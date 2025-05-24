/*
  # Add comprehensive game rules validation
  
  1. Changes
    - Add trump validation function
    - Add bidding validation
    - Add trick-taking rules
    - Add game state validation
    
  2. Security
    - Maintain existing RLS policies
    - Add validation for all game actions
*/

-- Trump validation function
CREATE OR REPLACE FUNCTION validate_trump_declaration(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_trump_suit CHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_player_hand TEXT[];
  v_suit_count INTEGER;
BEGIN
  -- Get player's hand
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(player_hands->p_player_name)
    FROM game_state
    WHERE id = p_game_id
  ) INTO v_player_hand;
  
  -- Count cards of declared suit
  SELECT COUNT(*)
  INTO v_suit_count
  FROM unnest(v_player_hand) AS card
  WHERE RIGHT(card, 1) = p_trump_suit;
  
  -- Need at least 5 cards of the suit to declare it
  RETURN v_suit_count >= 5;
END;
$$ LANGUAGE plpgsql;

-- Bidding validation function
CREATE OR REPLACE FUNCTION validate_bidding_action(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_action VARCHAR(20),
  p_trump_suit CHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_player INTEGER;
  v_player_position INTEGER;
  v_phase VARCHAR(20);
BEGIN
  -- Get current game state
  SELECT 
    current_player,
    current_phase,
    player_position
  INTO v_current_player, v_phase, v_player_position
  FROM game_state
  JOIN lobby_players ON lobby_players.lobby_id = game_state.lobby_id
  WHERE game_state.id = p_game_id
  AND lobby_players.player_name = p_player_name;
  
  -- Check if it's bidding phase
  IF v_phase != 'bidding' THEN
    RETURN FALSE;
  END IF;
  
  -- Check if it's player's turn
  IF v_current_player != v_player_position THEN
    RETURN FALSE;
  END IF;
  
  -- For trump declaration, validate the suit
  IF p_action = 'declare_trump' AND p_trump_suit IS NOT NULL THEN
    RETURN validate_trump_declaration(p_game_id, p_player_name, p_trump_suit);
  END IF;
  
  -- Passing is always valid during bidding
  IF p_action = 'pass' THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to handle bidding phase
CREATE OR REPLACE FUNCTION process_bidding_action(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_action VARCHAR(20),
  p_trump_suit CHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_next_player INTEGER;
  v_player_count INTEGER;
  v_current_player INTEGER;
  v_pass_count INTEGER;
BEGIN
  -- Validate action
  IF NOT validate_bidding_action(p_game_id, p_player_name, p_action, p_trump_suit) THEN
    RAISE EXCEPTION 'Invalid bidding action';
  END IF;
  
  -- Get current game state
  SELECT 
    current_player,
    (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = game_state.lobby_id)
  INTO v_current_player, v_player_count
  FROM game_state
  WHERE id = p_game_id;
  
  -- Handle trump declaration
  IF p_action = 'declare_trump' THEN
    UPDATE game_state
    SET 
      trump_suit = p_trump_suit,
      trump_declarer = p_player_name,
      current_phase = 'playing',
      current_player = v_current_player
    WHERE id = p_game_id;
    
    -- Add system message
    INSERT INTO chat_messages (
      lobby_id,
      message,
      message_type
    ) VALUES (
      (SELECT lobby_id FROM game_state WHERE id = p_game_id),
      p_player_name || ' declared ' || 
      CASE p_trump_suit
        WHEN 'H' THEN 'Hearts'
        WHEN 'D' THEN 'Diamonds'
        WHEN 'C' THEN 'Clubs'
        WHEN 'S' THEN 'Spades'
      END || ' as trump',
      'system'
    );
  
  -- Handle pass
  ELSE
    -- Move to next player
    v_next_player := (v_current_player + 1) % v_player_count;
    
    -- Update pass count
    UPDATE game_state
    SET 
      current_player = v_next_player
    WHERE id = p_game_id;
    
    -- Add system message
    INSERT INTO chat_messages (
      lobby_id,
      message,
      message_type
    ) VALUES (
      (SELECT lobby_id FROM game_state WHERE id = p_game_id),
      p_player_name || ' passed',
      'system'
    );
  END IF;
  
  -- Return updated game state
  RETURN (
    SELECT jsonb_build_object(
      'current_phase', current_phase,
      'current_player', current_player,
      'trump_suit', trump_suit,
      'trump_declarer', trump_declarer
    )
    FROM game_state
    WHERE id = p_game_id
  );
END;
$$ LANGUAGE plpgsql;

-- Update play_card function to use comprehensive validation
CREATE OR REPLACE FUNCTION validate_card_play(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_card TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_game_state JSONB;
  v_player_hand TEXT[];
  v_first_card TEXT;
  v_first_suit CHAR;
  v_card_suit CHAR;
  v_has_suit BOOLEAN;
  v_is_permanent_trump BOOLEAN;
BEGIN
  -- Get current game state
  SELECT 
    jsonb_build_object(
      'player_hands', player_hands,
      'table_cards', table_cards,
      'trump_suit', trump_suit,
      'current_phase', current_phase
    )
  INTO v_game_state
  FROM game_state
  WHERE id = p_game_id;

  -- Check if it's playing phase
  IF v_game_state->>'current_phase' != 'playing' THEN
    RETURN FALSE;
  END IF;

  -- Get player's hand
  v_player_hand := ARRAY(
    SELECT jsonb_array_elements_text(v_game_state->'player_hands'->p_player_name)
  );

  -- Check if player has the card
  IF NOT p_card = ANY(v_player_hand) THEN
    RETURN FALSE;
  END IF;

  -- Check if card is a permanent trump
  v_is_permanent_trump := p_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD');

  -- If no cards on table, any card is valid
  IF jsonb_object_keys(v_game_state->'table_cards') = '{}' THEN
    RETURN TRUE;
  END IF;

  -- Get first card played in trick
  SELECT value INTO v_first_card
  FROM jsonb_each_text(v_game_state->'table_cards')
  LIMIT 1;

  -- Extract suits
  v_first_suit := RIGHT(v_first_card, 1);
  v_card_suit := RIGHT(p_card, 1);

  -- If first card is permanent trump, must play permanent trump if available
  IF v_first_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD') THEN
    -- Check if player has any permanent trumps
    v_has_suit := EXISTS (
      SELECT 1 
      FROM unnest(v_player_hand) AS card 
      WHERE card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')
    );
    
    -- Must play permanent trump if available
    IF v_has_suit AND NOT v_is_permanent_trump THEN
      RETURN FALSE;
    END IF;
    
    RETURN TRUE;
  END IF;

  -- Check if player has any cards of the led suit
  v_has_suit := EXISTS (
    SELECT 1 
    FROM unnest(v_player_hand) AS card 
    WHERE RIGHT(card, 1) = v_first_suit
  );

  -- If player has the led suit, they must play it
  IF v_has_suit AND v_card_suit != v_first_suit AND NOT v_is_permanent_trump THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add function to check for game end conditions
CREATE OR REPLACE FUNCTION check_game_end(
  p_game_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_scores JSONB;
  v_has_winner BOOLEAN;
BEGIN
  -- Get current scores
  SELECT scores INTO v_scores
  FROM game_state
  WHERE id = p_game_id;
  
  -- Check if any player/team has reached 0 or below
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_each_text(v_scores) AS s(player_name, score)
    WHERE score::INTEGER <= 0
  ) INTO v_has_winner;
  
  RETURN v_has_winner;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_state_status ON game_state(status);
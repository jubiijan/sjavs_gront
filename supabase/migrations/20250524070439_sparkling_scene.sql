/*
  # Fix Card Validation and Game Rules
  
  1. Changes
    - Fix permanent trump validation
    - Correct suit following rules
    - Fix trick evaluation hierarchy
    - Add proper 3-player handling
    
  2. Security
    - Maintain transaction safety
    - Preserve game state consistency
*/

-- Fix card validation function
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
  v_has_permanent_trump BOOLEAN;
BEGIN
  -- Get current game state
  SELECT 
    jsonb_build_object(
      'player_hands', player_hands,
      'table_cards', table_cards,
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

  -- If no cards on table, any card is valid
  IF jsonb_object_length(v_game_state->'table_cards') = 0 THEN
    RETURN TRUE;
  END IF;

  -- Get first card played
  SELECT value INTO v_first_card
  FROM jsonb_each_text(v_game_state->'table_cards')
  ORDER BY key
  LIMIT 1;

  -- Check if first card is a permanent trump
  IF v_first_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD') THEN
    -- Check if player has any permanent trumps
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_player_hand) AS card
      WHERE card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')
    ) INTO v_has_permanent_trump;

    -- Must play permanent trump if available
    IF v_has_permanent_trump AND NOT (p_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')) THEN
      RETURN FALSE;
    END IF;

    RETURN TRUE;
  END IF;

  -- For regular cards, follow suit if possible
  v_first_suit := RIGHT(v_first_card, 1);
  v_card_suit := RIGHT(p_card, 1);

  -- Check if player has any cards of the led suit (excluding permanent trumps)
  SELECT EXISTS (
    SELECT 1 FROM unnest(v_player_hand) AS card
    WHERE RIGHT(card, 1) = v_first_suit
    AND card NOT IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')
  ) INTO v_has_suit;

  -- If player has the led suit, they must play it (unless playing permanent trump)
  IF v_has_suit AND v_card_suit != v_first_suit AND NOT (p_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fix trump declaration validation
CREATE OR REPLACE FUNCTION validate_trump_declaration(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_trump_suit CHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_player_hand TEXT[];
  v_suit_count INTEGER;
  v_permanent_trump_count INTEGER;
BEGIN
  -- Get player's hand
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(player_hands->p_player_name)
    FROM game_state
    WHERE id = p_game_id
  ) INTO v_player_hand;

  -- Count regular cards of declared suit (excluding permanent trumps)
  SELECT COUNT(*)
  INTO v_suit_count
  FROM unnest(v_player_hand) AS card
  WHERE RIGHT(card, 1) = p_trump_suit
  AND card NOT IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD');

  -- Count permanent trumps of the same suit
  SELECT COUNT(*)
  INTO v_permanent_trump_count
  FROM unnest(v_player_hand) AS card
  WHERE card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')
  AND RIGHT(card, 1) = p_trump_suit;

  -- Need at least 5 cards total (regular suit + permanent trumps)
  RETURN (v_suit_count + v_permanent_trump_count) >= 5;
END;
$$ LANGUAGE plpgsql;

-- Fix 3-player deck generation
CREATE OR REPLACE FUNCTION generate_deck_for_players(
  p_player_count INTEGER
) RETURNS TEXT[] AS $$
DECLARE
  v_deck TEXT[];
BEGIN
  IF p_player_count = 3 THEN
    -- For 3 players, remove diamonds but keep permanent trumps J♥ and J♦
    v_deck := ARRAY[
      '7H','8H','9H','10H','JH','QH','KH','AH',  -- Keep J♥
      '7C','8C','9C','10C','JC','QC','KC','AC',
      '7S','8S','9S','10S','JS','QS','KS','AS',
      'JD'  -- Keep J♦ as permanent trump
    ];
  ELSE
    -- For 4 players, use full 32-card deck
    v_deck := ARRAY[
      '7H','8H','9H','10H','JH','QH','KH','AH',
      '7D','8D','9D','10D','JD','QD','KD','AD',
      '7C','8C','9C','10C','JC','QC','KC','AC',
      '7S','8S','9S','10S','JS','QS','KS','AS'
    ];
  END IF;
  
  RETURN v_deck;
END;
$$ LANGUAGE plpgsql;

-- Add proper bidding phase completion check
CREATE OR REPLACE FUNCTION check_bidding_completion(
  p_game_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_player_count INTEGER;
  v_pass_count INTEGER;
BEGIN
  -- Get player count
  SELECT COUNT(*) INTO v_player_count
  FROM lobby_players
  WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id);
  
  -- Count recent passes
  SELECT COUNT(*) INTO v_pass_count
  FROM chat_messages
  WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
  AND message LIKE '% passed'
  AND message_type = 'system'
  AND created_at > (
    SELECT MAX(created_at)
    FROM chat_messages
    WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
    AND message LIKE '% declared % as trump'
    AND message_type = 'system'
  );
  
  -- All players must pass for bidding to fail
  RETURN v_pass_count >= v_player_count;
END;
$$ LANGUAGE plpgsql;

-- Add atomic action processing with proper locking
CREATE OR REPLACE FUNCTION process_game_action_atomic(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_action_type VARCHAR(20),
  p_action_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_lock_key BIGINT;
BEGIN
  -- Generate consistent lock key from game_id
  v_lock_key := ('x' || substr(md5(p_game_id::text), 1, 16))::bit(64)::bigint;
  
  -- Acquire advisory lock
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'Game is busy, please try again';
  END IF;
  
  -- Process action within transaction
  BEGIN
    CASE p_action_type
      WHEN 'play_card' THEN
        v_result := play_card(p_game_id, p_player_name, p_action_data->>'card');
      WHEN 'declare_trump' THEN
        v_result := process_bidding_action(
          p_game_id, 
          p_player_name, 
          'declare_trump', 
          (p_action_data->>'suit')::CHAR
        );
      WHEN 'pass' THEN
        v_result := process_bidding_action(p_game_id, p_player_name, 'pass');
      ELSE
        RAISE EXCEPTION 'Unknown action type: %', p_action_type;
    END CASE;

    RETURN v_result;
  EXCEPTION WHEN OTHERS THEN
    -- Ensure lock is released on error
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
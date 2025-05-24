/*
  # Fix Trump Declaration Validation

  1. New Functions
    - is_permanent_trump: Checks if a card is a permanent trump
    - count_suit_cards: Counts cards of a suit excluding permanent trumps
    - validate_trump_declaration: Validates if a player can declare a suit as trump

  2. Changes
    - Improved suit counting logic
    - Proper handling of permanent trumps
    - Better validation for trump declaration
*/

-- Function to check if a card is a permanent trump
CREATE OR REPLACE FUNCTION is_permanent_trump(p_card TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD');
END;
$$;

-- Function to count cards of a suit excluding permanent trumps
CREATE OR REPLACE FUNCTION count_suit_cards(
  p_hand TEXT[],
  p_suit CHAR
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INTEGER := 0;
  v_card TEXT;
BEGIN
  FOREACH v_card IN ARRAY p_hand
  LOOP
    -- Count card if it matches suit and is not a permanent trump
    IF RIGHT(v_card, 1) = p_suit AND NOT is_permanent_trump(v_card) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Function to validate trump declaration
CREATE OR REPLACE FUNCTION validate_trump_declaration(
  p_game_id UUID,
  p_player_name TEXT,
  p_trump_suit CHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_player_hand TEXT[];
  v_suit_count INTEGER;
  v_player_count INTEGER;
  v_permanent_trumps INTEGER;
BEGIN
  -- Get player's hand
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(player_hands->p_player_name)
  )
  INTO v_player_hand
  FROM game_state
  WHERE id = p_game_id;

  -- Get number of players
  SELECT COUNT(*)
  INTO v_player_count
  FROM lobby_players
  WHERE lobby_id = (
    SELECT lobby_id 
    FROM game_state 
    WHERE id = p_game_id
  );

  -- Count regular cards of the suit
  v_suit_count := count_suit_cards(v_player_hand, p_trump_suit);

  -- Count permanent trumps in hand
  SELECT COUNT(*)
  INTO v_permanent_trumps
  FROM unnest(v_player_hand) AS card
  WHERE is_permanent_trump(card);

  -- Validation rules:
  -- 1. Need at least 5 cards of the suit (excluding permanent trumps)
  -- 2. For 3-player game (no diamonds), need at least 4 cards
  RETURN (
    (v_player_count = 4 AND v_suit_count >= 5) OR
    (v_player_count = 3 AND v_suit_count >= 4)
  );
END;
$$;

-- Update the declare_trump function to use new validation
CREATE OR REPLACE FUNCTION declare_trump(
  p_game_id UUID,
  p_player_name TEXT,
  p_trump_suit CHAR
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_valid BOOLEAN;
  v_current_phase TEXT;
  v_current_player INTEGER;
  v_player_position INTEGER;
BEGIN
  -- Get current game state
  SELECT 
    current_phase,
    current_player
  INTO v_current_phase, v_current_player
  FROM game_state
  WHERE id = p_game_id;

  -- Get player position
  SELECT player_position
  INTO v_player_position
  FROM lobby_players
  WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
  AND player_name = p_player_name;

  -- Validate phase and turn
  IF v_current_phase != 'bidding' THEN
    RAISE EXCEPTION 'Can only declare trump during bidding phase';
  END IF;

  IF v_current_player != v_player_position THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Validate trump declaration
  SELECT validate_trump_declaration(p_game_id, p_player_name, p_trump_suit)
  INTO v_is_valid;

  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'Invalid trump declaration';
  END IF;

  -- Update game state
  UPDATE game_state
  SET 
    trump_suit = p_trump_suit,
    trump_declarer = p_player_name,
    current_phase = 'playing',
    current_player = v_player_position
  WHERE id = p_game_id;

  -- Return updated game state
  RETURN (
    SELECT jsonb_build_object(
      'trump_suit', trump_suit,
      'trump_declarer', trump_declarer,
      'current_phase', current_phase,
      'current_player', current_player
    )
    FROM game_state
    WHERE id = p_game_id
  );
END;
$$;
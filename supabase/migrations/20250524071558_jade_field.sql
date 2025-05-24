/*
  # Fix 3-player variant and permanent trump handling
  
  1. Changes
    - Remove J♦ from permanent trumps in 3-player mode
    - Adjust deck generation for 3-player games
    - Update card validation and evaluation logic
    
  2. Security
    - Maintain existing security model
    - No changes to permissions
*/

-- Update deck generation for 3-player mode
CREATE OR REPLACE FUNCTION generate_deck_for_players(
  p_player_count INTEGER
) RETURNS TEXT[] AS $$
DECLARE
  v_deck TEXT[];
BEGIN
  IF p_player_count = 3 THEN
    -- For 3 players, remove all diamonds including J♦
    -- Keep only Hearts, Clubs, and Spades
    v_deck := ARRAY[
      '7H','8H','9H','10H','JH','QH','KH','AH',
      '7C','8C','9C','10C','JC','QC','KC','AC',
      '7S','8S','9S','10S','JS','QS','KS','AS'
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

-- Update permanent trump validation for 3-player mode
CREATE OR REPLACE FUNCTION is_permanent_trump(
  p_card TEXT,
  p_player_count INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN CASE 
    WHEN p_player_count = 3 THEN
      -- In 3-player mode, J♦ is not a permanent trump
      p_card IN ('QC', 'QS', 'JC', 'JS', 'JH')
    ELSE
      -- In 4-player mode, all permanent trumps apply
      p_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')
  END;
END;
$$ LANGUAGE plpgsql;

-- Update card value calculation for 3-player mode
CREATE OR REPLACE FUNCTION get_card_value(
  p_card TEXT,
  p_trump_suit CHAR,
  p_first_suit CHAR,
  p_player_count INTEGER
) RETURNS INTEGER AS $$
BEGIN
  -- Get permanent trump value based on game mode
  IF is_permanent_trump(p_card, p_player_count) THEN
    RETURN CASE p_card
      WHEN 'QC' THEN 1000  -- Queen of Clubs (highest)
      WHEN 'QS' THEN 900   -- Queen of Spades  
      WHEN 'JC' THEN 800   -- Jack of Clubs
      WHEN 'JS' THEN 700   -- Jack of Spades
      WHEN 'JH' THEN 600   -- Jack of Hearts
      WHEN 'JD' THEN 500   -- Jack of Diamonds (only in 4-player)
    END;
  END IF;

  -- Regular cards
  RETURN CASE RIGHT(p_card, -1)  -- Get rank
    WHEN 'A' THEN 14
    WHEN 'K' THEN 13
    WHEN 'Q' THEN 12
    WHEN 'J' THEN 11
    WHEN '10' THEN 10
    ELSE LEFT(p_card, -1)::INTEGER
  END +
  CASE 
    -- Trump suit cards get bonus points
    WHEN RIGHT(p_card, 1) = p_trump_suit THEN 100
    -- Cards that don't follow first suit are worthless (unless trump)
    WHEN p_first_suit IS NOT NULL AND RIGHT(p_card, 1) != p_first_suit THEN -1000
    ELSE 0
  END;
END;
$$ LANGUAGE plpgsql;

-- Update trick evaluation for 3-player mode
CREATE OR REPLACE FUNCTION evaluate_trick(
  p_game_id UUID
) RETURNS TABLE(winner_name VARCHAR(50), points_won INTEGER) AS $$
DECLARE
  v_game_state JSONB;
  v_trump_suit CHAR;
  v_winning_card TEXT;
  v_winning_player VARCHAR(50);
  v_first_suit CHAR;
  v_points INTEGER := 0;
  v_player_count INTEGER;
  card_data RECORD;
BEGIN
  -- Get current game state and player count
  SELECT 
    jsonb_build_object(
      'table_cards', table_cards,
      'trump_suit', trump_suit
    ),
    (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = game_state.lobby_id)
  INTO v_game_state, v_player_count
  FROM game_state
  WHERE id = p_game_id;

  v_trump_suit := (v_game_state->>'trump_suit')::CHAR;

  -- Get first card to determine led suit
  SELECT key, value INTO v_winning_player, v_winning_card
  FROM jsonb_each_text(v_game_state->'table_cards')
  ORDER BY key
  LIMIT 1;

  -- Determine first suit (permanent trumps don't set suit for following)
  v_first_suit := CASE 
    WHEN is_permanent_trump(v_winning_card, v_player_count) THEN NULL
    ELSE RIGHT(v_winning_card, 1)
  END;

  -- Compare each card to find winner
  FOR card_data IN 
    SELECT key AS player_name, value AS card
    FROM jsonb_each_text(v_game_state->'table_cards')
  LOOP
    IF get_card_value(card_data.card, v_trump_suit, v_first_suit, v_player_count) > 
       get_card_value(v_winning_card, v_trump_suit, v_first_suit, v_player_count) THEN
      v_winning_card := card_data.card;
      v_winning_player := card_data.player_name;
    END IF;
  END LOOP;

  -- Calculate points (1 point per card in trick)
  v_points := jsonb_object_length(v_game_state->'table_cards');

  RETURN QUERY SELECT v_winning_player::VARCHAR(50), v_points::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Update card validation for 3-player mode
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
  v_trump_suit CHAR;
  v_has_led_suit BOOLEAN;
  v_has_permanent_trump BOOLEAN;
  v_player_count INTEGER;
BEGIN
  -- Get current game state and player count
  SELECT 
    jsonb_build_object(
      'player_hands', player_hands,
      'table_cards', table_cards,
      'current_phase', current_phase,
      'trump_suit', trump_suit
    ),
    (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = game_state.lobby_id)
  INTO v_game_state, v_player_count
  FROM game_state
  WHERE id = p_game_id;

  -- Basic validations
  IF v_game_state->>'current_phase' != 'playing' THEN
    RETURN FALSE;
  END IF;

  v_trump_suit := (v_game_state->>'trump_suit')::CHAR;
  
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

  -- Check if first card is permanent trump
  IF is_permanent_trump(v_first_card, v_player_count) THEN
    -- Check if player has any permanent trumps
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_player_hand) AS card
      WHERE is_permanent_trump(card, v_player_count)
    ) INTO v_has_permanent_trump;

    -- Must play permanent trump if available
    IF v_has_permanent_trump AND NOT is_permanent_trump(p_card, v_player_count) THEN
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
    AND NOT is_permanent_trump(card, v_player_count)
  ) INTO v_has_led_suit;

  -- Must follow led suit if possible (permanent trumps can always be played)
  IF v_has_led_suit AND v_card_suit != v_first_suit AND NOT is_permanent_trump(p_card, v_player_count) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
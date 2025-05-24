/*
  # Add Sjaus-specific game rules
  
  1. Changes
    - Add permanent trump validation
    - Update trick evaluation with proper trump hierarchy
    - Add bidding phase validation
    
  2. Security
    - Maintain existing security model
    - Add validation for all game actions
*/

-- Update validate_card_play to handle permanent trumps
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
  IF jsonb_object_keys(v_game_state->'table_cards') = '{}' THEN
    RETURN TRUE;
  END IF;

  -- Get first card played
  SELECT value INTO v_first_card
  FROM jsonb_each_text(v_game_state->'table_cards')
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

  -- Check if player has any cards of the led suit
  SELECT EXISTS (
    SELECT 1 FROM unnest(v_player_hand) AS card
    WHERE RIGHT(card, 1) = v_first_suit
  ) INTO v_has_suit;

  -- If player has the led suit, they must play it (unless playing permanent trump)
  IF v_has_suit AND v_card_suit != v_first_suit AND NOT (p_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update evaluate_trick to handle permanent trumps
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
  card_data RECORD;
BEGIN
  -- Get current game state
  SELECT 
    jsonb_build_object(
      'table_cards', table_cards,
      'trump_suit', trump_suit
    )
  INTO v_game_state
  FROM game_state
  WHERE id = p_game_id;

  v_trump_suit := v_game_state->>'trump_suit';

  -- Get first card played
  SELECT key, value INTO v_winning_player, v_winning_card
  FROM jsonb_each_text(v_game_state->'table_cards')
  LIMIT 1;

  v_first_suit := RIGHT(v_winning_card, 1);

  -- Iterate through each card
  FOR card_data IN 
    SELECT key AS player_name, value AS card
    FROM jsonb_each_text(v_game_state->'table_cards')
  LOOP
    DECLARE
      curr_value INTEGER;
      win_value INTEGER;
    BEGIN
      -- Assign values based on permanent trump hierarchy
      curr_value := 
        CASE card_data.card
          WHEN 'QC' THEN 600  -- Queen of Clubs (highest)
          WHEN 'QS' THEN 500  -- Queen of Spades
          WHEN 'JC' THEN 400  -- Jack of Clubs
          WHEN 'JS' THEN 300  -- Jack of Spades
          WHEN 'JH' THEN 200  -- Jack of Hearts
          WHEN 'JD' THEN 100  -- Jack of Diamonds
          ELSE
            CASE RIGHT(card_data.card, -1)
              WHEN 'A' THEN 14
              WHEN 'K' THEN 13
              WHEN 'Q' THEN 12
              WHEN 'J' THEN 11
              WHEN '10' THEN 10
              ELSE LEFT(card_data.card, -1)::INTEGER
            END +
            CASE 
              WHEN RIGHT(card_data.card, 1) = v_trump_suit THEN 50
              WHEN RIGHT(card_data.card, 1) != v_first_suit THEN 0
              ELSE 0
            END
        END;

      win_value := 
        CASE v_winning_card
          WHEN 'QC' THEN 600
          WHEN 'QS' THEN 500
          WHEN 'JC' THEN 400
          WHEN 'JS' THEN 300
          WHEN 'JH' THEN 200
          WHEN 'JD' THEN 100
          ELSE
            CASE RIGHT(v_winning_card, -1)
              WHEN 'A' THEN 14
              WHEN 'K' THEN 13
              WHEN 'Q' THEN 12
              WHEN 'J' THEN 11
              WHEN '10' THEN 10
              ELSE LEFT(v_winning_card, -1)::INTEGER
            END +
            CASE 
              WHEN RIGHT(v_winning_card, 1) = v_trump_suit THEN 50
              WHEN RIGHT(v_winning_card, 1) != v_first_suit THEN 0
              ELSE 0
            END
        END;

      -- Update winner if current card is higher
      IF curr_value > win_value THEN
        v_winning_card := card_data.card;
        v_winning_player := card_data.player_name;
      END IF;
    END;
  END LOOP;

  -- Calculate points won (1 point per card)
  v_points := (
    SELECT COUNT(*)
    FROM jsonb_each_text(v_game_state->'table_cards')
  );

  RETURN QUERY SELECT v_winning_player::VARCHAR(50), v_points::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Add function to validate trump declaration
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

  -- Count regular cards of declared suit
  SELECT COUNT(*)
  INTO v_suit_count
  FROM unnest(v_player_hand) AS card
  WHERE RIGHT(card, 1) = p_trump_suit
  AND card NOT IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD');

  -- Count permanent trumps of declared suit
  SELECT COUNT(*)
  INTO v_permanent_trump_count
  FROM unnest(v_player_hand) AS card
  WHERE card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')
  AND RIGHT(card, 1) = p_trump_suit;

  -- Need at least 5 cards of the suit (including permanent trumps)
  RETURN (v_suit_count + v_permanent_trump_count) >= 5;
END;
$$ LANGUAGE plpgsql;
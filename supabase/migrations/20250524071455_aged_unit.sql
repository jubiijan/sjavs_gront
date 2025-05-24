/*
  # Fix trick evaluation function
  
  1. Changes
    - Fix permanent trump hierarchy
    - Properly handle regular trump suit
    - Add clear card value calculation
    
  2. Security
    - Maintain existing transaction safety
    - No changes to permissions
*/

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

  v_trump_suit := (v_game_state->>'trump_suit')::CHAR;

  -- Get first card to determine led suit
  SELECT key, value INTO v_winning_player, v_winning_card
  FROM jsonb_each_text(v_game_state->'table_cards')
  ORDER BY key
  LIMIT 1;

  -- Determine first suit (permanent trumps don't set suit for following)
  v_first_suit := CASE 
    WHEN v_winning_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD') THEN NULL
    ELSE RIGHT(v_winning_card, 1)
  END;

  -- Compare each card to find winner
  FOR card_data IN 
    SELECT key AS player_name, value AS card
    FROM jsonb_each_text(v_game_state->'table_cards')
  LOOP
    IF get_card_value(card_data.card, v_trump_suit, v_first_suit) > 
       get_card_value(v_winning_card, v_trump_suit, v_first_suit) THEN
      v_winning_card := card_data.card;
      v_winning_player := card_data.player_name;
    END IF;
  END LOOP;

  -- Calculate points (1 point per card in trick)
  v_points := jsonb_object_length(v_game_state->'table_cards');

  RETURN QUERY SELECT v_winning_player::VARCHAR(50), v_points::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Helper function to get card value for comparison
CREATE OR REPLACE FUNCTION get_card_value(
  p_card TEXT,
  p_trump_suit CHAR,
  p_first_suit CHAR
) RETURNS INTEGER AS $$
BEGIN
  -- Permanent trumps have fixed hierarchy (highest values)
  RETURN CASE p_card
    WHEN 'QC' THEN 1000  -- Queen of Clubs (highest)
    WHEN 'QS' THEN 900   -- Queen of Spades  
    WHEN 'JC' THEN 800   -- Jack of Clubs
    WHEN 'JS' THEN 700   -- Jack of Spades
    WHEN 'JH' THEN 600   -- Jack of Hearts
    WHEN 'JD' THEN 500   -- Jack of Diamonds (lowest permanent trump)
    ELSE
      -- Regular cards
      CASE RIGHT(p_card, -1)  -- Get rank
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
      END
  END;
END;
$$ LANGUAGE plpgsql;
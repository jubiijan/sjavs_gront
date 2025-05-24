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
  v_trump_suit CHAR;
  v_has_led_suit BOOLEAN;
  v_has_trump_suit BOOLEAN;
  v_has_permanent_trump BOOLEAN;
  v_is_card_permanent_trump BOOLEAN;
  v_is_first_permanent_trump BOOLEAN;
BEGIN
  -- Get current game state
  SELECT 
    jsonb_build_object(
      'player_hands', player_hands,
      'table_cards', table_cards,
      'current_phase', current_phase,
      'trump_suit', trump_suit
    )
  INTO v_game_state
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

  -- Check if played card is permanent trump
  v_is_card_permanent_trump := p_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD');

  -- If no cards on table, any card is valid
  IF jsonb_object_length(v_game_state->'table_cards') = 0 THEN
    RETURN TRUE;
  END IF;

  -- Get first card played in this trick
  SELECT value INTO v_first_card
  FROM jsonb_each_text(v_game_state->'table_cards')
  ORDER BY key  -- Ensure consistent ordering
  LIMIT 1;

  v_first_suit := RIGHT(v_first_card, 1);
  v_is_first_permanent_trump := v_first_card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD');

  -- Check what suits player has
  SELECT 
    EXISTS(SELECT 1 FROM unnest(v_player_hand) AS card 
           WHERE RIGHT(card, 1) = v_first_suit 
           AND card NOT IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')),
    EXISTS(SELECT 1 FROM unnest(v_player_hand) AS card 
           WHERE RIGHT(card, 1) = v_trump_suit 
           AND card NOT IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')),
    EXISTS(SELECT 1 FROM unnest(v_player_hand) AS card 
           WHERE card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD'))
  INTO v_has_led_suit, v_has_trump_suit, v_has_permanent_trump;

  -- Permanent trump rules
  IF v_is_first_permanent_trump THEN
    -- If first card is permanent trump, must play permanent trump if available
    IF v_has_permanent_trump AND NOT v_is_card_permanent_trump THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  -- Regular suit following rules
  v_card_suit := RIGHT(p_card, 1);
  
  -- Must follow led suit if possible (permanent trumps can always be played)
  IF v_has_led_suit AND v_card_suit != v_first_suit AND NOT v_is_card_permanent_trump THEN
    RETURN FALSE;
  END IF;

  -- If can't follow suit, any card is valid (including trumps)
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
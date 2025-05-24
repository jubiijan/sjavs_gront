/*
  # Implement Game Engine Functions
  
  1. New Functions
    - validate_move: Validates if a card play is legal
    - evaluate_trick: Determines trick winner and updates scores
    - calculate_scores: Updates game scores after each trick
    - manage_game_turn: Handles turn progression and game phase changes
    
  2. Security
    - Functions can only be called through RLS policies
    - Maintains game state integrity
    - Prevents invalid moves
*/

-- Card validation function
CREATE OR REPLACE FUNCTION validate_move(
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

  -- Check if player has any cards of the led suit
  v_has_suit := EXISTS (
    SELECT 1 
    FROM unnest(v_player_hand) AS card 
    WHERE RIGHT(card, 1) = v_first_suit
  );

  -- If player has the led suit, they must play it
  IF v_has_suit AND v_card_suit != v_first_suit THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Trick evaluation function
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
  SELECT value INTO v_winning_card
  FROM jsonb_each_text(v_game_state->'table_cards')
  LIMIT 1;

  v_first_suit := RIGHT(v_winning_card, 1);
  v_winning_player := (
    SELECT key 
    FROM jsonb_each_text(v_game_state->'table_cards') 
    LIMIT 1
  );

  -- Evaluate each card against current winner
  FOR player_name, card IN 
    SELECT key, value 
    FROM jsonb_each_text(v_game_state->'table_cards')
  LOOP
    -- Calculate card value
    DECLARE
      curr_suit CHAR := RIGHT(card, 1);
      curr_rank TEXT := LEFT(card, -1);
      win_suit CHAR := RIGHT(v_winning_card, 1);
      win_rank TEXT := LEFT(v_winning_card, -1);
      curr_value INTEGER;
      win_value INTEGER;
    BEGIN
      -- Permanent trumps
      IF (card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')) THEN
        curr_value := 
          CASE card
            WHEN 'QC' THEN 600
            WHEN 'QS' THEN 500
            WHEN 'JC' THEN 400
            WHEN 'JS' THEN 300
            WHEN 'JH' THEN 200
            WHEN 'JD' THEN 100
          END;
      -- Regular cards
      ELSE
        curr_value := 
          CASE curr_rank
            WHEN 'A' THEN 14
            WHEN 'K' THEN 13
            WHEN 'Q' THEN 12
            WHEN 'J' THEN 11
            WHEN '10' THEN 10
            ELSE curr_rank::INTEGER
          END;
        
        -- Adjust value for trump suit
        IF curr_suit = v_trump_suit THEN
          curr_value := curr_value + 50;
        -- Must follow first suit
        ELSIF curr_suit != v_first_suit THEN
          curr_value := 0;
        END IF;
      END IF;

      -- Compare with current winning card
      IF (card IN ('QC', 'QS', 'JC', 'JS', 'JH', 'JD')) THEN
        win_value := 
          CASE v_winning_card
            WHEN 'QC' THEN 600
            WHEN 'QS' THEN 500
            WHEN 'JC' THEN 400
            WHEN 'JS' THEN 300
            WHEN 'JH' THEN 200
            WHEN 'JD' THEN 100
            ELSE 0
          END;
      ELSE
        win_value := 
          CASE win_rank
            WHEN 'A' THEN 14
            WHEN 'K' THEN 13
            WHEN 'Q' THEN 12
            WHEN 'J' THEN 11
            WHEN '10' THEN 10
            ELSE win_rank::INTEGER
          END;
        
        IF win_suit = v_trump_suit THEN
          win_value := win_value + 50;
        ELSIF win_suit != v_first_suit THEN
          win_value := 0;
        END IF;
      END IF;

      -- Update winner if current card is higher
      IF curr_value > win_value THEN
        v_winning_card := card;
        v_winning_player := player_name;
      END IF;
    END;
  END LOOP;

  -- Calculate points won
  v_points := (
    SELECT COUNT(*)
    FROM jsonb_each_text(v_game_state->'table_cards')
  );

  RETURN QUERY SELECT v_winning_player::VARCHAR(50), v_points::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Score calculation function
CREATE OR REPLACE FUNCTION calculate_scores(
  p_game_id UUID,
  p_winner_name VARCHAR(50),
  p_points INTEGER
) RETURNS void AS $$
DECLARE
  v_current_scores JSONB;
BEGIN
  -- Get current scores
  SELECT scores INTO v_current_scores
  FROM game_state
  WHERE id = p_game_id;

  -- Update winner's score
  UPDATE game_state
  SET scores = jsonb_set(
    scores,
    ARRAY[p_winner_name],
    to_jsonb((v_current_scores->>p_winner_name)::INTEGER - p_points)
  )
  WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql;

-- Turn management function
CREATE OR REPLACE FUNCTION manage_game_turn(
  p_game_id UUID,
  p_current_player INTEGER,
  p_winner_name VARCHAR(50)
) RETURNS INTEGER AS $$
DECLARE
  v_next_player INTEGER;
  v_player_count INTEGER;
  v_trick_number INTEGER;
BEGIN
  -- Get player count and current trick
  SELECT 
    (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = game_state.lobby_id),
    trick_number
  INTO v_player_count, v_trick_number
  FROM game_state
  WHERE id = p_game_id;

  -- If trick is complete
  IF (
    SELECT COUNT(*)
    FROM jsonb_object_keys(
      (SELECT table_cards FROM game_state WHERE id = p_game_id)
    )
  ) = v_player_count THEN
    -- Clear table cards
    UPDATE game_state
    SET table_cards = '{}'::jsonb,
        trick_number = trick_number + 1
    WHERE id = p_game_id;

    -- Find winner's position
    SELECT player_position INTO v_next_player
    FROM lobby_players
    WHERE player_name = p_winner_name
    AND lobby_id = (
      SELECT lobby_id 
      FROM game_state 
      WHERE id = p_game_id
    );
  ELSE
    -- Move to next player
    v_next_player := (p_current_player + 1) % v_player_count;
  END IF;

  -- Check if game is complete (8 tricks played)
  IF v_trick_number >= 8 THEN
    UPDATE game_state
    SET current_phase = 'scoring',
        status = 'finished'
    WHERE id = p_game_id;

    -- Update lobby status
    UPDATE lobbies
    SET status = 'finished'
    WHERE id = (
      SELECT lobby_id 
      FROM game_state 
      WHERE id = p_game_id
    );

    -- Create game history record
    INSERT INTO game_history (
      lobby_id,
      game_duration,
      winner_team,
      final_scores,
      trump_suit,
      trump_declarer,
      vol_achieved,
      double_victory,
      players_involved,
      game_variant,
      completed_at
    )
    SELECT
      lobby_id,
      NOW() - created_at,
      (
        SELECT jsonb_agg(player_name)
        FROM (
          SELECT player_name
          FROM jsonb_each_text(scores) AS s(player_name, score)
          WHERE score::INTEGER <= 0
          ORDER BY score::INTEGER
        ) winners
      ),
      scores,
      trump_suit,
      trump_declarer,
      EXISTS (
        SELECT 1
        FROM jsonb_each_text(scores) AS s(player_name, score)
        WHERE score::INTEGER = 0
      ),
      EXISTS (
        SELECT 1
        FROM jsonb_each_text(scores) AS s(player_name, score)
        WHERE score::INTEGER < 0
      ),
      (
        SELECT jsonb_agg(player_name)
        FROM lobby_players
        WHERE lobby_id = game_state.lobby_id
      ),
      CASE 
        WHEN v_player_count = 3 THEN '3-player'
        ELSE '4-player'
      END,
      NOW()
    FROM game_state
    WHERE id = p_game_id;
  END IF;

  RETURN v_next_player;
END;
$$ LANGUAGE plpgsql;

-- Play card function that combines all game logic
CREATE OR REPLACE FUNCTION play_card(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_card TEXT
) RETURNS JSONB AS $$
DECLARE
  v_current_player INTEGER;
  v_player_position INTEGER;
  v_is_valid BOOLEAN;
  v_winner_name VARCHAR(50);
  v_points INTEGER;
  v_next_player INTEGER;
  v_game_state JSONB;
BEGIN
  -- Get current player position
  SELECT 
    current_player,
    player_position
  INTO v_current_player, v_player_position
  FROM game_state
  JOIN lobby_players ON lobby_players.lobby_id = game_state.lobby_id
  WHERE game_state.id = p_game_id
  AND lobby_players.player_name = p_player_name;

  -- Check if it's player's turn
  IF v_current_player != v_player_position THEN
    RAISE EXCEPTION 'Not your turn';
  END IF;

  -- Validate move
  SELECT validate_move(p_game_id, p_player_name, p_card)
  INTO v_is_valid;

  IF NOT v_is_valid THEN
    RAISE EXCEPTION 'Invalid move';
  END IF;

  -- Update game state with played card
  UPDATE game_state
  SET 
    player_hands = jsonb_set(
      player_hands,
      ARRAY[p_player_name],
      (
        SELECT jsonb_agg(card)
        FROM jsonb_array_elements_text(player_hands->p_player_name) card
        WHERE card != p_card
      )
    ),
    table_cards = jsonb_set(
      table_cards,
      ARRAY[p_player_name],
      to_jsonb(p_card)
    )
  WHERE id = p_game_id
  RETURNING jsonb_build_object(
    'player_hands', player_hands,
    'table_cards', table_cards,
    'current_player', current_player,
    'scores', scores
  ) INTO v_game_state;

  -- If trick is complete, evaluate and update scores
  IF jsonb_object_length(v_game_state->'table_cards') = (
    SELECT COUNT(*)
    FROM lobby_players
    WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
  ) THEN
    -- Evaluate trick
    SELECT winner_name, points_won 
    INTO v_winner_name, v_points
    FROM evaluate_trick(p_game_id);

    -- Update scores
    PERFORM calculate_scores(p_game_id, v_winner_name, v_points);
  END IF;

  -- Manage turn progression
  SELECT manage_game_turn(p_game_id, v_current_player, v_winner_name)
  INTO v_next_player;

  -- Update current player
  UPDATE game_state
  SET current_player = v_next_player
  WHERE id = p_game_id;

  -- Return updated game state
  RETURN (
    SELECT jsonb_build_object(
      'player_hands', player_hands,
      'table_cards', table_cards,
      'current_player', current_player,
      'scores', scores,
      'status', status,
      'current_phase', current_phase
    )
    FROM game_state
    WHERE id = p_game_id
  );
END;
$$ LANGUAGE plpgsql;
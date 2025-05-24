-- Function to skip disconnected player's turn
CREATE OR REPLACE FUNCTION skip_player_turn(
  p_game_id UUID,
  p_player_name TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_player INTEGER;
  v_next_player INTEGER;
  v_player_count INTEGER;
  v_player_position INTEGER;
BEGIN
  -- Get current game state
  SELECT 
    current_player,
    get_player_count(id)
  INTO 
    v_current_player,
    v_player_count
  FROM game_state
  WHERE id = p_game_id;

  -- Get disconnected player's position
  SELECT player_position
  INTO v_player_position
  FROM lobby_players
  WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
  AND player_name = p_player_name;

  -- Only skip if it's actually this player's turn
  IF v_current_player = v_player_position THEN
    -- Calculate next player (clockwise)
    v_next_player := (v_current_player + 1) % v_player_count;

    -- Update game state
    UPDATE game_state
    SET 
      current_player = v_next_player,
      updated_at = now()
    WHERE id = p_game_id;

    -- Log the skip
    INSERT INTO system_logs (
      log_level,
      category,
      message,
      player_name,
      lobby_id,
      metadata
    ) VALUES (
      'INFO',
      'TURN_MANAGEMENT',
      'Skipped disconnected player''s turn',
      p_player_name,
      (SELECT lobby_id FROM game_state WHERE id = p_game_id),
      jsonb_build_object(
        'game_id', p_game_id,
        'skipped_position', v_player_position,
        'next_position', v_next_player
      )
    );
  END IF;
END;
$$;

-- Function to validate player's turn
CREATE OR REPLACE FUNCTION validate_player_turn(
  p_game_id UUID,
  p_player_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_player INTEGER;
  v_player_position INTEGER;
BEGIN
  -- Get current player position
  SELECT current_player
  INTO v_current_player
  FROM game_state
  WHERE id = p_game_id;

  -- Get acting player's position
  SELECT player_position
  INTO v_player_position
  FROM lobby_players
  WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
  AND player_name = p_player_name;

  -- Validate turn
  RETURN v_current_player = v_player_position;
END;
$$;

-- Function to get next active player
CREATE OR REPLACE FUNCTION get_next_player(
  p_game_id UUID,
  p_current_position INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_player_count INTEGER;
  v_next_position INTEGER;
BEGIN
  -- Get total number of players
  SELECT get_player_count(p_game_id)
  INTO v_player_count;

  -- Calculate next position (clockwise)
  v_next_position := (p_current_position + 1) % v_player_count;

  RETURN v_next_position;
END;
$$;

-- Update process_game_action_atomic to use turn validation
CREATE OR REPLACE FUNCTION process_game_action_atomic(
  p_game_id UUID,
  p_player_name TEXT,
  p_action_type TEXT,
  p_action_data JSONB,
  p_expected_version INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lock_key bigint;
  v_current_version INTEGER;
  v_action_id UUID;
  v_result JSONB;
  v_is_valid_turn BOOLEAN;
BEGIN
  -- Validate player's turn
  IF p_action_type NOT IN ('join_game', 'leave_game', 'spectate') THEN
    SELECT validate_player_turn(p_game_id, p_player_name)
    INTO v_is_valid_turn;

    IF NOT v_is_valid_turn THEN
      RAISE EXCEPTION 'Not your turn'
        USING ERRCODE = 'INVALID_TURN';
    END IF;
  END IF;

  -- Rest of the function remains the same...
  -- (Previous implementation of process_game_action_atomic)
END;
$$;
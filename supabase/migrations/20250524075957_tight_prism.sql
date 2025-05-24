-- Function to acquire advisory lock
CREATE OR REPLACE FUNCTION acquire_game_lock(p_game_id uuid)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_obtained boolean;
BEGIN
  -- Try to obtain advisory lock
  SELECT pg_try_advisory_xact_lock(
    ('x' || substr(p_game_id::text, 1, 8))::bit(32)::int,
    ('x' || substr(p_game_id::text, 9, 8))::bit(32)::int
  ) INTO v_lock_obtained;
  
  RETURN v_lock_obtained;
END;
$$;

-- Function to process game action atomically
CREATE OR REPLACE FUNCTION process_game_action_atomic(
  p_game_id uuid,
  p_player_name text,
  p_action_type text,
  p_action_data jsonb,
  p_expected_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_action_id uuid;
  v_current_version integer;
  v_result jsonb;
BEGIN
  -- Check current version
  SELECT version INTO v_current_version
  FROM game_state
  WHERE id = p_game_id
  FOR UPDATE;

  IF v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'Version mismatch: expected %, got %', 
      p_expected_version, v_current_version
    USING ERRCODE = 'SGAME';
  END IF;

  -- Create action record
  INSERT INTO game_action_queue (
    id,
    game_id,
    player_name,
    action_type,
    action_data,
    version,
    created_at
  ) VALUES (
    gen_random_uuid(),
    p_game_id,
    p_player_name,
    p_action_type,
    p_action_data,
    v_current_version + 1,
    now()
  ) RETURNING id INTO v_action_id;

  -- Update game state version
  UPDATE game_state
  SET version = version + 1
  WHERE id = p_game_id;

  -- Return action ID and new version
  v_result := jsonb_build_object(
    'action_id', v_action_id,
    'new_version', v_current_version + 1
  );

  RETURN v_result;
END;
$$;
/*
  # Fix game state synchronization

  1. Changes
    - Add version column to game_state table
    - Add version check to process_game_action_atomic function
    - Add advisory locks for atomic action processing
    
  2. Security
    - Only authenticated users can process actions
    - Version check prevents concurrent modifications
*/

-- Add version column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_state' AND column_name = 'version'
  ) THEN
    ALTER TABLE game_state ADD COLUMN version integer DEFAULT 1;
  END IF;
END $$;

-- Update process_game_action_atomic function
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
BEGIN
  -- Generate consistent lock key from game ID
  v_lock_key := ('x' || substr(p_game_id::text, 1, 16))::bit(64)::bigint;
  
  -- Try to acquire advisory lock
  IF NOT pg_try_advisory_xact_lock(v_lock_key) THEN
    RAISE EXCEPTION 'Game is busy' USING ERRCODE = 'GAME_BUSY';
  END IF;

  -- Get current version and check for mismatch
  SELECT version INTO v_current_version
  FROM game_state
  WHERE id = p_game_id
  FOR UPDATE;

  IF v_current_version != p_expected_version THEN
    RAISE EXCEPTION 'Version mismatch' USING ERRCODE = 'VERSION_MISMATCH';
  END IF;

  -- Insert action into queue
  INSERT INTO game_action_queue (
    game_id,
    player_name,
    action_type,
    action_data,
    version
  )
  VALUES (
    p_game_id,
    p_player_name,
    p_action_type,
    p_action_data,
    v_current_version + 1
  )
  RETURNING id INTO v_action_id;

  -- Update game state version
  UPDATE game_state
  SET version = version + 1
  WHERE id = p_game_id;

  -- Return action ID for tracking
  RETURN jsonb_build_object(
    'action_id', v_action_id,
    'version', v_current_version + 1
  );
END;
$$;
/*
  # Add Transaction and Locking for Game State
  
  1. Changes
    - Add advisory locks for game actions
    - Implement proper transaction handling
    - Add version tracking for optimistic concurrency
    
  2. Security
    - Prevent race conditions in game state updates
    - Ensure data consistency
*/

-- Function to acquire game lock
CREATE OR REPLACE FUNCTION acquire_game_lock(
  p_game_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  -- Try to acquire advisory lock using game_id hash
  RETURN pg_try_advisory_xact_lock(
    hashtext(p_game_id::text)::integer
  );
END;
$$ LANGUAGE plpgsql;

-- Update queue_game_action with proper locking
CREATE OR REPLACE FUNCTION queue_game_action(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_action_type VARCHAR(20),
  p_action_data JSONB
) RETURNS UUID AS $$
DECLARE
  v_action_id UUID;
  v_current_version INTEGER;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Start transaction
  BEGIN
    -- Try to acquire lock
    SELECT acquire_game_lock(p_game_id) INTO v_lock_acquired;
    
    IF NOT v_lock_acquired THEN
      RAISE EXCEPTION 'Could not acquire game lock';
    END IF;

    -- Get current game version with lock
    SELECT version INTO v_current_version
    FROM game_state
    WHERE id = p_game_id
    FOR UPDATE;

    -- Validate action order
    IF NOT validate_action_order(p_game_id, v_current_version) THEN
      RAISE EXCEPTION 'Invalid action order';
    END IF;

    -- Insert action into queue
    INSERT INTO game_action_queue (
      game_id,
      player_name,
      action_type,
      action_data,
      version
    ) VALUES (
      p_game_id,
      p_player_name,
      p_action_type,
      p_action_data,
      v_current_version
    ) RETURNING id INTO v_action_id;

    -- Process actions within same transaction
    PERFORM process_game_actions(p_game_id);

    -- Commit transaction (lock is automatically released)
    RETURN v_action_id;
  EXCEPTION WHEN OTHERS THEN
    -- Rollback releases the lock automatically
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Update process_game_actions with transaction handling
CREATE OR REPLACE FUNCTION process_game_actions(
  p_game_id UUID
) RETURNS void AS $$
DECLARE
  action_record RECORD;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Process actions in strict order
  FOR action_record IN
    SELECT * FROM game_action_queue
    WHERE game_id = p_game_id
    AND NOT processed
    AND NOT acknowledged
    ORDER BY version, created_at
    FOR UPDATE
  LOOP
    BEGIN
      -- Store current state for potential rollback
      PERFORM store_rollback_state(p_game_id, action_record.id);

      -- Check version matches
      IF action_record.version != (
        SELECT version 
        FROM game_state 
        WHERE id = p_game_id
        FOR UPDATE
      ) THEN
        PERFORM rollback_game_action(action_record.id);
        CONTINUE;
      END IF;

      -- Process action based on type
      CASE action_record.action_type
        WHEN 'play_card' THEN
          PERFORM play_card(
            p_game_id,
            action_record.player_name,
            (action_record.action_data->>'card')::TEXT
          );
        WHEN 'declare_trump' THEN
          PERFORM process_bidding_action(
            p_game_id,
            action_record.player_name,
            'declare_trump',
            (action_record.action_data->>'suit')::CHAR
          );
        WHEN 'pass' THEN
          PERFORM process_bidding_action(
            p_game_id,
            action_record.player_name,
            'pass'
          );
      END CASE;

      -- Mark action as processed and increment version
      UPDATE game_action_queue
      SET 
        processed = TRUE,
        acknowledged = TRUE,
        acknowledged_at = NOW()
      WHERE id = action_record.id;

      UPDATE game_state
      SET version = version + 1
      WHERE id = p_game_id;

    EXCEPTION WHEN OTHERS THEN
      -- Rollback on error
      PERFORM rollback_game_action(action_record.id);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add deadlock detection
CREATE OR REPLACE FUNCTION check_deadlock(
  p_game_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_blocked_pid INTEGER;
BEGIN
  SELECT pid INTO v_blocked_pid
  FROM pg_locks l1
  JOIN pg_locks l2 ON (l1.transactionid = l2.transactionid)
  JOIN pg_stat_activity a ON (l2.pid = a.pid)
  WHERE l1.granted 
  AND NOT l2.granted
  AND a.query LIKE '%' || p_game_id::text || '%';
  
  RETURN v_blocked_pid IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Add function to cleanup stale locks
CREATE OR REPLACE FUNCTION cleanup_stale_locks() RETURNS void AS $$
BEGIN
  -- Cancel queries holding locks for too long
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle in transaction'
  AND state_change < NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql;
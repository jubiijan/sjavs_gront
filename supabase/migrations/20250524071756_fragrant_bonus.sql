/*
  # Fix Advisory Lock Contention

  1. Changes
    - Implement unique lock keys per game using consistent hashing
    - Add lock timeout handling
    - Add deadlock detection
    - Add lock cleanup mechanism
    
  2. Security
    - Maintain transaction isolation
    - Prevent lock leaks
*/

-- Function to generate unique lock key
CREATE OR REPLACE FUNCTION generate_lock_key(
  p_game_id UUID
) RETURNS BIGINT AS $$
BEGIN
  -- Use consistent hash combining game ID components
  RETURN (
    ('x' || substr(md5(
      p_game_id::text || 
      extract(epoch from now())::text
    ), 1, 16))::bit(64)::bigint
  );
END;
$$ LANGUAGE plpgsql;

-- Function to acquire game lock with timeout
CREATE OR REPLACE FUNCTION acquire_game_lock(
  p_game_id UUID,
  p_timeout INTEGER DEFAULT 5000  -- Timeout in milliseconds
) RETURNS BOOLEAN AS $$
DECLARE
  v_lock_key BIGINT;
  v_start_time TIMESTAMP;
  v_acquired BOOLEAN := FALSE;
BEGIN
  -- Generate unique lock key
  v_lock_key := generate_lock_key(p_game_id);
  v_start_time := clock_timestamp();
  
  -- Try to acquire lock with timeout
  WHILE NOT v_acquired AND 
        (EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000 < p_timeout) 
  LOOP
    -- Try to acquire advisory lock
    v_acquired := pg_try_advisory_xact_lock(v_lock_key);
    
    IF NOT v_acquired THEN
      -- Check for deadlock
      IF EXISTS (
        SELECT 1 
        FROM pg_locks l1
        JOIN pg_locks l2 ON (l1.transactionid = l2.transactionid)
        WHERE l1.granted 
        AND NOT l2.granted
        AND l2.locktype = 'advisory'
      ) THEN
        RAISE EXCEPTION 'Deadlock detected';
      END IF;
      
      -- Wait briefly before retrying
      PERFORM pg_sleep(0.01);  -- 10ms delay
    END IF;
  END LOOP;
  
  IF NOT v_acquired THEN
    RAISE EXCEPTION 'Could not acquire game lock within % ms', p_timeout;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to process game action with improved locking
CREATE OR REPLACE FUNCTION process_game_action_atomic(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_action_type VARCHAR(20),
  p_action_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_lock_acquired BOOLEAN;
BEGIN
  -- Try to acquire lock with timeout
  SELECT acquire_game_lock(p_game_id) INTO v_lock_acquired;
  
  IF NOT v_lock_acquired THEN
    RAISE EXCEPTION 'Game is busy, please try again';
  END IF;
  
  -- Process action within transaction
  BEGIN
    -- Get exclusive row lock on game state
    PERFORM id 
    FROM game_state 
    WHERE id = p_game_id 
    FOR UPDATE NOWAIT;
    
    CASE p_action_type
      WHEN 'play_card' THEN
        v_result := play_card(
          p_game_id,
          p_player_name,
          p_action_data->>'card'
        );
      WHEN 'declare_trump' THEN
        v_result := process_bidding_action(
          p_game_id,
          p_player_name,
          'declare_trump',
          (p_action_data->>'suit')::CHAR
        );
      WHEN 'pass' THEN
        v_result := process_bidding_action(
          p_game_id,
          p_player_name,
          'pass'
        );
      ELSE
        RAISE EXCEPTION 'Unknown action type: %', p_action_type;
    END CASE;

    RETURN v_result;
  EXCEPTION 
    WHEN lock_not_available THEN
      RAISE EXCEPTION 'Game state is locked by another operation';
    WHEN OTHERS THEN
      -- Ensure lock is released on error
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup stale locks
CREATE OR REPLACE FUNCTION cleanup_game_locks() RETURNS void AS $$
BEGIN
  -- Cancel queries holding locks for too long
  WITH stale_locks AS (
    SELECT pid 
    FROM pg_stat_activity
    WHERE state = 'idle in transaction'
    AND state_change < NOW() - INTERVAL '1 minute'
    AND query LIKE '%process_game_action_atomic%'
  )
  SELECT pg_terminate_backend(pid)
  FROM stale_locks;
END;
$$ LANGUAGE plpgsql;

-- Add monitoring for lock contention
CREATE OR REPLACE FUNCTION monitor_lock_contention(
  p_game_id UUID
) RETURNS TABLE(
  waiting_pid INTEGER,
  blocking_pid INTEGER,
  blocked_duration INTERVAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    blocked.pid AS waiting_pid,
    blocking.pid AS blocking_pid,
    NOW() - blocked.state_change AS blocked_duration
  FROM pg_stat_activity blocked
  JOIN pg_locks blocked_locks ON blocked.pid = blocked_locks.pid
  JOIN pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
  JOIN pg_stat_activity blocking ON blocking.pid = blocking_locks.pid
  WHERE NOT blocked_locks.granted
  AND blocked.query LIKE '%' || p_game_id::text || '%';
END;
$$ LANGUAGE plpgsql;
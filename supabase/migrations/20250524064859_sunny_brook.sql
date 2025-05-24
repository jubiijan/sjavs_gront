/*
  # Improve real-time synchronization
  
  1. Changes
    - Add action acknowledgment system
    - Implement deterministic action ordering
    - Add rollback mechanism for failed actions
    
  2. Security
    - Maintain existing RLS policies
    - Add validation for action ordering
*/

-- Add acknowledgment tracking to game_action_queue
ALTER TABLE game_action_queue
ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rollback_data JSONB;

-- Function to acknowledge action completion
CREATE OR REPLACE FUNCTION acknowledge_game_action(
  p_action_id UUID,
  p_success BOOLEAN
) RETURNS void AS $$
BEGIN
  UPDATE game_action_queue
  SET 
    acknowledged = TRUE,
    acknowledged_at = NOW()
  WHERE id = p_action_id;
END;
$$ LANGUAGE plpgsql;

-- Function to store game state for rollback
CREATE OR REPLACE FUNCTION store_rollback_state(
  p_game_id UUID,
  p_action_id UUID
) RETURNS void AS $$
BEGIN
  UPDATE game_action_queue
  SET rollback_data = (
    SELECT jsonb_build_object(
      'player_hands', player_hands,
      'table_cards', table_cards,
      'scores', scores,
      'current_player', current_player,
      'current_phase', current_phase,
      'version', version
    )
    FROM game_state
    WHERE id = p_game_id
  )
  WHERE id = p_action_id;
END;
$$ LANGUAGE plpgsql;

-- Function to rollback failed action
CREATE OR REPLACE FUNCTION rollback_game_action(
  p_action_id UUID
) RETURNS void AS $$
DECLARE
  v_game_id UUID;
  v_rollback_data JSONB;
BEGIN
  -- Get action data
  SELECT 
    game_id,
    rollback_data
  INTO v_game_id, v_rollback_data
  FROM game_action_queue
  WHERE id = p_action_id;

  -- Restore previous state
  UPDATE game_state
  SET
    player_hands = v_rollback_data->'player_hands',
    table_cards = v_rollback_data->'table_cards',
    scores = v_rollback_data->'scores',
    current_player = (v_rollback_data->>'current_player')::INTEGER,
    current_phase = v_rollback_data->>'current_phase',
    version = (v_rollback_data->>'version')::INTEGER
  WHERE id = v_game_id;

  -- Mark action as failed
  UPDATE game_action_queue
  SET 
    processed = TRUE,
    error = 'Action rolled back',
    acknowledged = TRUE,
    acknowledged_at = NOW()
  WHERE id = p_action_id;
END;
$$ LANGUAGE plpgsql;

-- Update process_game_actions to use new features
CREATE OR REPLACE FUNCTION process_game_actions(
  p_game_id UUID
) RETURNS void AS $$
DECLARE
  action_record RECORD;
BEGIN
  -- Process actions in strict order
  FOR action_record IN
    SELECT * FROM game_action_queue
    WHERE game_id = p_game_id
    AND NOT processed
    AND NOT acknowledged
    ORDER BY version, created_at
  LOOP
    BEGIN
      -- Store current state for potential rollback
      PERFORM store_rollback_state(p_game_id, action_record.id);

      -- Check version matches
      IF action_record.version != (
        SELECT version FROM game_state WHERE id = p_game_id
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

-- Add function to check action order validity
CREATE OR REPLACE FUNCTION validate_action_order(
  p_game_id UUID,
  p_version INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_version INTEGER;
  v_pending_actions INTEGER;
BEGIN
  -- Get current game version
  SELECT version INTO v_current_version
  FROM game_state
  WHERE id = p_game_id;

  -- Count pending actions with lower version
  SELECT COUNT(*)
  INTO v_pending_actions
  FROM game_action_queue
  WHERE game_id = p_game_id
  AND version < p_version
  AND NOT processed;

  -- Action is valid if it matches current version and no earlier actions are pending
  RETURN p_version = v_current_version AND v_pending_actions = 0;
END;
$$ LANGUAGE plpgsql;

-- Update queue_game_action to use stricter ordering
CREATE OR REPLACE FUNCTION queue_game_action(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_action_type VARCHAR(20),
  p_action_data JSONB
) RETURNS UUID AS $$
DECLARE
  v_action_id UUID;
  v_current_version INTEGER;
BEGIN
  -- Get current game version
  SELECT version INTO v_current_version
  FROM game_state
  WHERE id = p_game_id;

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

  -- Process actions
  PERFORM process_game_actions(p_game_id);

  RETURN v_action_id;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_game_action_queue_acknowledged 
ON game_action_queue(acknowledged);

CREATE INDEX IF NOT EXISTS idx_game_action_queue_acknowledged_at 
ON game_action_queue(acknowledged_at);
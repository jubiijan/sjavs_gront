/*
  # Add state synchronization functions
  
  1. Changes
    - Add version tracking to game_state
    - Add conflict resolution function
    - Add action queue table and functions
    - Add cleanup function for stale actions
    
  2. Security
    - Maintain RLS policies
    - Add validation for action ordering
*/

-- Add version column to game_state
ALTER TABLE game_state 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Create action queue table
CREATE TABLE IF NOT EXISTS game_action_queue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  game_id UUID REFERENCES game_state(id) ON DELETE CASCADE,
  player_name VARCHAR(50) NOT NULL,
  action_type VARCHAR(20) NOT NULL,
  action_data JSONB NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  error TEXT
);

-- Enable RLS on action queue
ALTER TABLE game_action_queue ENABLE ROW LEVEL SECURITY;

-- Add policies for action queue
CREATE POLICY "Players can view action queue"
ON game_action_queue
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Players can add actions"
ON game_action_queue
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Function to process queued actions
CREATE OR REPLACE FUNCTION process_game_actions(
  p_game_id UUID
) RETURNS void AS $$
DECLARE
  action_record RECORD;
BEGIN
  -- Process actions in order
  FOR action_record IN
    SELECT * FROM game_action_queue
    WHERE game_id = p_game_id
    AND NOT processed
    ORDER BY version, created_at
  LOOP
    BEGIN
      -- Check version matches
      IF action_record.version != (
        SELECT version FROM game_state WHERE id = p_game_id
      ) THEN
        -- Version mismatch, mark as error
        UPDATE game_action_queue
        SET 
          processed = TRUE,
          error = 'Version mismatch'
        WHERE id = action_record.id;
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
        -- Add other action types here
      END CASE;

      -- Mark action as processed and increment version
      UPDATE game_action_queue
      SET processed = TRUE
      WHERE id = action_record.id;

      UPDATE game_state
      SET version = version + 1
      WHERE id = p_game_id;

    EXCEPTION WHEN OTHERS THEN
      -- Log error and continue
      UPDATE game_action_queue
      SET 
        processed = TRUE,
        error = SQLERRM
      WHERE id = action_record.id;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to queue a game action
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

-- Function to clean up old actions
CREATE OR REPLACE FUNCTION cleanup_game_actions() RETURNS void AS $$
BEGIN
  DELETE FROM game_action_queue
  WHERE processed = TRUE
  AND created_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Add trigger to process actions after insert
CREATE OR REPLACE FUNCTION process_new_action() RETURNS TRIGGER AS $$
BEGIN
  PERFORM process_game_actions(NEW.game_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER process_action_trigger
AFTER INSERT ON game_action_queue
FOR EACH ROW
EXECUTE FUNCTION process_new_action();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_action_queue_game_id ON game_action_queue(game_id);
CREATE INDEX IF NOT EXISTS idx_game_action_queue_version ON game_action_queue(version);
CREATE INDEX IF NOT EXISTS idx_game_action_queue_processed ON game_action_queue(processed);
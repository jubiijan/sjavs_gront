/*
  # Enhance Player Presence and Activity Tracking

  1. New Tables
    - `player_presence` table to track real-time player status
    - `activity_log` table for detailed activity history

  2. Changes
    - Add last_heartbeat column to lobby_players
    - Add presence_status column to lobby_players
    - Add activity tracking triggers

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies for access control
*/

-- Add presence status type
CREATE TYPE presence_status AS ENUM ('online', 'idle', 'away', 'offline');

-- Add columns to lobby_players
ALTER TABLE lobby_players 
ADD COLUMN IF NOT EXISTS last_heartbeat timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS presence_status presence_status DEFAULT 'offline';

-- Create player presence table
CREATE TABLE IF NOT EXISTS player_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name text NOT NULL,
  lobby_id uuid NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  connection_id text NOT NULL,
  connected_at timestamptz DEFAULT now(),
  last_heartbeat timestamptz DEFAULT now(),
  client_info jsonb DEFAULT '{}'::jsonb,
  UNIQUE (player_name, connection_id)
);

-- Create activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  activity_type text NOT NULL,
  activity_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE player_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Anyone can view presence"
  ON player_presence
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can update their own presence"
  ON player_presence
  FOR ALL
  TO authenticated
  USING (player_name = current_setting('request.jwt.claims')::json->>'player_name')
  WITH CHECK (player_name = current_setting('request.jwt.claims')::json->>'player_name');

CREATE POLICY "Anyone can view activity log"
  ON activity_log
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can create activity logs"
  ON activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to update player presence
CREATE OR REPLACE FUNCTION update_player_presence(
  p_player_name text,
  p_lobby_id uuid,
  p_connection_id text,
  p_client_info jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update or insert presence record
  INSERT INTO player_presence (
    player_name,
    lobby_id,
    connection_id,
    client_info
  )
  VALUES (
    p_player_name,
    p_lobby_id,
    p_connection_id,
    p_client_info
  )
  ON CONFLICT (player_name, connection_id)
  DO UPDATE SET
    last_heartbeat = now(),
    client_info = COALESCE(p_client_info, player_presence.client_info);

  -- Update lobby player status
  UPDATE lobby_players
  SET 
    last_heartbeat = now(),
    presence_status = CASE
      WHEN (now() - last_heartbeat) < interval '10 seconds' THEN 'online'::presence_status
      WHEN (now() - last_heartbeat) < interval '30 seconds' THEN 'idle'::presence_status
      WHEN (now() - last_heartbeat) < interval '2 minutes' THEN 'away'::presence_status
      ELSE 'offline'::presence_status
    END
  WHERE lobby_id = p_lobby_id
    AND player_name = p_player_name;
END;
$$;

-- Function to cleanup stale presence records
CREATE OR REPLACE FUNCTION cleanup_stale_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete presence records older than 2 minutes
  DELETE FROM player_presence
  WHERE now() - last_heartbeat > interval '2 minutes';

  -- Update status for players with no recent heartbeat
  UPDATE lobby_players
  SET presence_status = 'offline'::presence_status
  WHERE now() - last_heartbeat > interval '2 minutes';

  -- Log disconnections
  INSERT INTO activity_log (
    lobby_id,
    player_name,
    activity_type,
    activity_data
  )
  SELECT 
    lobby_id,
    player_name,
    'disconnected',
    jsonb_build_object(
      'reason', 'timeout',
      'last_heartbeat', last_heartbeat
    )
  FROM lobby_players
  WHERE presence_status = 'offline'
    AND now() - last_heartbeat > interval '2 minutes';
END;
$$;

-- Create cleanup trigger function
CREATE OR REPLACE FUNCTION trigger_cleanup_stale_presence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM cleanup_stale_presence();
  RETURN NULL;
END;
$$;

-- Create trigger to cleanup stale presence records
CREATE TRIGGER cleanup_stale_presence_trigger
  AFTER INSERT OR UPDATE
  ON player_presence
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_cleanup_stale_presence();

-- Function to log player activity
CREATE OR REPLACE FUNCTION log_player_activity(
  p_lobby_id uuid,
  p_player_name text,
  p_activity_type text,
  p_activity_data jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO activity_log (
    lobby_id,
    player_name,
    activity_type,
    activity_data
  )
  VALUES (
    p_lobby_id,
    p_player_name,
    p_activity_type,
    p_activity_data
  );

  -- Update lobby's last activity
  UPDATE lobbies
  SET last_activity = now()
  WHERE id = p_lobby_id;
END;
$$;

-- Create activity logging triggers
CREATE OR REPLACE FUNCTION trigger_log_player_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_player_activity(
      NEW.lobby_id,
      NEW.player_name,
      'joined_lobby',
      jsonb_build_object('position', NEW.player_position)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM log_player_activity(
      OLD.lobby_id,
      OLD.player_name,
      'left_lobby',
      jsonb_build_object('position', OLD.player_position)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_ready != OLD.is_ready THEN
      PERFORM log_player_activity(
        NEW.lobby_id,
        NEW.player_name,
        CASE WHEN NEW.is_ready THEN 'ready' ELSE 'not_ready' END,
        jsonb_build_object('position', NEW.player_position)
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- Add activity logging trigger to lobby_players
CREATE TRIGGER log_player_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE
  ON lobby_players
  FOR EACH ROW
  EXECUTE FUNCTION trigger_log_player_activity();
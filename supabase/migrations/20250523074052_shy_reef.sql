/*
  # Add lobby cleanup functionality
  
  1. Changes
    - Add last_activity column to lobbies table
    - Add function to clean up inactive lobbies
    - Add trigger to update last_activity
*/

-- Add last_activity column
ALTER TABLE lobbies
ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to clean up inactive lobbies
CREATE OR REPLACE FUNCTION cleanup_inactive_lobbies() RETURNS void AS $$
BEGIN
  -- Delete lobbies that have been inactive for 30+ minutes
  DELETE FROM lobbies
  WHERE status = 'waiting'
  AND last_activity < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update last_activity
CREATE OR REPLACE FUNCTION update_lobby_activity() RETURNS TRIGGER AS $$
BEGIN
  UPDATE lobbies
  SET last_activity = NOW()
  WHERE id = NEW.lobby_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lobby_players changes
CREATE TRIGGER update_lobby_activity_trigger
AFTER INSERT OR UPDATE ON lobby_players
FOR EACH ROW
EXECUTE FUNCTION update_lobby_activity();

-- Create trigger for chat_messages changes
CREATE TRIGGER update_lobby_activity_on_chat
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_lobby_activity();
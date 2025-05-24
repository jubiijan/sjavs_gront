/*
  # Add player inactivity cleanup
  
  1. Changes
    - Add last_active column to lobby_players
    - Add function to clean up inactive players
    - Add trigger to update last_active timestamp
    
  2. Security
    - Only removes players who have been inactive for 5+ minutes
    - Preserves game state and chat history
*/

-- Add last_active column to lobby_players
ALTER TABLE lobby_players
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to clean up inactive players
CREATE OR REPLACE FUNCTION cleanup_inactive_players() RETURNS void AS $$
BEGIN
  -- Get lobbies with inactive players
  WITH inactive_lobbies AS (
    SELECT DISTINCT l.id
    FROM lobbies l
    JOIN lobby_players lp ON l.id = lp.lobby_id
    WHERE l.status = 'waiting'
    AND lp.last_active < NOW() - INTERVAL '5 minutes'
  )
  -- Insert system messages for removed players
  INSERT INTO chat_messages (lobby_id, message, message_type)
  SELECT 
    lp.lobby_id,
    'Player ' || lp.player_name || ' was removed due to inactivity.',
    'system'
  FROM lobby_players lp
  JOIN inactive_lobbies il ON lp.lobby_id = il.id
  WHERE lp.last_active < NOW() - INTERVAL '5 minutes';

  -- Remove inactive players
  DELETE FROM lobby_players
  WHERE lobby_id IN (SELECT id FROM inactive_lobbies)
  AND last_active < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to update last_active
CREATE OR REPLACE FUNCTION update_player_activity() RETURNS TRIGGER AS $$
BEGIN
  UPDATE lobby_players
  SET last_active = NOW()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lobby_players changes
CREATE TRIGGER update_player_activity_trigger
AFTER UPDATE OF is_ready ON lobby_players
FOR EACH ROW
EXECUTE FUNCTION update_player_activity();
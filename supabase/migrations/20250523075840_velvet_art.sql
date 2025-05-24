/*
  # Add kick player functionality
  
  1. Changes
    - Add function for hosts to kick players
    - Add system message for kicked players
    
  2. Security
    - Only hosts can kick players
    - Cannot kick self (host)
    - Maintains audit trail via system messages
*/

CREATE OR REPLACE FUNCTION kick_player(
  p_lobby_id UUID,
  p_host_name VARCHAR(50),
  p_player_name VARCHAR(50)
) RETURNS void AS $$
DECLARE
  v_is_host BOOLEAN;
BEGIN
  -- Check host status
  SELECT EXISTS (
    SELECT 1 FROM lobby_players 
    WHERE lobby_id = p_lobby_id 
    AND player_name = p_host_name 
    AND is_host = true
  ) INTO v_is_host;
  
  IF NOT v_is_host THEN
    RAISE EXCEPTION 'Only the host can kick players';
  END IF;

  -- Cannot kick self
  IF p_host_name = p_player_name THEN
    RAISE EXCEPTION 'Host cannot kick themselves';
  END IF;

  -- Check if player exists in lobby
  IF NOT EXISTS (
    SELECT 1 FROM lobby_players
    WHERE lobby_id = p_lobby_id
    AND player_name = p_player_name
  ) THEN
    RAISE EXCEPTION 'Player not found in lobby';
  END IF;

  -- Start transaction
  BEGIN
    -- Remove player
    DELETE FROM lobby_players
    WHERE lobby_id = p_lobby_id
    AND player_name = p_player_name;

    -- Add system message
    INSERT INTO chat_messages (
      lobby_id,
      message,
      message_type
    ) VALUES (
      p_lobby_id,
      p_player_name || ' was kicked from the lobby by ' || p_host_name,
      'system'
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
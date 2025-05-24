/*
  # Fix kick player functionality
  
  1. Changes
    - Update kick_player function to handle errors better
    - Add additional validation checks
    - Ensure proper transaction handling
    
  2. Security
    - Verify host status before allowing kick
    - Prevent kicking of host
    - Add system logging
*/

CREATE OR REPLACE FUNCTION kick_player(
  p_lobby_id UUID,
  p_host_name VARCHAR(50),
  p_player_name VARCHAR(50)
) RETURNS void AS $$
DECLARE
  v_is_host BOOLEAN;
  v_target_is_host BOOLEAN;
  v_lobby_status VARCHAR(20);
BEGIN
  -- Check if lobby exists and get status
  SELECT status INTO v_lobby_status
  FROM lobbies
  WHERE id = p_lobby_id;
  
  IF v_lobby_status IS NULL THEN
    RAISE EXCEPTION 'Lobby not found';
  END IF;
  
  IF v_lobby_status != 'waiting' THEN
    RAISE EXCEPTION 'Cannot kick players after game has started';
  END IF;

  -- Check host status
  SELECT is_host INTO v_is_host
  FROM lobby_players 
  WHERE lobby_id = p_lobby_id 
  AND player_name = p_host_name;
  
  IF NOT v_is_host THEN
    RAISE EXCEPTION 'Only the host can kick players';
  END IF;

  -- Check if target player is host
  SELECT is_host INTO v_target_is_host
  FROM lobby_players
  WHERE lobby_id = p_lobby_id
  AND player_name = p_player_name;
  
  IF v_target_is_host THEN
    RAISE EXCEPTION 'Cannot kick the host';
  END IF;

  -- Start transaction
  BEGIN
    -- Remove player
    DELETE FROM lobby_players
    WHERE lobby_id = p_lobby_id
    AND player_name = p_player_name;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Player not found in lobby';
    END IF;

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

    -- Log the action
    INSERT INTO system_logs (
      log_level,
      category,
      message,
      player_name,
      lobby_id,
      metadata
    ) VALUES (
      'info',
      'lobby',
      'Player kicked from lobby',
      p_player_name,
      p_lobby_id,
      jsonb_build_object(
        'host_name', p_host_name,
        'action', 'kick_player',
        'timestamp', now()
      )
    );

  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
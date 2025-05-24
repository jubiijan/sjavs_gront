/*
  # Add atomic game start procedure
  
  1. Changes
    - Add stored procedure for atomic game start
    - Handles deck generation server-side
    - Ensures consistent game state
    
  2. Security
    - Only host can start game
    - Validates all players are ready
    - Ensures minimum player count
*/

CREATE OR REPLACE FUNCTION start_game(
  p_lobby_id UUID,
  p_host_name VARCHAR(50)
) RETURNS UUID AS $$
DECLARE
  v_game_id UUID;
  v_player_count INTEGER;
  v_all_ready BOOLEAN;
  v_is_host BOOLEAN;
  v_deck TEXT[];
  v_hands JSONB;
  temp TEXT;
  i INTEGER;
  j INTEGER;
BEGIN
  -- Check host status
  SELECT EXISTS (
    SELECT 1 FROM lobby_players 
    WHERE lobby_id = p_lobby_id 
    AND player_name = p_host_name 
    AND is_host = true
  ) INTO v_is_host;
  
  IF NOT v_is_host THEN
    RAISE EXCEPTION 'Only the host can start the game';
  END IF;

  -- Check player count
  SELECT COUNT(*) FROM lobby_players 
  WHERE lobby_id = p_lobby_id 
  INTO v_player_count;
  
  IF v_player_count < 3 THEN
    RAISE EXCEPTION 'Need at least 3 players to start';
  END IF;

  -- Check all players ready
  SELECT bool_and(is_ready OR is_host) 
  FROM lobby_players 
  WHERE lobby_id = p_lobby_id 
  INTO v_all_ready;
  
  IF NOT v_all_ready THEN
    RAISE EXCEPTION 'Not all players are ready';
  END IF;

  -- Generate and shuffle deck
  v_deck := ARRAY[
    '7H','8H','9H','10H','JH','QH','KH','AH',
    '7D','8D','9D','10D','JD','QD','KD','AD',
    '7C','8C','9C','10C','JC','QC','KC','AC',
    '7S','8S','9S','10S','JS','QS','KS','AS'
  ];
  
  -- Fisher-Yates shuffle
  FOR i IN REVERSE array_length(v_deck, 1)..2 LOOP
    j := floor(random() * i + 1);
    SELECT v_deck[j], v_deck[i] INTO temp, v_deck[i], v_deck[j];
  END LOOP;

  -- Deal cards to players
  WITH player_cards AS (
    SELECT 
      player_name,
      array_to_json(
        v_deck[player_position * 8 + 1 : (player_position + 1) * 8]
      ) as cards
    FROM lobby_players
    WHERE lobby_id = p_lobby_id
  )
  SELECT jsonb_object_agg(player_name, cards)
  INTO v_hands
  FROM player_cards;

  -- Start transaction
  BEGIN
    -- Update lobby status
    UPDATE lobbies 
    SET status = 'playing'
    WHERE id = p_lobby_id;

    -- Create game state
    INSERT INTO game_state (
      lobby_id,
      status,
      current_phase,
      current_player,
      trick_number,
      player_hands,
      table_cards,
      scores
    ) VALUES (
      p_lobby_id,
      'active',
      'bidding',
      0,
      0,
      v_hands,
      '{}',
      (
        SELECT jsonb_object_agg(player_name, 24)
        FROM lobby_players
        WHERE lobby_id = p_lobby_id
      )
    ) RETURNING id INTO v_game_id;

    -- Add system message
    INSERT INTO chat_messages (
      lobby_id,
      message,
      message_type
    ) VALUES (
      p_lobby_id,
      'Game has started! Bidding phase begins.',
      'system'
    );

    RETURN v_game_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE;
  END;
END;
$$ LANGUAGE plpgsql;
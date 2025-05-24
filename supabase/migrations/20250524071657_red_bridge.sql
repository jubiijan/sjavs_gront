-- Add bidding state tracking
ALTER TABLE game_state
ADD COLUMN IF NOT EXISTS bidding_round INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS pass_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS min_bid_suit CHAR;

-- Function to validate trump declaration with progressive bidding
CREATE OR REPLACE FUNCTION validate_trump_declaration(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_trump_suit CHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_player_hand TEXT[];
  v_suit_count INTEGER;
  v_permanent_trump_count INTEGER;
  v_min_bid_suit CHAR;
  v_player_count INTEGER;
BEGIN
  -- Get game state info
  SELECT 
    min_bid_suit,
    (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = game_state.lobby_id)
  INTO v_min_bid_suit, v_player_count
  FROM game_state
  WHERE id = p_game_id;

  -- Get player's hand
  SELECT ARRAY(
    SELECT jsonb_array_elements_text(player_hands->p_player_name)
    FROM game_state
    WHERE id = p_game_id
  ) INTO v_player_hand;

  -- Count regular cards of declared suit
  SELECT COUNT(*)
  INTO v_suit_count
  FROM unnest(v_player_hand) AS card
  WHERE RIGHT(card, 1) = p_trump_suit
  AND NOT is_permanent_trump(card, v_player_count);

  -- Count permanent trumps of declared suit
  SELECT COUNT(*)
  INTO v_permanent_trump_count
  FROM unnest(v_player_hand) AS card
  WHERE is_permanent_trump(card, v_player_count)
  AND RIGHT(card, 1) = p_trump_suit;

  -- Progressive bidding: must declare higher suit than minimum
  IF v_min_bid_suit IS NOT NULL THEN
    IF NOT (
      CASE p_trump_suit
        WHEN 'C' THEN 1
        WHEN 'S' THEN 2
        WHEN 'H' THEN 3
        WHEN 'D' THEN 4
      END >
      CASE v_min_bid_suit
        WHEN 'C' THEN 1
        WHEN 'S' THEN 2
        WHEN 'H' THEN 3
        WHEN 'D' THEN 4
      END
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Need at least 5 cards of the suit (including permanent trumps)
  RETURN (v_suit_count + v_permanent_trump_count) >= 5;
END;
$$ LANGUAGE plpgsql;

-- Function to handle bidding phase
CREATE OR REPLACE FUNCTION process_bidding_action(
  p_game_id UUID,
  p_player_name VARCHAR(50),
  p_action VARCHAR(20),
  p_trump_suit CHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_next_player INTEGER;
  v_player_count INTEGER;
  v_current_player INTEGER;
  v_pass_count INTEGER;
  v_bidding_round INTEGER;
BEGIN
  -- Get current game state
  SELECT 
    current_player,
    pass_count,
    bidding_round,
    (SELECT COUNT(*) FROM lobby_players WHERE lobby_id = game_state.lobby_id)
  INTO v_current_player, v_pass_count, v_bidding_round, v_player_count
  FROM game_state
  WHERE id = p_game_id;

  -- Handle trump declaration
  IF p_action = 'declare_trump' THEN
    -- Validate trump declaration
    IF NOT validate_trump_declaration(p_game_id, p_player_name, p_trump_suit) THEN
      RAISE EXCEPTION 'Invalid trump declaration';
    END IF;

    -- Update game state
    UPDATE game_state
    SET 
      trump_suit = p_trump_suit,
      trump_declarer = p_player_name,
      current_phase = 'playing',
      current_player = v_current_player,
      pass_count = 0,
      bidding_round = 1
    WHERE id = p_game_id;

    -- Add system message
    INSERT INTO chat_messages (
      lobby_id,
      message,
      message_type
    ) VALUES (
      (SELECT lobby_id FROM game_state WHERE id = p_game_id),
      p_player_name || ' declared ' || 
      CASE p_trump_suit
        WHEN 'H' THEN 'Hearts'
        WHEN 'D' THEN 'Diamonds'
        WHEN 'C' THEN 'Clubs'
        WHEN 'S' THEN 'Spades'
      END || ' as trump',
      'system'
    );

  -- Handle pass
  ELSE
    -- Increment pass count
    UPDATE game_state
    SET 
      pass_count = pass_count + 1,
      current_player = (current_player + 1) % v_player_count
    WHERE id = p_game_id;

    -- Check if all players passed
    IF v_pass_count + 1 >= v_player_count THEN
      -- If in first round, redeal
      IF v_bidding_round = 1 THEN
        -- Redeal cards
        UPDATE game_state
        SET
          player_hands = deal_cards(p_game_id),
          pass_count = 0,
          bidding_round = 1,
          min_bid_suit = NULL
        WHERE id = p_game_id;

        -- Add system message
        INSERT INTO chat_messages (
          lobby_id,
          message,
          message_type
        ) VALUES (
          (SELECT lobby_id FROM game_state WHERE id = p_game_id),
          'All players passed. Redealing cards.',
          'system'
        );
      ELSE
        -- End game if all pass in subsequent rounds
        UPDATE game_state
        SET
          current_phase = 'scoring',
          status = 'finished'
        WHERE id = p_game_id;

        -- Add system message
        INSERT INTO chat_messages (
          lobby_id,
          message,
          message_type
        ) VALUES (
          (SELECT lobby_id FROM game_state WHERE id = p_game_id),
          'All players passed. Game ends without a winner.',
          'system'
        );
      END IF;
    ELSE
      -- Add system message for pass
      INSERT INTO chat_messages (
        lobby_id,
        message,
        message_type
      ) VALUES (
        (SELECT lobby_id FROM game_state WHERE id = p_game_id),
        p_player_name || ' passed',
        'system'
      );
    END IF;
  END IF;

  -- Return updated game state
  RETURN (
    SELECT jsonb_build_object(
      'current_phase', current_phase,
      'current_player', current_player,
      'trump_suit', trump_suit,
      'trump_declarer', trump_declarer,
      'pass_count', pass_count,
      'bidding_round', bidding_round,
      'min_bid_suit', min_bid_suit
    )
    FROM game_state
    WHERE id = p_game_id
  );
END;
$$ LANGUAGE plpgsql;

-- Helper function to deal new cards
CREATE OR REPLACE FUNCTION deal_cards(
  p_game_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_deck TEXT[];
  v_hands JSONB;
  v_player_count INTEGER;
  temp TEXT;
  i INTEGER;
  j INTEGER;
BEGIN
  -- Get player count
  SELECT COUNT(*) INTO v_player_count
  FROM lobby_players
  WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id);

  -- Generate and shuffle deck
  v_deck := generate_deck_for_players(v_player_count);
  
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
    WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
    ORDER BY player_position
  )
  SELECT jsonb_object_agg(player_name, cards)
  INTO v_hands
  FROM player_cards;

  RETURN v_hands;
END;
$$ LANGUAGE plpgsql;
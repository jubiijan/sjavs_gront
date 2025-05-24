/*
  # Fix 3-Player Mode Handling

  1. Changes
    - Add proper handling for 3-player variant
    - Fix permanent trump handling
    - Correct card dealing for removed diamonds
    - Consistent J♦ handling across functions

  2. New Functions
    - get_player_count: Get number of players in game
    - get_valid_cards: Get valid deck based on player count
    - is_valid_card: Check if card is valid for current game mode
*/

-- Function to get number of players
CREATE OR REPLACE FUNCTION get_player_count(p_game_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM lobby_players
    WHERE lobby_id = (
      SELECT lobby_id 
      FROM game_state 
      WHERE id = p_game_id
    )
  );
END;
$$;

-- Function to get valid cards for game mode
CREATE OR REPLACE FUNCTION get_valid_cards(p_player_count INTEGER)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
BEGIN
  -- Base deck (7 through Ace in all suits)
  RETURN CASE 
    WHEN p_player_count = 4 THEN
      ARRAY[
        -- Hearts
        '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH', 'AH',
        -- Diamonds
        '7D', '8D', '9D', '10D', 'JD', 'QD', 'KD', 'AD',
        -- Clubs
        '7C', '8C', '9C', '10C', 'JC', 'QC', 'KC', 'AC',
        -- Spades
        '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS', 'AS'
      ]
    ELSE
      -- 3-player mode: Remove all diamonds except J♦
      ARRAY[
        -- Hearts
        '7H', '8H', '9H', '10H', 'JH', 'QH', 'KH', 'AH',
        -- Diamonds (only J♦)
        'JD',
        -- Clubs
        '7C', '8C', '9C', '10C', 'JC', 'QC', 'KC', 'AC',
        -- Spades
        '7S', '8S', '9S', '10S', 'JS', 'QS', 'KS', 'AS'
      ]
  END;
END;
$$;

-- Function to check if card is valid for game mode
CREATE OR REPLACE FUNCTION is_valid_card(
  p_card TEXT,
  p_player_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- In 3-player mode, only J♦ is valid from diamonds
  IF p_player_count = 3 AND RIGHT(p_card, 1) = 'D' THEN
    RETURN p_card = 'JD';
  END IF;
  
  -- All cards valid in 4-player mode
  RETURN TRUE;
END;
$$;

-- Updated permanent trump check
CREATE OR REPLACE FUNCTION is_permanent_trump(
  p_card TEXT,
  p_player_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN p_card IN (
    'QC',  -- Queen of Clubs (highest)
    'QS',  -- Queen of Spades
    'JC',  -- Jack of Clubs
    'JS',  -- Jack of Spades
    'JH',  -- Jack of Hearts
    CASE WHEN p_player_count = 4 THEN 'JD' END  -- Jack of Diamonds (4-player only)
  );
END;
$$;

-- Updated card value calculation
CREATE OR REPLACE FUNCTION get_card_value(
  p_card TEXT,
  p_trump_suit CHAR,
  p_first_suit CHAR,
  p_player_count INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_rank TEXT := LEFT(p_card, -1);
  v_suit CHAR := RIGHT(p_card, 1);
  v_base_value INTEGER;
BEGIN
  -- Handle permanent trumps
  IF is_permanent_trump(p_card, p_player_count) THEN
    RETURN CASE p_card
      WHEN 'QC' THEN 600  -- Highest permanent trump
      WHEN 'QS' THEN 500
      WHEN 'JC' THEN 400
      WHEN 'JS' THEN 300
      WHEN 'JH' THEN 200
      WHEN 'JD' THEN 100  -- Lowest permanent trump
    END;
  END IF;

  -- Base value for regular cards
  v_base_value := CASE v_rank
    WHEN 'A' THEN 14
    WHEN 'K' THEN 13
    WHEN 'Q' THEN 12
    WHEN 'J' THEN 11
    WHEN '10' THEN 10
    ELSE v_rank::INTEGER
  END;

  -- Adjust value based on trump and led suit
  RETURN CASE
    WHEN v_suit = p_trump_suit THEN v_base_value + 50
    WHEN v_suit = p_first_suit THEN v_base_value
    ELSE 0  -- Card of different suit
  END;
END;
$$;

-- Updated trick evaluation
CREATE OR REPLACE FUNCTION evaluate_trick(
  p_game_id UUID,
  p_table_cards JSONB
)
RETURNS TABLE(
  winner_name TEXT,
  points_won INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_player_count INTEGER;
  v_trump_suit CHAR;
  v_first_card TEXT;
  v_first_suit CHAR;
  v_winning_card TEXT;
  v_winning_player TEXT;
  v_winning_value INTEGER := -1;
  v_current_value INTEGER;
BEGIN
  -- Get game parameters
  SELECT get_player_count(p_game_id) INTO v_player_count;
  
  SELECT trump_suit 
  INTO v_trump_suit
  FROM game_state 
  WHERE id = p_game_id;

  -- Get first card played
  SELECT value INTO v_first_card
  FROM jsonb_each_text(p_table_cards)
  LIMIT 1;

  v_first_suit := RIGHT(v_first_card, 1);

  -- Evaluate each card
  FOR player_name, card IN 
    SELECT * FROM jsonb_each_text(p_table_cards)
  LOOP
    v_current_value := get_card_value(
      card,
      v_trump_suit,
      v_first_suit,
      v_player_count
    );

    IF v_current_value > v_winning_value THEN
      v_winning_value := v_current_value;
      v_winning_card := card;
      v_winning_player := player_name;
    END IF;
  END LOOP;

  -- Return winner and points
  RETURN QUERY
  SELECT 
    v_winning_player::TEXT,
    jsonb_object_length(p_table_cards)::INTEGER;
END;
$$;

-- Updated deal cards function
CREATE OR REPLACE FUNCTION deal_cards(p_game_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_player_count INTEGER;
  v_valid_cards TEXT[];
  v_deck TEXT[];
  v_hands JSONB := '{}'::JSONB;
  v_card_count INTEGER;
  v_current_player INTEGER := 0;
BEGIN
  -- Get game parameters
  SELECT get_player_count(p_game_id) INTO v_player_count;
  
  -- Get valid cards for game mode
  SELECT get_valid_cards(v_player_count) INTO v_valid_cards;
  
  -- Shuffle deck
  SELECT ARRAY(
    SELECT v_valid_cards[i]
    FROM generate_series(1, array_length(v_valid_cards, 1)) i
    ORDER BY random()
  ) INTO v_deck;

  -- Calculate cards per player
  v_card_count := array_length(v_deck, 1) / v_player_count;

  -- Deal cards to each player
  FOR player_name IN 
    SELECT player_name 
    FROM lobby_players 
    WHERE lobby_id = (SELECT lobby_id FROM game_state WHERE id = p_game_id)
    ORDER BY player_position
  LOOP
    v_hands := jsonb_set(
      v_hands,
      ARRAY[player_name],
      to_jsonb(
        v_deck[v_current_player * v_card_count + 1 : 
               (v_current_player + 1) * v_card_count]
      )
    );
    v_current_player := v_current_player + 1;
  END LOOP;

  RETURN v_hands;
END;
$$;
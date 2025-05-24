/*
  # Improve Score Calculation System

  1. Changes
    - Add point tracking for each trick
    - Implement proper score calculation for special cases
    - Add validation for score updates
    - Add score history tracking
    - Improve score calculation accuracy

  2. New Functions
    - calculate_trick_points: Calculate points for a single trick
    - update_scores: Update game scores with validation
    - check_game_end: Check if game is finished
    - track_score_history: Track score changes

  3. Security
    - Enable RLS on score_history table
    - Add policies for score history access
*/

-- Create score history table
CREATE TABLE IF NOT EXISTS score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES game_state(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  points_before integer NOT NULL,
  points_after integer NOT NULL,
  points_change integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Anyone can view score history"
  ON score_history
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can create score history"
  ON score_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to calculate trick points
CREATE OR REPLACE FUNCTION calculate_trick_points(
  p_game_id UUID,
  p_table_cards JSONB,
  p_trump_suit CHAR
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_points INTEGER := 0;
  v_card TEXT;
  v_player_count INTEGER;
  v_has_permanent_trump BOOLEAN := false;
BEGIN
  -- Get player count
  SELECT get_player_count(p_game_id) INTO v_player_count;

  -- Base points for winning the trick
  v_points := jsonb_object_length(p_table_cards);

  -- Check for permanent trumps
  FOR v_card IN 
    SELECT value 
    FROM jsonb_each_text(p_table_cards)
  LOOP
    IF is_permanent_trump(v_card, v_player_count) THEN
      v_has_permanent_trump := true;
      
      -- Extra points for permanent trumps
      v_points := v_points + CASE v_card
        WHEN 'QC' THEN 3  -- Queen of Clubs
        WHEN 'QS' THEN 2  -- Queen of Spades
        WHEN 'JC' THEN 2  -- Jack of Clubs
        WHEN 'JS' THEN 1  -- Jack of Spades
        WHEN 'JH' THEN 1  -- Jack of Hearts
        WHEN 'JD' THEN 1  -- Jack of Diamonds
        ELSE 0
      END;
    END IF;
  END LOOP;

  -- Bonus points for trump tricks
  IF NOT v_has_permanent_trump AND p_trump_suit IS NOT NULL THEN
    FOR v_card IN 
      SELECT value 
      FROM jsonb_each_text(p_table_cards)
    LOOP
      IF RIGHT(v_card, 1) = p_trump_suit THEN
        v_points := v_points + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN v_points;
END;
$$;

-- Function to update scores with validation
CREATE OR REPLACE FUNCTION update_scores(
  p_game_id UUID,
  p_winner_name TEXT,
  p_points INTEGER,
  p_reason TEXT DEFAULT 'trick_win'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_scores JSONB;
  v_winner_score INTEGER;
  v_new_score INTEGER;
  v_game_status TEXT;
BEGIN
  -- Get current scores and status
  SELECT 
    scores,
    status
  INTO 
    v_current_scores,
    v_game_status
  FROM game_state
  WHERE id = p_game_id;

  -- Validate game is active
  IF v_game_status != 'active' THEN
    RAISE EXCEPTION 'Cannot update scores: game is not active';
  END IF;

  -- Get winner's current score
  v_winner_score := (v_current_scores->>p_winner_name)::INTEGER;
  
  -- Calculate new score
  v_new_score := v_winner_score - p_points;

  -- Validate score change
  IF v_new_score < 0 THEN
    v_new_score := 0;
  END IF;

  -- Track score history
  INSERT INTO score_history (
    game_id,
    player_name,
    points_before,
    points_after,
    points_change,
    reason
  ) VALUES (
    p_game_id,
    p_winner_name,
    v_winner_score,
    v_new_score,
    p_points,
    p_reason
  );

  -- Update game state scores
  UPDATE game_state
  SET scores = jsonb_set(
    scores,
    ARRAY[p_winner_name],
    to_jsonb(v_new_score)
  )
  WHERE id = p_game_id;

  -- Return updated scores
  RETURN (SELECT scores FROM game_state WHERE id = p_game_id);
END;
$$;

-- Function to check if game is finished
CREATE OR REPLACE FUNCTION check_game_end(
  p_game_id UUID
)
RETURNS TABLE (
  is_finished BOOLEAN,
  winner_team JSONB,
  is_vol BOOLEAN,
  is_double_victory BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_scores JSONB;
  v_trump_declarer TEXT;
  v_player_count INTEGER;
  v_winners TEXT[];
  v_vol_achieved BOOLEAN := false;
  v_double_victory BOOLEAN := false;
BEGIN
  -- Get game state
  SELECT 
    scores,
    trump_declarer,
    get_player_count(id)
  INTO 
    v_scores,
    v_trump_declarer,
    v_player_count
  FROM game_state
  WHERE id = p_game_id;

  -- Check for winners (players at 0 points)
  SELECT ARRAY_AGG(player_name)
  INTO v_winners
  FROM jsonb_each_text(v_scores) AS t(player_name, score)
  WHERE score::INTEGER = 0;

  -- Check for vol (trump declarer's team wins before opponents score)
  IF v_trump_declarer IS NOT NULL AND array_length(v_winners, 1) > 0 THEN
    v_vol_achieved := NOT EXISTS (
      SELECT 1
      FROM score_history
      WHERE game_id = p_game_id
        AND player_name != v_trump_declarer
        AND points_change > 0
    );
  END IF;

  -- Check for double victory (both players on team reach 0)
  IF v_player_count = 4 AND array_length(v_winners, 1) = 2 THEN
    -- Players sitting opposite are partners (positions 0-2, 1-3)
    v_double_victory := EXISTS (
      SELECT 1
      FROM lobby_players lp1
      JOIN lobby_players lp2 ON 
        lp2.lobby_id = lp1.lobby_id AND
        (
          (lp1.player_position % 2 = 0 AND lp2.player_position = (lp1.player_position + 2) % 4) OR
          (lp1.player_position % 2 = 1 AND lp2.player_position = (lp1.player_position + 2) % 4)
        )
      WHERE lp1.player_name = ANY(v_winners)
        AND lp2.player_name = ANY(v_winners)
    );
  END IF;

  -- Return results
  RETURN QUERY
  SELECT 
    array_length(v_winners, 1) > 0,
    CASE WHEN array_length(v_winners, 1) > 0
      THEN jsonb_build_array(v_winners)
      ELSE NULL
    END,
    v_vol_achieved,
    v_double_victory;
END;
$$;

-- Update evaluate_trick to use new scoring
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
  v_current_player TEXT;
  v_current_card TEXT;
  v_points INTEGER;
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
  FOR v_current_player, v_current_card IN 
    SELECT * FROM jsonb_each_text(p_table_cards)
  LOOP
    v_current_value := get_card_value(
      v_current_card,
      v_trump_suit,
      v_first_suit,
      v_player_count
    );

    IF v_current_value > v_winning_value THEN
      v_winning_value := v_current_value;
      v_winning_card := v_current_card;
      v_winning_player := v_current_player;
    END IF;
  END LOOP;

  -- Calculate points for this trick
  v_points := calculate_trick_points(
    p_game_id,
    p_table_cards,
    v_trump_suit
  );

  -- Return winner and points
  RETURN QUERY
  SELECT 
    v_winning_player::TEXT,
    v_points;
END;
$$;
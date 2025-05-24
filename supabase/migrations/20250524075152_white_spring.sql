/*
  # Add score history tracking

  1. New Tables
    - `score_history` - Tracks point changes during the game
      - `id` (uuid, primary key)
      - `game_id` (uuid, references game_state)
      - `player_name` (text)
      - `points_before` (integer)
      - `points_after` (integer)
      - `points_change` (integer)
      - `reason` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `score_history` table
    - Add policies for viewing and creating score history records
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view score history" ON score_history;
DROP POLICY IF EXISTS "System can create score history" ON score_history;

-- Create score history table if it doesn't exist
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
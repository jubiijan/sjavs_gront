/*
  # Fix ready status toggle functionality
  
  1. Changes
    - Update lobby players policy to allow status updates
    - Simplify the policy check to focus on player_name match
    
  2. Security
    - Maintains player-specific updates
    - Ensures players can only update their own status
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Players can update their own status" ON lobby_players;

-- Create new simplified policy
CREATE POLICY "Players can update their own status"
ON lobby_players
FOR UPDATE
TO authenticated
USING (
  player_name = (
    SELECT player_name 
    FROM player_profiles 
    WHERE email = auth.jwt()->>'email'
  )
);

-- Add index to improve performance
CREATE INDEX IF NOT EXISTS idx_lobby_players_player_name 
ON lobby_players(player_name);
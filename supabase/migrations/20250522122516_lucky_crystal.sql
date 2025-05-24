/*
  # Fix lobby player ready status update

  1. Changes
    - Update policy for players to modify their own ready status
    - Add specific check for ready status updates
    
  2. Security
    - Players can only update their own status
    - Maintains existing security model
*/

-- Drop existing update policy
DROP POLICY IF EXISTS "Players can update their own status" ON lobby_players;

-- Create new, more specific policy
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
)
WITH CHECK (
  player_name = (
    SELECT player_name 
    FROM player_profiles 
    WHERE email = auth.jwt()->>'email'
  )
);
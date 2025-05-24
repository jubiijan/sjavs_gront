/*
  # Update lobby deletion policies
  
  1. Changes
    - Add policy for hosts to delete their lobbies
    - Ensure cascading deletion works properly
    - Fix host verification using auth.uid()
  
  2. Security
    - Only hosts can delete their own lobbies
    - Deletion only allowed when they are the only player
*/

-- First, drop existing policies that might conflict
DROP POLICY IF EXISTS "Hosts can delete their lobbies" ON lobbies;

-- Create new policy for lobby deletion
CREATE POLICY "Hosts can delete their lobbies"
ON lobbies
FOR DELETE 
TO authenticated
USING (
  host_id = auth.uid() AND
  (
    SELECT COUNT(*)
    FROM lobby_players
    WHERE lobby_id = lobbies.id
  ) = 1
);

-- Add index to improve performance
CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
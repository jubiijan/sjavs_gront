/*
  # Fix host lobby leave functionality
  
  1. Changes
    - Update lobby deletion policy to allow hosts to leave
    - Remove player count restriction
    - Add policy for hosts to delete their own lobbies
    
  2. Security
    - Only hosts can delete their own lobbies
    - Maintains existing security model
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Hosts can delete their lobbies" ON lobbies;

-- Create new policy for lobby deletion
CREATE POLICY "Hosts can delete their lobbies"
ON lobbies
FOR DELETE 
TO authenticated
USING (
  host_id = auth.uid()
);

-- Add index to improve performance
CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
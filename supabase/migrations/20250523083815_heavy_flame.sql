/*
  # Add admin game deletion functionality
  
  1. Changes
    - Add policy for admins to delete games
    - Add policy for admins to delete game history
    - Add policy for admins to delete game state
    
  2. Security
    - Only admin users can delete games
    - Maintains audit trail via system logs
*/

-- Add policy for admins to delete lobbies
CREATE POLICY "Admins can delete any lobby"
ON lobbies
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level >= 2
  )
);

-- Add policy for admins to delete game history
CREATE POLICY "Admins can delete game history"
ON game_history
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level >= 2
  )
);

-- Add policy for admins to delete game state
CREATE POLICY "Admins can delete game state"
ON game_state
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level >= 2
  )
);
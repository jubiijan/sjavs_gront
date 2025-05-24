/*
  # Add admin deletion policies
  
  1. Changes
    - Drop existing policies to avoid conflicts
    - Add policies for admins to delete lobbies and related data
    
  2. Security
    - Only admins with level 2+ can delete
    - Maintains audit trail
*/

-- First drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can delete any lobby" ON lobbies;
DROP POLICY IF EXISTS "Admins can delete game state" ON game_state;
DROP POLICY IF EXISTS "Admins can delete game history" ON game_history;

-- Add policy for admins to delete any lobby
CREATE POLICY "Admins can delete any lobby"
ON lobbies
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level >= 2
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
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level >= 2
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
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level >= 2
  )
);
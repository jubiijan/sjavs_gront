/*
  # Fix admin users policy recursion

  1. Changes
    - Drop existing policy that causes recursion
    - Add new policy that checks auth.uid() directly
    - Add policy for inserting admin users
  
  2. Security
    - Only authenticated users can view admin users table if they are admins
    - System can insert new admin users
*/

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Only admins can view admin users" ON admin_users;

-- Create new non-recursive policy for viewing admin users
CREATE POLICY "Only admins can view admin users"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE auth.users.email = admin_users.email 
    AND auth.users.id = auth.uid()
  )
);

-- Add policy for inserting admin users
CREATE POLICY "System can insert admin users"
ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (true);
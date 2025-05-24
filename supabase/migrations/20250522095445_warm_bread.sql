/*
  # Fix admin_users table RLS policy

  1. Changes
    - Update the SELECT policy for admin_users table to use auth.users() instead of users table
    
  2. Security
    - Maintains RLS protection while fixing the permission issue
    - Only allows users to view their own admin status
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Only admins can view admin users" ON admin_users;

-- Create new policy using auth.users()
CREATE POLICY "Only admins can view admin users"
ON admin_users
FOR SELECT
TO authenticated
USING (
  email = auth.jwt()->>'email'
);
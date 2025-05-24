/*
  # Update admin users RLS policy

  1. Changes
    - Modify RLS policy to allow admins to view all admin users
    - Add policy for updating admin users
    - Add policy for deleting admin users
  
  2. Security
    - Only users with admin_level >= 2 can view all admin users
    - Only users with admin_level >= 3 can modify admin users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Only admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "System can insert admin users" ON admin_users;

-- Create new policies
CREATE POLICY "Admins can view admin users"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level >= 2
  )
);

CREATE POLICY "Super admins can insert admin users"
ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level >= 3
  )
);

CREATE POLICY "Super admins can update admin users"
ON admin_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level >= 3
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level >= 3
  )
);

CREATE POLICY "Super admins can delete admin users"
ON admin_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level >= 3
  )
);
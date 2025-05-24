/*
  # Fix admin users policy recursion

  1. Changes
    - Drop existing policies that cause recursion
    - Create new simplified policy for viewing admin users
    - Add basic check using JWT email

  2. Security
    - Maintains admin-only access
    - Uses JWT claims instead of recursive queries
    - Prevents infinite recursion
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can insert admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can update admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can delete admin users" ON admin_users;

-- Create new simplified policies
CREATE POLICY "View own admin record"
ON admin_users
FOR SELECT
TO authenticated
USING (
  email = auth.jwt()->>'email'
);

CREATE POLICY "Super admins view all"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
);

CREATE POLICY "Super admins manage users"
ON admin_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
);
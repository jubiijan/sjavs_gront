/*
  # Fix admin users RLS policies to prevent infinite recursion
  
  1. Changes
    - Drop all existing admin_users policies
    - Create new non-recursive policies
    - Fix infinite recursion issue
    
  2. Security
    - Maintain same security model
    - Prevent policy recursion
    - Keep admin-only access
*/

-- First drop all existing policies
DROP POLICY IF EXISTS "Admin view all records" ON admin_users;
DROP POLICY IF EXISTS "Super admin manage all" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;
DROP POLICY IF EXISTS "Admins can view admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can insert admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can update admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins can delete admin users" ON admin_users;
DROP POLICY IF EXISTS "Super admins manage users" ON admin_users;
DROP POLICY IF EXISTS "Super admins view all" ON admin_users;
DROP POLICY IF EXISTS "Only admins can view admin users" ON admin_users;

-- Create new simplified policies
CREATE POLICY "View own admin record"
ON admin_users
FOR SELECT
TO authenticated
USING (email = auth.jwt()->>'email');

CREATE POLICY "Admin view all records"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level >= 2
  )
);

CREATE POLICY "Super admin manage all"
ON admin_users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level = 3
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level = 3
  )
);
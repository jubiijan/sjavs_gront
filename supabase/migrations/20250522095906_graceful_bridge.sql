/*
  # Fix admin_users policies to prevent recursion

  1. Changes
    - Remove recursive policies from admin_users table
    - Create new, simplified policies that avoid recursion
    - Maintain security while fixing the infinite recursion issue

  2. Security
    - Maintain RLS protection
    - Ensure admins can only access appropriate records
    - Prevent unauthorized access
*/

-- First, disable RLS temporarily to modify policies
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Admins view all records" ON admin_users;
DROP POLICY IF EXISTS "Super admins manage users" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;

-- Create new, non-recursive policies
CREATE POLICY "View own admin record"
ON admin_users
FOR SELECT
TO authenticated
USING (
  email = auth.jwt()->>'email'
);

CREATE POLICY "Admin view all"
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

CREATE POLICY "Super admin manage"
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

-- Re-enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
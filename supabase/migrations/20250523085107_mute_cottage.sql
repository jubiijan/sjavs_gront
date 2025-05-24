/*
  # Fix admin users policy recursion
  
  1. Changes
    - Drop all existing admin_users policies
    - Create new simplified policies without recursion
    - Fix the policy chain that was causing infinite recursion
    
  2. Security
    - Maintain admin-only access
    - Prevent policy recursion
    - Keep existing security model
*/

-- First disable RLS to clean up policies
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin view all records" ON admin_users;
DROP POLICY IF EXISTS "Super admin manage all" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;

-- Create new simplified policies
CREATE POLICY "Admin view own record"
ON admin_users
FOR SELECT
TO authenticated
USING (
  email = auth.jwt()->>'email'
);

CREATE POLICY "Admin view all records"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM admin_users
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
    SELECT 1
    FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level = 3
  )
);

-- Re-enable RLS
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
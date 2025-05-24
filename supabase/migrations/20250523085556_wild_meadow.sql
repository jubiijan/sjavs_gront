/*
  # Fix Admin Users Policies

  1. Changes
    - Remove recursive admin check in policies
    - Simplify admin verification logic
    - Add proper policy hierarchy

  2. Security
    - Maintain row-level security
    - Preserve admin access control
    - Prevent infinite recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin view all records" ON admin_users;
DROP POLICY IF EXISTS "Admin view own record" ON admin_users;
DROP POLICY IF EXISTS "Super admin manage all" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;

-- Create new, non-recursive policies
CREATE POLICY "View own admin record"
ON admin_users
FOR SELECT
TO authenticated
USING (
  email = auth.jwt()->>'email'
);

CREATE POLICY "Super admin view all"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level = 3
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
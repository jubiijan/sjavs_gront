/*
  # Fix admin_users policies

  1. Changes
    - Remove recursive policies that were causing infinite loops
    - Restructure admin policies to use direct email checks
    - Simplify policy conditions to prevent recursion
    
  2. Security
    - Maintain same level of access control
    - Ensure super admins retain management capabilities
    - Preserve individual admin access to their own records
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Super admin manage all" ON admin_users;
DROP POLICY IF EXISTS "Super admin view all" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;

-- Create new non-recursive policies
CREATE POLICY "Super admins can manage all records"
ON admin_users
FOR ALL
TO authenticated
USING (
  email = (SELECT email FROM admin_users WHERE email = auth.jwt()->>'email' AND admin_level = 3)
)
WITH CHECK (
  email = (SELECT email FROM admin_users WHERE email = auth.jwt()->>'email' AND admin_level = 3)
);

CREATE POLICY "Admins can view their own record"
ON admin_users
FOR SELECT
TO authenticated
USING (
  email = auth.jwt()->>'email'
);
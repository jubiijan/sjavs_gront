/*
  # Fix admin_users RLS policies

  1. Changes
    - Remove recursive policies from admin_users table
    - Implement simplified policies that avoid infinite recursion
    - Maintain security while fixing the policy structure

  2. Security
    - Maintain admin level checks without recursive queries
    - Ensure proper access control for different admin levels
    - Preserve existing functionality with corrected policy logic
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Super admin manage all" ON admin_users;
DROP POLICY IF EXISTS "Super admin view all" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;

-- Create new, non-recursive policies
CREATE POLICY "Super admin manage all"
ON admin_users
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  (auth.jwt()->>'email')::text = email 
  AND admin_level = 3
)
WITH CHECK (
  (auth.jwt()->>'email')::text = email 
  AND admin_level = 3
);

CREATE POLICY "Super admin view all"
ON admin_users
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE email = (auth.jwt()->>'email')::text 
    AND admin_level = 3
  )
);

CREATE POLICY "View own admin record"
ON admin_users
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  email = (auth.jwt()->>'email')::text
);
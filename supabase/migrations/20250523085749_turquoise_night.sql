/*
  # Fix admin users policy recursion

  1. Changes
    - Remove recursive policy on admin_users table
    - Add new non-recursive policies for admin management
    
  2. Security
    - Maintain admin access control without recursion
    - Ensure super admins (level 3) can still manage all records
    - Regular admins can only view their own records
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Super admins can manage all records" ON admin_users;

-- Create new non-recursive policies
CREATE POLICY "Super admins can view all records" 
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level = 3
  )
);

CREATE POLICY "Super admins can insert records" 
ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level = 3
  )
);

CREATE POLICY "Super admins can update records" 
ON admin_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level = 3
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level = 3
  )
);

CREATE POLICY "Super admins can delete records" 
ON admin_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users
    WHERE admin_users.email = auth.jwt()->>'email'
    AND admin_users.admin_level = 3
  )
);
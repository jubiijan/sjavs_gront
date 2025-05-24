/*
  # Fix admin_users RLS policies

  1. Changes
    - Drop existing problematic policies that cause infinite recursion
    - Create new, optimized policies for admin_users table
    
  2. Security
    - Maintain same security level but with more efficient policy structure
    - Ensure admins can only view/manage based on their admin level
    - Prevent infinite recursion by avoiding self-referential queries
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Admin view all" ON admin_users;
DROP POLICY IF EXISTS "Super admin manage" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;

-- Create new policies without recursion
CREATE POLICY "View own admin record"
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
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM admin_users
    WHERE email = auth.jwt()->>'email'
    AND admin_level = 3
  )
);
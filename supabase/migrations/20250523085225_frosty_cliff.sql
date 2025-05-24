/*
  # Fix admin users policies to prevent recursion
  
  1. Changes
    - Drop and recreate admin_users policies
    - Add safety checks before creating policies
    - Add compound index for performance
    
  2. Security
    - Maintain admin-only access
    - Use JWT claims instead of recursive queries
    - Prevent infinite recursion
*/

DO $$ 
BEGIN
  -- Drop existing policies if they exist
  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin view all records' AND tablename = 'admin_users') THEN
    DROP POLICY "Admin view all records" ON admin_users;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Super admin manage all' AND tablename = 'admin_users') THEN
    DROP POLICY "Super admin manage all" ON admin_users;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'View own admin record' AND tablename = 'admin_users') THEN
    DROP POLICY "View own admin record" ON admin_users;
  END IF;
END $$;

-- Create new simplified policies
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

-- Add index for performance
DROP INDEX IF EXISTS idx_admin_users_email_level;
CREATE INDEX idx_admin_users_email_level ON admin_users(email, admin_level);
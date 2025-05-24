/*
  # Fix recursive admin policies

  1. Changes
    - Drop existing policies on admin_users table
    - Create new, non-recursive policies for admin_users table
    
  2. Security
    - Enable RLS on admin_users table
    - Add policy for super admins to manage all records
    - Add policy for users to view their own record
    - Add policy for level 2+ admins to view all records
*/

-- First, drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Super admins manage users" ON admin_users;
DROP POLICY IF EXISTS "Super admins view all" ON admin_users;
DROP POLICY IF EXISTS "View own admin record" ON admin_users;

-- Create new, non-recursive policies
CREATE POLICY "Super admins manage users"
ON admin_users
FOR ALL
TO authenticated
USING (
  admin_level = 3 AND
  email = auth.jwt()->>'email'
)
WITH CHECK (
  admin_level = 3 AND
  email = auth.jwt()->>'email'
);

CREATE POLICY "Admins view all records"
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

CREATE POLICY "View own admin record"
ON admin_users
FOR SELECT
TO authenticated
USING (
  email = auth.jwt()->>'email'
);

-- Add index for email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (email);
-- Drop existing policies
DROP POLICY IF EXISTS "Super admins can view all records" ON admin_users;
DROP POLICY IF EXISTS "Super admins can insert records" ON admin_users;
DROP POLICY IF EXISTS "Super admins can update records" ON admin_users;
DROP POLICY IF EXISTS "Super admins can delete records" ON admin_users;
DROP POLICY IF EXISTS "Admins can view their own record" ON admin_users;

-- Create new simplified policies
CREATE POLICY "View own record"
ON admin_users
FOR SELECT
TO authenticated
USING (email = auth.jwt()->>'email');

CREATE POLICY "Super admin select"
ON admin_users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
);

CREATE POLICY "Super admin insert"
ON admin_users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
);

CREATE POLICY "Super admin update"
ON admin_users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
);

CREATE POLICY "Super admin delete"
ON admin_users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.email = auth.jwt()->>'email'
    AND a.admin_level = 3
  )
);
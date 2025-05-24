/*
  # Add admin user

  1. Changes
    - Insert admin user record for jjoensen@fuglafjordur.com
    - Grant full admin permissions

  2. Security
    - Admin users are protected by RLS policies
    - Only admins can view admin users
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_users 
    WHERE email = 'jjoensen@fuglafjordur.com'
  ) THEN
    INSERT INTO admin_users (
      email,
      admin_level,
      permissions
    ) VALUES (
      'jjoensen@fuglafjordur.com',
      3,
      jsonb_build_object(
        'view_stats', true,
        'moderate_chat', true,
        'manage_lobbies', true,
        'manage_users', true,
        'view_logs', true
      )
    );
  END IF;
END $$;
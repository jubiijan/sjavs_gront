/*
  # Update lobby deletion policies
  
  1. Changes
    - Update host lobby deletion policy to allow deletion when host leaves
    - Remove single player restriction
    
  2. Security
    - Only hosts can delete their own lobbies
    - Maintains audit trail via system logs
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Hosts can delete their lobbies" ON lobbies;

-- Create new policy for lobby deletion
CREATE POLICY "Hosts can delete their lobbies"
ON lobbies
FOR DELETE 
TO authenticated
USING (host_id = auth.uid());

-- Add system log entry
INSERT INTO system_logs (
  log_level,
  category,
  message,
  metadata
) VALUES (
  'info',
  'admin',
  'Updated lobby deletion policy to allow host deletion',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'update_lobby_policy'
  )
);
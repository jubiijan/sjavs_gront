-- Drop existing admin deletion policies
DROP POLICY IF EXISTS "Admins can delete any lobby" ON lobbies;
DROP POLICY IF EXISTS "Admins can delete game state" ON game_state;
DROP POLICY IF EXISTS "Admins can delete game history" ON game_history;

-- Simplify host lobby deletion policy
DROP POLICY IF EXISTS "Hosts can delete their lobbies" ON lobbies;
CREATE POLICY "Hosts can delete their lobbies"
ON lobbies
FOR DELETE 
TO authenticated
USING (
  host_id = auth.uid() AND
  status = 'waiting'
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_lobbies_host_id ON lobbies(host_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);

-- Log the policy changes
INSERT INTO system_logs (
  log_level,
  category,
  message,
  metadata
) VALUES (
  'info',
  'admin',
  'Removed admin lobby deletion policies and simplified host deletion',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'remove_admin_policies'
  )
);
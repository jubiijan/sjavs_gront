-- Add typing status tracking
CREATE TABLE IF NOT EXISTS typing_status (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  player_name VARCHAR(50) NOT NULL,
  is_typing BOOLEAN DEFAULT false,
  last_typed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add spectator tracking
CREATE TABLE IF NOT EXISTS spectators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  player_name VARCHAR(50) NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE spectators ENABLE ROW LEVEL SECURITY;

-- Add policies
CREATE POLICY "Anyone can view typing status"
  ON typing_status
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can update typing status"
  ON typing_status
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can view spectators"
  ON spectators
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can become spectators"
  ON spectators
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add function to clean up stale typing status
CREATE OR REPLACE FUNCTION cleanup_typing_status() RETURNS void AS $$
BEGIN
  DELETE FROM typing_status
  WHERE last_typed < NOW() - INTERVAL '10 seconds';
END;
$$ LANGUAGE plpgsql;
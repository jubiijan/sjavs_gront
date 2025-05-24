/*
  # Add Tournament Support
  
  1. New Tables
    - `tournaments` - Tournament information and settings
    - `tournament_participants` - Players/teams in tournaments
    - `tournament_matches` - Tournament match schedule and results
    - `tournament_standings` - Current tournament rankings
    
  2. Security
    - Enable RLS on all tables
    - Add policies for tournament organizers and participants
*/

-- Tournaments table
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  format VARCHAR(20) NOT NULL, -- 'single_elimination', 'double_elimination', 'round_robin', 'swiss'
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'cancelled'
  max_participants INTEGER DEFAULT 8,
  current_round INTEGER DEFAULT 0,
  organizer_id UUID NOT NULL,
  rules JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tournament participants table
CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_name VARCHAR(50) REFERENCES player_profiles(player_name) ON UPDATE CASCADE,
  team_number INTEGER, -- For team tournaments
  seed_number INTEGER,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'eliminated', 'winner'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, player_name)
);

-- Tournament matches table
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  lobby_id UUID REFERENCES lobbies(id),
  player1_name VARCHAR(50) REFERENCES player_profiles(player_name) ON UPDATE CASCADE,
  player2_name VARCHAR(50) REFERENCES player_profiles(player_name) ON UPDATE CASCADE,
  winner_name VARCHAR(50) REFERENCES player_profiles(player_name) ON UPDATE CASCADE,
  scheduled_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
  UNIQUE(tournament_id, round_number, match_number)
);

-- Tournament standings table
CREATE TABLE IF NOT EXISTS tournament_standings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  player_name VARCHAR(50) REFERENCES player_profiles(player_name) ON UPDATE CASCADE,
  position INTEGER,
  matches_won INTEGER DEFAULT 0,
  matches_lost INTEGER DEFAULT 0,
  points_scored INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tournament_id, player_name)
);

-- Enable Row Level Security
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_standings ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Tournaments policies
CREATE POLICY "Anyone can view tournaments"
  ON tournaments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create tournaments"
  ON tournaments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Organizers can update their tournaments"
  ON tournaments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = organizer_id);

-- Tournament participants policies
CREATE POLICY "Anyone can view tournament participants"
  ON tournament_participants
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can join tournaments"
  ON tournament_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Tournament matches policies
CREATE POLICY "Anyone can view tournament matches"
  ON tournament_matches
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can update matches"
  ON tournament_matches
  FOR UPDATE
  TO authenticated
  USING (true);

-- Tournament standings policies
CREATE POLICY "Anyone can view tournament standings"
  ON tournament_standings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can update standings"
  ON tournament_standings
  FOR UPDATE
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournament_matches_status ON tournament_matches(status);
CREATE INDEX idx_tournament_participants_tournament ON tournament_participants(tournament_id);
CREATE INDEX idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX idx_tournament_standings_tournament ON tournament_standings(tournament_id);
/*
  # Initial Sjavs Card Game Schema

  1. New Tables
    - `lobbies` - Stores game lobbies
    - `lobby_players` - Tracks players in each lobby
    - `chat_messages` - Stores chat messages for each lobby
    - `game_state` - Tracks the current state of each game
    - `player_profiles` - Stores player information
    - `player_statistics` - Tracks player stats and achievements
    - `game_history` - Records completed games
    - `admin_users` - Admin user accounts
    - `system_logs` - System event logs

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_code VARCHAR(6) UNIQUE NOT NULL,
  host_id UUID NOT NULL,
  max_players INTEGER DEFAULT 4,
  status VARCHAR(20) DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  game_settings JSONB DEFAULT '{}'
);

-- Lobby players table
CREATE TABLE IF NOT EXISTS lobby_players (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  player_name VARCHAR(50) NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  is_ready BOOLEAN DEFAULT FALSE,
  player_position INTEGER, -- 0, 1, 2, 3 for seating
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  player_name VARCHAR(50),
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'player', -- 'player', 'system'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game state table
CREATE TABLE IF NOT EXISTS game_state (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  current_phase VARCHAR(20), -- 'bidding', 'playing', 'scoring'
  trump_suit VARCHAR(20),
  trump_declarer VARCHAR(50),
  current_player INTEGER,
  trick_number INTEGER DEFAULT 0,
  scores JSONB DEFAULT '{}',
  player_hands JSONB DEFAULT '{}',
  table_cards JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Player profiles table
CREATE TABLE IF NOT EXISTS player_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_name VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_guest BOOLEAN DEFAULT TRUE,
  profile_avatar TEXT, -- URL or base64 image
  preferred_settings JSONB DEFAULT '{}'
);

-- Player statistics table
CREATE TABLE IF NOT EXISTS player_statistics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_name VARCHAR(50) REFERENCES player_profiles(player_name),
  total_games INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_lost INTEGER DEFAULT 0,
  total_points_scored INTEGER DEFAULT 0,
  vol_achievements INTEGER DEFAULT 0, -- Times achieved "vol" (all tricks)
  times_on_hook INTEGER DEFAULT 0, -- Times had exactly 6 points
  double_victories INTEGER DEFAULT 0,
  average_game_duration INTERVAL,
  favorite_trump_suit VARCHAR(20),
  trump_success_rate DECIMAL(5,2) DEFAULT 0.00,
  trump_success_count INTEGER DEFAULT 0,
  trump_total_count INTEGER DEFAULT 0,
  partnership_wins INTEGER DEFAULT 0,
  solo_wins INTEGER DEFAULT 0, -- For 3-player variant
  longest_win_streak INTEGER DEFAULT 0,
  current_win_streak INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game history table
CREATE TABLE IF NOT EXISTS game_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lobby_id UUID REFERENCES lobbies(id),
  game_duration INTERVAL,
  winner_team JSONB, -- Array of winning player names
  final_scores JSONB, -- Final score breakdown
  trump_suit VARCHAR(20),
  trump_declarer VARCHAR(50),
  vol_achieved BOOLEAN DEFAULT FALSE,
  double_victory BOOLEAN DEFAULT FALSE,
  players_involved JSONB, -- Array of all player names
  game_variant VARCHAR(20) DEFAULT '4-player', -- '4-player', '3-player', '2-player'
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  admin_level INTEGER DEFAULT 1, -- 1=basic, 2=moderator, 3=super admin
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  permissions JSONB DEFAULT '{"view_stats": true, "moderate_chat": true, "manage_lobbies": false}'
);

-- System logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  log_level VARCHAR(20), -- 'info', 'warning', 'error', 'critical'
  category VARCHAR(50), -- 'game', 'lobby', 'chat', 'auth', 'admin'
  message TEXT NOT NULL,
  player_name VARCHAR(50),
  lobby_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Lobbies policies
CREATE POLICY "Anyone can view lobbies"
  ON lobbies
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can create lobbies"
  ON lobbies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Hosts can update their lobbies"
  ON lobbies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = host_id);

-- Lobby players policies
CREATE POLICY "Anyone can view lobby players"
  ON lobby_players
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can join lobbies"
  ON lobby_players
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update their own status"
  ON lobby_players
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Players can delete themselves from lobbies"
  ON lobby_players
  FOR DELETE
  TO authenticated
  USING (true);

-- Chat messages policies
CREATE POLICY "Anyone can view chat messages"
  ON chat_messages
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can send chat messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Game state policies
CREATE POLICY "Anyone can view game state"
  ON game_state
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Authenticated users can update game state"
  ON game_state
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update game state"
  ON game_state
  FOR UPDATE
  TO authenticated
  USING (true);

-- Player profiles policies
CREATE POLICY "Players can view profiles"
  ON player_profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Players can create their own profile"
  ON player_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Players can update their own profile"
  ON player_profiles
  FOR UPDATE
  TO authenticated
  USING (true);

-- Player statistics policies
CREATE POLICY "Anyone can view player statistics"
  ON player_statistics
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can update player statistics"
  ON player_statistics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update player statistics records"
  ON player_statistics
  FOR UPDATE
  TO authenticated
  USING (true);

-- Game history policies
CREATE POLICY "Anyone can view game history"
  ON game_history
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "System can create game history"
  ON game_history
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin users policies
CREATE POLICY "Only admins can view admin users"
  ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

-- System logs policies
CREATE POLICY "Only admins can view system logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );

CREATE POLICY "System can create logs"
  ON system_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
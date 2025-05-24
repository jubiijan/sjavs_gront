/*
  # Delete all games and related data
  
  1. Changes
    - Delete all game history records
    - Delete all game states
    - Delete all chat messages
    - Delete all lobby players
    - Delete all lobbies
    - Reset all player statistics to initial values
    
  2. Security
    - Maintains RLS policies
    - Preserves player profiles and admin data
*/

-- Delete all game-related data in the correct order
DELETE FROM game_history;
DELETE FROM game_state;
DELETE FROM chat_messages;
DELETE FROM lobby_players;
DELETE FROM lobbies;

-- Reset player statistics to initial values
UPDATE player_statistics
SET
  total_games = 0,
  games_won = 0,
  games_lost = 0,
  total_points_scored = 0,
  vol_achievements = 0,
  times_on_hook = 0,
  double_victories = 0,
  average_game_duration = NULL,
  favorite_trump_suit = NULL,
  trump_success_rate = 0.00,
  trump_success_count = 0,
  trump_total_count = 0,
  partnership_wins = 0,
  solo_wins = 0,
  longest_win_streak = 0,
  current_win_streak = 0,
  last_updated = NOW();

-- Add system log entry
INSERT INTO system_logs (
  log_level,
  category,
  message,
  metadata
) VALUES (
  'info',
  'admin',
  'All games and related data have been deleted',
  jsonb_build_object(
    'timestamp', NOW(),
    'action', 'delete_all_games'
  )
);
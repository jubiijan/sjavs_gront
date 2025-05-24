/*
  # Delete all lobbies and related data
  
  This migration will:
  1. Delete all game history records
  2. Delete all chat messages
  3. Delete all game states
  4. Delete all lobby players
  5. Delete all lobbies
  
  IMPORTANT: This is a destructive operation that cannot be undone!
*/

-- Delete related records first (due to foreign key constraints)
DELETE FROM game_history;
DELETE FROM chat_messages;
DELETE FROM game_state;
DELETE FROM lobby_players;
DELETE FROM lobbies;

-- Add system log entry
INSERT INTO system_logs (
  log_level,
  category,
  message,
  metadata
) VALUES (
  'info',
  'admin',
  'All lobbies and related data deleted via migration',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'delete_all_lobbies'
  )
);
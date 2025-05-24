/*
  # Add Missing Database Indexes
  
  1. Changes
    - Add composite indexes for game_action_queue
    - Add indexes for chat_messages
    - Add indexes for improved query performance
    
  2. Performance
    - Optimize common query patterns
    - Improve sorting performance
    - Speed up joins and filters
*/

-- Add composite index for game_action_queue
CREATE INDEX IF NOT EXISTS idx_game_action_queue_game_processed_version 
ON game_action_queue(game_id, processed, version);

-- Add indexes for chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_lobby_created 
ON chat_messages(lobby_id, created_at);

-- Add index for message type filtering
CREATE INDEX IF NOT EXISTS idx_chat_messages_type 
ON chat_messages(message_type);

-- Add index for player name lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_player 
ON chat_messages(player_name);

-- Add partial index for unprocessed actions
CREATE INDEX IF NOT EXISTS idx_game_action_queue_unprocessed 
ON game_action_queue(game_id, version) 
WHERE NOT processed;

-- Add index for action type filtering
CREATE INDEX IF NOT EXISTS idx_game_action_queue_type 
ON game_action_queue(action_type);

-- Add index for error tracking
CREATE INDEX IF NOT EXISTS idx_game_action_queue_error 
ON game_action_queue(game_id) 
WHERE error IS NOT NULL;

-- Add index for recent activity tracking
CREATE INDEX IF NOT EXISTS idx_chat_messages_recent 
ON chat_messages(lobby_id, created_at DESC);

-- Log the index creation
INSERT INTO system_logs (
  log_level,
  category,
  message,
  metadata
) VALUES (
  'info',
  'admin',
  'Added missing database indexes for performance optimization',
  jsonb_build_object(
    'timestamp', now(),
    'action', 'add_indexes'
  )
);
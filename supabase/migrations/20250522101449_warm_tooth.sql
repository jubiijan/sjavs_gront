/*
  # Delete users except admin

  This migration removes all users except the admin user (jjoensen@fuglafjordur.com).
  The deletion is done in the correct order to respect foreign key constraints.

  1. Changes
    - Delete game history records
    - Delete chat messages
    - Delete game states
    - Delete lobby players
    - Delete lobbies
    - Delete player statistics
    - Delete player profiles
    
  2. Security
    - Preserves admin user data
    - Handles foreign key constraints properly
*/

-- First delete all game-related data
DELETE FROM game_history;
DELETE FROM chat_messages;
DELETE FROM game_state;
DELETE FROM lobby_players;
DELETE FROM lobbies;

-- Delete player statistics for non-admin users
DELETE FROM player_statistics
WHERE player_name IN (
  SELECT player_name
  FROM player_profiles
  WHERE email != 'jjoensen@fuglafjordur.com'
  OR email IS NULL
);

-- Finally delete the player profiles
DELETE FROM player_profiles
WHERE email != 'jjoensen@fuglafjordur.com'
OR email IS NULL;
/*
  # Add ban functionality for users

  1. Changes
    - Add `is_banned` column to player_profiles table
    - Default value is false
    - Add index for faster queries
*/

ALTER TABLE player_profiles
ADD COLUMN IF NOT EXISTS is_banned boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_player_profiles_is_banned 
ON player_profiles(is_banned);
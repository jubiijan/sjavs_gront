/*
  # Add cascade update to player statistics foreign key

  1. Changes
    - Drop existing foreign key constraint
    - Add new foreign key constraint with ON UPDATE CASCADE
    - This allows player_name updates to propagate to statistics table
*/

-- Drop existing foreign key constraint
ALTER TABLE player_statistics
DROP CONSTRAINT IF EXISTS player_statistics_player_name_fkey;

-- Add new foreign key constraint with cascade update
ALTER TABLE player_statistics
ADD CONSTRAINT player_statistics_player_name_fkey
FOREIGN KEY (player_name)
REFERENCES player_profiles(player_name)
ON UPDATE CASCADE;
-- Add status column to game_state table
ALTER TABLE game_state 
ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_error text;

-- Create index for status lookups
CREATE INDEX IF NOT EXISTS idx_game_state_status 
ON game_state(status);

-- Add comment for documentation
COMMENT ON COLUMN game_state.status IS 'Current game status: active, interrupted, or finished';
COMMENT ON COLUMN game_state.last_error IS 'Last error that occurred in the game';
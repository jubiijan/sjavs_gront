/*
  # Add tournament deletion policy

  1. Changes
    - Add policy for organizers to delete their tournaments
    - Only allow deletion of pending tournaments
    
  2. Security
    - Only tournament organizers can delete their own tournaments
    - Tournaments can only be deleted before they start
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Organizers can delete their tournaments" ON tournaments;

-- Create new policy for tournament deletion
CREATE POLICY "Organizers can delete their tournaments"
ON tournaments
FOR DELETE
TO authenticated
USING (
  auth.uid() = organizer_id AND
  status = 'pending'
);
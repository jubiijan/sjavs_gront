import React, { useState } from 'react';
import { User, UserPlus, Users } from 'lucide-react';
import { useAudio } from '../../contexts/AudioContext';
import { useLobby } from '../../hooks/useLobby';

interface CreateJoinFormProps {
  onCreateLobby: () => void;
}

const CreateJoinForm: React.FC<CreateJoinFormProps> = ({ onCreateLobby }) => {
  const [lobbyCode, setLobbyCode] = useState('');
  const [error, setError] = useState('');
  const { playSound } = useAudio();
  const { joinLobby } = useLobby();
  
  const handleCreateLobby = () => {
    playSound('buttonClick');
    onCreateLobby();
  };
  
  const handleJoinLobby = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!lobbyCode.trim()) {
      setError('Please enter a lobby code');
      return;
    }
    
    playSound('buttonClick');
    try {
      await joinLobby(lobbyCode);
    } catch (err: any) {
      setError(err.message || 'Failed to join lobby');
    }
  };
  
  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-amber-300 mb-6 text-center">Play Sjaus</h2>
      
      <div className="space-y-6">
        <button
          onClick={handleCreateLobby}
          className="w-full py-4 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex items-center justify-center"
        >
          <UserPlus size={22} className="mr-3" />
          Create New Lobby
        </button>
        
        <div className="relative flex items-center">
          <div className="flex-grow border-t border-green-600"></div>
          <span className="mx-4 text-green-300">OR</span>
          <div className="flex-grow border-t border-green-600"></div>
        </div>
        
        <form onSubmit={handleJoinLobby}>
          <div className="mb-4">
            <label htmlFor="lobbyCode" className="block text-white mb-2">
              Join with Lobby Code
            </label>
            <input
              id="lobbyCode"
              type="text"
              value={lobbyCode}
              onChange={(e) => {
                setLobbyCode(e.target.value.toUpperCase());
                setError('');
              }}
              placeholder="Enter 6-letter code"
              className="w-full p-3 bg-green-700 text-white border border-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-green-400"
              maxLength={6}
            />
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-700/60 text-white rounded-md text-sm">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors flex items-center justify-center"
          >
            <Users size={20} className="mr-2" />
            Join Lobby
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateJoinForm;
import React from 'react';
import { LogOut, Play, Check, X, Trash2 } from 'lucide-react';
import { Lobby, LobbyPlayer } from '../../types/gameTypes';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../contexts/AudioContext';

interface LobbyControlsProps {
  lobby: Lobby;
  players: LobbyPlayer[];
  onToggleReady: () => void;
  onStartGame: () => void;
  onLeaveLobby: () => void;
  onDeleteLobby: () => void;
  isHost: boolean;
}

const LobbyControls: React.FC<LobbyControlsProps> = ({
  lobby,
  players,
  onToggleReady,
  onStartGame,
  onLeaveLobby,
  isHost
}) => {
  const { playerName } = useAuth();
  const { playSound } = useAudio();
  
  // Find current player
  const currentPlayer = players.find(p => p.player_name === playerName);
  
  // Check if all players are ready
  const allPlayersReady = players.every(p => p.is_ready || p.is_host);
  
  // Check if we have enough players (at least 3)
  const enoughPlayers = players.length >= 3;
  
  // Can start game if host, all players ready, and enough players
  const canStartGame = isHost && allPlayersReady && enoughPlayers;
  
  const handleToggleReady = () => {
    playSound('buttonClick');
    onToggleReady();
  };
  
  const handleStartGame = () => {
    playSound('shuffle');
    onStartGame();
  };
  
  const handleLeaveLobby = () => {
    playSound('buttonClick');
    onLeaveLobby();
  };
  
  // Don't show ready controls if game is in progress
  if (lobby.status === 'playing') {
    return (
      <div className="bg-green-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-amber-300 mb-4">Game in Progress</h2>
        <button
          onClick={handleLeaveLobby}
          className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors flex items-center justify-center"
        >
          <LogOut size={20} className="mr-2" />
          Leave Game
        </button>
      </div>
    );
  }
  
  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">Controls</h2>
      
      <div className="space-y-4">
        {!isHost && currentPlayer && (
          <button
            onClick={handleToggleReady}
            className={`w-full py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${
              currentPlayer.is_ready
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {currentPlayer.is_ready ? (
              <>
                <X size={20} className="mr-2" />
                Not Ready
              </>
            ) : (
              <>
                <Check size={20} className="mr-2" />
                Ready to play
              </>
            )}
          </button>
        )}
        
        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={!canStartGame}
            className={`w-full py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${
              canStartGame
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-gray-500 text-gray-200 cursor-not-allowed'
            }`}
          >
            <Play size={20} className="mr-2" />
            Start Game
          </button>
        )}
        
        {!canStartGame && isHost && (
          <div className="text-sm text-amber-300 mt-2">
            {!allPlayersReady && <p>• All players must be ready</p>}
            {!enoughPlayers && <p>• Need at least 3 players</p>}
          </div>
        )}
        
        <button
          onClick={handleLeaveLobby}
          className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors flex items-center justify-center"
        >
          {isHost ? (
            <>
              <Trash2 size={20} className="mr-2" />
              Delete Lobby
            </>
          ) : (
            <>
              <LogOut size={20} className="mr-2" />
              Leave Lobby
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default LobbyControls;
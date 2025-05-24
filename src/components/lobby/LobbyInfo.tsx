import React from 'react';
import { Copy, Users, Crown, AlertTriangle } from 'lucide-react';
import { Lobby, LobbyPlayer } from '../../types/gameTypes';
import { useAudio } from '../../contexts/AudioContext';

interface LobbyInfoProps {
  lobby: Lobby;
  players: LobbyPlayer[];
}

const LobbyInfo: React.FC<LobbyInfoProps> = ({ lobby, players }) => {
  const { playSound } = useAudio();
  
  const copyLobbyCode = () => {
    navigator.clipboard.writeText(lobby.lobby_code);
    playSound('buttonClick');
  };
  
  // Find the host player
  const hostPlayer = players.find(player => player.is_host);

  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-amber-300">Lobby Information</h2>
        <div className="flex items-center space-x-2">
          <Users size={20} className="text-amber-300" />
          <span className="text-white font-medium">{players.length} / {lobby.max_players}</span>
        </div>
      </div>
      
      <div className="bg-green-700 rounded-md p-4 mb-4">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-green-100 mb-1">Lobby Code:</p>
            <p className="text-xl font-mono font-bold tracking-wider text-white">{lobby.lobby_code}</p>
          </div>
          <button 
            className="p-2 bg-green-600 hover:bg-green-500 rounded-md transition-colors"
            onClick={copyLobbyCode}
            title="Copy Lobby Code"
          >
            <Copy size={20} className="text-white" />
          </button>
        </div>
      </div>
      
      <div className="bg-green-700 rounded-md p-4 mb-4">
        <div className="mb-2">
          <p className="text-sm text-green-100">Host:</p>
          <div className="flex items-center mt-1">
            <Crown size={18} className="text-amber-400 mr-2" />
            <p className="text-white font-medium">{hostPlayer?.player_name || 'Unknown'}</p>
          </div>
        </div>
        
        <div>
          <p className="text-sm text-green-100 mb-1">Status:</p>
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            lobby.status === 'waiting' ? 'bg-blue-600 text-white' :
            lobby.status === 'playing' ? 'bg-amber-600 text-white' :
            'bg-gray-600 text-white'
          }`}>
            {lobby.status.charAt(0).toUpperCase() + lobby.status.slice(1)}
          </div>
        </div>
      </div>

      {players.length === 3 && (
        <div className="bg-amber-600/20 rounded-md p-4 border border-amber-500/30">
          <div className="flex items-start">
            <AlertTriangle size={24} className="text-amber-400 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h3 className="text-amber-300 font-medium mb-1">3-Player Variant</h3>
              <p className="text-green-100 text-sm leading-relaxed">
                In 3-player mode, all diamond cards are removed from the deck. Each player still receives 8 cards, and the game rules remain the same with permanent trumps (Q♣, Q♠, J♣, J♠, J♥).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyInfo;
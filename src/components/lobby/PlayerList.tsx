import React from 'react';
import { Crown, CheckCircle, XCircle, UserX, Wifi, WifiOff } from 'lucide-react';
import { LobbyPlayer } from '../../types/gameTypes';
import { useAuth } from '../../hooks/useAuth';
import { useAudio } from '../../contexts/AudioContext';

interface PlayerListProps {
  players: LobbyPlayer[];
  onKickPlayer?: (playerName: string) => void;
  isHost?: boolean;
  presenceState?: Record<string, any>;
}

const PlayerList: React.FC<PlayerListProps> = ({ 
  players, 
  onKickPlayer, 
  isHost,
  presenceState = {}
}) => {
  const { playerName } = useAuth();
  const { playSound } = useAudio();
  
  const handleKick = (playerToKick: string) => {
    if (onKickPlayer && isHost && playerToKick !== playerName) {
      playSound('buttonClick');
      onKickPlayer(playerToKick);
    }
  };

  const getPlayerPresence = (name: string) => {
    const presence = Object.values(presenceState).flat().find(
      (p: any) => p.player_name === name
    );
    
    if (!presence) return 'offline';
    
    const lastSeen = new Date(presence.last_seen);
    const now = new Date();
    const diff = now.getTime() - lastSeen.getTime();
    
    if (diff < 30000) return 'online'; // Less than 30 seconds
    if (diff < 120000) return 'idle'; // Less than 2 minutes
    return 'away';
  };
  
  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">Players</h2>
      
      <div className="space-y-3">
        {players.map((player) => {
          const presence = getPlayerPresence(player.player_name);
          
          return (
            <div 
              key={player.id} 
              className={`flex items-center justify-between p-3 rounded-md ${
                player.player_name === playerName 
                  ? 'bg-green-600 border-2 border-amber-400' 
                  : 'bg-green-700'
              }`}
            >
              <div className="flex items-center">
                {player.is_host && (
                  <Crown size={18} className="text-amber-400 mr-2" />
                )}
                <span className="font-medium text-white">
                  {player.player_name}
                  {player.player_name === playerName && ' (You)'}
                </span>
                {presence === 'online' ? (
                  <Wifi size={14} className="ml-2 text-green-400" />
                ) : presence === 'idle' ? (
                  <Wifi size={14} className="ml-2 text-amber-400" />
                ) : (
                  <WifiOff size={14} className="ml-2 text-red-400" />
                )}
              </div>
              
              <div className="flex items-center space-x-3">
                {player.is_ready ? (
                  <div className="flex items-center text-green-300">
                    <CheckCircle size={18} className="mr-1" />
                    <span className="text-sm">Ready</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-300">
                    <XCircle size={18} className="mr-1" />
                    <span className="text-sm">Not Ready</span>
                  </div>
                )}
                
                {isHost && !player.is_host && (
                  <button
                    onClick={() => handleKick(player.player_name)}
                    className="p-1 hover:bg-red-600/20 rounded-full transition-colors"
                    title="Kick Player"
                  >
                    <UserX size={18} className="text-red-400" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Empty slots */}
        {Array.from({ length: 4 - players.length }).map((_, index) => (
          <div 
            key={`empty-${index}`} 
            className="flex items-center justify-center p-3 bg-green-700/30 rounded-md border border-dashed border-green-600"
          >
            <span className="text-green-400 text-sm">Waiting for player...</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerList;
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Crown, Trash2, Clock } from 'lucide-react';
import { Lobby, LobbyPlayer } from '../../types/gameTypes';
import { useAudio } from '../../contexts/AudioContext';
import { useAuth } from '../../hooks/useAuth';
import { useLobby } from '../../hooks/useLobby';
import { supabase } from '../../lib/supabase';

interface LobbyListProps {
  lobbies: {
    lobby: Lobby;
    players: LobbyPlayer[];
  }[];
}

const LobbyList: React.FC<LobbyListProps> = ({ lobbies }) => {
  const { playSound } = useAudio();
  const { playerName, user } = useAuth();
  const { joinLobby } = useLobby();
  
  const handleJoinLobby = async (code: string) => {
    playSound('buttonClick');
    await joinLobby(code);
  };

  const handleDeleteLobby = async (lobby: Lobby) => {
    if (!user || lobby.host_id !== user.id) return;
    
    if (window.confirm('Are you sure you want to delete this lobby? This action cannot be undone.')) {
      playSound('buttonClick');
      try {
        const { error } = await supabase
          .from('lobbies')
          .delete()
          .eq('id', lobby.id)
          .eq('host_id', user.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error deleting lobby:', error);
        alert('Failed to delete lobby. Please try again.');
      }
    }
  };

  const getLastActivity = (lastActivity: string) => {
    const now = new Date();
    const activity = new Date(lastActivity);
    const diff = Math.floor((now.getTime() - activity.getTime()) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };
  
  if (lobbies.length === 0) {
    return (
      <div className="text-center py-8 text-green-300">
        <p>No active lobbies found.</p>
        <p className="text-sm mt-2">Create a new lobby to start playing!</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {lobbies.map(({ lobby, players }) => {
        const hostPlayer = players.find(p => p.is_host);
        const isHost = lobby.host_id === user?.id;
        const isAlone = players.length === 1;
        const isInLobby = players.some(p => p.player_name === playerName);
        const isFull = players.length >= lobby.max_players;

        return (
          <div key={lobby.id} className="bg-green-700/50 rounded-lg p-4 hover:bg-green-700/70 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-white font-bold flex items-center">
                  {hostPlayer?.player_name}
                  <Crown size={16} className="text-amber-400 ml-2" />
                </h3>
                <p className="text-sm text-green-300">Code: {lobby.lobby_code}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center text-green-300">
                  <Users size={16} className="mr-1" />
                  <span>{players.length}/{lobby.max_players}</span>
                </div>
                {isHost && isAlone && (
                  <button
                    onClick={() => handleDeleteLobby(lobby)}
                    className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-red-900/20"
                    title="Delete Lobby"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-3">
              {players.map(player => (
                <span 
                  key={player.id} 
                  className={`text-sm px-2 py-1 rounded ${
                    player.is_ready 
                      ? 'bg-green-600 text-white' 
                      : 'bg-green-800 text-green-300'
                  }`}
                >
                  {player.player_name}
                </span>
              ))}
            </div>

            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center text-sm text-green-400">
                <Clock size={14} className="mr-1" />
                <span>Active {getLastActivity(lobby.last_activity)}</span>
              </div>
              {players.length === 3 && (
                <span className="text-sm text-amber-400">3-Player Mode</span>
              )}
            </div>
            
            <button
              onClick={() => handleJoinLobby(lobby.lobby_code)}
              disabled={isFull && !isInLobby}
              className={`w-full py-2 px-4 rounded text-sm font-medium transition-colors ${
                isFull && !isInLobby
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : isInLobby
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              {isInLobby ? 'Rejoin Game' : isFull ? 'Lobby Full' : 'Join Game'}
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default LobbyList;
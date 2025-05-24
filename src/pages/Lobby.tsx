import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import LobbyInfo from '../components/lobby/LobbyInfo';
import PlayerList from '../components/lobby/PlayerList';
import LobbyControls from '../components/lobby/LobbyControls';
import TableIllustration from '../components/lobby/TableIllustration';
import ChatBox from '../components/chat/ChatBox';
import { useLobby } from '../hooks/useLobby';

const Lobby: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { 
    lobby, 
    players, 
    isLoading, 
    error,
    isHost,
    presenceState,
    toggleReady, 
    startGame, 
    leaveLobby,
    kickPlayer
  } = useLobby(code);
  
  useEffect(() => {
    if (error) {
      console.error('Lobby error:', error);
    }
  }, [error]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-400"></div>
      </div>
    );
  }
  
  if (!lobby) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="bg-green-800 rounded-lg p-8 shadow-lg text-center">
          <h2 className="text-2xl font-bold text-amber-300 mb-4">Lobby Not Found</h2>
          <p className="text-white mb-6">The lobby you're looking for doesn't exist or has ended.</p>
          <button 
            onClick={() => navigate('/')}
            className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-green-900 flex flex-col">
      <Header />
      
      <div className="flex-grow container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <LobbyInfo lobby={lobby} players={players} />
            <TableIllustration players={players} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PlayerList 
                players={players} 
                onKickPlayer={kickPlayer}
                isHost={isHost()}
                presenceState={presenceState}
              />
              <LobbyControls 
                lobby={lobby} 
                players={players}
                onToggleReady={toggleReady}
                onStartGame={startGame}
                onLeaveLobby={leaveLobby}
                onDeleteLobby={() => {}}
                isHost={isHost()}
              />
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <ChatBox lobbyId={lobby.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
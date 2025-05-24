import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import GameBoard from '../components/game/GameBoard';
import GameInfo from '../components/game/GameInfo';
import BiddingControls from '../components/game/BiddingControls';
import ChatBox from '../components/lobby/ChatBox';
import { useGame } from '../hooks/useGame';

const Game: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { 
    gameState, 
    players, 
    isLoading, 
    error, 
    isPlayerTurn, 
    selectTrump, 
    passBid, 
    playCard,
    isConnected
  } = useGame(code || '');
  
  useEffect(() => {
    if (error) {
      console.error('Game error:', error);
    }
  }, [error]);
  
  if (isLoading || !gameState) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-amber-400"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-green-900 flex flex-col">
      <Header />
      
      <div className="flex-grow container mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <GameBoard 
              gameState={gameState} 
              players={players}
              onPlayCard={playCard}
              isConnected={isConnected}
            />
            
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <GameInfo gameState={gameState} players={players} />
              
              {gameState.current_phase === 'bidding' ? (
                <BiddingControls 
                  onSelectTrump={selectTrump}
                  onPass={passBid}
                  isPlayerTurn={isPlayerTurn()}
                />
              ) : (
                <div className="bg-green-800 rounded-lg p-6 shadow-lg">
                  <h2 className="text-2xl font-bold text-amber-300 mb-4">Playing Phase</h2>
                  <p className="text-white">
                    {isPlayerTurn() 
                      ? "It's your turn! Select a card to play." 
                      : "Wait for your turn..."}
                  </p>
                  
                  <div className="mt-4 text-sm text-amber-300">
                    <p>• Follow the suit of the first card played if possible</p>
                    <p>• Remember the permanent trumps are highest</p>
                    <p>• Winner of the trick leads the next one</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <ChatBox lobbyId={gameState.lobby_id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Game;
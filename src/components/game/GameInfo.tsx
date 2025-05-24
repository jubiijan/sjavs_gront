import React from 'react';
import { GameState, LobbyPlayer } from '../../types/gameTypes';
import { Heart, Diamond, Club, Spade } from 'lucide-react';

interface GameInfoProps {
  gameState: GameState;
  players: LobbyPlayer[];
}

const GameInfo: React.FC<GameInfoProps> = ({ gameState, players }) => {
  const getTrumpIcon = () => {
    switch(gameState.trump_suit) {
      case 'H': return <Heart className="text-red-600" size={24} />;
      case 'D': return <Diamond className="text-red-600" size={24} />;
      case 'C': return <Club className="text-green-900" size={24} />;
      case 'S': return <Spade className="text-green-900" size={24} />;
      default: return null;
    }
  };
  
  const getCurrentPhaseText = () => {
    switch(gameState.current_phase) {
      case 'bidding': return 'Bidding Phase';
      case 'playing': return `Trick ${gameState.trick_number + 1}`;
      case 'scoring': return 'Final Scoring';
      default: return 'Unknown Phase';
    }
  };
  
  const getCurrentPlayerName = () => {
    const currentPlayerPosition = gameState.current_player;
    const currentPlayer = players.find(p => p.player_position === currentPlayerPosition);
    return currentPlayer?.player_name || 'Unknown';
  };
  
  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">Game Info</h2>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-700 rounded-md p-3">
          <div className="text-sm text-green-100 mb-1">Phase:</div>
          <div className="text-white font-bold">{getCurrentPhaseText()}</div>
        </div>
        
        <div className="bg-green-700 rounded-md p-3">
          <div className="text-sm text-green-100 mb-1">Current Player:</div>
          <div className="text-white font-bold">{getCurrentPlayerName()}</div>
        </div>
      </div>
      
      {gameState.trump_suit && (
        <div className="mt-4 bg-green-700 rounded-md p-3">
          <div className="text-sm text-green-100 mb-1">Trump:</div>
          <div className="flex items-center">
            {getTrumpIcon()}
            <span className="text-white font-bold ml-2">
              {gameState.trump_suit === 'H' && 'Hearts'}
              {gameState.trump_suit === 'D' && 'Diamonds'}
              {gameState.trump_suit === 'C' && 'Clubs'}
              {gameState.trump_suit === 'S' && 'Spades'}
            </span>
          </div>
          <div className="text-sm text-green-100 mt-1">
            Declared by: <span className="text-white">{gameState.trump_declarer}</span>
          </div>
        </div>
      )}
      
      <div className="mt-4 bg-green-700 rounded-md p-3">
        <div className="text-sm text-green-100 mb-2">Scores:</div>
        <div className="space-y-2">
          {Object.entries(gameState.scores || {}).map(([player, score]) => (
            <div key={player} className="flex justify-between items-center">
              <div className="text-white">{player}</div>
              <div className={`font-bold ${score <= 0 ? 'text-amber-400' : 'text-white'}`}>
                {score}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameInfo;
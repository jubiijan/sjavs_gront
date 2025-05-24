import React from 'react';
import Card from './Card';
import { GameState, LobbyPlayer } from '../../types/gameTypes';
import { useAuth } from '../../hooks/useAuth';
import './GameBoard.css';

interface GameBoardProps {
  gameState: GameState;
  players: LobbyPlayer[];
  onPlayCard: (card: string) => void;
  isConnected: boolean;
}

const GameBoard: React.FC<GameBoardProps> = ({ gameState, players, onPlayCard, isConnected }) => {
  const { playerName } = useAuth();
  const playerHand = gameState.player_hands[playerName || ''] || [];
  const tableCards = gameState.table_cards || {};
  
  // Find current player's position
  const currentPlayer = players.find(p => p.player_name === playerName);
  const currentPosition = currentPlayer?.player_position || 0;
  
  // Calculate positions for all players relative to current player
  const getPlayerPosition = (position: number) => {
    const relativePosition = (position - currentPosition + 4) % 4;
    
    switch(relativePosition) {
      case 0: return 'bottom';
      case 1: return 'left';
      case 2: return 'top';
      case 3: return 'right';
      default: return 'bottom';
    }
  };
  
  // Get the player at a specific table position
  const getPlayerAtPosition = (position: string) => {
    switch(position) {
      case 'bottom':
        return players.find(p => p.player_position === currentPosition);
      case 'left':
        return players.find(p => p.player_position === (currentPosition + 1) % 4);
      case 'top':
        return players.find(p => p.player_position === (currentPosition + 2) % 4);
      case 'right':
        return players.find(p => p.player_position === (currentPosition + 3) % 4);
      default:
        return undefined;
    }
  };
  
  // Check if it's the current player's turn
  const isPlayerTurn = gameState.current_player === currentPosition;
  
  // Check if card is playable
  const isCardPlayable = (card: string) => {
    if (!isPlayerTurn || gameState.current_phase !== 'playing' || !isConnected) {
      return false;
    }

    // Get the first card played in this trick
    const firstCard = Object.values(tableCards)[0];
    
    // If no cards played yet, any card is playable
    if (!firstCard) {
      return true;
    }

    // Get the suit of the first card played
    const firstCardSuit = firstCard.slice(-1);
    const cardSuit = card.slice(-1);

    // Check if player has any cards of the led suit
    const hasSameSuit = playerHand.some(c => c.slice(-1) === firstCardSuit);

    // If player has cards of the led suit, they must play one
    if (hasSameSuit) {
      return cardSuit === firstCardSuit;
    }

    // If player has no cards of the led suit, they can play any card
    return true;
  };
  
  return (
    <div className="game-board">
      <div className="felt-background">
        {!isConnected && (
          <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center py-2 px-4">
            Reconnecting to game...
          </div>
        )}
        
        {/* Trump indicator */}
        {gameState.trump_suit && (
          <div className="trump-indicator">
            <div className="text-xl font-bold mb-1">Trump</div>
            <div className={`trump-suit ${
              gameState.trump_suit === 'H' || gameState.trump_suit === 'D' 
                ? 'text-red-600' 
                : 'text-green-950'
            }`}>
              {gameState.trump_suit === 'H' && '♥'}
              {gameState.trump_suit === 'D' && '♦'}
              {gameState.trump_suit === 'C' && '♣'}
              {gameState.trump_suit === 'S' && '♠'}
            </div>
            <div className="text-sm mt-1">
              by {gameState.trump_declarer}
            </div>
          </div>
        )}
        
        {/* Table area */}
        <div className="table-area">
          {/* Table cards */}
          {Object.entries(tableCards).map(([playerName, card]) => {
            const player = players.find(p => p.player_name === playerName);
            if (!player) return null;
            
            const position = getPlayerPosition(player.player_position);
            
            return (
              <div key={playerName} className={`table-card ${position}`}>
                <Card card={card} position="table" />
              </div>
            );
          })}
        </div>
        
        {/* Player positions */}
        {['bottom', 'left', 'top', 'right'].map(position => {
          const player = getPlayerAtPosition(position);
          const isCurrentTurn = player && gameState.current_player === player.player_position;
          
          if (!player) return null;
          
          return (
            <div key={position} className={`player-position ${position} ${isCurrentTurn ? 'current-turn' : ''}`}>
              <div className="player-name">{player.player_name}</div>
              <div className="player-score">Score: {gameState.scores[player.player_name]}</div>
            </div>
          );
        })}
        
        {/* Player's hand */}
        <div className="player-hand">
          {playerHand.map((card, index) => (
            <Card 
              key={card} 
              card={card} 
              isPlayable={isCardPlayable(card)}
              onClick={() => onPlayCard(card)}
              position="hand"
              rotation={-10 + (index * 5)}
              index={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;
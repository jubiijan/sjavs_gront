import React from 'react';
import { useAudio } from '../../contexts/AudioContext';
import './Card.css';

interface CardProps {
  card: string;
  isPlayable?: boolean;
  onClick?: () => void;
  position?: 'hand' | 'table';
  rotation?: number;
  index?: number;
}

const Card: React.FC<CardProps> = ({ 
  card, 
  isPlayable = false, 
  onClick, 
  position = 'hand',
  rotation = 0,
  index = 0
}) => {
  const { playSound } = useAudio();
  
  // Parse card into rank and suit
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  
  // Convert suit to symbol and color
  const getSuitInfo = (suit: string) => {
    switch(suit) {
      case 'H': return { symbol: '♥', color: 'text-red-600' };
      case 'D': return { symbol: '♦', color: 'text-red-600' };
      case 'C': return { symbol: '♣', color: 'text-green-900' };
      case 'S': return { symbol: '♠', color: 'text-green-900' };
      default: return { symbol: '?', color: 'text-gray-700' };
    }
  };
  
  const { symbol, color } = getSuitInfo(suit);
  
  const handleClick = () => {
    if (isPlayable && onClick) {
      playSound('cardPlace');
      onClick();
    }
  };
  
  // Calculate visual position for card in hand
  const getPositionStyle = () => {
    if (position === 'hand') {
      return {
        transform: `translateX(${index * 30}px) rotate(${rotation}deg)`,
        zIndex: index
      };
    }
    return {};
  };
  
  return (
    <div 
      className={`card ${position} ${isPlayable ? 'playable' : ''}`}
      onClick={handleClick}
      style={getPositionStyle()}
    >
      <div className="card-inner">
        <div className="card-content">
          <div className={`card-rank ${color}`}>
            {rank}
            <div className={`card-suit ${color}`}>{symbol}</div>
          </div>
          
          <div className={`card-suit center ${color}`}>{symbol}</div>
          
          <div className={`card-rank ${color}`} style={{ transform: 'rotate(180deg)' }}>
            {rank}
            <div className={`card-suit ${color}`}>{symbol}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card;
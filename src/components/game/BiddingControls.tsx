import React from 'react';
import { useAudio } from '../../contexts/AudioContext';

interface BiddingControlsProps {
  onSelectTrump: (suit: string) => void;
  onPass: () => void;
  isPlayerTurn: boolean;
}

const BiddingControls: React.FC<BiddingControlsProps> = ({ 
  onSelectTrump, 
  onPass, 
  isPlayerTurn 
}) => {
  const { playSound } = useAudio();
  
  const handleSelectTrump = (suit: string) => {
    playSound('buttonClick');
    onSelectTrump(suit);
  };
  
  const handlePass = () => {
    playSound('buttonClick');
    onPass();
  };
  
  if (!isPlayerTurn) {
    return (
      <div className="bg-green-800 rounded-lg p-6 shadow-lg text-center">
        <h2 className="text-2xl font-bold text-amber-300 mb-4">Bidding Phase</h2>
        <p className="text-white">Waiting for other players to bid...</p>
      </div>
    );
  }
  
  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">Your Turn to Bid</h2>
      
      <div className="mb-4">
        <p className="text-white mb-2">Select trump suit:</p>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => handleSelectTrump('H')} 
            className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            <span className="text-2xl">♥</span> Hearts
          </button>
          <button 
            onClick={() => handleSelectTrump('D')} 
            className="py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
          >
            <span className="text-2xl">♦</span> Diamonds
          </button>
          <button 
            onClick={() => handleSelectTrump('C')} 
            className="py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
          >
            <span className="text-2xl">♣</span> Clubs
          </button>
          <button 
            onClick={() => handleSelectTrump('S')} 
            className="py-3 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
          >
            <span className="text-2xl">♠</span> Spades
          </button>
        </div>
      </div>
      
      <button 
        onClick={handlePass} 
        className="w-full py-3 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
      >
        Pass
      </button>
      
      <div className="mt-4 text-sm text-amber-300">
        <p>• You need at least 5 cards of the same suit to declare it as trump</p>
        <p>• Remember that Q♣, Q♠, J♣, J♠, J♥, J♦ are permanent trumps</p>
      </div>
    </div>
  );
};

export default BiddingControls;
import React from 'react';
import { User } from 'lucide-react';
import { LobbyPlayer } from '../../types/gameTypes';

interface TableIllustrationProps {
  players: LobbyPlayer[];
}

const TableIllustration: React.FC<TableIllustrationProps> = ({ players }) => {
  // Sort players by position
  const sortedPlayers = [...players].sort((a, b) => a.player_position - b.player_position);
  
  return (
    <div className="bg-green-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-2xl font-bold text-amber-300 mb-4">Table Layout</h2>
      
      <div className="relative w-full aspect-square max-w-md mx-auto">
        {/* Table */}
        <div className="absolute inset-0 m-12 bg-green-700 rounded-full border-8 border-green-600 shadow-lg">
          {/* Center decoration */}
          <div className="absolute inset-0 m-12 border-4 border-dashed border-green-600/30 rounded-full" />
        </div>
        
        {/* Player positions */}
        <div className="absolute inset-0">
          {/* Bottom player (position 0) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 transform text-center">
            <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mb-2 mx-auto shadow-lg border-4 border-green-500">
              {sortedPlayers[0] ? (
                <span className="text-2xl font-bold text-white">
                  {sortedPlayers[0].player_name[0].toUpperCase()}
                </span>
              ) : (
                <User className="w-8 h-8 text-green-300" />
              )}
            </div>
            <div className="bg-green-700/50 px-4 py-2 rounded-lg">
              <p className="text-white font-medium">
                {sortedPlayers[0]?.player_name || 'Waiting...'}
              </p>
              {sortedPlayers[0]?.is_host && (
                <p className="text-amber-400 text-sm">Host</p>
              )}
            </div>
          </div>
          
          {/* Left player (position 1) */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 transform text-center">
            <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mb-2 mx-auto shadow-lg border-4 border-green-500">
              {sortedPlayers[1] ? (
                <span className="text-2xl font-bold text-white">
                  {sortedPlayers[1].player_name[0].toUpperCase()}
                </span>
              ) : (
                <User className="w-8 h-8 text-green-300" />
              )}
            </div>
            <div className="bg-green-700/50 px-4 py-2 rounded-lg">
              <p className="text-white font-medium">
                {sortedPlayers[1]?.player_name || 'Waiting...'}
              </p>
              {sortedPlayers[1]?.is_host && (
                <p className="text-amber-400 text-sm">Host</p>
              )}
            </div>
          </div>
          
          {/* Top player (position 2) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 transform text-center">
            <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mb-2 mx-auto shadow-lg border-4 border-green-500">
              {sortedPlayers[2] ? (
                <span className="text-2xl font-bold text-white">
                  {sortedPlayers[2].player_name[0].toUpperCase()}
                </span>
              ) : (
                <User className="w-8 h-8 text-green-300" />
              )}
            </div>
            <div className="bg-green-700/50 px-4 py-2 rounded-lg">
              <p className="text-white font-medium">
                {sortedPlayers[2]?.player_name || 'Waiting...'}
              </p>
              {sortedPlayers[2]?.is_host && (
                <p className="text-amber-400 text-sm">Host</p>
              )}
            </div>
          </div>
          
          {/* Right player (position 3) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 transform text-center">
            <div className="bg-green-600 w-16 h-16 rounded-full flex items-center justify-center mb-2 mx-auto shadow-lg border-4 border-green-500">
              {sortedPlayers[3] ? (
                <span className="text-2xl font-bold text-white">
                  {sortedPlayers[3].player_name[0].toUpperCase()}
                </span>
              ) : (
                <User className="w-8 h-8 text-green-300" />
              )}
            </div>
            <div className="bg-green-700/50 px-4 py-2 rounded-lg">
              <p className="text-white font-medium">
                {sortedPlayers[3]?.player_name || 'Waiting...'}
              </p>
              {sortedPlayers[3]?.is_host && (
                <p className="text-amber-400 text-sm">Host</p>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-6 text-center text-green-300 text-sm">
        <p>Players will be seated in this arrangement during the game</p>
        <p>Need at least 3 players to start</p>
      </div>
    </div>
  );
};

export default TableIllustration;
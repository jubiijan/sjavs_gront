import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import { TrendingUp, Award, Target, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PlayerStatistics, GameHistory } from '../types/gameTypes';

const Statistics: React.FC = () => {
  const [topPlayers, setTopPlayers] = useState<PlayerStatistics[]>([]);
  const [recentGames, setRecentGames] = useState<GameHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchStatistics();
  }, []);
  
  const fetchStatistics = async () => {
    setIsLoading(true);
    try {
      // Fetch top players
      const { data: playersData, error: playersError } = await supabase
        .from('player_statistics')
        .select('*')
        .order('games_won', { ascending: false })
        .limit(10);
      
      if (playersError) throw playersError;
      
      setTopPlayers(playersData as PlayerStatistics[]);
      
      // Fetch recent games
      const { data: gamesData, error: gamesError } = await supabase
        .from('game_history')
        .select('*')
        .order('completed_at', { ascending: false })
        .limit(10);
      
      if (gamesError) throw gamesError;
      
      setRecentGames(gamesData as GameHistory[]);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
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
        <h1 className="text-3xl font-bold text-amber-400 mb-6 flex items-center">
          <TrendingUp size={28} className="mr-3" />
          Game Statistics
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Players */}
          <div className="bg-green-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-amber-300 mb-4 flex items-center">
              <Crown size={24} className="mr-2" />
              Top Players
            </h2>
            
            {topPlayers.length === 0 ? (
              <p className="text-center text-green-300 py-8">No player statistics available yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-green-700">
                      <th className="py-2 text-left text-green-300">Rank</th>
                      <th className="py-2 text-left text-green-300">Player</th>
                      <th className="py-2 text-center text-green-300">Games</th>
                      <th className="py-2 text-center text-green-300">Wins</th>
                      <th className="py-2 text-center text-green-300">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPlayers.map((player, index) => (
                      <tr key={player.id} className="border-b border-green-700/50">
                        <td className="py-3 text-white font-bold">{index + 1}</td>
                        <td className="py-3 text-white">{player.player_name}</td>
                        <td className="py-3 text-white text-center">{player.total_games}</td>
                        <td className="py-3 text-white text-center">{player.games_won}</td>
                        <td className="py-3 text-white text-center">
                          {player.total_games > 0 
                            ? `${((player.games_won / player.total_games) * 100).toFixed(1)}%` 
                            : '0%'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Recent Games */}
          <div className="bg-green-800 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-bold text-amber-300 mb-4 flex items-center">
              <Award size={24} className="mr-2" />
              Recent Games
            </h2>
            
            {recentGames.length === 0 ? (
              <p className="text-center text-green-300 py-8">No game history available yet.</p>
            ) : (
              <div className="space-y-4">
                {recentGames.map((game) => (
                  <div key={game.id} className="bg-green-700 rounded-md p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-amber-300 font-medium">
                          {new Date(game.completed_at).toLocaleDateString()}
                        </span>
                        <span className="text-green-300 text-sm ml-2">
                          {new Date(game.completed_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="bg-green-600 px-2 py-1 rounded text-xs text-white">
                        {game.game_variant}
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      <div className="text-white text-sm mb-1">Winners:</div>
                      <div className="flex flex-wrap gap-2">
                        {(game.winner_team as string[]).map((winner, i) => (
                          <span key={i} className="bg-amber-600 px-2 py-1 rounded-full text-xs text-white">
                            {winner}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-white text-sm mb-1">Trump:</div>
                      <div className="flex items-center">
                        <span className={`text-xl ${
                          game.trump_suit === 'H' || game.trump_suit === 'D' 
                            ? 'text-red-500' 
                            : 'text-green-300'
                        }`}>
                          {game.trump_suit === 'H' && '♥'}
                          {game.trump_suit === 'D' && '♦'}
                          {game.trump_suit === 'C' && '♣'}
                          {game.trump_suit === 'S' && '♠'}
                        </span>
                        <span className="text-white ml-2">
                          by {game.trump_declarer}
                        </span>
                      </div>
                    </div>
                    
                    {(game.double_victory || game.vol_achieved) && (
                      <div className="mt-2 flex gap-2">
                        {game.double_victory && (
                          <span className="bg-purple-700 px-2 py-1 rounded text-xs text-white">
                            Double Victory
                          </span>
                        )}
                        {game.vol_achieved && (
                          <span className="bg-blue-700 px-2 py-1 rounded text-xs text-white">
                            Vol
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 bg-green-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold text-amber-300 mb-4 flex items-center">
            <Target size={24} className="mr-2" />
            Game Achievements
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Vol Achievements */}
            <div className="bg-green-700 rounded-md p-4">
              <div className="flex items-center mb-2">
                <div className="bg-blue-600 p-2 rounded-full mr-3">
                  <Award size={20} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Vol Masters</h3>
              </div>
              
              {topPlayers.length === 0 ? (
                <p className="text-center text-green-300 py-4">No data yet</p>
              ) : (
                <div>
                  {[...topPlayers]
                    .sort((a, b) => b.vol_achievements - a.vol_achievements)
                    .slice(0, 3)
                    .map((player, index) => (
                      <div key={player.id} className="flex justify-between items-center py-2 border-b border-green-600/50">
                        <div className="flex items-center">
                          <span className="text-amber-300 font-bold mr-2">{index + 1}.</span>
                          <span className="text-white">{player.player_name}</span>
                        </div>
                        <span className="text-blue-300 font-bold">{player.vol_achievements}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            {/* Double Victories */}
            <div className="bg-green-700 rounded-md p-4">
              <div className="flex items-center mb-2">
                <div className="bg-purple-600 p-2 rounded-full mr-3">
                  <Crown size={20} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Double Victories</h3>
              </div>
              
              {topPlayers.length === 0 ? (
                <p className="text-center text-green-300 py-4">No data yet</p>
              ) : (
                <div>
                  {[...topPlayers]
                    .sort((a, b) => b.double_victories - a.double_victories)
                    .slice(0, 3)
                    .map((player, index) => (
                      <div key={player.id} className="flex justify-between items-center py-2 border-b border-green-600/50">
                        <div className="flex items-center">
                          <span className="text-amber-300 font-bold mr-2">{index + 1}.</span>
                          <span className="text-white">{player.player_name}</span>
                        </div>
                        <span className="text-purple-300 font-bold">{player.double_victories}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
            
            {/* Win Streaks */}
            <div className="bg-green-700 rounded-md p-4">
              <div className="flex items-center mb-2">
                <div className="bg-amber-600 p-2 rounded-full mr-3">
                  <TrendingUp size={20} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Best Win Streaks</h3>
              </div>
              
              {topPlayers.length === 0 ? (
                <p className="text-center text-green-300 py-4">No data yet</p>
              ) : (
                <div>
                  {[...topPlayers]
                    .sort((a, b) => b.longest_win_streak - a.longest_win_streak)
                    .slice(0, 3)
                    .map((player, index) => (
                      <div key={player.id} className="flex justify-between items-center py-2 border-b border-green-600/50">
                        <div className="flex items-center">
                          <span className="text-amber-300 font-bold mr-2">{index + 1}.</span>
                          <span className="text-white">{player.player_name}</span>
                        </div>
                        <span className="text-amber-300 font-bold">{player.longest_win_streak}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
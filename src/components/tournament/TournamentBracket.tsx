import React from 'react';
import { TournamentMatch } from '../../types/gameTypes';

interface TournamentBracketProps {
  matches: TournamentMatch[];
  format: string;
  maxParticipants: number;
}

const TournamentBracket: React.FC<TournamentBracketProps> = ({ matches, format, maxParticipants }) => {
  const getMatchesByRound = () => {
    const rounds: TournamentMatch[][] = [];
    const maxRounds = Math.ceil(Math.log2(maxParticipants));
    
    for (let i = 0; i < maxRounds; i++) {
      rounds[i] = matches.filter(m => m.round_number === i);
    }
    
    return rounds;
  };

  const getMatchStatusColor = (match: TournamentMatch) => {
    switch (match.status) {
      case 'completed':
        return 'border-amber-400';
      case 'in_progress':
        return 'border-green-400';
      default:
        return 'border-green-700';
    }
  };

  const rounds = getMatchesByRound();

  if (format === 'round_robin' || format === 'swiss') {
    return (
      <div className="text-center py-8 text-green-300">
        Bracket view is not available for {format.split('_').join(' ')} format.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px] p-6 flex justify-between items-stretch space-x-8">
        {rounds.map((roundMatches, roundIndex) => (
          <div
            key={roundIndex}
            className="flex-1 flex flex-col justify-around space-y-4"
          >
            <div className="text-amber-400 font-medium mb-2 text-center">
              {roundIndex === rounds.length - 1 ? 'Final' :
               roundIndex === rounds.length - 2 ? 'Semi Finals' :
               roundIndex === rounds.length - 3 ? 'Quarter Finals' :
               `Round ${roundIndex + 1}`}
            </div>
            
            {roundMatches.map((match, matchIndex) => (
              <div
                key={match.id}
                className={`relative flex flex-col bg-green-800/50 rounded-lg border-2 ${getMatchStatusColor(match)}`}
              >
                <div className="p-3 border-b border-green-700">
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${
                      match.winner_name === match.player1_name
                        ? 'text-amber-400'
                        : 'text-white'
                    }`}>
                      {match.player1_name || 'TBD'}
                    </span>
                    {match.status === 'completed' && match.winner_name === match.player1_name && (
                      <span className="text-amber-400 text-sm">Winner</span>
                    )}
                  </div>
                </div>
                
                <div className="p-3">
                  <div className="flex justify-between items-center">
                    <span className={`font-medium ${
                      match.winner_name === match.player2_name
                        ? 'text-amber-400'
                        : 'text-white'
                    }`}>
                      {match.player2_name || 'TBD'}
                    </span>
                    {match.status === 'completed' && match.winner_name === match.player2_name && (
                      <span className="text-amber-400 text-sm">Winner</span>
                    )}
                  </div>
                </div>

                {match.scheduled_time && (
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-green-400 bg-green-900 px-2 py-1 rounded whitespace-nowrap">
                    {new Date(match.scheduled_time).toLocaleTimeString([], { 
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                )}

                {/* Connector lines */}
                {roundIndex < rounds.length - 1 && (
                  <>
                    <div className="absolute right-0 top-1/2 w-8 h-px bg-green-700 translate-x-full"></div>
                    {matchIndex % 2 === 0 && (
                      <div className="absolute right-0 top-1/2 w-px h-full bg-green-700 translate-x-[2rem]"></div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TournamentBracket;
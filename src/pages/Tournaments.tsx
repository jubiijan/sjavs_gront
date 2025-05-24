import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import { Trophy, Calendar, Users, Plus, ChevronRight, Crown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament, TournamentParticipant } from '../types/gameTypes';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../contexts/AudioContext';

interface TournamentWithParticipants extends Tournament {
  participants: TournamentParticipant[];
}

const Tournaments: React.FC = () => {
  const [tournaments, setTournaments] = useState<TournamentWithParticipants[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { playerName } = useAuth();
  const navigate = useNavigate();
  const { playSound } = useAudio();

  useEffect(() => {
    fetchTournaments();
    setupSubscriptions();
  }, []);

  const fetchTournaments = async () => {
    try {
      const { data: tournamentsData, error: tournamentsError } = await supabase
        .from('tournaments')
        .select(`
          *,
          tournament_participants (*)
        `)
        .order('created_at', { ascending: false });

      if (tournamentsError) throw tournamentsError;

      const formattedTournaments = tournamentsData.map(tournament => ({
        ...tournament,
        participants: tournament.tournament_participants || []
      }));

      setTournaments(formattedTournaments);
    } catch (error: any) {
      console.error('Error fetching tournaments:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSubscriptions = () => {
    const tournamentSubscription = supabase
      .channel('tournament_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments'
      }, () => {
        fetchTournaments();
      })
      .subscribe();

    const participantSubscription = supabase
      .channel('participant_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants'
      }, () => {
        fetchTournaments();
      })
      .subscribe();

    return () => {
      tournamentSubscription.unsubscribe();
      participantSubscription.unsubscribe();
    };
  };

  const handleCreateTournament = () => {
    playSound('buttonClick');
    navigate('/tournaments/create');
  };

  const handleViewTournament = (id: string) => {
    playSound('buttonClick');
    navigate(`/tournaments/${id}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-blue-600 text-white';
      case 'active':
        return 'bg-green-600 text-white';
      case 'completed':
        return 'bg-amber-600 text-white';
      case 'cancelled':
        return 'bg-red-600 text-white';
      default:
        return 'bg-gray-600 text-white';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-amber-400 flex items-center">
            <Trophy size={28} className="mr-3" />
            Tournaments
          </h1>

          <button
            onClick={handleCreateTournament}
            className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Create Tournament
          </button>
        </div>

        {error ? (
          <div className="bg-red-900/50 text-red-300 p-4 rounded-md">
            {error}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-green-800 rounded-lg p-8 text-center">
            <Trophy size={48} className="text-amber-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">No Tournaments Yet</h2>
            <p className="text-green-300 mb-6">Be the first to create a tournament!</p>
            <button
              onClick={handleCreateTournament}
              className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors inline-flex items-center"
            >
              <Plus size={20} className="mr-2" />
              Create Tournament
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => (
              <div
                key={tournament.id}
                className="bg-green-800 rounded-lg p-6 shadow-lg hover:bg-green-800/80 transition-colors cursor-pointer"
                onClick={() => handleViewTournament(tournament.id)}
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-white">{tournament.name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(tournament.status)}`}>
                    {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-green-300">
                    <Calendar size={16} className="mr-2" />
                    <span className="text-sm">
                      {formatDate(tournament.start_date)}
                    </span>
                  </div>

                  <div className="flex items-center text-green-300">
                    <Users size={16} className="mr-2" />
                    <span className="text-sm">
                      {tournament.participants.length} / {tournament.max_participants} Players
                    </span>
                  </div>

                  <div className="flex items-center text-green-300">
                    <Crown size={16} className="mr-2" />
                    <span className="text-sm">
                      {tournament.format.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </span>
                  </div>
                </div>

                {tournament.participants.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tournament.participants.slice(0, 3).map((participant) => (
                      <span
                        key={participant.id}
                        className={`px-2 py-1 rounded text-xs ${
                          participant.player_name === playerName
                            ? 'bg-amber-600 text-white'
                            : 'bg-green-700 text-green-300'
                        }`}
                      >
                        {participant.player_name}
                      </span>
                    ))}
                    {tournament.participants.length > 3 && (
                      <span className="px-2 py-1 rounded text-xs bg-green-700 text-green-300">
                        +{tournament.participants.length - 3} more
                      </span>
                    )}
                  </div>
                )}

                <button
                  className="w-full py-2 px-4 bg-green-700 hover:bg-green-600 text-white rounded-md font-medium transition-colors flex items-center justify-center mt-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewTournament(tournament.id);
                  }}
                >
                  View Details
                  <ChevronRight size={16} className="ml-2" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tournaments;
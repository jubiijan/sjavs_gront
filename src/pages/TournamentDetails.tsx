import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import { Trophy, Calendar, Users, Crown, Clock, ChevronRight, UserPlus, UserMinus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Tournament, TournamentParticipant, TournamentMatch, TournamentStanding } from '../types/gameTypes';
import { useAuth } from '../hooks/useAuth';
import { useAudio } from '../contexts/AudioContext';
import TournamentBracket from '../components/tournament/TournamentBracket';

const TournamentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [standings, setStandings] = useState<TournamentStanding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { playerName, user } = useAuth();
  const navigate = useNavigate();
  const { playSound } = useAudio();

  useEffect(() => {
    if (id) {
      fetchTournamentData();
      setupSubscriptions();
    }
  }, [id]);

  const fetchTournamentData = async () => {
    if (!id) return;

    try {
      // Fetch tournament details
      const { data: tournamentData, error: tournamentError } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

      if (tournamentError) throw tournamentError;
      setTournament(tournamentData);

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('tournament_participants')
        .select('*')
        .eq('tournament_id', id)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;
      setParticipants(participantsData);

      // Fetch matches
      const { data: matchesData, error: matchesError } = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('tournament_id', id)
        .order('round_number', { ascending: true })
        .order('match_number', { ascending: true });

      if (matchesError) throw matchesError;
      setMatches(matchesData);

      // Fetch standings
      const { data: standingsData, error: standingsError } = await supabase
        .from('tournament_standings')
        .select('*')
        .eq('tournament_id', id)
        .order('position', { ascending: true });

      if (standingsError) throw standingsError;
      setStandings(standingsData);

    } catch (error: any) {
      console.error('Error fetching tournament data:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSubscriptions = () => {
    if (!id) return;

    const tournamentSubscription = supabase
      .channel(`tournament:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${id}`
      }, () => {
        fetchTournamentData();
      })
      .subscribe();

    const participantSubscription = supabase
      .channel(`participants:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_participants',
        filter: `tournament_id=eq.${id}`
      }, () => {
        fetchTournamentData();
      })
      .subscribe();

    const matchSubscription = supabase
      .channel(`matches:${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournament_matches',
        filter: `tournament_id=eq.${id}`
      }, () => {
        fetchTournamentData();
      })
      .subscribe();

    return () => {
      tournamentSubscription.unsubscribe();
      participantSubscription.unsubscribe();
      matchSubscription.unsubscribe();
    };
  };

  const handleJoinTournament = async () => {
    if (!tournament || !playerName) return;
    playSound('buttonClick');

    try {
      // Check if tournament is full
      if (participants.length >= tournament.max_participants) {
        setError('Tournament is full');
        return;
      }

      // Check if tournament has started
      if (tournament.status !== 'pending') {
        setError('Tournament has already started');
        return;
      }

      const { error: joinError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          player_name: playerName,
          status: 'active'
        });

      if (joinError) throw joinError;
    } catch (error: any) {
      console.error('Error joining tournament:', error);
      setError(error.message);
    }
  };

  const handleLeaveTournament = async () => {
    if (!tournament || !playerName) return;
    playSound('buttonClick');

    try {
      // Check if tournament has started
      if (tournament.status !== 'pending') {
        setError('Cannot leave a tournament that has already started');
        return;
      }

      const { error: leaveError } = await supabase
        .from('tournament_participants')
        .delete()
        .eq('tournament_id', tournament.id)
        .eq('player_name', playerName);

      if (leaveError) throw leaveError;
    } catch (error: any) {
      console.error('Error leaving tournament:', error);
      setError(error.message);
    }
  };

  const handleDeleteTournament = async () => {
    if (!tournament || !isOrganizer()) return;
    playSound('buttonClick');

    if (!window.confirm('Are you sure you want to delete this tournament? This action cannot be undone.')) {
      return;
    }

    try {
      // Check if tournament has started
      if (tournament.status !== 'pending') {
        setError('Cannot delete a tournament that has already started');
        return;
      }

      const { error: deleteError } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournament.id)
        .eq('organizer_id', user?.id); // Extra safety check

      if (deleteError) throw deleteError;

      // Navigate back to tournaments page
      navigate('/tournaments');
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      setError(error.message);
    }
  };

  const isParticipant = () => {
    return participants.some(p => p.player_name === playerName);
  };

  const isOrganizer = () => {
    return tournament?.organizer_id === user?.id;
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

  if (!tournament) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="bg-green-800 rounded-lg p-8 shadow-lg text-center">
          <h2 className="text-2xl font-bold text-amber-300 mb-4">Tournament Not Found</h2>
          <p className="text-white mb-6">The tournament you're looking for doesn't exist.</p>
          <button 
            onClick={() => navigate('/tournaments')}
            className="py-3 px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-md font-medium transition-colors"
          >
            Back to Tournaments
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
          {/* Tournament Info */}
          <div className="lg:col-span-2">
            <div className="bg-green-800 rounded-lg p-6 shadow-lg">
              <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-bold text-amber-400 flex items-center">
                  <Trophy size={28} className="mr-3" />
                  {tournament.name}
                </h1>
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(tournament.status)}`}>
                    {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                  </span>
                  {isOrganizer() && tournament.status === 'pending' && (
                    <button
                      onClick={handleDeleteTournament}
                      className="p-2 text-red-400 hover:text-red-300 transition-colors rounded-full hover:bg-red-900/20"
                      title="Delete Tournament"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-green-700/50 rounded-md p-4">
                  <div className="flex items-center text-green-300 mb-2">
                    <Calendar size={18} className="mr-2" />
                    <span className="font-medium">Schedule</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-white">Start: {formatDate(tournament.start_date)}</p>
                    <p className="text-white">End: {formatDate(tournament.end_date)}</p>
                  </div>
                </div>

                <div className="bg-green-700/50 rounded-md p-4">
                  <div className="flex items-center text-green-300 mb-2">
                    <Crown size={18} className="mr-2" />
                    <span className="font-medium">Format</span>
                  </div>
                  <p className="text-white">
                    {tournament.format.split('_').map(word => 
                      word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ')}
                  </p>
                  <p className="text-green-300 text-sm mt-1">
                    Round {tournament.current_round + 1} of {
                      tournament.format === 'round_robin' 
                        ? participants.length - 1
                        : Math.ceil(Math.log2(tournament.max_participants))
                    }
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-6 p-3 bg-red-900/50 text-red-300 rounded-md text-sm">
                  {error}
                </div>
              )}

              {tournament.status === 'pending' && !isOrganizer() && (
                <div className="flex justify-center">
                  {isParticipant() ? (
                    <button
                      onClick={handleLeaveTournament}
                      className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors flex items-center"
                    >
                      <UserMinus size={20} className="mr-2" />
                      Leave Tournament
                    </button>
                  ) : (
                    <button
                      onClick={handleJoinTournament}
                      disabled={participants.length >= tournament.max_participants}
                      className={`py-2 px-4 rounded-md font-medium transition-colors flex items-center ${
                        participants.length >= tournament.max_participants
                          ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      <UserPlus size={20} className="mr-2" />
                      Join Tournament
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Tournament Bracket */}
            {tournament.status !== 'pending' && (tournament.format === 'single_elimination' || tournament.format === 'double_elimination') && (
              <div className="bg-green-800 rounded-lg p-6 shadow-lg mt-6">
                <h2 className="text-2xl font-bold text-amber-300 mb-4 flex items-center">
                  <Trophy size={24} className="mr-2" />
                  Tournament Bracket
                </h2>
                
                <TournamentBracket
                  matches={matches}
                  format={tournament.format}
                  maxParticipants={tournament.max_participants}
                />
              </div>
            )}

            {/* Matches */}
            <div className="bg-green-800 rounded-lg p-6 shadow-lg mt-6">
              <h2 className="text-2xl font-bold text-amber-300 mb-4 flex items-center">
                <Clock size={24} className="mr-2" />
                Matches
              </h2>

              {matches.length === 0 ? (
                <p className="text-center text-green-300 py-8">
                  No matches scheduled yet. The tournament will begin soon!
                </p>
              ) : (
                <div className="space-y-4">
                  {matches.map((match) => (
                    <div key={match.id} className="bg-green-700/50 rounded-md p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-green-300">
                          Round {match.round_number + 1} - Match {match.match_number + 1}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(match.status)}`}>
                          {match.status.split('_').map(word => 
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {match.player1_name || 'TBD'}
                          </p>
                        </div>
                        <div className="px-4 text-amber-400 font-bold">VS</div>
                        <div className="flex-1 text-right">
                          <p className="text-white font-medium">
                            {match.player2_name || 'TBD'}
                          </p>
                        </div>
                      </div>

                      {match.scheduled_time && (
                        <div className="mt-2 text-sm text-green-300 flex items-center justify-center">
                          <Clock size={14} className="mr-1" />
                          {formatDate(match.scheduled_time)}
                        </div>
                      )}

                      {match.winner_name && (
                        <div className="mt-2 text-center">
                          <span className="text-amber-400 font-medium">
                            Winner: {match.winner_name}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Participants */}
            <div className="bg-green-800 rounded-lg p-6 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-amber-300 flex items-center">
                  <Users size={20} className="mr-2" />
                  Participants
                </h2>
                <span className="text-green-300">
                  {participants.length} / {tournament.max_participants}
                </span>
              </div>

              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className={`p-3 rounded-md ${
                      participant.player_name === playerName
                        ? 'bg-amber-600/50 text-white'
                        : 'bg-green-700/50 text-green-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{participant.player_name}</span>
                      {participant.status === 'eliminated' && (
                        <span className="text-xs bg-red-600/50 px-2 py-1 rounded">
                          Eliminated
                        </span>
                      )}
                      {participant.status === 'winner' && (
                        <span className="text-xs bg-amber-600/50 px-2 py-1 rounded flex items-center">
                          <Crown size={12} className="mr-1" />
                          Winner
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: tournament.max_participants - participants.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="p-3 rounded-md border border-dashed border-green-700/50 text-green-500 text-center"
                  >
                    Open Slot
                  </div>
                ))}
              </div>
            </div>

            {/* Standings */}
            {standings.length > 0 && (
              <div className="bg-green-800 rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-bold text-amber-300 mb-4 flex items-center">
                  <Trophy size={20} className="mr-2" />
                  Standings
                </h2>

                <div className="space-y-2">
                  {standings.map((standing) => (
                    <div
                      key={standing.id}
                      className={`p-3 rounded-md ${
                        standing.player_name === playerName
                          ? 'bg-amber-600/50 text-white'
                          : 'bg-green-700/50 text-green-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{standing.player_name}</span>
                          <div className="text-sm opacity-75">
                            Matches: {standing.matches_won}W - {standing.matches_lost}L
                          </div>
                        </div>
                        <div className="text-2xl font-bold">
                          {standing.points_scored}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TournamentDetails;
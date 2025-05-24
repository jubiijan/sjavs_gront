import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import { Trophy, Calendar, Users, Scroll, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { useAudio } from '../contexts/AudioContext';

const CreateTournament: React.FC = () => {
  const [name, setName] = useState('');
  const [format, setFormat] = useState('single_elimination');
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user, playerName } = useAuth();
  const navigate = useNavigate();
  const { playSound } = useAudio();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    playSound('buttonClick');

    if (!user || !playerName) {
      setError('You must be signed in to create a tournament');
      return;
    }

    if (!name.trim()) {
      setError('Please enter a tournament name');
      return;
    }

    if (!startDate) {
      setError('Please select a start date');
      return;
    }

    if (!endDate) {
      setError('Please select an end date');
      return;
    }

    const startDateTime = new Date(startDate);
    const endDateTime = new Date(endDate);

    if (startDateTime >= endDateTime) {
      setError('End date must be after start date');
      return;
    }

    if (startDateTime < new Date()) {
      setError('Start date cannot be in the past');
      return;
    }

    setIsLoading(true);

    try {
      const { data: tournament, error: createError } = await supabase
        .from('tournaments')
        .insert({
          name,
          format,
          start_date: startDate,
          end_date: endDate,
          max_participants: maxParticipants,
          organizer_id: user.id,
          rules: {
            format_details: format === 'swiss' ? {
              rounds: Math.ceil(Math.log2(maxParticipants))
            } : {},
            scoring: {
              win_points: 3,
              draw_points: 1,
              loss_points: 0
            }
          }
        })
        .select()
        .single();

      if (createError) throw createError;

      // Register the organizer as first participant
      const { error: participantError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: tournament.id,
          player_name: playerName,
          seed_number: 1,
          status: 'active'
        });

      if (participantError) throw participantError;

      // Navigate to tournament page
      navigate(`/tournaments/${tournament.id}`);
    } catch (err: any) {
      console.error('Error creating tournament:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-900 flex flex-col">
      <Header />

      <div className="flex-grow container mx-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-amber-400 mb-6 flex items-center">
            <Trophy size={28} className="mr-3" />
            Create Tournament
          </h1>

          <div className="bg-green-800 rounded-lg p-6 shadow-lg">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-green-300 mb-2">
                  Tournament Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-3 bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-green-400"
                  placeholder="Enter tournament name"
                  maxLength={100}
                />
              </div>

              <div>
                <label htmlFor="format" className="block text-sm font-medium text-green-300 mb-2">
                  Tournament Format
                </label>
                <select
                  id="format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full p-3 bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination">Double Elimination</option>
                  <option value="round_robin">Round Robin</option>
                  <option value="swiss">Swiss System</option>
                </select>
              </div>

              <div>
                <label htmlFor="maxParticipants" className="block text-sm font-medium text-green-300 mb-2">
                  Maximum Participants
                </label>
                <select
                  id="maxParticipants"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(parseInt(e.target.value))}
                  className="w-full p-3 bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value={4}>4 Players</option>
                  <option value={8}>8 Players</option>
                  <option value={16}>16 Players</option>
                  <option value={32}>32 Players</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-green-300 mb-2">
                    Start Date
                  </label>
                  <input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-3 bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-green-300 mb-2">
                    End Date
                  </label>
                  <input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-3 bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-900/50 text-red-300 rounded-md text-sm">
                  {error}
                </div>
              )}

              <div className="bg-green-700/50 rounded-md p-4">
                <h3 className="text-lg font-bold text-white mb-2 flex items-center">
                  <Scroll size={20} className="mr-2 text-amber-400" />
                  Format Details
                </h3>
                <div className="space-y-2 text-green-100 text-sm">
                  {format === 'single_elimination' && (
                    <>
                      <p>• Single elimination bracket tournament</p>
                      <p>• Lose once and you're out</p>
                      <p>• Best for quick tournaments</p>
                    </>
                  )}
                  {format === 'double_elimination' && (
                    <>
                      <p>• Double elimination bracket tournament</p>
                      <p>• Players must lose twice to be eliminated</p>
                      <p>• Longer format but more chances to compete</p>
                    </>
                  )}
                  {format === 'round_robin' && (
                    <>
                      <p>• Everyone plays against everyone</p>
                      <p>• Points awarded for wins/draws</p>
                      <p>• Best for small groups</p>
                    </>
                  )}
                  {format === 'swiss' && (
                    <>
                      <p>• Players paired based on standings</p>
                      <p>• No eliminations until final rounds</p>
                      <p>• Good balance of games vs duration</p>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={`w-full py-3 px-4 rounded-md font-medium transition-colors flex items-center justify-center ${
                  isLoading
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-amber-500 hover:bg-amber-600 text-white'
                }`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    Create Tournament
                    <ChevronRight size={20} className="ml-2" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTournament;
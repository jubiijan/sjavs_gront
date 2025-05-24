import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/shared/Header';
import { User, TrendingUp, Award, Mail, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PlayerProfile, PlayerStatistics } from '../types/gameTypes';
import { useAudio } from '../contexts/AudioContext';

const Profile: React.FC = () => {
  const { playerName, signOut } = useAuth();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [stats, setStats] = useState<PlayerStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const navigate = useNavigate();
  const { playSound } = useAudio();
  
  useEffect(() => {
    if (playerName) {
      fetchProfileAndStats();
    }
  }, [playerName]);
  
  const fetchProfileAndStats = async () => {
    if (!playerName) return;
    
    setIsLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('player_name', playerName)
        .maybeSingle();
      
      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (!profileData) {
        // Create initial profile if it doesn't exist
        const { data: newProfile, error: createProfileError } = await supabase
          .from('player_profiles')
          .insert({
            player_name: playerName,
            email: '',
            is_guest: true,
            created_at: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            preferred_settings: {},
            is_banned: false
          })
          .select()
          .single();

        if (createProfileError) throw createProfileError;
        setProfile(newProfile as PlayerProfile);
        setEmail('');
      } else {
        setProfile(profileData as PlayerProfile);
        setEmail(profileData.email || '');
      }
      
      // Initialize stats if they don't exist
      const { data: statsData, error: statsError } = await supabase
        .from('player_statistics')
        .select('*')
        .eq('player_name', playerName)
        .maybeSingle();
      
      if (statsError && statsError.code !== 'PGRST116') {
        throw statsError;
      }

      if (!statsData) {
        // Create initial stats
        const { data: newStats, error: createError } = await supabase
          .from('player_statistics')
          .insert({
            player_name: playerName,
            total_games: 0,
            games_won: 0,
            games_lost: 0,
            total_points_scored: 0,
            vol_achievements: 0,
            times_on_hook: 0,
            double_victories: 0,
            trump_success_rate: 0,
            partnership_wins: 0,
            solo_wins: 0,
            longest_win_streak: 0,
            current_win_streak: 0,
            last_updated: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) throw createError;
        setStats(newStats as PlayerStatistics);
      } else {
        setStats(statsData as PlayerStatistics);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveProfile = async () => {
    if (!profile || !playerName) return;
    
    playSound('buttonClick');
    
    try {
      const { error } = await supabase
        .from('player_profiles')
        .update({
          email: email
        })
        .eq('player_name', playerName);
      
      if (error) throw error;
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };
  
  const handleLogout = () => {
    playSound('buttonClick');
    signOut();
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-amber-400 mb-6 flex items-center">
            <User size={28} className="mr-3" />
            Your Profile
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Profile Info */}
            <div className="md:col-span-1">
              <div className="bg-green-800 rounded-lg p-6 shadow-lg">
                <div className="flex justify-center mb-6">
                  <div className="w-24 h-24 bg-green-700 rounded-full flex items-center justify-center text-3xl font-bold text-white">
                    {playerName?.charAt(0).toUpperCase()}
                  </div>
                </div>
                
                <h2 className="text-xl font-bold text-white text-center mb-4">
                  {playerName}
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-green-300 text-sm">Account Type:</p>
                    <p className="text-white font-medium">
                      {profile?.is_guest ? 'Guest Player' : 'Registered Player'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-green-300 text-sm">Joined:</p>
                    <p className="text-white font-medium">
                      {new Date(profile?.created_at || '').toLocaleDateString()}
                    </p>
                  </div>
                  
                  {isEditing ? (
                    <div>
                      <label className="text-green-300 text-sm block mb-1">Email:</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full p-2 bg-green-700 text-white border border-green-600 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <div className="flex mt-2 space-x-2">
                        <button 
                          onClick={handleSaveProfile}
                          className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm flex items-center"
                        >
                          <Save size={16} className="mr-1" />
                          Save
                        </button>
                        <button 
                          onClick={() => {
                            setIsEditing(false);
                            setEmail(profile?.email || '');
                            playSound('buttonClick');
                          }}
                          className="py-2 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-green-300 text-sm">Email:</p>
                      <div className="flex justify-between items-center">
                        <p className="text-white font-medium">
                          {profile?.email || 'Not set'}
                        </p>
                        <button 
                          onClick={() => {
                            setIsEditing(true);
                            playSound('buttonClick');
                          }}
                          className="text-xs bg-green-700 hover:bg-green-600 text-white py-1 px-2 rounded"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {saveSuccess && (
                    <div className="bg-green-600/70 text-white p-2 rounded-md text-sm text-center mt-2">
                      Profile updated successfully
                    </div>
                  )}
                </div>
                
                <div className="mt-6">
                  <button
                    onClick={handleLogout}
                    className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
            
            {/* Statistics */}
            <div className="md:col-span-2">
              <div className="bg-green-800 rounded-lg p-6 shadow-lg">
                <h2 className="text-xl font-bold text-amber-300 mb-4 flex items-center">
                  <TrendingUp size={22} className="mr-2" />
                  Your Statistics
                </h2>
                
                {!stats ? (
                  <p className="text-center text-green-300 py-8">
                    No game statistics available yet. Play some games to see your stats!
                  </p>
                ) : (
                  <div>
                    {/* Summary stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-green-700 rounded-md p-3 text-center">
                        <p className="text-green-300 text-sm">Games Played</p>
                        <p className="text-2xl font-bold text-white">{stats.total_games}</p>
                      </div>
                      
                      <div className="bg-green-700 rounded-md p-3 text-center">
                        <p className="text-green-300 text-sm">Games Won</p>
                        <p className="text-2xl font-bold text-white">{stats.games_won}</p>
                      </div>
                      
                      <div className="bg-green-700 rounded-md p-3 text-center">
                        <p className="text-green-300 text-sm">Win Rate</p>
                        <p className="text-2xl font-bold text-white">
                          {stats.total_games > 0 
                            ? `${((stats.games_won / stats.total_games) * 100).toFixed(1)}%` 
                            : '0%'}
                        </p>
                      </div>
                      
                      <div className="bg-green-700 rounded-md p-3 text-center">
                        <p className="text-green-300 text-sm">Current Streak</p>
                        <p className="text-2xl font-bold text-white">{stats.current_win_streak}</p>
                      </div>
                    </div>
                    
                    {/* Achievements */}
                    <h3 className="text-lg font-bold text-white mb-3 flex items-center">
                      <Award size={18} className="mr-2 text-amber-400" />
                      Achievements
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-green-700 rounded-md p-3">
                        <p className="text-green-300 text-sm">Vol Achievements</p>
                        <p className="text-xl font-bold text-white">{stats.vol_achievements}</p>
                      </div>
                      
                      <div className="bg-green-700 rounded-md p-3">
                        <p className="text-green-300 text-sm">Double Victories</p>
                        <p className="text-xl font-bold text-white">{stats.double_victories}</p>
                      </div>
                      
                      <div className="bg-green-700 rounded-md p-3">
                        <p className="text-green-300 text-sm">Times "On the Hook"</p>
                        <p className="text-xl font-bold text-white">{stats.times_on_hook}</p>
                      </div>
                    </div>
                    
                    {/* Other stats */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-700 rounded-md p-3">
                        <p className="text-green-300 text-sm">Longest Win Streak</p>
                        <p className="text-xl font-bold text-white">{stats.longest_win_streak}</p>
                      </div>
                      
                      <div className="bg-green-700 rounded-md p-3">
                        <p className="text-green-300 text-sm">Trump Success Rate</p>
                        <p className="text-xl font-bold text-white">
                          {stats.trump_success_rate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
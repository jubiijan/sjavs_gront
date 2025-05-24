import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playerName, setPlayerName] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Get player name from localStorage if it exists
      const storedName = localStorage.getItem('sjaus-player-name');
      if (storedName) {
        setPlayerName(storedName);
      }
      
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Clear player name if logged out
      if (!session) {
        setPlayerName('');
        localStorage.removeItem('sjaus-player-name');
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInAsGuest = async (name: string) => {
    setIsLoading(true);
    try {
      // Save player name
      localStorage.setItem('sjaus-player-name', name);
      setPlayerName(name);
      
      // Sign in anonymously
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      
      // Create or update player profile
      const { error: profileError } = await supabase
        .from('player_profiles')
        .upsert({
          player_name: name,
          is_guest: true,
          last_seen: new Date().toISOString(),
        });
      
      if (profileError) throw profileError;

      // Initialize player statistics
      const { error: statsError } = await supabase
        .from('player_statistics')
        .insert({
          player_name: name,
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
      
      if (statsError && statsError.code !== 'PGRST116') {
        throw statsError;
      }
      
      return { success: true };
    } catch (error) {
      console.error("Sign in error:", error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Get player profile
      const { data: profile } = await supabase
        .from('player_profiles')
        .select('player_name')
        .eq('email', email)
        .single();
      
      if (profile) {
        setPlayerName(profile.player_name);
        localStorage.setItem('sjaus-player-name', profile.player_name);
      }
      
      return { success: true, data };
    } catch (error) {
      console.error("Sign in error:", error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Create player profile
      if (data.user) {
        const { error: profileError } = await supabase
          .from('player_profiles')
          .insert({
            player_name: name,
            email: email,
            is_guest: false,
          });
        
        if (profileError) throw profileError;

        // Initialize player statistics
        const { error: statsError } = await supabase
          .from('player_statistics')
          .insert({
            player_name: name,
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
        
        if (statsError && statsError.code !== 'PGRST116') {
          throw statsError;
        }
        
        setPlayerName(name);
        localStorage.setItem('sjaus-player-name', name);
      }
      
      return { success: true, data };
    } catch (error) {
      console.error("Sign up error:", error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      // Clear all local storage data
      localStorage.clear();
      
      // Reset states
      setPlayerName('');
      setUser(null);
      setSession(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Navigate to home page
      navigate('/', { replace: true });
      
      return { success: true };
    } catch (error) {
      console.error("Sign out error:", error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    session,
    user,
    isLoading,
    playerName,
    setPlayerName,
    signInAsGuest,
    signIn,
    signUp,
    signOut
  };
};
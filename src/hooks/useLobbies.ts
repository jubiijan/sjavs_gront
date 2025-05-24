import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Lobby, LobbyPlayer } from '../types/gameTypes';

export const useLobbies = () => {
  const [lobbies, setLobbies] = useState<{ lobby: Lobby; players: LobbyPlayer[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLobbies();
    const cleanup = setupSubscriptions();
    return () => {
      cleanup();
    };
  }, []);

  const fetchLobbies = async () => {
    try {
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .select(`
          *,
          lobby_players (*)
        `)
        .eq('status', 'waiting')
        .order('created_at', { ascending: false });
      
      if (lobbyError) throw lobbyError;
      
      const formattedLobbies = lobbyData.map(lobby => ({
        lobby: {
          id: lobby.id,
          lobby_code: lobby.lobby_code,
          host_id: lobby.host_id,
          max_players: lobby.max_players,
          status: lobby.status,
          created_at: lobby.created_at,
          game_settings: lobby.game_settings,
          last_activity: lobby.last_activity
        } as Lobby,
        players: (lobby.lobby_players || []) as LobbyPlayer[]
      }));
      
      setLobbies(formattedLobbies);
    } catch (error: any) {
      console.error('Error fetching lobbies:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSubscriptions = () => {
    // Subscribe to lobby changes
    const lobbyChannel = supabase
      .channel('lobby_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobbies'
      }, async () => {
        await fetchLobbies();
      })
      .subscribe();
    
    // Subscribe to player changes
    const playerChannel = supabase
      .channel('player_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobby_players'
      }, async () => {
        await fetchLobbies();
      })
      .subscribe();

    // Subscribe to chat messages for activity tracking
    const chatChannel = supabase
      .channel('chat_changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      }, async () => {
        await fetchLobbies();
      })
      .subscribe();

    return () => {
      lobbyChannel.unsubscribe();
      playerChannel.unsubscribe();
      chatChannel.unsubscribe();
    };
  };

  return {
    lobbies,
    isLoading,
    error
  };
};
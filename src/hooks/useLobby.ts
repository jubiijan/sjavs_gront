import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { Lobby, LobbyPlayer } from '../types/gameTypes';

export const useLobby = (lobbyCode?: string) => {
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [presenceState, setPresenceState] = useState<Record<string, any>>({});
  const { playerName, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let cleanupSubscriptions: (() => void) | undefined;

    const initialize = async () => {
      if (!lobbyCode) return;

      try {
        await fetchLobbyByCode(lobbyCode);
        if (mounted) {
          cleanupSubscriptions = setupSubscriptions(lobbyCode);
        }
      } catch (err) {
        console.error('Error initializing lobby:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize lobby');
          navigate('/');
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
      if (cleanupSubscriptions) {
        cleanupSubscriptions();
      }
    };
  }, [lobbyCode]);

  const fetchLobbyByCode = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .select(`
          *,
          lobby_players (*)
        `)
        .eq('lobby_code', code)
        .single();
      
      if (lobbyError) {
        if (lobbyError.code === 'PGRST116') {
          navigate('/');
          return;
        }
        throw lobbyError;
      }

      if (!lobbyData) {
        navigate('/');
        return;
      }

      // If lobby is in playing state, redirect to game
      if (lobbyData.status === 'playing') {
        navigate(`/game/${code}`);
        return;
      }

      // Extract lobby and players from response
      const { lobby_players, ...lobby } = lobbyData;
      setLobby(lobby as Lobby);
      setPlayers((lobby_players || []).sort((a, b) => 
        (a.player_position || 0) - (b.player_position || 0)
      ));

    } catch (error: any) {
      console.error('Error fetching lobby:', error);
      setError(error.message);
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const setupSubscriptions = (code: string) => {
    if (!code || !playerName) return () => {};

    // Create a channel for real-time updates and presence
    const channel = supabase.channel(`lobby:${code}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceState(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Handle player join
        console.log('Player joined:', newPresences[0]?.player_name);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // Handle player leave
        console.log('Player left:', leftPresences[0]?.player_name);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobbies',
        filter: `lobby_code=eq.${code}`
      }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          navigate('/');
          return;
        }
        
        if (payload.eventType === 'UPDATE') {
          const newLobby = payload.new as Lobby;
          setLobby(newLobby);
          
          if (newLobby.status === 'playing') {
            navigate(`/game/${code}`);
          }
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobby_players',
        filter: `lobby_id=eq.${lobby?.id}`
      }, (payload) => {
        setPlayers(currentPlayers => {
          switch (payload.eventType) {
            case 'INSERT':
              return [...currentPlayers, payload.new as LobbyPlayer]
                .sort((a, b) => (a.player_position || 0) - (b.player_position || 0));
            
            case 'DELETE':
              return currentPlayers.filter(p => p.id !== payload.old.id);
            
            case 'UPDATE':
              return currentPlayers.map(p => 
                p.id === payload.new.id ? payload.new as LobbyPlayer : p
              ).sort((a, b) => (a.player_position || 0) - (b.player_position || 0));
            
            default:
              return currentPlayers;
          }
        });
      });

    // Subscribe to the channel and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          player_name: playerName,
          online_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        });
      }
    });

    // Set up heartbeat to keep presence alive
    const heartbeatInterval = setInterval(async () => {
      if (channel) {
        await channel.track({
          player_name: playerName,
          online_at: new Date().toISOString(),
          last_seen: new Date().toISOString()
        });
      }
    }, 15000);

    // Return cleanup function
    return () => {
      clearInterval(heartbeatInterval);
      channel.unsubscribe();
    };
  };

  const createLobby = async () => {
    if (!playerName || !user) {
      setError('You must be signed in to create a lobby');
      return false;
    }

    setIsLoading(true);
    try {
      // Check if player is banned
      const { data: profile, error: profileError } = await supabase
        .from('player_profiles')
        .select('is_banned')
        .eq('player_name', playerName)
        .single();
      
      if (profileError) throw profileError;
      if (profile.is_banned) {
        throw new Error('Your account has been banned from creating lobbies');
      }

      // Generate a random 6-character lobby code
      const lobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Create the lobby
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .insert({
          lobby_code: lobbyCode,
          host_id: user.id,
          status: 'waiting',
          max_players: 4,
          game_settings: {},
          last_activity: new Date().toISOString()
        })
        .select()
        .single();

      if (lobbyError) throw lobbyError;

      // Add the creator as the first player and host
      const { error: playerError } = await supabase
        .from('lobby_players')
        .insert({
          lobby_id: lobbyData.id,
          player_name: playerName,
          is_host: true,
          is_ready: true,
          player_position: 0,
          last_active: new Date().toISOString()
        });

      if (playerError) throw playerError;

      // Navigate to the lobby
      navigate(`/lobby/${lobbyCode}`);
      return true;
    } catch (err) {
      console.error('Error creating lobby:', err);
      setError(err instanceof Error ? err.message : 'Failed to create lobby');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReady = async () => {
    if (!lobby || !playerName) return;
    
    try {
      const currentPlayer = players.find(p => p.player_name === playerName);
      if (!currentPlayer) return;
      
      // Optimistic update
      const newReadyState = !currentPlayer.is_ready;
      setPlayers(prev => prev.map(p => 
        p.player_name === playerName 
          ? { ...p, is_ready: newReadyState }
          : p
      ));
      
      const { error } = await supabase
        .from('lobby_players')
        .update({ 
          is_ready: newReadyState,
          last_active: new Date().toISOString()
        })
        .eq('lobby_id', lobby.id)
        .eq('player_name', playerName);
      
      if (error) {
        // Revert optimistic update on error
        setPlayers(prev => prev.map(p => 
          p.player_name === playerName 
            ? { ...p, is_ready: currentPlayer.is_ready }
            : p
        ));
        throw error;
      }
    } catch (error: any) {
      console.error('Error toggling ready status:', error);
      setError(error.message);
    }
  };

  const joinLobby = async (code: string) => {
    if (!playerName || !user) {
      setError('You must be signed in to join a lobby');
      return false;
    }
    
    setIsLoading(true);
    try {
      // Check if player is banned
      const { data: profile, error: profileError } = await supabase
        .from('player_profiles')
        .select('is_banned')
        .eq('player_name', playerName)
        .single();
      
      if (profileError) throw profileError;
      if (profile.is_banned) {
        throw new Error('Your account has been banned from creating or joining lobbies');
      }
      
      // Find the lobby by code
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('lobby_code', code.toUpperCase())
        .eq('status', 'waiting')
        .maybeSingle();
      
      if (lobbyError) throw lobbyError;
      if (!lobbyData) throw new Error('Lobby not found or game already started');
      
      // Check if player is already in the lobby
      const { data: existingPlayer, error: existingError } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', lobbyData.id)
        .eq('player_name', playerName)
        .maybeSingle();
      
      if (existingError) throw existingError;
      
      // If player is already in the lobby, just navigate there
      if (existingPlayer) {
        navigate(`/lobby/${code}`);
        return true;
      }
      
      // Check if lobby is full
      const { count, error: countError } = await supabase
        .from('lobby_players')
        .select('*', { count: 'exact' })
        .eq('lobby_id', lobbyData.id);
      
      if (countError) throw countError;
      
      if (count && count >= lobbyData.max_players) {
        throw new Error('This lobby is full');
      }
      
      // Find the next available position
      const { data: positions } = await supabase
        .from('lobby_players')
        .select('player_position')
        .eq('lobby_id', lobbyData.id);
      
      const takenPositions = positions?.map(p => p.player_position) || [];
      let nextPosition = 0;
      while (takenPositions.includes(nextPosition)) {
        nextPosition++;
      }
      
      // Add player to lobby
      const { error: playerError } = await supabase
        .from('lobby_players')
        .insert({
          lobby_id: lobbyData.id,
          player_name: playerName,
          is_host: false,
          is_ready: false,
          player_position: nextPosition,
          last_active: new Date().toISOString()
        });
      
      if (playerError) throw playerError;

      // Update lobby's last activity
      const { error: updateError } = await supabase
        .from('lobbies')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', lobbyData.id);

      if (updateError) throw updateError;
      
      // Navigate to the lobby
      navigate(`/lobby/${code}`);
      return true;
    } catch (error: any) {
      console.error('Error joining lobby:', error);
      setError(error.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const startGame = async () => {
    if (!lobby || !playerName) return;
    
    try {
      const { data, error } = await supabase
        .rpc('start_game', { 
          p_lobby_id: lobby.id,
          p_host_name: playerName 
        });
      
      if (error) throw error;

      // Game started successfully, navigation will happen automatically
      // due to the lobby status subscription
    } catch (error: any) {
      console.error('Error starting game:', error);
      setError(error.message);
    }
  };

  const leaveLobby = async () => {
    if (!lobby || !playerName) return;
    
    try {
      // Check if player is host
      const isHost = players.some(p => p.player_name === playerName && p.is_host);
      
      if (isHost) {
        // Delete the entire lobby if host leaves
        const { error: deleteError } = await supabase
          .from('lobbies')
          .delete()
          .eq('id', lobby.id);
        
        if (deleteError) throw deleteError;
      } else {
        // Just remove the player
        const { error } = await supabase
          .from('lobby_players')
          .delete()
          .eq('lobby_id', lobby.id)
          .eq('player_name', playerName);
        
        if (error) throw error;
      }
      
      navigate('/');
    } catch (error: any) {
      console.error('Error leaving lobby:', error);
      setError(error.message);
      navigate('/');
    }
  };

  const isHost = () => {
    return players.some(p => p.player_name === playerName && p.is_host);
  };

  const kickPlayer = async (playerToKick: string) => {
    if (!lobby || !playerName) return;
    
    try {
      const { error: kickError } = await supabase
        .rpc('kick_player', {
          p_lobby_id: lobby.id,
          p_host_name: playerName,
          p_player_name: playerToKick
        });
      
      if (kickError) throw kickError;
    } catch (error: any) {
      console.error('Error kicking player:', error);
      setError(error.message);
    }
  };

  return {
    lobby,
    players,
    isLoading,
    error,
    isHost,
    presenceState,
    createLobby,
    joinLobby,
    toggleReady,
    startGame,
    leaveLobby,
    kickPlayer
  };
};

export default useLobby;
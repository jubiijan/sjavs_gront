import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { supabase } from '../lib/supabase';
import { GameState } from '../types/gameTypes';

export const useGameSync = (lobbyCode: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const { channel, isConnected } = useWebSocket(`game:${lobbyCode}`);

  // First fetch the lobby ID using the code
  useEffect(() => {
    const fetchLobbyId = async () => {
      try {
        const { data, error } = await supabase
          .from('lobbies')
          .select('id')
          .eq('lobby_code', lobbyCode)
          .single();

        if (error) throw error;
        setLobbyId(data.id);
      } catch (err) {
        console.error('Error fetching lobby ID:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch lobby');
      }
    };

    if (lobbyCode) {
      fetchLobbyId();
    }
  }, [lobbyCode]);

  // Subscribe to game state changes
  useEffect(() => {
    if (!lobbyId) return;

    const subscription = supabase
      .channel(`game_state:${lobbyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: `lobby_id=eq.${lobbyId}`
      }, (payload) => {
        setGameState(payload.new as GameState);
        setLastSyncTime(Date.now());
        setReconnectAttempts(0); // Reset attempts on successful sync
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lobbyId]);

  // Subscribe to action acknowledgments
  useEffect(() => {
    if (!lobbyId) return;

    const subscription = supabase
      .channel(`game_actions:${lobbyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_action_queue',
        filter: `game_id=eq.${gameState?.id}`
      }, (payload) => {
        if (payload.new.error) {
          setError(payload.new.error);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lobbyId, gameState?.id]);

  // Automatic reconnection and state sync
  useEffect(() => {
    if (!lobbyId || !gameState?.id) return;

    const syncInterval = setInterval(async () => {
      // Check if we haven't received updates recently
      const timeSinceLastSync = Date.now() - lastSyncTime;
      
      if (timeSinceLastSync > 5000 && !isConnected) { // 5 seconds threshold
        try {
          // Exponential backoff for reconnection attempts
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));

          // Fetch latest state
          const { data, error } = await supabase
            .from('game_state')
            .select('*')
            .eq('id', gameState.id)
            .single();

          if (error) throw error;

          setGameState(data);
          setLastSyncTime(Date.now());
          setReconnectAttempts(prev => prev + 1);
        } catch (err) {
          console.error('Error during reconnection:', err);
          setError('Connection lost. Attempting to reconnect...');
        }
      }
    }, 1000); // Check every second

    return () => clearInterval(syncInterval);
  }, [lobbyId, gameState?.id, lastSyncTime, isConnected, reconnectAttempts]);

  // Queue a game action
  const applyAction = async (action: {
    type: string;
    data: Record<string, any>;
  }) => {
    if (!lobbyId || !gameState || !isConnected) {
      setError('Cannot perform action while disconnected');
      return;
    }

    try {
      const { error } = await supabase.rpc('queue_game_action', {
        p_game_id: gameState.id,
        p_player_name: action.data.playerName,
        p_action_type: action.type,
        p_action_data: action.data
      });

      if (error) throw error;
    } catch (err) {
      console.error('Error applying action:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply action');
    }
  };

  return {
    gameState,
    applyAction,
    isConnected,
    isLoading,
    error
  };
};
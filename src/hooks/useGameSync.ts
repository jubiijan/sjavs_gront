import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { supabase } from '../lib/supabase';
import { GameState } from '../types/gameTypes';

interface GameSync {
  state: GameState | null;
  version: number;
  pendingActions: Map<string, any>;
  lastSyncedAt: number;
}

export const useGameSync = (lobbyCode: string) => {
  const [sync, setSync] = useState<GameSync>({
    state: null,
    version: 0,
    pendingActions: new Map(),
    lastSyncedAt: Date.now(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);

  const { channel, isConnected } = useWebSocket(`game:${lobbyCode}`);

  // Fetch lobby ID
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
        setIsLoading(false);
      } catch (err) {
        console.error('Error fetching lobby ID:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch lobby');
        setIsLoading(false);
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
        const newState = payload.new as GameState;
        
        setSync(prev => {
          // Only update if version is newer
          if (newState.version > prev.version) {
            return {
              ...prev,
              state: newState,
              version: newState.version,
              lastSyncedAt: Date.now()
            };
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lobbyId]);

  // Subscribe to action acknowledgments
  useEffect(() => {
    if (!lobbyId || !sync.state?.id) return;

    const subscription = supabase
      .channel(`game_actions:${lobbyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_action_queue',
        filter: `game_id=eq.${sync.state.id}`
      }, (payload) => {
        if (payload.new.processed) {
          setSync(prev => {
            const pendingActions = new Map(prev.pendingActions);
            pendingActions.delete(payload.new.id);

            if (payload.new.error) {
              setError(payload.new.error);
              // Rollback state if needed
              if (payload.new.rollback_data) {
                return {
                  ...prev,
                  state: payload.new.rollback_data as GameState,
                  version: (payload.new.rollback_data as GameState).version,
                  pendingActions,
                  lastSyncedAt: Date.now()
                };
              }
            }

            return {
              ...prev,
              pendingActions,
              lastSyncedAt: Date.now()
            };
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lobbyId, sync.state?.id]);

  // Periodic state validation
  useEffect(() => {
    if (!isConnected || !sync.state?.id) return;

    const validateInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('game_state')
          .select('*')
          .eq('id', sync.state.id)
          .single();

        if (error) throw error;

        // Check if server state is newer
        if (data.version > sync.version) {
          setSync(prev => ({
            ...prev,
            state: data,
            version: data.version,
            lastSyncedAt: Date.now()
          }));
        }
      } catch (err) {
        console.error('State validation error:', err);
      }
    }, 5000);

    return () => clearInterval(validateInterval);
  }, [isConnected, sync.state?.id, sync.version]);

  // Handle reconnection
  useEffect(() => {
    if (!isConnected && sync.state?.id) {
      // Mark all pending actions as failed
      setSync(prev => ({
        ...prev,
        pendingActions: new Map(),
        lastSyncedAt: Date.now()
      }));
      setError('Connection lost. Reconnecting...');
    }
  }, [isConnected, sync.state?.id]);

  const applyAction = async (action: {
    type: string;
    data: Record<string, any>;
  }) => {
    if (!sync.state?.id || !isConnected) {
      setError('Cannot perform action while disconnected');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('process_game_action_atomic', {
        p_game_id: sync.state.id,
        p_player_name: action.data.playerName,
        p_action_type: action.type,
        p_action_data: action.data
      });

      if (error) {
        if (error.message.includes('Game is busy')) {
          // Retry with exponential backoff
          const retryDelay = Math.min(1000 * Math.pow(2, sync.pendingActions.size), 5000);
          setTimeout(() => applyAction(action), retryDelay);
          return;
        }
        throw error;
      }

      // Track pending action
      const actionId = data.action_id;
      setSync(prev => {
        const pendingActions = new Map(prev.pendingActions);
        pendingActions.set(actionId, action);
        return {
          ...prev,
          pendingActions,
          lastSyncedAt: Date.now()
        };
      });

    } catch (err) {
      console.error('Error applying action:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply action');
    }
  };

  return {
    gameState: sync.state,
    applyAction,
    isConnected,
    isLoading,
    error,
    hasPendingActions: sync.pendingActions.size > 0,
    lastSyncedAt: sync.lastSyncedAt
  };
};
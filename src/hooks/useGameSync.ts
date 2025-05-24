import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { supabase } from '../lib/supabase';
import { GameState } from '../types/gameTypes';

interface GameSync {
  state: GameState | null;
  version: number;
  pendingActions: Map<string, any>;
  lastSyncedAt: number;
  recoveryAttempts: number;
}

export const useGameSync = (lobbyCode: string) => {
  const [sync, setSync] = useState<GameSync>({
    state: null,
    version: 0,
    pendingActions: new Map(),
    lastSyncedAt: Date.now(),
    recoveryAttempts: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [isRecovering, setIsRecovering] = useState(false);

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
              lastSyncedAt: Date.now(),
              recoveryAttempts: 0 // Reset recovery attempts on successful sync
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

  // Handle state recovery
  const recoverGameState = async () => {
    if (!sync.state?.id || isRecovering) return;
    
    setIsRecovering(true);
    
    try {
      // Get latest game state
      const { data: gameState, error: gameError } = await supabase
        .from('game_state')
        .select('*')
        .eq('id', sync.state.id)
        .single();

      if (gameError) throw gameError;

      // Get pending actions
      const { data: actions, error: actionsError } = await supabase
        .from('game_action_queue')
        .select('*')
        .eq('game_id', sync.state.id)
        .eq('processed', false)
        .order('version', { ascending: true });

      if (actionsError) throw actionsError;

      // Replay pending actions
      const pendingActions = new Map();
      for (const action of actions || []) {
        pendingActions.set(action.id, {
          type: action.action_type,
          data: action.action_data
        });
      }

      setSync(prev => ({
        ...prev,
        state: gameState,
        version: gameState.version,
        pendingActions,
        lastSyncedAt: Date.now(),
        recoveryAttempts: prev.recoveryAttempts + 1
      }));

      setError(null);
    } catch (err) {
      console.error('Recovery error:', err);
      setError('Failed to recover game state');
    } finally {
      setIsRecovering(false);
    }
  };

  // Handle disconnection recovery
  useEffect(() => {
    if (!isConnected && sync.state?.id) {
      const recoveryDelay = Math.min(1000 * Math.pow(2, sync.recoveryAttempts), 30000);
      
      const recoveryTimeout = setTimeout(() => {
        if (sync.recoveryAttempts < 5) {
          recoverGameState();
        } else {
          setError('Unable to recover game state after multiple attempts');
        }
      }, recoveryDelay);

      return () => clearTimeout(recoveryTimeout);
    }
  }, [isConnected, sync.state?.id, sync.recoveryAttempts]);

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
            lastSyncedAt: Date.now(),
            recoveryAttempts: 0
          }));
        }
      } catch (err) {
        console.error('State validation error:', err);
        setError('Failed to validate game state');
      }
    }, 5000);

    return () => clearInterval(validateInterval);
  }, [isConnected, sync.state?.id, sync.version]);

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
      
      // Attempt recovery if action fails
      if (sync.recoveryAttempts < 5) {
        recoverGameState();
      }
    }
  };

  return {
    gameState: sync.state,
    applyAction,
    isConnected,
    isLoading,
    error,
    isRecovering,
    hasPendingActions: sync.pendingActions.size > 0,
    lastSyncedAt: sync.lastSyncedAt
  };
};
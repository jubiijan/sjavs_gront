import { useState, useEffect, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { GameState } from '../types/gameTypes';

interface GameSync {
  state: GameState | null;
  version: number;
  pendingActions: Map<string, any>;
  lastSyncedAt: number;
  recoveryAttempts: number;
}

interface SyncOptions {
  retryLimit?: number;
  retryDelay?: number;
  syncInterval?: number;
  turnTimeout?: number;
}

const DEFAULT_OPTIONS: SyncOptions = {
  retryLimit: 5,
  retryDelay: 1000,
  syncInterval: 5000,
  turnTimeout: 30000 // 30 seconds turn timeout
};

export const useGameSync = (lobbyCode: string, options: SyncOptions = {}) => {
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
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [playerPresence, setPlayerPresence] = useState<Record<string, any>>({});

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Track player presence
  const updatePlayerPresence = useCallback((state: Record<string, any>) => {
    setPlayerPresence(state);
    
    // Check if current player is disconnected
    if (sync.state?.current_player !== undefined) {
      const currentPlayerName = Object.values(state)
        .flat()
        .find((p: any) => p.position === sync.state?.current_player)?.player_name;

      if (currentPlayerName) {
        const presence = Object.values(state)
          .flat()
          .find((p: any) => p.player_name === currentPlayerName);

        // If current player is disconnected for more than turn timeout
        if (presence && Date.now() - new Date(presence.last_seen).getTime() > opts.turnTimeout!) {
          handlePlayerTimeout(currentPlayerName);
        }
      }
    }
  }, [sync.state?.current_player, opts.turnTimeout]);

  // Handle disconnected player's turn
  const handlePlayerTimeout = async (playerName: string) => {
    if (!sync.state?.id) return;

    try {
      // Skip disconnected player's turn
      await supabase.rpc('skip_player_turn', {
        p_game_id: sync.state.id,
        p_player_name: playerName
      });
    } catch (err) {
      console.error('Error handling player timeout:', err);
    }
  };

  // Fetch initial game state
  const fetchGameState = useCallback(async () => {
    if (!lobbyId) return;

    try {
      const { data: gameState, error: gameError } = await supabase
        .from('game_state')
        .select('*')
        .eq('lobby_id', lobbyId)
        .single();

      if (gameError) throw gameError;

      setSync(prev => ({
        ...prev,
        state: gameState,
        version: gameState.version || 0,
        lastSyncedAt: Date.now(),
        recoveryAttempts: 0
      }));

      setError(null);
    } catch (err) {
      console.error('Error fetching game state:', err);
      setError('Failed to fetch game state');
      
      if (sync.recoveryAttempts < (opts.retryLimit || 5)) {
        setTimeout(fetchGameState, Math.min(
          opts.retryDelay! * Math.pow(2, sync.recoveryAttempts),
          30000
        ));
      }
    }
  }, [lobbyId, opts.retryDelay, opts.retryLimit]);

  // Set up real-time subscription
  const setupRealtimeSubscription = useCallback(() => {
    if (!lobbyId) return;

    const newChannel = supabase.channel(`game_state:${lobbyId}`, {
      config: {
        broadcast: { self: true },
        presence: { key: lobbyId },
      },
    });

    newChannel
      .on('presence', { event: 'sync' }, () => {
        const state = newChannel.presenceState();
        updatePlayerPresence(state);
        setIsConnected(true);
        setSync(prev => ({
          ...prev,
          recoveryAttempts: 0,
          lastSyncedAt: Date.now()
        }));
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        setSync(prev => ({ ...prev, lastSyncedAt: Date.now() }));
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const state = newChannel.presenceState();
        updatePlayerPresence(state);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'game_state',
        filter: `lobby_id=eq.${lobbyId}`
      }, async (payload) => {
        const newState = payload.new as GameState;
        
        // Only update if version is newer
        if (newState.version > sync.version) {
          setSync(prev => ({
            ...prev,
            state: newState,
            version: newState.version,
            lastSyncedAt: Date.now(),
            recoveryAttempts: 0
          }));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await newChannel.track({
            online_at: new Date().toISOString(),
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          await recoverConnection();
        }
      });

    setChannel(newChannel);

    return () => {
      newChannel.unsubscribe();
    };
  }, [lobbyId, updatePlayerPresence]);

  // Handle connection recovery
  const recoverConnection = async () => {
    setSync(prev => ({
      ...prev,
      recoveryAttempts: prev.recoveryAttempts + 1
    }));

    if (sync.recoveryAttempts < (opts.retryLimit || 5)) {
      const delay = Math.min(
        opts.retryDelay! * Math.pow(2, sync.recoveryAttempts),
        30000
      );

      setTimeout(() => {
        setupRealtimeSubscription();
        fetchGameState();
      }, delay);
    } else {
      setError('Connection lost. Please refresh the page.');
    }
  };

  // Apply game action
  const applyAction = async (action: {
    type: string;
    data: Record<string, any>;
  }) => {
    if (!sync.state?.id || !isConnected) {
      setError('Cannot perform action while disconnected');
      return;
    }

    try {
      // Get an advisory lock for this game
      const { data: lockData, error: lockError } = await supabase.rpc(
        'acquire_game_lock',
        { p_game_id: sync.state.id }
      );

      if (lockError || !lockData) {
        throw new Error('Game is busy, please try again');
      }

      // Process the action atomically
      const { data, error } = await supabase.rpc('process_game_action_atomic', {
        p_game_id: sync.state.id,
        p_player_name: action.data.playerName,
        p_action_type: action.type,
        p_action_data: action.data,
        p_expected_version: sync.version
      });

      if (error) {
        if (error.message.includes('Version mismatch')) {
          await fetchGameState();
          throw new Error('Game state has changed, please try again');
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
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply action';
      setError(errorMessage);

      // Retry with exponential backoff if appropriate
      if (errorMessage.includes('Game is busy')) {
        const retryDelay = Math.min(
          opts.retryDelay! * Math.pow(2, sync.pendingActions.size),
          5000
        );
        setTimeout(() => applyAction(action), retryDelay);
      } else if (sync.recoveryAttempts < (opts.retryLimit || 5)) {
        await fetchGameState();
      }
    }
  };

  // Initialize
  useEffect(() => {
    if (!lobbyCode) return;

    const initialize = async () => {
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

    initialize();
  }, [lobbyCode]);

  // Set up subscriptions when lobby ID is available
  useEffect(() => {
    if (!lobbyId) return;
    
    const cleanup = setupRealtimeSubscription();
    fetchGameState();

    return () => {
      if (cleanup) cleanup();
    };
  }, [lobbyId, setupRealtimeSubscription, fetchGameState]);

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
    }, opts.syncInterval);

    return () => clearInterval(validateInterval);
  }, [isConnected, sync.state?.id, sync.version, opts.syncInterval]);

  return {
    gameState: sync.state,
    applyAction,
    isConnected,
    isLoading,
    error,
    isRecovering,
    hasPendingActions: sync.pendingActions.size > 0,
    lastSyncedAt: sync.lastSyncedAt,
    playerPresence
  };
};
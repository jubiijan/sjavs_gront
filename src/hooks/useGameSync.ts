import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { supabase } from '../lib/supabase';
import { GameState } from '../types/gameTypes';

interface GameSync {
  localState: GameState | null;
  pendingActions: Map<string, any>;
  lastSyncedAt: number;
}

export const useGameSync = (lobbyCode: string) => {
  const [sync, setSync] = useState<GameSync>({
    localState: null,
    pendingActions: new Map(),
    lastSyncedAt: Date.now(),
  });
  const [lobbyId, setLobbyId] = useState<string | null>(null);

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
      }
    };

    if (lobbyCode) {
      fetchLobbyId();
    }
  }, [lobbyCode]);

  // Handle optimistic updates
  const applyAction = async (action: any) => {
    if (!lobbyId) return;
    
    const actionId = crypto.randomUUID();
    
    // Apply optimistically to local state
    setSync(prev => ({
      ...prev,
      pendingActions: prev.pendingActions.set(actionId, action),
      localState: applyActionToState(prev.localState, action),
    }));

    try {
      // Send to server
      const { error } = await supabase
        .from('game_state')
        .update(action)
        .eq('lobby_id', lobbyId);

      if (error) throw error;

      // Broadcast to other players
      channel?.send({
        type: 'broadcast',
        event: 'game_action',
        payload: { actionId, ...action }
      });
    } catch (error) {
      // Revert on failure
      setSync(prev => {
        const pendingActions = prev.pendingActions;
        pendingActions.delete(actionId);
        return {
          ...prev,
          pendingActions,
          localState: recomputeState(prev.localState, Array.from(pendingActions.values())),
        };
      });
    }
  };

  // Listen for remote actions
  useEffect(() => {
    if (!channel) return;

    const subscription = channel
      .on('broadcast', { event: 'game_action' }, ({ payload }) => {
        setSync(prev => ({
          ...prev,
          localState: applyActionToState(prev.localState, payload),
          lastSyncedAt: Date.now(),
        }));
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [channel]);

  // Periodic state validation
  useEffect(() => {
    if (!isConnected || !lobbyId) return;

    const validateInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('game_state')
          .select('*')
          .eq('lobby_id', lobbyId)
          .single();

        if (error) throw error;

        // Check if server state matches local state
        if (!statesMatch(data, sync.localState)) {
          setSync(prev => ({
            ...prev,
            localState: data,
            pendingActions: new Map(),
            lastSyncedAt: Date.now(),
          }));
        }
      } catch (error) {
        console.error('State validation error:', error);
      }
    }, 5000);

    return () => clearInterval(validateInterval);
  }, [isConnected, lobbyId, sync.localState]);

  return {
    gameState: sync.localState,
    applyAction,
    isConnected,
  };
};

// Helper functions
const applyActionToState = (state: GameState | null, action: any): GameState => {
  if (!state) return action;
  return { ...state, ...action };
};

const recomputeState = (baseState: GameState | null, actions: any[]): GameState => {
  if (!baseState) return actions[actions.length - 1];
  return actions.reduce((state, action) => ({ ...state, ...action }), baseState);
};

const statesMatch = (state1: GameState | null, state2: GameState | null): boolean => {
  if (!state1 || !state2) return false;
  return JSON.stringify(state1) === JSON.stringify(state2);
};
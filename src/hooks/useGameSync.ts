import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { supabase } from '../lib/supabase';
import { GameState } from '../types/gameTypes';

export const useGameSync = (lobbyCode: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

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
        const newState = payload.new as GameState;
        if (newState.version > version) {
          setGameState(newState);
          setVersion(newState.version);
          setError(null);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lobbyId, version]);

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
        if (payload.new.processed) {
          setPendingActions(prev => {
            const next = new Set(prev);
            next.delete(payload.new.id);
            return next;
          });

          if (payload.new.error) {
            setError(payload.new.error);
          }
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [lobbyId, gameState?.id]);

  // Periodic state validation
  useEffect(() => {
    if (!isConnected || !gameState?.id) return;

    const validateInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('game_state')
          .select('*')
          .eq('id', gameState.id)
          .single();

        if (error) throw error;

        if (data.version > version) {
          setGameState(data);
          setVersion(data.version);
        }
      } catch (err) {
        console.error('State validation error:', err);
      }
    }, 5000);

    return () => clearInterval(validateInterval);
  }, [isConnected, gameState?.id, version]);

  const applyAction = async (action: {
    type: string;
    data: Record<string, any>;
  }) => {
    if (!gameState?.id || !isConnected) {
      setError('Cannot perform action while disconnected');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('queue_game_action', {
        p_game_id: gameState.id,
        p_player_name: action.data.playerName,
        p_action_type: action.type,
        p_action_data: action.data
      });

      if (error) throw error;

      setPendingActions(prev => new Set(prev).add(data));
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
    error,
    hasPendingActions: pendingActions.size > 0
  };
};
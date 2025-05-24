import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { GameState, LobbyPlayer } from '../types/gameTypes';
import { useNavigate } from 'react-router-dom';
import { useGameSync } from './useGameSync';

export const useGame = (code: string) => {
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playerName } = useAuth();
  const navigate = useNavigate();
  
  // Use the game sync hook
  const { gameState, applyAction, isConnected, isLoading: syncLoading } = useGameSync(code);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      if (!code) return;

      try {
        await fetchGameByCode();
      } catch (err) {
        console.error('Error initializing game:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize game');
        }
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [code]);

  const fetchGameByCode = async () => {
    setIsLoading(true);
    try {
      // First get the lobby ID using the code
      const { data: lobbyData, error: lobbyError } = await supabase
        .from('lobbies')
        .select('id')
        .eq('lobby_code', code)
        .eq('status', 'playing')
        .single();
      
      if (lobbyError) {
        if (lobbyError.code === 'PGRST116') {
          throw new Error('Game not found or hasn\'t started yet');
        }
        throw lobbyError;
      }

      if (!lobbyData) {
        throw new Error('Game not found');
      }

      // Then get the players using the lobby ID
      const { data: playersData, error: playersError } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', lobbyData.id)
        .order('player_position', { ascending: true });
      
      if (playersError) throw playersError;

      if (!playersData || playersData.length === 0) {
        throw new Error('No players found in game');
      }

      setPlayers(playersData);

    } catch (error: any) {
      console.error('Error fetching game:', error);
      setError(error.message);
      navigate('/404');
    } finally {
      setIsLoading(false);
    }
  };

  const playCard = async (card: string) => {
    if (!gameState || !playerName) return;

    try {
      await applyAction({
        type: 'play_card',
        data: {
          playerName,
          card
        }
      });
    } catch (error) {
      console.error('Error playing card:', error);
    }
  };

  const selectTrump = async (suit: string) => {
    if (!gameState || !playerName) return;

    try {
      await applyAction({
        type: 'declare_trump',
        data: {
          playerName,
          suit
        }
      });
    } catch (error) {
      console.error('Error selecting trump:', error);
    }
  };

  const passBid = async () => {
    if (!gameState || !playerName) return;

    try {
      await applyAction({
        type: 'pass',
        data: {
          playerName
        }
      });
    } catch (error) {
      console.error('Error passing bid:', error);
    }
  };

  const isPlayerTurn = () => {
    if (!gameState || !players.length || !playerName) return false;
    const currentPlayer = players.find(p => p.player_position === gameState.current_player);
    return currentPlayer?.player_name === playerName;
  };

  return {
    gameState,
    players,
    isLoading: isLoading || syncLoading,
    error,
    isPlayerTurn,
    selectTrump,
    passBid,
    playCard,
    isConnected
  };
};
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { GameState, LobbyPlayer } from '../types/gameTypes';
import { useNavigate } from 'react-router-dom';
import { useGameSync } from './useGameSync';

export const useGame = (code: string) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { playerName } = useAuth();
  const navigate = useNavigate();
  
  // Use the game sync hook
  const { gameState: syncedState, applyAction, isConnected } = useGameSync(code);

  useEffect(() => {
    if (syncedState) {
      setGameState(syncedState);
    }
  }, [syncedState]);

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
    if (!gameState || !playerName || !isPlayerTurn() || gameState.current_phase !== 'playing') {
      return;
    }

    try {
      const hand = gameState.player_hands[playerName] || [];
      if (!hand.includes(card)) return;

      const updatedState = {
        ...gameState,
        player_hands: {
          ...gameState.player_hands,
          [playerName]: hand.filter(c => c !== card)
        },
        table_cards: {
          ...gameState.table_cards,
          [playerName]: card
        }
      };

      await applyAction(updatedState);

    } catch (error) {
      console.error('Error playing card:', error);
    }
  };

  const selectTrump = async (suit: string) => {
    if (!gameState || !playerName || !isPlayerTurn() || gameState.current_phase !== 'bidding') {
      return;
    }

    try {
      const updatedState = {
        ...gameState,
        trump_suit: suit,
        trump_declarer: playerName,
        current_phase: 'playing'
      };

      await applyAction(updatedState);

    } catch (error) {
      console.error('Error selecting trump:', error);
    }
  };

  const passBid = async () => {
    if (!gameState || !playerName || !isPlayerTurn() || gameState.current_phase !== 'bidding') {
      return;
    }

    try {
      const nextPosition = (gameState.current_player + 1) % players.length;
      const updatedState = {
        ...gameState,
        current_player: nextPosition
      };

      await applyAction(updatedState);

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
    isLoading,
    error,
    isPlayerTurn,
    selectTrump,
    passBid,
    playCard,
    isConnected
  };
};
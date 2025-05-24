export interface Lobby {
  id: string;
  lobby_code: string;
  host_id: string;
  max_players: number;
  status: 'waiting' | 'playing' | 'finished';
  created_at: string;
  game_settings?: Record<string, any>;
}

export interface LobbyPlayer {
  id: string;
  lobby_id: string;
  player_name: string;
  is_host: boolean;
  is_ready: boolean;
  player_position: number;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  lobby_id: string;
  player_name?: string;
  message: string;
  message_type: 'player' | 'system';
  created_at: string;
}

export interface GameState {
  id: string;
  lobby_id: string;
  current_phase?: 'bidding' | 'playing' | 'scoring';
  status?: 'active' | 'interrupted' | 'finished';
  trump_suit?: string;
  trump_declarer?: string;
  current_player: number;
  trick_number: number;
  scores: Record<string, number>;
  player_hands: Record<string, string[]>;
  table_cards: Record<string, string>;
  last_error?: string;
  updated_at: string;
}

export interface PlayerProfile {
  id: string;
  player_name: string;
  email?: string;
  created_at: string;
  last_seen: string;
  is_guest: boolean;
  profile_avatar?: string;
  preferred_settings?: Record<string, any>;
}

export interface PlayerStatistics {
  id: string;
  player_name: string;
  total_games: number;
  games_won: number;
  games_lost: number;
  total_points_scored: number;
  vol_achievements: number;
  times_on_hook: number;
  double_victories: number;
  average_game_duration?: string;
  favorite_trump_suit?: string;
  trump_success_rate: number;
  partnership_wins: number;
  solo_wins: number;
  longest_win_streak: number;
  current_win_streak: number;
  last_updated: string;
}

export interface GameHistory {
  id: string;
  lobby_id: string;
  game_duration?: string;
  winner_team: string[];
  final_scores: Record<string, number>;
  trump_suit?: string;
  trump_declarer?: string;
  vol_achieved: boolean;
  double_victory: boolean;
  players_involved: string[];
  game_variant: '4-player' | '3-player' | '2-player';
  completed_at: string;
}

export interface Tournament {
  id: string;
  name: string;
  format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss';
  start_date: string;
  end_date: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  max_participants: number;
  current_round: number;
  organizer_id: string;
  rules: Record<string, any>;
  created_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  player_name: string;
  team_number?: number;
  seed_number?: number;
  status: 'active' | 'eliminated' | 'winner';
  joined_at: string;
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  lobby_id?: string;
  player1_name?: string;
  player2_name?: string;
  winner_name?: string;
  scheduled_time?: string;
  completed_at?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

export interface TournamentStanding {
  id: string;
  tournament_id: string;
  player_name: string;
  position: number;
  matches_won: number;
  matches_lost: number;
  points_scored: number;
  last_updated: string;
}

export interface Card {
  id: string;
  rank: string;
  suit: string;
  value: number;
}
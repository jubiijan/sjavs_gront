export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: {
          id: string
          email: string
          admin_level: number
          created_at: string
          last_login: string | null
          permissions: Json
        }
        Insert: {
          id?: string
          email: string
          admin_level?: number
          created_at?: string
          last_login?: string | null
          permissions?: Json
        }
        Update: {
          id?: string
          email?: string
          admin_level?: number
          created_at?: string
          last_login?: string | null
          permissions?: Json
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          id: string
          lobby_id: string
          player_name: string | null
          message: string
          message_type: string
          created_at: string
        }
        Insert: {
          id?: string
          lobby_id: string
          player_name?: string | null
          message: string
          message_type?: string
          created_at?: string
        }
        Update: {
          id?: string
          lobby_id?: string
          player_name?: string | null
          message?: string
          message_type?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_lobby_id_fkey"
            columns: ["lobby_id"]
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          }
        ]
      }
      game_history: {
        Row: {
          id: string
          lobby_id: string
          game_duration: string | null
          winner_team: Json | null
          final_scores: Json | null
          trump_suit: string | null
          trump_declarer: string | null
          vol_achieved: boolean
          double_victory: boolean
          players_involved: Json | null
          game_variant: string
          completed_at: string
        }
        Insert: {
          id?: string
          lobby_id: string
          game_duration?: string | null
          winner_team?: Json | null
          final_scores?: Json | null
          trump_suit?: string | null
          trump_declarer?: string | null
          vol_achieved?: boolean
          double_victory?: boolean
          players_involved?: Json | null
          game_variant?: string
          completed_at?: string
        }
        Update: {
          id?: string
          lobby_id?: string
          game_duration?: string | null
          winner_team?: Json | null
          final_scores?: Json | null
          trump_suit?: string | null
          trump_declarer?: string | null
          vol_achieved?: boolean
          double_victory?: boolean
          players_involved?: Json | null
          game_variant?: string
          completed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_history_lobby_id_fkey"
            columns: ["lobby_id"]
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          }
        ]
      }
      game_state: {
        Row: {
          id: string
          lobby_id: string
          current_phase: string | null
          trump_suit: string | null
          trump_declarer: string | null
          current_player: number | null
          trick_number: number
          scores: Json | null
          player_hands: Json | null
          table_cards: Json | null
          updated_at: string
        }
        Insert: {
          id?: string
          lobby_id: string
          current_phase?: string | null
          trump_suit?: string | null
          trump_declarer?: string | null
          current_player?: number | null
          trick_number?: number
          scores?: Json | null
          player_hands?: Json | null
          table_cards?: Json | null
          updated_at?: string
        }
        Update: {
          id?: string
          lobby_id?: string
          current_phase?: string | null
          trump_suit?: string | null
          trump_declarer?: string | null
          current_player?: number | null
          trick_number?: number
          scores?: Json | null
          player_hands?: Json | null
          table_cards?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_state_lobby_id_fkey"
            columns: ["lobby_id"]
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          }
        ]
      }
      lobbies: {
        Row: {
          id: string
          lobby_code: string
          host_id: string
          max_players: number
          status: string
          created_at: string
          game_settings: Json | null
        }
        Insert: {
          id?: string
          lobby_code: string
          host_id: string
          max_players?: number
          status?: string
          created_at?: string
          game_settings?: Json | null
        }
        Update: {
          id?: string
          lobby_code?: string
          host_id?: string
          max_players?: number
          status?: string
          created_at?: string
          game_settings?: Json | null
        }
        Relationships: []
      }
      lobby_players: {
        Row: {
          id: string
          lobby_id: string
          player_name: string
          is_host: boolean
          is_ready: boolean
          player_position: number | null
          joined_at: string
        }
        Insert: {
          id?: string
          lobby_id: string
          player_name: string
          is_host?: boolean
          is_ready?: boolean
          player_position?: number | null
          joined_at?: string
        }
        Update: {
          id?: string
          lobby_id?: string
          player_name?: string
          is_host?: boolean
          is_ready?: boolean
          player_position?: number | null
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lobby_players_lobby_id_fkey"
            columns: ["lobby_id"]
            referencedRelation: "lobbies"
            referencedColumns: ["id"]
          }
        ]
      }
      player_profiles: {
        Row: {
          id: string
          player_name: string
          email: string | null
          created_at: string
          last_seen: string
          is_guest: boolean
          profile_avatar: string | null
          preferred_settings: Json | null
        }
        Insert: {
          id?: string
          player_name: string
          email?: string | null
          created_at?: string
          last_seen?: string
          is_guest?: boolean
          profile_avatar?: string | null
          preferred_settings?: Json | null
        }
        Update: {
          id?: string
          player_name?: string
          email?: string | null
          created_at?: string
          last_seen?: string
          is_guest?: boolean
          profile_avatar?: string | null
          preferred_settings?: Json | null
        }
        Relationships: []
      }
      player_statistics: {
        Row: {
          id: string
          player_name: string | null
          total_games: number
          games_won: number
          games_lost: number
          total_points_scored: number
          vol_achievements: number
          times_on_hook: number
          double_victories: number
          average_game_duration: string | null
          favorite_trump_suit: string | null
          trump_success_rate: number
          partnership_wins: number
          solo_wins: number
          longest_win_streak: number
          current_win_streak: number
          last_updated: string
          trump_success_count?: number
          trump_total_count?: number
        }
        Insert: {
          id?: string
          player_name?: string | null
          total_games?: number
          games_won?: number
          games_lost?: number
          total_points_scored?: number
          vol_achievements?: number
          times_on_hook?: number
          double_victories?: number
          average_game_duration?: string | null
          favorite_trump_suit?: string | null
          trump_success_rate?: number
          partnership_wins?: number
          solo_wins?: number
          longest_win_streak?: number
          current_win_streak?: number
          last_updated?: string
          trump_success_count?: number
          trump_total_count?: number
        }
        Update: {
          id?: string
          player_name?: string | null
          total_games?: number
          games_won?: number
          games_lost?: number
          total_points_scored?: number
          vol_achievements?: number
          times_on_hook?: number
          double_victories?: number
          average_game_duration?: string | null
          favorite_trump_suit?: string | null
          trump_success_rate?: number
          partnership_wins?: number
          solo_wins?: number
          longest_win_streak?: number
          current_win_streak?: number
          last_updated?: string
          trump_success_count?: number
          trump_total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_statistics_player_name_fkey"
            columns: ["player_name"]
            referencedRelation: "player_profiles"
            referencedColumns: ["player_name"]
          }
        ]
      }
      system_logs: {
        Row: {
          id: string
          log_level: string | null
          category: string | null
          message: string
          player_name: string | null
          lobby_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          log_level?: string | null
          category?: string | null
          message: string
          player_name?: string | null
          lobby_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          log_level?: string | null
          category?: string | null
          message?: string
          player_name?: string | null
          lobby_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
    }
  }
}
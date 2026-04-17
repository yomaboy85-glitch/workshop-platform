import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string;
          name: string;
          role: 'admin' | 'user';
          is_online: boolean;
          last_seen: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      teams: {
        Row: {
          id: string;
          name: string;
          color: string;
          total_score: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['teams']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['teams']['Insert']>;
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: Omit<Database['public']['Tables']['team_members']['Row'], 'id' | 'joined_at'>;
        Update: Partial<Database['public']['Tables']['team_members']['Insert']>;
      };
      games: {
        Row: {
          id: string;
          name: string;
          type: 'quiz' | 'mission' | 'timer' | 'voting' | 'treasure';
          status: 'waiting' | 'playing' | 'ended';
          config: Record<string, unknown>;
          created_by: string | null;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['games']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['games']['Insert']>;
      };
      treasures: {
        Row: {
          id: string;
          game_id: string;
          lat: number;
          lng: number;
          hint: string | null;
          score: number;
          reveal_radius: number;
          claim_radius: number;
          is_found: boolean;
          found_by: string | null;
          found_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['treasures']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['treasures']['Insert']>;
      };
      scores: {
        Row: {
          id: string;
          user_id: string;
          team_id: string | null;
          game_id: string;
          points: number;
          reason: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scores']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['scores']['Insert']>;
      };
      rewards: {
        Row: {
          id: string;
          rank: number;
          reward_name: string;
          description: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['rewards']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['rewards']['Insert']>;
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          content: string;
          type: 'banner' | 'modal';
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['announcements']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['announcements']['Insert']>;
      };
    };
  };
};

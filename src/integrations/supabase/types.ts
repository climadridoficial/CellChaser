export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      aemet_radar_frames: {
        Row: {
          code: string
          created_at: string
          image_b64: string | null
          observed_at: string
          path: string
        }
        Insert: {
          code: string
          created_at?: string
          image_b64?: string | null
          observed_at: string
          path: string
        }
        Update: {
          code?: string
          created_at?: string
          image_b64?: string | null
          observed_at?: string
          path?: string
        }
        Relationships: []
      }
      opera_response_cache: {
        Row: {
          body_base64: string | null
          cache_key: string
          content_type: string
          expires_at: string
          lease_token: string | null
          lease_until: string
          status: number
        }
        Insert: {
          body_base64?: string | null
          cache_key: string
          content_type?: string
          expires_at?: string
          lease_token?: string | null
          lease_until?: string
          status?: number
        }
        Update: {
          body_base64?: string | null
          cache_key?: string
          content_type?: string
          expires_at?: string
          lease_token?: string | null
          lease_until?: string
          status?: number
        }
        Relationships: []
      }
      opera_upstream_gate: {
        Row: {
          blocked_until: string
          host: string
          next_request_at: string
        }
        Insert: {
          blocked_until?: string
          host: string
          next_request_at?: string
        }
        Update: {
          blocked_until?: string
          host?: string
          next_request_at?: string
        }
        Relationships: []
      }
      radar_alignments: {
        Row: {
          corners: Json | null
          east: number
          north: number
          radar_code: string
          south: number
          updated_at: string
          user_id: string
          west: number
        }
        Insert: {
          corners?: Json | null
          east: number
          north: number
          radar_code: string
          south: number
          updated_at?: string
          user_id: string
          west: number
        }
        Update: {
          corners?: Json | null
          east?: number
          north?: number
          radar_code?: string
          south?: number
          updated_at?: string
          user_id?: string
          west?: number
        }
        Relationships: []
      }
      storm_cell_frames: {
        Row: {
          algorithm_version: number
          cells: Json
          observed_at: string
          radar_id: string
          source: string
        }
        Insert: {
          algorithm_version?: number
          cells?: Json
          observed_at: string
          radar_id: string
          source: string
        }
        Update: {
          algorithm_version?: number
          cells?: Json
          observed_at?: string
          radar_id?: string
          source?: string
        }
        Relationships: []
      }
      storm_source_state: {
        Row: {
          available: boolean
          checked_at: string
          radar_id: string
          source: string
        }
        Insert: {
          available?: boolean
          checked_at?: string
          radar_id: string
          source: string
        }
        Update: {
          available?: boolean
          checked_at?: string
          radar_id?: string
          source?: string
        }
        Relationships: []
      }
      storm_track_frames: {
        Row: {
          algorithm_version: number
          observed_at: string
          radar_id: string
          source: string
          tracks: Json
        }
        Insert: {
          algorithm_version?: number
          observed_at: string
          radar_id: string
          source: string
          tracks?: Json
        }
        Update: {
          algorithm_version?: number
          observed_at?: string
          radar_id?: string
          source?: string
          tracks?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_opera_cache: {
        Args: { p_host: string; p_key: string; p_token: string }
        Returns: Json
      }
      finish_opera_cache: {
        Args: {
          p_body: string
          p_host: string
          p_key: string
          p_retry?: number
          p_status: number
          p_token: string
          p_ttl: number
          p_type: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

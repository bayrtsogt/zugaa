export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string;
          actor: string;
          actor_telegram_id: number | null;
          actor_user_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          entity: string;
          entity_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor: string;
          actor_telegram_id?: number | null;
          actor_user_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          entity: string;
          entity_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor?: string;
          actor_telegram_id?: number | null;
          actor_user_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          entity?: string;
          entity_id?: string | null;
          id?: never;
        };
        Relationships: [];
      };
      chapter_choices: {
        Row: {
          chapter_id: string;
          id: string;
          label: string;
          position: number;
          target_chapter_id: string;
        };
        Insert: {
          chapter_id: string;
          id?: string;
          label: string;
          position?: number;
          target_chapter_id: string;
        };
        Update: {
          chapter_id?: string;
          id?: string;
          label?: string;
          position?: number;
          target_chapter_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chapter_choices_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "chapters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chapter_choices_target_chapter_id_fkey";
            columns: ["target_chapter_id"];
            isOneToOne: false;
            referencedRelation: "chapters";
            referencedColumns: ["id"];
          },
        ];
      };
      chapters: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          is_ending: boolean;
          is_free: boolean;
          number: number;
          price_coins: number;
          published_at: string | null;
          story_id: string;
          title: string;
        };
        Insert: {
          content?: string;
          created_at?: string;
          id?: string;
          is_ending?: boolean;
          is_free?: boolean;
          number: number;
          price_coins?: number;
          published_at?: string | null;
          story_id: string;
          title: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          id?: string;
          is_ending?: boolean;
          is_free?: boolean;
          number?: number;
          price_coins?: number;
          published_at?: string | null;
          story_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chapters_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_requests: {
        Row: {
          amount_mnt: number;
          created_at: string;
          decided_at: string | null;
          decided_by_telegram_id: number | null;
          decided_by_user_id: string | null;
          ebarimt_id: string | null;
          id: string;
          product_id: string;
          provider: string;
          provider_ref: string | null;
          ref_code: string;
          reject_reason: string | null;
          status: string;
          submitted_at: string | null;
          telegram_chat_id: number | null;
          telegram_message_id: number | null;
          user_id: string;
        };
        Insert: {
          amount_mnt: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by_telegram_id?: number | null;
          decided_by_user_id?: string | null;
          ebarimt_id?: string | null;
          id?: string;
          product_id: string;
          provider?: string;
          provider_ref?: string | null;
          ref_code: string;
          reject_reason?: string | null;
          status?: string;
          submitted_at?: string | null;
          telegram_chat_id?: number | null;
          telegram_message_id?: number | null;
          user_id: string;
        };
        Update: {
          amount_mnt?: number;
          created_at?: string;
          decided_at?: string | null;
          decided_by_telegram_id?: number | null;
          decided_by_user_id?: string | null;
          ebarimt_id?: string | null;
          id?: string;
          product_id?: string;
          provider?: string;
          provider_ref?: string | null;
          ref_code?: string;
          reject_reason?: string | null;
          status?: string;
          submitted_at?: string | null;
          telegram_chat_id?: number | null;
          telegram_message_id?: number | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_requests_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          app: string;
          code: string;
          coins: number | null;
          created_at: string;
          description: string | null;
          duration_days: number | null;
          id: string;
          kind: string;
          price_mnt: number;
          sort_order: number;
          story_id: string | null;
          title: string;
        };
        Insert: {
          active?: boolean;
          app?: string;
          code: string;
          coins?: number | null;
          created_at?: string;
          description?: string | null;
          duration_days?: number | null;
          id?: string;
          kind: string;
          price_mnt: number;
          sort_order?: number;
          story_id?: string | null;
          title: string;
        };
        Update: {
          active?: boolean;
          app?: string;
          code?: string;
          coins?: number | null;
          created_at?: string;
          description?: string | null;
          duration_days?: number | null;
          id?: string;
          kind?: string;
          price_mnt?: number;
          sort_order?: number;
          story_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_story_fk";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          age_verification_method: string | null;
          age_verified_at: string | null;
          birth_year: number | null;
          created_at: string;
          display_name: string | null;
          id: string;
          is_admin: boolean;
        };
        Insert: {
          age_verification_method?: string | null;
          age_verified_at?: string | null;
          birth_year?: number | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          is_admin?: boolean;
        };
        Update: {
          age_verification_method?: string | null;
          age_verified_at?: string | null;
          birth_year?: number | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          is_admin?: boolean;
        };
        Relationships: [];
      };
      reading_progress: {
        Row: {
          chapter_id: string;
          scroll_pct: number;
          story_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          chapter_id: string;
          scroll_pct?: number;
          story_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          chapter_id?: string;
          scroll_pct?: number;
          story_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reading_progress_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "chapters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reading_progress_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      stories: {
        Row: {
          age_rating: string;
          cover_color: string;
          cover_url: string | null;
          created_at: string;
          description: string;
          genre: string;
          id: string;
          price_coins: number | null;
          published_at: string | null;
          slug: string;
          status: string;
          title: string;
          wait_free_hours: number | null;
        };
        Insert: {
          age_rating?: string;
          cover_color?: string;
          cover_url?: string | null;
          created_at?: string;
          description?: string;
          genre?: string;
          id?: string;
          price_coins?: number | null;
          published_at?: string | null;
          slug: string;
          status?: string;
          title: string;
          wait_free_hours?: number | null;
        };
        Update: {
          age_rating?: string;
          cover_color?: string;
          cover_url?: string | null;
          created_at?: string;
          description?: string;
          genre?: string;
          id?: string;
          price_coins?: number | null;
          published_at?: string | null;
          slug?: string;
          status?: string;
          title?: string;
          wait_free_hours?: number | null;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          payment_request_id: string | null;
          product_id: string | null;
          scope: string;
          starts_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          payment_request_id?: string | null;
          product_id?: string | null;
          scope?: string;
          starts_at: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          payment_request_id?: string | null;
          product_id?: string | null;
          scope?: string;
          starts_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_payment_request_fk";
            columns: ["payment_request_id"];
            isOneToOne: false;
            referencedRelation: "payment_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      unlocks: {
        Row: {
          chapter_id: string | null;
          created_at: string;
          id: string;
          method: string;
          story_id: string;
          user_id: string;
        };
        Insert: {
          chapter_id?: string | null;
          created_at?: string;
          id?: string;
          method: string;
          story_id: string;
          user_id: string;
        };
        Update: {
          chapter_id?: string | null;
          created_at?: string;
          id?: string;
          method?: string;
          story_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unlocks_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "chapters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "unlocks_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      wait_free_timers: {
        Row: {
          chapter_id: string;
          started_at: string;
          story_id: string;
          user_id: string;
        };
        Insert: {
          chapter_id: string;
          started_at?: string;
          story_id: string;
          user_id: string;
        };
        Update: {
          chapter_id?: string;
          started_at?: string;
          story_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wait_free_timers_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "chapters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wait_free_timers_story_id_fkey";
            columns: ["story_id"];
            isOneToOne: false;
            referencedRelation: "stories";
            referencedColumns: ["id"];
          },
        ];
      };
      wallet_transactions: {
        Row: {
          app: string;
          created_at: string;
          delta_coins: number;
          id: string;
          note: string | null;
          reason: string;
          ref_id: string | null;
          user_id: string;
        };
        Insert: {
          app?: string;
          created_at?: string;
          delta_coins: number;
          id?: string;
          note?: string | null;
          reason: string;
          ref_id?: string | null;
          user_id: string;
        };
        Update: {
          app?: string;
          created_at?: string;
          delta_coins?: number;
          id?: string;
          note?: string | null;
          reason?: string;
          ref_id?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          balance_coins: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance_coins?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance_coins?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_adjust_coins: { Args: { p_delta: number; p_reason: string; p_user_id: string }; Returns: number };
      admin_find_users: {
        Args: { p_query: string };
        Returns: {
          balance_coins: number;
          display_name: string;
          email: string;
          id: string;
          subscription_expires_at: string;
        }[];
      };
      admin_list_payment_requests: {
        Args: { p_limit?: number; p_status?: string };
        Returns: {
          amount_mnt: number;
          created_at: string;
          decided_at: string;
          decided_by_telegram_id: number;
          decided_by_user_id: string;
          id: string;
          product_kind: string;
          product_title: string;
          ref_code: string;
          reject_reason: string;
          status: string;
          submitted_at: string;
          user_email: string;
          user_id: string;
        }[];
      };
      approve_payment: { Args: { p_admin_telegram_id?: number; p_request_id: string }; Returns: Json };
      check_rate_limit: { Args: { p_key: string; p_max: number; p_window_seconds: number }; Returns: boolean };
      create_payment_request: {
        Args: { p_product_code: string };
        Returns: {
          amount_mnt: number;
          created_at: string;
          decided_at: string | null;
          decided_by_telegram_id: number | null;
          decided_by_user_id: string | null;
          ebarimt_id: string | null;
          id: string;
          product_id: string;
          provider: string;
          provider_ref: string | null;
          ref_code: string;
          reject_reason: string | null;
          status: string;
          submitted_at: string | null;
          telegram_chat_id: number | null;
          telegram_message_id: number | null;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "payment_requests";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      get_chapter: {
        Args: { p_chapter_id: string };
        Returns: {
          choices: Json;
          content: string;
          gate: string;
          id: string;
          is_ending: boolean;
          is_free: boolean;
          locked: boolean;
          next_number: number;
          number: number;
          prev_number: number;
          price_coins: number;
          story_id: string;
          story_price_coins: number;
          story_slug: string;
          story_title: string;
          title: string;
          wait_free_ends_at: string;
          wait_free_hours: number;
          wait_free_other_chapter: number;
        }[];
      };
      get_chapter_at: {
        Args: { p_number: number; p_slug: string };
        Returns: {
          choices: Json;
          content: string;
          gate: string;
          id: string;
          is_ending: boolean;
          is_free: boolean;
          locked: boolean;
          next_number: number;
          number: number;
          prev_number: number;
          price_coins: number;
          story_id: string;
          story_price_coins: number;
          story_slug: string;
          story_title: string;
          title: string;
          wait_free_ends_at: string;
          wait_free_hours: number;
          wait_free_other_chapter: number;
        }[];
      };
      get_chapter_id: { Args: { p_number: number; p_slug: string }; Returns: string };
      get_story_chapters: {
        Args: { p_story_id: string };
        Returns: {
          has_access: boolean;
          id: string;
          is_ending: boolean;
          is_free: boolean;
          number: number;
          price_coins: number;
          published_at: string;
          title: string;
        }[];
      };
      has_access: { Args: { p_chapter_id: string; p_user: string }; Returns: boolean };
      my_wallet_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      reject_payment: {
        Args: { p_admin_telegram_id?: number; p_reason?: string; p_request_id: string };
        Returns: Json;
      };
      save_reading_progress: { Args: { p_chapter_id: string; p_scroll_pct: number }; Returns: undefined };
      set_payment_reject_reason: { Args: { p_reason: string; p_request_id: string }; Returns: boolean };
      submit_payment_request: { Args: { p_request_id: string }; Returns: Json };
      unlock_chapter: { Args: { p_chapter_id: string }; Returns: Json };
      unlock_story: { Args: { p_story_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]) | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      aisles: {
        Row: {
          created_at: string
          emoji: string
          household_id: string
          id: string
          kind: string | null
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          emoji?: string
          household_id: string
          id?: string
          kind?: string | null
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          emoji?: string
          household_id?: string
          id?: string
          kind?: string | null
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "aisles_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string
          household_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at: string
          household_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string
          household_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_invites_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      household_members: {
        Row: {
          household_id: string
          joined_at: string
          role: string
          tint: string
          user_id: string
        }
        Insert: {
          household_id: string
          joined_at?: string
          role?: string
          tint?: string
          user_id: string
        }
        Update: {
          household_id?: string
          joined_at?: string
          role?: string
          tint?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "household_members_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      households: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          aisle_id: string | null
          assigned_to: string | null
          checked: boolean
          created_at: string
          id: string
          list_id: string
          name: string
          note: string | null
          priority: boolean
          product_slug: string | null
          qty: number | null
          unit: string
          updated_at: string
        }
        Insert: {
          aisle_id?: string | null
          assigned_to?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          list_id: string
          name: string
          note?: string | null
          priority?: boolean
          product_slug?: string | null
          qty?: number | null
          unit?: string
          updated_at?: string
        }
        Update: {
          aisle_id?: string | null
          assigned_to?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          note?: string | null
          priority?: boolean
          product_slug?: string | null
          qty?: number | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_aisle_id_fkey"
            columns: ["aisle_id"]
            isOneToOne: false
            referencedRelation: "aisles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      list_members: {
        Row: {
          list_id: string
          user_id: string
        }
        Insert: {
          list_id: string
          user_id: string
        }
        Update: {
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          archived_at: string | null
          color: string
          created_at: string
          emoji: string
          event_date: string | null
          household_id: string
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          emoji?: string
          event_date?: string | null
          household_id: string
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          emoji?: string
          event_date?: string | null
          household_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lists_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_cards: {
        Row: {
          code: string
          code_type: string
          created_at: string
          grad: string
          household_id: string
          id: string
          name: string
          notes: string | null
          num: string
          points: number
          shop_id: string | null
          tint: string
        }
        Insert: {
          code: string
          code_type: string
          created_at?: string
          grad?: string
          household_id: string
          id?: string
          name: string
          notes?: string | null
          num?: string
          points?: number
          shop_id?: string | null
          tint?: string
        }
        Update: {
          code?: string
          code_type?: string
          created_at?: string
          grad?: string
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          num?: string
          points?: number
          shop_id?: string | null
          tint?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_cards_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_system: boolean
          list_id: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          list_id: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_system?: boolean
          list_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_options: {
        Row: {
          claimed_by: string | null
          emoji: string | null
          id: string
          ingredients: string[]
          label: string
          poll_id: string
          position: number
        }
        Insert: {
          claimed_by?: string | null
          emoji?: string | null
          id?: string
          ingredients?: string[]
          label: string
          poll_id: string
          position?: number
        }
        Update: {
          claimed_by?: string | null
          emoji?: string | null
          id?: string
          ingredients?: string[]
          label?: string
          poll_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_votes: {
        Row: {
          option_id: string
          user_id: string
        }
        Insert: {
          option_id: string
          user_id: string
        }
        Update: {
          option_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          closed: boolean
          id: string
          kind: string
          message_id: string
          question: string
        }
        Insert: {
          closed?: boolean
          id?: string
          kind: string
          message_id: string
          question: string
        }
        Update: {
          closed?: boolean
          id?: string
          kind?: string
          message_id?: string
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          initial: string
          is_demo: boolean
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          status: string
          theme: string
          tint: string
          type_scale: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          initial?: string
          is_demo?: boolean
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
          theme?: string
          tint?: string
          type_scale?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          initial?: string
          is_demo?: boolean
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          status?: string
          theme?: string
          tint?: string
          type_scale?: string
        }
        Relationships: []
      }
      shop_item_orders: {
        Row: {
          aisle_id: string
          product_slugs: string[]
          shop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aisle_id: string
          product_slugs?: string[]
          shop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aisle_id?: string
          product_slugs?: string[]
          shop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_item_orders_aisle_id_fkey"
            columns: ["aisle_id"]
            isOneToOne: false
            referencedRelation: "aisles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_item_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_layouts: {
        Row: {
          aisle_order: string[]
          learned: boolean
          shop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          aisle_order?: string[]
          learned?: boolean
          shop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          aisle_order?: string[]
          learned?: boolean
          shop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_layouts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          created_at: string
          household_id: string
          id: string
          name: string
          short: string
          tint: string
        }
        Insert: {
          created_at?: string
          household_id: string
          id?: string
          name: string
          short?: string
          tint?: string
        }
        Update: {
          created_at?: string
          household_id?: string
          id?: string
          name?: string
          short?: string
          tint?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_list: { Args: { target: string }; Returns: boolean }
      can_access_shop: { Args: { target: string }; Returns: boolean }
      create_invite: { Args: never; Returns: string }
      ensure_household: { Args: { household_name?: string }; Returns: string }
      household_profiles: {
        Args: never
        Returns: {
          display_name: string
          id: string
          initial: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      is_household_member: { Args: { target: string }; Returns: boolean }
      leave_household: { Args: { target: string }; Returns: undefined }
      pending_accounts: {
        Args: never
        Returns: {
          display_name: string
          email: string
          id: string
          requested_at: string
          status: string
        }[]
      }
      redeem_invite: { Args: { invite_code: string }; Returns: string }
      review_account: {
        Args: { decision: string; target: string }
        Returns: undefined
      }
      slugify: { Args: { value: string }; Returns: string }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


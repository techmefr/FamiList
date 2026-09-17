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
      admin_notifications: {
        Row: {
          claimed_at: string | null
          created_at: string
          id: string
          kind: string
          payload: Json
          sent_at: string | null
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          sent_at?: string | null
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          sent_at?: string | null
        }
        Relationships: []
      }
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
      bug_reports: {
        Row: {
          created_at: string
          description: string
          id: string
          issue_claimed_at: string | null
          issue_number: number | null
          issue_published_at: string | null
          issue_requested_at: string | null
          issue_url: string | null
          kind: string
          number: number
          path: string | null
          resolved_at: string | null
          screenshot: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          issue_claimed_at?: string | null
          issue_number?: number | null
          issue_published_at?: string | null
          issue_requested_at?: string | null
          issue_url?: string | null
          kind?: string
          number?: number
          path?: string | null
          resolved_at?: string | null
          screenshot?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          issue_claimed_at?: string | null
          issue_number?: number | null
          issue_published_at?: string | null
          issue_requested_at?: string | null
          issue_url?: string | null
          kind?: string
          number?: number
          path?: string | null
          resolved_at?: string | null
          screenshot?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          message: string
          occurrences: number
          path: string | null
          resolved_at: string | null
          source: string
          stack: string | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message: string
          occurrences?: number
          path?: string | null
          resolved_at?: string | null
          source: string
          stack?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message?: string
          occurrences?: number
          path?: string | null
          resolved_at?: string | null
          source?: string
          stack?: string | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      instance_mail_quota: {
        Row: {
          day: string
          sent: number
        }
        Insert: {
          day: string
          sent?: number
        }
        Update: {
          day?: string
          sent?: number
        }
        Relationships: []
      }
      instance_settings: {
        Row: {
          is_secret: boolean
          is_set: boolean
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          is_secret?: boolean
          is_set?: boolean
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          is_secret?: boolean
          is_set?: boolean
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      invite_attempts: {
        Row: {
          attempted_at: string
          id: number
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: never
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      item_prices: {
        Row: {
          amount: number
          created_at: string
          currency: string
          household_id: string
          id: string
          product_name: string
          product_slug: string
          recorded_at: string
          recorded_by: string | null
          shop_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          household_id: string
          id?: string
          product_name: string
          product_slug: string
          recorded_at?: string
          recorded_by?: string | null
          shop_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          household_id?: string
          id?: string
          product_name?: string
          product_slug?: string
          recorded_at?: string
          recorded_by?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_prices_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
          household_id: string | null
          id: string
          name: string
        }
        Insert: {
          archived_at?: string | null
          color?: string
          created_at?: string
          emoji?: string
          event_date?: string | null
          household_id?: string | null
          id?: string
          name: string
        }
        Update: {
          archived_at?: string | null
          color?: string
          created_at?: string
          emoji?: string
          event_date?: string | null
          household_id?: string | null
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
          brand: string
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
          brand?: string
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
          brand?: string
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
      mfa_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
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
          accent_id: string
          avatar: string
          created_at: string
          display_name: string
          first_name: string
          font_id: string
          hand: string
          haptics: boolean
          has_seen_tour: boolean
          id: string
          initial: string
          is_demo: boolean
          last_name: string
          motion: string
          nearby_cards: boolean
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          role: string
          sound: boolean
          status: string
          theme: string
          tint: string
          type_scale: string
        }
        Insert: {
          accent_id?: string
          avatar?: string
          created_at?: string
          display_name?: string
          first_name?: string
          font_id?: string
          hand?: string
          haptics?: boolean
          has_seen_tour?: boolean
          id: string
          initial?: string
          is_demo?: boolean
          last_name?: string
          motion?: string
          nearby_cards?: boolean
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          sound?: boolean
          status?: string
          theme?: string
          tint?: string
          type_scale?: string
        }
        Update: {
          accent_id?: string
          avatar?: string
          created_at?: string
          display_name?: string
          first_name?: string
          font_id?: string
          hand?: string
          haptics?: boolean
          has_seen_tour?: boolean
          id?: string
          initial?: string
          is_demo?: boolean
          last_name?: string
          motion?: string
          nearby_cards?: boolean
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: string
          sound?: boolean
          status?: string
          theme?: string
          tint?: string
          type_scale?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          position: number
          qty: number | null
          recipe_id: string
          unit: string
        }
        Insert: {
          id?: string
          name: string
          position?: number
          qty?: number | null
          recipe_id: string
          unit?: string
        }
        Update: {
          id?: string
          name?: string
          position?: number
          qty?: number | null
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_steps: {
        Row: {
          body: string
          id: string
          position: number
          recipe_id: string
        }
        Insert: {
          body: string
          id?: string
          position?: number
          recipe_id: string
        }
        Update: {
          body?: string
          id?: string
          position?: number
          recipe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_steps_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string
          created_by: string | null
          emoji: string
          household_id: string
          id: string
          name: string
          notes: string | null
          servings: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          household_id: string
          id?: string
          name: string
          notes?: string | null
          servings?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          household_id?: string
          id?: string
          name?: string
          notes?: string | null
          servings?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipes_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "households"
            referencedColumns: ["id"]
          },
        ]
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
          address: string
          brand: string
          created_at: string
          household_id: string
          id: string
          is_default: boolean
          lat: number | null
          lng: number | null
          name: string
          short: string
          tint: string
        }
        Insert: {
          address?: string
          brand?: string
          created_at?: string
          household_id: string
          id?: string
          is_default?: boolean
          lat?: number | null
          lng?: number | null
          name: string
          short?: string
          tint?: string
        }
        Update: {
          address?: string
          brand?: string
          created_at?: string
          household_id?: string
          id?: string
          is_default?: boolean
          lat?: number | null
          lng?: number | null
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
      admin_reset_mfa: { Args: { target: string }; Returns: undefined }
      assert_admin_write: { Args: never; Returns: undefined }
      backup_codes_left: { Args: never; Returns: number }
      begin_instance_mail_test: { Args: never; Returns: string }
      can_access_list: { Args: { target: string }; Returns: boolean }
      can_access_recipe: { Args: { target: string }; Returns: boolean }
      can_access_shop: { Args: { target: string }; Returns: boolean }
      claim_admin_notifications: { Args: never; Returns: Json }
      claim_bug_report_issues: { Args: never; Returns: Json }
      claim_instance_mail: { Args: { amount?: number }; Returns: boolean }
      clear_instance_setting: {
        Args: { setting_key: string }
        Returns: undefined
      }
      consume_backup_code: { Args: { code: string }; Returns: boolean }
      create_backup_codes: { Args: never; Returns: string[] }
      create_invite: { Args: never; Returns: string }
      delete_account: { Args: never; Returns: undefined }
      demote_admin: { Args: { target: string }; Returns: undefined }
      ensure_household: { Args: { household_name?: string }; Returns: string }
      export_account: { Args: never; Returns: Json }
      flush_admin_notifications: { Args: never; Returns: undefined }
      flush_bug_report_issues: { Args: never; Returns: undefined }
      household_profiles: {
        Args: never
        Returns: {
          avatar: string
          display_name: string
          first_name: string
          id: string
          initial: string
          last_name: string
        }[]
      }
      instance_config: { Args: never; Returns: Json }
      instance_secret_name: { Args: { setting_key: string }; Returns: string }
      instance_settings_read: {
        Args: never
        Returns: {
          is_secret: boolean
          is_set: boolean
          key: string
          updated_at: string
          value: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      is_approved: { Args: never; Returns: boolean }
      is_household_member: { Args: { target: string }; Returns: boolean }
      is_household_owner: { Args: { target: string }; Returns: boolean }
      is_household_sole_member: { Args: { target: string }; Returns: boolean }
      leave_household: { Args: { target: string }; Returns: undefined }
      list_belongs_to_household_of: {
        Args: { member: string; target: string }
        Returns: boolean
      }
      list_bug_reports: {
        Args: never
        Returns: {
          created_at: string
          description: string
          email: string
          id: string
          issue_number: number
          issue_requested_at: string
          issue_url: string
          kind: string
          number: number
          path: string
          screenshot: string
          status: string
          user_agent: string
        }[]
      }
      list_client_errors: {
        Args: never
        Returns: {
          fingerprint: string
          first_seen_at: string
          last_seen_at: string
          message: string
          occurrences: number
          path: string
          people: number
          source: string
          stack: string
          status: string
          user_agent: string
        }[]
      }
      lock_household_membership: { Args: never; Returns: undefined }
      mark_admin_notifications_sent: {
        Args: { ids: string[] }
        Returns: undefined
      }
      mark_bug_report_issue: {
        Args: { issue_number: number; issue_url: string; target: string }
        Returns: undefined
      }
      my_sessions: {
        Args: never
        Returns: {
          aal: string
          created_at: string
          current: boolean
          id: string
          ip: string
          refreshed_at: string
          user_agent: string
        }[]
      }
      pending_accounts: {
        Args: never
        Returns: {
          display_name: string
          email: string
          has_mfa: boolean
          id: string
          is_demo: boolean
          requested_at: string
          role: string
          status: string
        }[]
      }
      promote_admin: { Args: { target: string }; Returns: undefined }
      redeem_invite: { Args: { invite_code: string }; Returns: Json }
      release_admin_notifications: {
        Args: { ids: string[] }
        Returns: undefined
      }
      release_bug_report_issues: { Args: { ids: string[] }; Returns: undefined }
      report_crash: {
        Args: {
          fingerprint: string
          message: string
          path: string
          source: string
          stack: string
          user_agent: string
        }
        Returns: Json
      }
      request_bug_report_issue: { Args: { target: string }; Returns: undefined }
      reset_demo: { Args: never; Returns: undefined }
      resolve_bug_report: { Args: { target: string }; Returns: undefined }
      resolve_client_error: { Args: { target: string }; Returns: undefined }
      review_account: {
        Args: { decision: string; target: string }
        Returns: undefined
      }
      revoke_session: { Args: { target: string }; Returns: undefined }
      set_demo: { Args: { demo: boolean; target: string }; Returns: undefined }
      set_instance_setting: {
        Args: { setting_key: string; setting_value: string }
        Returns: undefined
      }
      slugify: { Args: { value: string }; Returns: string }
      submit_bug_report: {
        Args: {
          description: string
          kind?: string
          path: string
          screenshot: string
          user_agent: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


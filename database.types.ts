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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_permissions: {
        Row: {
          category: string
          created_at: string
          description: string | null
          display_name: string
          id: string
          permission_key: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          permission_key: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          permission_key?: string
        }
        Relationships: []
      }
      admin_role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "admin_permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          is_system: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          is_system?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          is_system?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_user_roles: {
        Row: {
          admin_user_id: string
          assigned_at: string
          assigned_by: string | null
          id: string
          role_id: string
        }
        Insert: {
          admin_user_id: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id: string
        }
        Update: {
          admin_user_id?: string
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_roles_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "admin_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          auth_user_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      balance_reconcile_log: {
        Row: {
          checked_users: number
          details: Json
          id: string
          mismatch_count: number
          run_at: string
        }
        Insert: {
          checked_users: number
          details?: Json
          id?: string
          mismatch_count: number
          run_at?: string
        }
        Update: {
          checked_users?: number
          details?: Json
          id?: string
          mismatch_count?: number
          run_at?: string
        }
        Relationships: []
      }
      line_quota_cache: {
        Row: {
          consumed: number | null
          fetched_at: string
          id: number
          quota_limit: number | null
        }
        Insert: {
          consumed?: number | null
          fetched_at?: string
          id?: number
          quota_limit?: number | null
        }
        Update: {
          consumed?: number | null
          fetched_at?: string
          id?: number
          quota_limit?: number | null
        }
        Relationships: []
      }
      notification_channels: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          last_error: string | null
          last_sent_at: string | null
          target_id: string
          token: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sent_at?: string | null
          target_id: string
          token?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_sent_at?: string | null
          target_id?: string
          token?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          id: string
          kind: string
          payload: Json | null
          sent_at: string
          user_id: string
          window_key: string
        }
        Insert: {
          id?: string
          kind: string
          payload?: Json | null
          sent_at?: string
          user_id: string
          window_key: string
        }
        Update: {
          id?: string
          kind?: string
          payload?: Json | null
          sent_at?: string
          user_id?: string
          window_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      point_batch_ledger: {
        Row: {
          bill_no: string | null
          campaign_id: string | null
          created_at: string
          discount_amount: number | null
          earned_month: string
          expires_at: string
          gross_amount: number | null
          id: string
          multiplier: number
          net_amount: number | null
          points_earned: number
          points_remaining: number
          purchase_date: string | null
          sales_rep_id: string | null
          source: string
          source_batch_id: string | null
          user_id: string
          voided: boolean
        }
        Insert: {
          bill_no?: string | null
          campaign_id?: string | null
          created_at?: string
          discount_amount?: number | null
          earned_month: string
          expires_at: string
          gross_amount?: number | null
          id?: string
          multiplier?: number
          net_amount?: number | null
          points_earned: number
          points_remaining: number
          purchase_date?: string | null
          sales_rep_id?: string | null
          source?: string
          source_batch_id?: string | null
          user_id: string
          voided?: boolean
        }
        Update: {
          bill_no?: string | null
          campaign_id?: string | null
          created_at?: string
          discount_amount?: number | null
          earned_month?: string
          expires_at?: string
          gross_amount?: number | null
          id?: string
          multiplier?: number
          net_amount?: number | null
          points_earned?: number
          points_remaining?: number
          purchase_date?: string | null
          sales_rep_id?: string | null
          source?: string
          source_batch_id?: string | null
          user_id?: string
          voided?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "point_batch_ledger_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "point_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_batch_ledger_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_batch_ledger_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "point_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_batch_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      point_batches: {
        Row: {
          committed_at: string | null
          committed_by: string | null
          created_at: string
          file_name: string
          file_sha256: string
          id: string
          invalid_rows: number
          raw_rows: Json
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["batch_status"]
          submitted_at: string | null
          submitted_by: string | null
          total_points: number
          total_rows: number
          unmatched_rows: number
          uploaded_by: string
          valid_rows: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          file_name: string
          file_sha256: string
          id?: string
          invalid_rows?: number
          raw_rows?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          total_points?: number
          total_rows?: number
          unmatched_rows?: number
          uploaded_by: string
          valid_rows?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          committed_at?: string | null
          committed_by?: string | null
          created_at?: string
          file_name?: string
          file_sha256?: string
          id?: string
          invalid_rows?: number
          raw_rows?: Json
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["batch_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          total_points?: number
          total_rows?: number
          unmatched_rows?: number
          uploaded_by?: string
          valid_rows?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_batches_committed_by_fkey"
            columns: ["committed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_batches_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_batches_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_batches_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_batches_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      point_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string
          id: string
          is_active: boolean
          multiplier: number
          name: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on: string
          id?: string
          is_active?: boolean
          multiplier: number
          name: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string
          id?: string
          is_active?: boolean
          multiplier?: number
          name?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      point_settings: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          setting_key: string
          setting_value: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          setting_key: string
          setting_value: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          setting_key?: string
          setting_value?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          points: number
          source: string
          source_batch_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          points: number
          source: string
          source_batch_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          points?: number
          source?: string
          source_batch_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "point_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      redemption_lots: {
        Row: {
          lot_id: string
          points: number
          redemption_id: string
        }
        Insert: {
          lot_id: string
          points: number
          redemption_id: string
        }
        Update: {
          lot_id?: string
          points?: number
          redemption_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemption_lots_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "point_batch_ledger"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemption_lots_redemption_id_fkey"
            columns: ["redemption_id"]
            isOneToOne: false
            referencedRelation: "redemptions"
            referencedColumns: ["id"]
          },
        ]
      }
      redemptions: {
        Row: {
          admin_notes: string | null
          created_at: string
          delivered_at: string | null
          delivered_by: string | null
          id: string
          pickup_code: string | null
          points_used: number
          processed_at: string | null
          processed_by: string | null
          quantity: number
          reward_id: string
          status: Database["public"]["Enums"]["redemption_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          pickup_code?: string | null
          points_used: number
          processed_at?: string | null
          processed_by?: string | null
          quantity?: number
          reward_id: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          delivered_at?: string | null
          delivered_by?: string | null
          id?: string
          pickup_code?: string | null
          points_used?: number
          processed_at?: string | null
          processed_by?: string | null
          quantity?: number
          reward_id?: string
          status?: Database["public"]["Enums"]["redemption_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redemptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_archived: boolean
          name: string
          points_cost: number
          sort_order: number | null
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_archived?: boolean
          name: string
          points_cost: number
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_archived?: boolean
          name?: string
          points_cost?: number
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_reps: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_reps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          line_audience_id: number | null
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          line_audience_id?: number | null
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          line_audience_id?: number | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notes: {
        Row: {
          created_at: string
          created_by_admin_id: string | null
          id: string
          note_content: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_admin_id?: string | null
          id?: string
          note_content: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by_admin_id?: string | null
          id?: string
          note_content?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notes_created_by_admin_id_fkey"
            columns: ["created_by_admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          birthday: string
          created_at: string
          customer_code: string | null
          display_name: string | null
          first_name: string | null
          id: string
          last_login_at: string | null
          last_name: string | null
          line_user_id: string
          phone: string | null
          picture_url: string | null
          points_balance: number
          role: Database["public"]["Enums"]["user_role"] | null
          updated_at: string
        }
        Insert: {
          birthday: string
          created_at?: string
          customer_code?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          line_user_id: string
          phone?: string | null
          picture_url?: string | null
          points_balance?: number
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
        }
        Update: {
          birthday?: string
          created_at?: string
          customer_code?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_login_at?: string | null
          last_name?: string | null
          line_user_id?: string
          phone?: string | null
          picture_url?: string | null
          points_balance?: number
          role?: Database["public"]["Enums"]["user_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
      user_tags: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          tag_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          tag_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tags_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_points_manual: {
        Args: {
          p_admin: string
          p_delta: number
          p_note: string
          p_user: string
        }
        Returns: number
      }
      award_points_from_batch: {
        Args: { p_admin: string; p_batch_id: string }
        Returns: number
      }
      cancel_redemption: {
        Args: { p_admin: string; p_note: string; p_redemption: string }
        Returns: number
      }
      expire_ledger_batches: { Args: { p_as_of: string }; Returns: number }
      generate_pickup_code: { Args: Record<PropertyKey, never>; Returns: string }
      reconcile_balances: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          points_balance: number
          ledger_remaining: number
          drift: number
        }[]
      }
      redeem_reward: {
        Args: { p_qty: number; p_reward: string; p_user: string }
        Returns: string
      }
      void_batch: {
        Args: { p_admin: string; p_batch_id: string; p_reason: string }
        Returns: undefined
      }
    }
    Enums: {
      batch_status:
        | "draft"
        | "previewed"
        | "pending_approval"
        | "committed"
        | "voided"
      redemption_status:
        | "requested"
        | "approved"
        | "ready"
        | "delivered"
        | "cancelled"
      transaction_type: "earned" | "spent" | "expired" | "bonus" | "refund"
      user_role: "contractor" | "homeowner"
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
  public: {
    Enums: {
      batch_status: [
        "draft",
        "previewed",
        "pending_approval",
        "committed",
        "voided",
      ],
      redemption_status: [
        "requested",
        "approved",
        "ready",
        "delivered",
        "cancelled",
      ],
      transaction_type: ["earned", "spent", "expired", "bonus", "refund"],
      user_role: ["contractor", "homeowner"],
    },
  },
} as const

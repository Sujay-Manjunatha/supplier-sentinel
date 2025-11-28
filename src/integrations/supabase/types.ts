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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      comparison_documents: {
        Row: {
          baseline_document_id: string
          content: string
          created_at: string
          file_name: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          baseline_document_id: string
          content: string
          created_at?: string
          file_name: string
          id?: string
          title: string
          user_id: string
        }
        Update: {
          baseline_document_id?: string
          content?: string
          created_at?: string
          file_name?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      completed_evaluations: {
        Row: {
          comparison_document_id: string
          completed_at: string
          created_at: string
          critical_gaps: number
          customer_name: string
          decisions: Json
          document_type: string
          email_template: string | null
          gaps: Json
          id: string
          low_gaps: number
          medium_gaps: number
          overall_compliance: number
          title: string
          user_id: string
        }
        Insert: {
          comparison_document_id: string
          completed_at?: string
          created_at?: string
          critical_gaps?: number
          customer_name: string
          decisions?: Json
          document_type?: string
          email_template?: string | null
          gaps?: Json
          id?: string
          low_gaps?: number
          medium_gaps?: number
          overall_compliance: number
          title: string
          user_id: string
        }
        Update: {
          comparison_document_id?: string
          completed_at?: string
          created_at?: string
          critical_gaps?: number
          customer_name?: string
          decisions?: Json
          document_type?: string
          email_template?: string | null
          gaps?: Json
          id?: string
          low_gaps?: number
          medium_gaps?: number
          overall_compliance?: number
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "completed_evaluations_comparison_document_id_fkey"
            columns: ["comparison_document_id"]
            isOneToOne: false
            referencedRelation: "comparison_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      gap_analyses: {
        Row: {
          baseline_document_id: string
          comparison_document_id: string
          created_at: string
          critical_gaps: number
          document_type: string
          gaps: Json
          id: string
          low_gaps: number
          medium_gaps: number
          overall_compliance_percentage: number
          status: string
          total_gaps: number
          user_id: string
        }
        Insert: {
          baseline_document_id: string
          comparison_document_id: string
          created_at?: string
          critical_gaps?: number
          document_type?: string
          gaps?: Json
          id?: string
          low_gaps?: number
          medium_gaps?: number
          overall_compliance_percentage: number
          status?: string
          total_gaps?: number
          user_id: string
        }
        Update: {
          baseline_document_id?: string
          comparison_document_id?: string
          created_at?: string
          critical_gaps?: number
          document_type?: string
          gaps?: Json
          id?: string
          low_gaps?: number
          medium_gaps?: number
          overall_compliance_percentage?: number
          status?: string
          total_gaps?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gap_analyses_comparison_document_id_fkey"
            columns: ["comparison_document_id"]
            isOneToOne: false
            referencedRelation: "comparison_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      negative_list_items: {
        Row: {
          category: string | null
          created_at: string | null
          description: string
          document_type: string
          id: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description: string
          document_type?: string
          id?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string
          document_type?: string
          id?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  public: {
    Enums: {},
  },
} as const

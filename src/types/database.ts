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
      exercise_sets: {
        Row: {
          created_at: string
          id: string
          position: number
          reps: number | null
          rpe: number | null
          session_exercise_id: string
          set_type: Database["public"]["Enums"]["set_type"]
          unit: Database["public"]["Enums"]["weight_unit"]
          user_id: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          reps?: number | null
          rpe?: number | null
          session_exercise_id: string
          set_type?: Database["public"]["Enums"]["set_type"]
          unit?: Database["public"]["Enums"]["weight_unit"]
          user_id?: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          reps?: number | null
          rpe?: number | null
          session_exercise_id?: string
          set_type?: Database["public"]["Enums"]["set_type"]
          unit?: Database["public"]["Enums"]["weight_unit"]
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_sets_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          aliases: string[]
          created_at: string
          equipment: Database["public"]["Enums"]["equipment_type"][]
          id: string
          muscle_group: string | null
          name: string
          user_id: string | null
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          equipment?: Database["public"]["Enums"]["equipment_type"][]
          id?: string
          muscle_group?: string | null
          name: string
          user_id?: string | null
        }
        Update: {
          aliases?: string[]
          created_at?: string
          equipment?: Database["public"]["Enums"]["equipment_type"][]
          id?: string
          muscle_group?: string | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      note_recordings: {
        Row: {
          created_at: string
          duration_ms: number
          id: string
          note_id: string
          path: string
          transcript: string
          user_id: string
          waveform: number[]
        }
        Insert: {
          created_at?: string
          duration_ms: number
          id?: string
          note_id: string
          path: string
          transcript?: string
          user_id?: string
          waveform?: number[]
        }
        Update: {
          created_at?: string
          duration_ms?: number
          id?: string
          note_id?: string
          path?: string
          transcript?: string
          user_id?: string
          waveform?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "note_recordings_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          extracted: Json | null
          id: string
          session_exercise_id: string | null
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          extracted?: Json | null
          id?: string
          session_exercise_id?: string | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          extracted?: Json | null
          id?: string
          session_exercise_id?: string | null
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      recovery_checks: {
        Row: {
          breathing_bpm: number | null
          confidence: number | null
          created_at: string
          duration_ms: number
          hrv_ms: number | null
          id: string
          pulse_bpm: number | null
          session_exercise_id: string | null
          session_id: string
          user_id: string
          video_location: string | null
          video_path: string | null
        }
        Insert: {
          breathing_bpm?: number | null
          confidence?: number | null
          created_at?: string
          duration_ms: number
          hrv_ms?: number | null
          id?: string
          pulse_bpm?: number | null
          session_exercise_id?: string | null
          session_id: string
          user_id?: string
          video_location?: string | null
          video_path?: string | null
        }
        Update: {
          breathing_bpm?: number | null
          confidence?: number | null
          created_at?: string
          duration_ms?: number
          hrv_ms?: number | null
          id?: string
          pulse_bpm?: number | null
          session_exercise_id?: string | null
          session_id?: string
          user_id?: string
          video_location?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recovery_checks_session_exercise_id_fkey"
            columns: ["session_exercise_id"]
            isOneToOne: false
            referencedRelation: "session_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recovery_checks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          created_at: string
          equipment: Database["public"]["Enums"]["equipment_type"] | null
          exercise_id: string
          id: string
          position: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipment?: Database["public"]["Enums"]["equipment_type"] | null
          exercise_id: string
          id?: string
          position?: number
          session_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          equipment?: Database["public"]["Enums"]["equipment_type"] | null
          exercise_id?: string
          id?: string
          position?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_ms: number
          started_at: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          paused_at?: string | null
          paused_ms?: number
          started_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          paused_at?: string | null
          paused_ms?: number
          started_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_my_account: { Args: never; Returns: undefined }
    }
    Enums: {
      equipment_type:
        | "barbell"
        | "dumbbell"
        | "cable"
        | "machine"
        | "kettlebell"
        | "band"
        | "bodyweight"
        | "smith_machine"
        | "other"
      set_type: "normal" | "warmup" | "drop" | "failure" | "cluster"
      weight_unit: "kg" | "lb"
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
    Enums: {
      equipment_type: [
        "barbell",
        "dumbbell",
        "cable",
        "machine",
        "kettlebell",
        "band",
        "bodyweight",
        "smith_machine",
        "other",
      ],
      set_type: ["normal", "warmup", "drop", "failure", "cluster"],
      weight_unit: ["kg", "lb"],
    },
  },
} as const

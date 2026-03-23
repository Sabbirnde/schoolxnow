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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          is_present: boolean
          remarks: string | null
          school_id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          is_present?: boolean
          remarks?: string | null
          school_id: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          is_present?: boolean
          remarks?: string | null
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          error_message: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          success: boolean
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          success?: boolean
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          success?: boolean
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          academic_year_end: string
          academic_year_start: string
          allow_registrations: boolean
          config_key: string
          created_at: string
          default_school_type: string
          id: string
          maintenance_mode: boolean
          max_students_per_class: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year_end?: string
          academic_year_start?: string
          allow_registrations?: boolean
          config_key?: string
          created_at?: string
          default_school_type?: string
          id?: string
          maintenance_mode?: boolean
          max_students_per_class?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year_end?: string
          academic_year_start?: string
          allow_registrations?: boolean
          config_key?: string
          created_at?: string
          default_school_type?: string
          id?: string
          maintenance_mode?: boolean
          max_students_per_class?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          capacity: number | null
          class_level: Database["public"]["Enums"]["class_level"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          name_bangla: string | null
          school_id: string
          section: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          class_level: Database["public"]["Enums"]["class_level"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          name_bangla?: string | null
          school_id: string
          section?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          class_level?: Database["public"]["Enums"]["class_level"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          name_bangla?: string | null
          school_id?: string
          section?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results: {
        Row: {
          created_at: string
          exam_id: string
          grade: string | null
          id: string
          obtained_marks: number
          school_id: string
          student_id: string
          subject_id: string
          total_marks: number
        }
        Insert: {
          created_at?: string
          exam_id: string
          grade?: string | null
          id?: string
          obtained_marks: number
          school_id: string
          student_id: string
          subject_id: string
          total_marks: number
        }
        Update: {
          created_at?: string
          exam_id?: string
          grade?: string | null
          id?: string
          obtained_marks?: number
          school_id?: string
          student_id?: string
          subject_id?: string
          total_marks?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at: string
          exam_date: string
          id: string
          is_active: boolean
          name: string
          name_bangla: string | null
          pass_marks: number
          school_id: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          class_level: Database["public"]["Enums"]["class_level"]
          created_at?: string
          exam_date: string
          id?: string
          is_active?: boolean
          name: string
          name_bangla?: string | null
          pass_marks?: number
          school_id: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"]
          created_at?: string
          exam_date?: string
          id?: string
          is_active?: boolean
          name?: string
          name_bangla?: string | null
          pass_marks?: number
          school_id?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string
          address_bangla: string | null
          created_at: string
          eiin_number: string | null
          email: string | null
          established_year: number | null
          id: string
          is_active: boolean
          name: string
          name_bangla: string | null
          phone: string | null
          school_type: Database["public"]["Enums"]["school_type"]
          updated_at: string
        }
        Insert: {
          address: string
          address_bangla?: string | null
          created_at?: string
          eiin_number?: string | null
          email?: string | null
          established_year?: number | null
          id?: string
          is_active?: boolean
          name: string
          name_bangla?: string | null
          phone?: string | null
          school_type: Database["public"]["Enums"]["school_type"]
          updated_at?: string
        }
        Update: {
          address?: string
          address_bangla?: string | null
          created_at?: string
          eiin_number?: string | null
          email?: string | null
          established_year?: number | null
          id?: string
          is_active?: boolean
          name?: string
          name_bangla?: string | null
          phone?: string | null
          school_type?: Database["public"]["Enums"]["school_type"]
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          address: string
          address_bangla: string | null
          admission_date: string
          blood_group: string | null
          class_id: string | null
          created_at: string
          date_of_birth: string
          father_name: string
          father_name_bangla: string | null
          full_name: string
          full_name_bangla: string | null
          gender: string
          guardian_email: string | null
          guardian_phone: string
          id: string
          mother_name: string
          mother_name_bangla: string | null
          photo_url: string | null
          school_id: string
          status: Database["public"]["Enums"]["student_status"]
          student_id: string
          updated_at: string
        }
        Insert: {
          address: string
          address_bangla?: string | null
          admission_date?: string
          blood_group?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth: string
          father_name: string
          father_name_bangla?: string | null
          full_name: string
          full_name_bangla?: string | null
          gender: string
          guardian_email?: string | null
          guardian_phone: string
          id?: string
          mother_name: string
          mother_name_bangla?: string | null
          photo_url?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["student_status"]
          student_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          address_bangla?: string | null
          admission_date?: string
          blood_group?: string | null
          class_id?: string | null
          created_at?: string
          date_of_birth?: string
          father_name?: string
          father_name_bangla?: string | null
          full_name?: string
          full_name_bangla?: string | null
          gender?: string
          guardian_email?: string | null
          guardian_phone?: string
          id?: string
          mother_name?: string
          mother_name_bangla?: string | null
          photo_url?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["student_status"]
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_level: Database["public"]["Enums"]["class_level"]
          code: string
          created_at: string
          id: string
          is_active: boolean
          is_optional: boolean
          name: string
          name_bangla: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          class_level: Database["public"]["Enums"]["class_level"]
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name: string
          name_bangla?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          class_level?: Database["public"]["Enums"]["class_level"]
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name?: string
          name_bangla?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_applications: {
        Row: {
          address: string | null
          address_bangla: string | null
          application_date: string
          created_at: string
          experience_years: number | null
          full_name: string
          full_name_bangla: string | null
          id: string
          phone: string
          qualification: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          subject_specialization: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          address_bangla?: string | null
          application_date?: string
          created_at?: string
          experience_years?: number | null
          full_name: string
          full_name_bangla?: string | null
          id?: string
          phone: string
          qualification?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          subject_specialization?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          address_bangla?: string | null
          application_date?: string
          created_at?: string
          experience_years?: number | null
          full_name?: string
          full_name_bangla?: string | null
          id?: string
          phone?: string
          qualification?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          subject_specialization?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          address: string | null
          address_bangla: string | null
          created_at: string
          designation: string | null
          email: string | null
          full_name: string
          full_name_bangla: string | null
          id: string
          is_active: boolean
          joining_date: string
          phone: string
          qualification: string | null
          school_id: string
          subject_specialization: string | null
          teacher_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          address_bangla?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name: string
          full_name_bangla?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string
          phone: string
          qualification?: string | null
          school_id: string
          subject_specialization?: string | null
          teacher_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          address_bangla?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          full_name?: string
          full_name_bangla?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string
          phone?: string
          qualification?: string | null
          school_id?: string
          subject_specialization?: string | null
          teacher_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: string
          id: string
          room_number: string | null
          school_id: string
          subject_id: string
          teacher_id: string
          time_slot: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: string
          id?: string
          room_number?: string | null
          school_id: string
          subject_id: string
          teacher_id: string
          time_slot: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: string
          id?: string
          room_number?: string | null
          school_id?: string
          subject_id?: string
          teacher_id?: string
          time_slot?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address: string | null
          address_bangla: string | null
          approval_status: string | null
          created_at: string
          full_name: string
          full_name_bangla: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          address_bangla?: string | null
          approval_status?: string | null
          created_at?: string
          full_name: string
          full_name_bangla?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          address_bangla?: string | null
          approval_status?: string | null
          created_at?: string
          full_name?: string
          full_name_bangla?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          school_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      schools_public_view: {
        Row: {
          id: string | null
          is_active: boolean | null
          name: string | null
          name_bangla: string | null
          school_type: Database["public"]["Enums"]["school_type"] | null
        }
        Insert: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          name_bangla?: string | null
          school_type?: Database["public"]["Enums"]["school_type"] | null
        }
        Update: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          name_bangla?: string | null
          school_type?: Database["public"]["Enums"]["school_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: {
        Args: { user_uuid: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_school: {
        Args: { user_uuid: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type: string
          p_error_message?: string
          p_metadata?: Json
          p_new_values?: Json
          p_old_values?: Json
          p_success?: boolean
          p_user_id: string
        }
        Returns: string
      }
      super_admin_exists: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      class_level:
        | "nursery"
        | "kg"
        | "class_1"
        | "class_2"
        | "class_3"
        | "class_4"
        | "class_5"
        | "class_6"
        | "class_7"
        | "class_8"
        | "class_9"
        | "class_10"
        | "class_11"
        | "class_12"
        | "alim"
        | "fazil"
        | "kamil"
      school_type: "bangla_medium" | "english_medium" | "madrasha"
      student_status: "active" | "inactive" | "graduated" | "transferred"
      user_role: "super_admin" | "school_admin" | "teacher"
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
      class_level: [
        "nursery",
        "kg",
        "class_1",
        "class_2",
        "class_3",
        "class_4",
        "class_5",
        "class_6",
        "class_7",
        "class_8",
        "class_9",
        "class_10",
        "class_11",
        "class_12",
        "alim",
        "fazil",
        "kamil",
      ],
      school_type: ["bangla_medium", "english_medium", "madrasha"],
      student_status: ["active", "inactive", "graduated", "transferred"],
      user_role: ["super_admin", "school_admin", "teacher"],
    },
  },
} as const

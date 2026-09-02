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
      consultation_requests: {
        Row: {
          anatomo_patologico: string | null
          created_at: string
          cti: number | null
          data_desejada: string | null
          diaria: number | null
          doctor_id: string | null
          equipe_multidisciplinar: string | null
          especialidade: string | null
          fisioterapia: number | null
          honorarios_medicos: number | null
          id: string
          numero: string
          obs_comercial: string | null
          obs_medico: string | null
          observacoes: string | null
          opme: string | null
          patient_id: string
          preenchido_comercial_em: string | null
          preenchido_medico_em: string | null
          reserva_sangue: string | null
          status: Database["public"]["Enums"]["request_status"]
          tempo_bloco: string | null
          tipo_consulta: string | null
          updated_at: string
          valor_hospitalar: number | null
        }
        Insert: {
          anatomo_patologico?: string | null
          created_at?: string
          cti?: number | null
          data_desejada?: string | null
          diaria?: number | null
          doctor_id?: string | null
          equipe_multidisciplinar?: string | null
          especialidade?: string | null
          fisioterapia?: number | null
          honorarios_medicos?: number | null
          id?: string
          numero: string
          obs_comercial?: string | null
          obs_medico?: string | null
          observacoes?: string | null
          opme?: string | null
          patient_id: string
          preenchido_comercial_em?: string | null
          preenchido_medico_em?: string | null
          reserva_sangue?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tempo_bloco?: string | null
          tipo_consulta?: string | null
          updated_at?: string
          valor_hospitalar?: number | null
        }
        Update: {
          anatomo_patologico?: string | null
          created_at?: string
          cti?: number | null
          data_desejada?: string | null
          diaria?: number | null
          doctor_id?: string | null
          equipe_multidisciplinar?: string | null
          especialidade?: string | null
          fisioterapia?: number | null
          honorarios_medicos?: number | null
          id?: string
          numero?: string
          obs_comercial?: string | null
          obs_medico?: string | null
          observacoes?: string | null
          opme?: string | null
          patient_id?: string
          preenchido_comercial_em?: string | null
          preenchido_medico_em?: string | null
          reserva_sangue?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          tempo_bloco?: string | null
          tipo_consulta?: string | null
          updated_at?: string
          valor_hospitalar?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_requests_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          ativo: boolean
          created_at: string
          crm: string
          especialidade: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          crm: string
          especialidade: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          crm?: string
          especialidade?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      institution_settings: {
        Row: {
          cnpj: string | null
          email_notificacoes: string | null
          endereco: string | null
          id: number
          nome: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          email_notificacoes?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          email_notificacoes?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          cpf: string
          created_at: string
          email: string | null
          id: string
          nascimento: string | null
          nome: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cpf: string
          created_at?: string
          email?: string | null
          id?: string
          nascimento?: string | null
          nome: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string
          created_at?: string
          email?: string | null
          id?: string
          nascimento?: string | null
          nome?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      portal_users: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["user_profile"]
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email: string
          id?: string
          nome: string
          perfil: Database["public"]["Enums"]["user_profile"]
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["user_profile"]
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      request_events: {
        Row: {
          concluido: boolean
          criado_em: string
          descricao: string | null
          id: string
          ordem: number
          request_id: string
          titulo: string
        }
        Insert: {
          concluido?: boolean
          criado_em?: string
          descricao?: string | null
          id?: string
          ordem?: number
          request_id: string
          titulo: string
        }
        Update: {
          concluido?: boolean
          criado_em?: string
          descricao?: string | null
          id?: string
          ordem?: number
          request_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "consultation_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      request_status:
        | "pendente"
        | "em_analise"
        | "aguardando_medico"
        | "aguardando_comercial"
        | "concluido"
      user_profile: "administrador" | "comercial" | "medico"
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
      request_status: [
        "pendente",
        "em_analise",
        "aguardando_medico",
        "aguardando_comercial",
        "concluido",
      ],
      user_profile: ["administrador", "comercial", "medico"],
    },
  },
} as const

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      anamneses: {
        Row: {
          alergias: string | null
          anexos: Json | null
          assinatura_doutor: Json | null
          assinatura_paciente: Json | null
          atualizado_em: string
          criado_em: string
          data: string
          data_expiracao_link: string | null
          exame_extra_bucal: string | null
          exame_intra_bucal: string | null
          habitos_vicios_negativos: string | null
          habitos_vicios_positivos: string | null
          historia_atual: string
          historia_familiar: string | null
          historia_medica: string | null
          id: string
          link_assinatura: string | null
          medicamentos: string | null
          observacoes: string | null
          paciente_id: string
          queixa_principal: string
          status_assinatura: string
          token_assinatura: string | null
          user_id: string
        }
        Insert: {
          alergias?: string | null
          anexos?: Json | null
          assinatura_doutor?: Json | null
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          data: string
          data_expiracao_link?: string | null
          exame_extra_bucal?: string | null
          exame_intra_bucal?: string | null
          habitos_vicios_negativos?: string | null
          habitos_vicios_positivos?: string | null
          historia_atual: string
          historia_familiar?: string | null
          historia_medica?: string | null
          id?: string
          link_assinatura?: string | null
          medicamentos?: string | null
          observacoes?: string | null
          paciente_id: string
          queixa_principal: string
          status_assinatura?: string
          token_assinatura?: string | null
          user_id: string
        }
        Update: {
          alergias?: string | null
          anexos?: Json | null
          assinatura_doutor?: Json | null
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          data?: string
          data_expiracao_link?: string | null
          exame_extra_bucal?: string | null
          exame_intra_bucal?: string | null
          habitos_vicios_negativos?: string | null
          habitos_vicios_positivos?: string | null
          historia_atual?: string
          historia_familiar?: string | null
          historia_medica?: string | null
          id?: string
          link_assinatura?: string | null
          medicamentos?: string | null
          observacoes?: string | null
          paciente_id?: string
          queixa_principal?: string
          status_assinatura?: string
          token_assinatura?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamneses_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      consultas: {
        Row: {
          atualizado_em: string
          criado_em: string
          data: string
          dentista: string
          duracao: number
          hora: string
          id: string
          observacoes: string | null
          paciente_id: string
          procedimento: string
          status: string
          user_id: string
          valor: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data: string
          dentista: string
          duracao: number
          hora: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          procedimento: string
          status?: string
          user_id: string
          valor?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          dentista?: string
          duracao?: number
          hora?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          procedimento?: string
          status?: string
          user_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_paciente: {
        Row: {
          arquivo: string
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
          paciente_id: string
          tamanho: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          arquivo: string
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
          paciente_id: string
          tamanho?: number | null
          tipo: string
          user_id: string
        }
        Update: {
          arquivo?: string
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
          paciente_id?: string
          tamanho?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          conteudo: string | null
          created_at: string
          id: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conteudo?: string | null
          created_at?: string
          id?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conteudo?: string | null
          created_at?: string
          id?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          alergias: string | null
          atualizado_em: string
          convenio: string
          cpf: string | null
          criado_em: string
          data_arquivamento: string | null
          email: string
          endereco: string | null
          estado_civil: string | null
          foto: string | null
          historico_medico: string | null
          id: string
          idade: number
          medicamentos: string | null
          motivo_arquivamento: string | null
          nome: string
          observacoes: string | null
          origem_lead: string
          profissao: string | null
          proxima_consulta: string | null
          rg: string | null
          status: string
          telefone: string
          ultima_consulta: string | null
          user_id: string
        }
        Insert: {
          alergias?: string | null
          atualizado_em?: string
          convenio: string
          cpf?: string | null
          criado_em?: string
          data_arquivamento?: string | null
          email: string
          endereco?: string | null
          estado_civil?: string | null
          foto?: string | null
          historico_medico?: string | null
          id?: string
          idade?: number
          medicamentos?: string | null
          motivo_arquivamento?: string | null
          nome: string
          observacoes?: string | null
          origem_lead: string
          profissao?: string | null
          proxima_consulta?: string | null
          rg?: string | null
          status?: string
          telefone: string
          ultima_consulta?: string | null
          user_id: string
        }
        Update: {
          alergias?: string | null
          atualizado_em?: string
          convenio?: string
          cpf?: string | null
          criado_em?: string
          data_arquivamento?: string | null
          email?: string
          endereco?: string | null
          estado_civil?: string | null
          foto?: string | null
          historico_medico?: string | null
          id?: string
          idade?: number
          medicamentos?: string | null
          motivo_arquivamento?: string | null
          nome?: string
          observacoes?: string | null
          origem_lead?: string
          profissao?: string | null
          proxima_consulta?: string | null
          rg?: string | null
          status?: string
          telefone?: string
          ultima_consulta?: string | null
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          atualizado_em: string
          categoria: string
          criado_em: string
          id: string
          minimo: number
          nome: string
          preco: number
          quantidade: number
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          categoria: string
          criado_em?: string
          id?: string
          minimo?: number
          nome: string
          preco?: number
          quantidade?: number
          user_id: string
        }
        Update: {
          atualizado_em?: string
          categoria?: string
          criado_em?: string
          id?: string
          minimo?: number
          nome?: string
          preco?: number
          quantidade?: number
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prontuarios: {
        Row: {
          anexos: Json | null
          atualizado_em: string
          consulta_id: string | null
          criado_em: string
          data: string
          diagnostico: string | null
          exame_clinico: string
          historia_doenca: string
          id: string
          observacoes: string | null
          paciente_id: string
          plano_tratamento: string | null
          procedimentos_realizados: Json | null
          queixa_principal: string
          user_id: string
        }
        Insert: {
          anexos?: Json | null
          atualizado_em?: string
          consulta_id?: string | null
          criado_em?: string
          data: string
          diagnostico?: string | null
          exame_clinico: string
          historia_doenca: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          plano_tratamento?: string | null
          procedimentos_realizados?: Json | null
          queixa_principal: string
          user_id: string
        }
        Update: {
          anexos?: Json | null
          atualizado_em?: string
          consulta_id?: string | null
          criado_em?: string
          data?: string
          diagnostico?: string | null
          exame_clinico?: string
          historia_doenca?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          plano_tratamento?: string | null
          procedimentos_realizados?: Json | null
          queixa_principal?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prontuarios_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prontuarios_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes: {
        Row: {
          atualizado_em: string
          consulta_id: string | null
          criado_em: string
          data: string
          descricao: string
          id: string
          metodo_pagamento: string
          observacoes: string | null
          paciente_id: string
          status: string
          tipo: string
          user_id: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          consulta_id?: string | null
          criado_em?: string
          data: string
          descricao: string
          id?: string
          metodo_pagamento: string
          observacoes?: string | null
          paciente_id: string
          status?: string
          tipo: string
          user_id: string
          valor: number
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          consulta_id?: string | null
          criado_em?: string
          data?: string
          descricao?: string
          id?: string
          metodo_pagamento?: string
          observacoes?: string | null
          paciente_id?: string
          status?: string
          tipo?: string
          user_id?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_consulta_id_fkey"
            columns: ["consulta_id"]
            isOneToOne: false
            referencedRelation: "consultas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

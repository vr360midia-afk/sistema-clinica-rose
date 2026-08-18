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
      anamneses: {
        Row: {
          alergias: string | null
          anexos: Json | null
          assinatura: string | null
          assinatura_doutor: Json | null
          assinatura_paciente: Json | null
          atualizado_em: string
          criado_em: string
          data: string | null
          data_assinatura: string | null
          data_expiracao_link: string | null
          exame_extra_bucal: string | null
          exame_intra_bucal: string | null
          habitos_vicios_negativos: string | null
          habitos_vicios_positivos: string | null
          historia_atual: string | null
          historia_familiar: string | null
          historia_medica: string | null
          id: string
          link_assinatura: string | null
          medicamentos: string | null
          observacoes: string | null
          paciente_id: string | null
          paciente_nome: string | null
          queixa_principal: string | null
          respostas: Json | null
          status: string | null
          status_assinatura: string | null
          token_assinatura: string | null
          user_id: string
        }
        Insert: {
          alergias?: string | null
          anexos?: Json | null
          assinatura?: string | null
          assinatura_doutor?: Json | null
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          data?: string | null
          data_assinatura?: string | null
          data_expiracao_link?: string | null
          exame_extra_bucal?: string | null
          exame_intra_bucal?: string | null
          habitos_vicios_negativos?: string | null
          habitos_vicios_positivos?: string | null
          historia_atual?: string | null
          historia_familiar?: string | null
          historia_medica?: string | null
          id?: string
          link_assinatura?: string | null
          medicamentos?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          queixa_principal?: string | null
          respostas?: Json | null
          status?: string | null
          status_assinatura?: string | null
          token_assinatura?: string | null
          user_id: string
        }
        Update: {
          alergias?: string | null
          anexos?: Json | null
          assinatura?: string | null
          assinatura_doutor?: Json | null
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          data?: string | null
          data_assinatura?: string | null
          data_expiracao_link?: string | null
          exame_extra_bucal?: string | null
          exame_intra_bucal?: string | null
          habitos_vicios_negativos?: string | null
          habitos_vicios_positivos?: string | null
          historia_atual?: string | null
          historia_familiar?: string | null
          historia_medica?: string | null
          id?: string
          link_assinatura?: string | null
          medicamentos?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          queixa_principal?: string | null
          respostas?: Json | null
          status?: string | null
          status_assinatura?: string | null
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
      assinaturas: {
        Row: {
          assinatura_data: string
          atualizado_em: string
          criado_em: string
          documento_id: string | null
          documento_tipo: string | null
          id: string
          nome: string
          paciente_id: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          assinatura_data: string
          atualizado_em?: string
          criado_em?: string
          documento_id?: string | null
          documento_tipo?: string | null
          id?: string
          nome: string
          paciente_id?: string | null
          tipo?: string
          user_id: string
        }
        Update: {
          assinatura_data?: string
          atualizado_em?: string
          criado_em?: string
          documento_id?: string | null
          documento_tipo?: string | null
          id?: string
          nome?: string
          paciente_id?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      consultas: {
        Row: {
          atualizado_em: string
          criado_em: string
          data: string
          dentista: string | null
          duracao: number | null
          hora: string | null
          id: string
          observacoes: string | null
          paciente_id: string | null
          paciente_nome: string | null
          procedimento: string | null
          status: string | null
          tipo: string | null
          user_id: string
          valor: number | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data: string
          dentista?: string | null
          duracao?: number | null
          hora?: string | null
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          procedimento?: string | null
          status?: string | null
          tipo?: string | null
          user_id: string
          valor?: number | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data?: string
          dentista?: string | null
          duracao?: number | null
          hora?: string | null
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          procedimento?: string | null
          status?: string | null
          tipo?: string | null
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
      dentistas: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          cro: string | null
          email: string | null
          especialidade: string | null
          id: string
          nome: string
          telefone: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          cro?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          telefone?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          cro?: string | null
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documentos_paciente: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          paciente_id: string | null
          tamanho: number | null
          tipo: string | null
          url: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          paciente_id?: string | null
          tamanho?: number | null
          tipo?: string | null
          url?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          paciente_id?: string | null
          tamanho?: number | null
          tipo?: string | null
          url?: string | null
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
          categoria: string
          concluida: boolean
          conteudo: string | null
          created_at: string
          id: string
          lembrete_ativo: boolean
          lembrete_data: string | null
          prazo: string | null
          prioridade: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria?: string
          concluida?: boolean
          conteudo?: string | null
          created_at?: string
          id?: string
          lembrete_ativo?: boolean
          lembrete_data?: string | null
          prazo?: string | null
          prioridade?: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          concluida?: boolean
          conteudo?: string | null
          created_at?: string
          id?: string
          lembrete_ativo?: boolean
          lembrete_data?: string | null
          prazo?: string | null
          prioridade?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pacientes: {
        Row: {
          alergias: string | null
          atualizado_em: string
          convenio: string | null
          cpf: string | null
          criado_em: string
          data_arquivamento: string | null
          email: string | null
          endereco: string | null
          estado_civil: string | null
          foto: string | null
          historico_medico: string | null
          id: string
          idade: number | null
          medicamentos: string | null
          motivo_arquivamento: string | null
          nome: string
          observacoes: string | null
          origem_lead: string | null
          profissao: string | null
          proxima_consulta: string | null
          rg: string | null
          status: string | null
          telefone: string | null
          ultima_consulta: string | null
          user_id: string
        }
        Insert: {
          alergias?: string | null
          atualizado_em?: string
          convenio?: string | null
          cpf?: string | null
          criado_em?: string
          data_arquivamento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          foto?: string | null
          historico_medico?: string | null
          id?: string
          idade?: number | null
          medicamentos?: string | null
          motivo_arquivamento?: string | null
          nome: string
          observacoes?: string | null
          origem_lead?: string | null
          profissao?: string | null
          proxima_consulta?: string | null
          rg?: string | null
          status?: string | null
          telefone?: string | null
          ultima_consulta?: string | null
          user_id: string
        }
        Update: {
          alergias?: string | null
          atualizado_em?: string
          convenio?: string | null
          cpf?: string | null
          criado_em?: string
          data_arquivamento?: string | null
          email?: string | null
          endereco?: string | null
          estado_civil?: string | null
          foto?: string | null
          historico_medico?: string | null
          id?: string
          idade?: number | null
          medicamentos?: string | null
          motivo_arquivamento?: string | null
          nome?: string
          observacoes?: string | null
          origem_lead?: string | null
          profissao?: string | null
          proxima_consulta?: string | null
          rg?: string | null
          status?: string | null
          telefone?: string | null
          ultima_consulta?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pacotes_procedimentos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          desconto_percentual: number
          descricao: string | null
          id: string
          nome: string
          preco: number
          procedimento_ids: Json
          user_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          desconto_percentual?: number
          descricao?: string | null
          id?: string
          nome: string
          preco?: number
          procedimento_ids?: Json
          user_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          desconto_percentual?: number
          descricao?: string | null
          id?: string
          nome?: string
          preco?: number
          procedimento_ids?: Json
          user_id?: string
        }
        Relationships: []
      }
      procedimentos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string
          complexidade: string
          criado_em: string
          criado_por: string | null
          descricao: string | null
          duracao_minutos: number
          equipamentos_necessarios: Json
          id: string
          materiais_necessarios: Json
          nome: string
          observacoes: string | null
          preco: number
          preco_convenio: number | null
          requerer_anestesia: boolean
          requerer_raio_x: boolean
          user_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          complexidade?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          duracao_minutos?: number
          equipamentos_necessarios?: Json
          id?: string
          materiais_necessarios?: Json
          nome: string
          observacoes?: string | null
          preco?: number
          preco_convenio?: number | null
          requerer_anestesia?: boolean
          requerer_raio_x?: boolean
          user_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string
          complexidade?: string
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          duracao_minutos?: number
          equipamentos_necessarios?: Json
          id?: string
          materiais_necessarios?: Json
          nome?: string
          observacoes?: string | null
          preco?: number
          preco_convenio?: number | null
          requerer_anestesia?: boolean
          requerer_raio_x?: boolean
          user_id?: string
        }
        Relationships: []
      }
      produtos: {
        Row: {
          atualizado_em: string
          categoria: string | null
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
          categoria?: string | null
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
          categoria?: string | null
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
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prontuarios: {
        Row: {
          anexos: Json | null
          assinatura: string | null
          atualizado_em: string
          consulta_id: string | null
          criado_em: string
          data: string
          diagnostico: string | null
          exame_clinico: string | null
          historia_doenca: string | null
          id: string
          imagens: Json | null
          observacoes: string | null
          odontograma: Json | null
          paciente_id: string | null
          paciente_nome: string | null
          plano_tratamento: string | null
          procedimentos: Json | null
          procedimentos_realizados: Json | null
          queixa_principal: string | null
          tratamento: string | null
          user_id: string
        }
        Insert: {
          anexos?: Json | null
          assinatura?: string | null
          atualizado_em?: string
          consulta_id?: string | null
          criado_em?: string
          data?: string
          diagnostico?: string | null
          exame_clinico?: string | null
          historia_doenca?: string | null
          id?: string
          imagens?: Json | null
          observacoes?: string | null
          odontograma?: Json | null
          paciente_id?: string | null
          paciente_nome?: string | null
          plano_tratamento?: string | null
          procedimentos?: Json | null
          procedimentos_realizados?: Json | null
          queixa_principal?: string | null
          tratamento?: string | null
          user_id: string
        }
        Update: {
          anexos?: Json | null
          assinatura?: string | null
          atualizado_em?: string
          consulta_id?: string | null
          criado_em?: string
          data?: string
          diagnostico?: string | null
          exame_clinico?: string | null
          historia_doenca?: string | null
          id?: string
          imagens?: Json | null
          observacoes?: string | null
          odontograma?: Json | null
          paciente_id?: string | null
          paciente_nome?: string | null
          plano_tratamento?: string | null
          procedimentos?: Json | null
          procedimentos_realizados?: Json | null
          queixa_principal?: string | null
          tratamento?: string | null
          user_id?: string
        }
        Relationships: [
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
          categoria: string | null
          consulta_id: string | null
          criado_em: string
          data: string
          descricao: string | null
          id: string
          metodo_pagamento: string | null
          observacoes: string | null
          paciente_id: string | null
          paciente_nome: string | null
          status: string | null
          tipo: string
          user_id: string
          valor: number
          vencimento: string | null
        }
        Insert: {
          atualizado_em?: string
          categoria?: string | null
          consulta_id?: string | null
          criado_em?: string
          data?: string
          descricao?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          status?: string | null
          tipo: string
          user_id: string
          valor?: number
          vencimento?: string | null
        }
        Update: {
          atualizado_em?: string
          categoria?: string | null
          consulta_id?: string | null
          criado_em?: string
          data?: string
          descricao?: string | null
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          status?: string | null
          tipo?: string
          user_id?: string
          valor?: number
          vencimento?: string | null
        }
        Relationships: [
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

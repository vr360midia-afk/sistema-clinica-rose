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
      audit_logs: {
        Row: {
          acao: string
          ator_email: string | null
          criado_em: string
          dados: Json | null
          descricao: string | null
          entidade: string
          entidade_id: string | null
          id: string
          user_id: string
        }
        Insert: {
          acao: string
          ator_email?: string | null
          criado_em?: string
          dados?: Json | null
          descricao?: string | null
          entidade: string
          entidade_id?: string | null
          id?: string
          user_id: string
        }
        Update: {
          acao?: string
          ator_email?: string | null
          criado_em?: string
          dados?: Json | null
          descricao?: string | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      bloqueios_agenda: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_fim: string
          data_inicio: string
          dentista: string | null
          dia_inteiro: boolean
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          observacoes: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_fim: string
          data_inicio: string
          dentista?: string | null
          dia_inteiro?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacoes?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_fim?: string
          data_inicio?: string
          dentista?: string | null
          dia_inteiro?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          observacoes?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      certificados_digitais: {
        Row: {
          ambiente: string
          ativo: boolean
          atualizado_em: string
          client_id: string | null
          client_secret: string | null
          criado_em: string
          id: string
          provedor: string
          titular_cpf: string | null
          titular_nome: string | null
          user_id: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          client_id?: string | null
          client_secret?: string | null
          criado_em?: string
          id?: string
          provedor?: string
          titular_cpf?: string | null
          titular_nome?: string | null
          user_id: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          client_id?: string | null
          client_secret?: string | null
          criado_em?: string
          id?: string
          provedor?: string
          titular_cpf?: string | null
          titular_nome?: string | null
          user_id?: string
        }
        Relationships: []
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          backup_automatico: boolean
          cnpj: string | null
          criado_em: string
          email: string | null
          email_notificacoes: boolean
          endereco: string | null
          frequencia_backup: string
          id: string
          lembrete_24h: boolean
          lembrete_2h: boolean
          logo_url: string | null
          nome_clinica: string | null
          telefone: string | null
          user_id: string
          whatsapp_lembretes: boolean
          whatsapp_numero: string | null
        }
        Insert: {
          atualizado_em?: string
          backup_automatico?: boolean
          cnpj?: string | null
          criado_em?: string
          email?: string | null
          email_notificacoes?: boolean
          endereco?: string | null
          frequencia_backup?: string
          id?: string
          lembrete_24h?: boolean
          lembrete_2h?: boolean
          logo_url?: string | null
          nome_clinica?: string | null
          telefone?: string | null
          user_id: string
          whatsapp_lembretes?: boolean
          whatsapp_numero?: string | null
        }
        Update: {
          atualizado_em?: string
          backup_automatico?: boolean
          cnpj?: string | null
          criado_em?: string
          email?: string | null
          email_notificacoes?: boolean
          endereco?: string | null
          frequencia_backup?: string
          id?: string
          lembrete_24h?: boolean
          lembrete_2h?: boolean
          logo_url?: string | null
          nome_clinica?: string | null
          telefone?: string | null
          user_id?: string
          whatsapp_lembretes?: boolean
          whatsapp_numero?: string | null
        }
        Relationships: []
      }
      consultas: {
        Row: {
          atualizado_em: string
          confirmacao_status: string
          confirmado_em: string | null
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
          confirmacao_status?: string
          confirmado_em?: string | null
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
          confirmacao_status?: string
          confirmado_em?: string | null
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
      documentos_clinicos: {
        Row: {
          assinado_em: string | null
          assinante_nome: string | null
          assinatura_data: string | null
          assinatura_id: string | null
          atualizado_em: string
          cfo_codigo_validacao: string | null
          cfo_emitido_em: string | null
          cfo_link_validacao: string | null
          cid: string | null
          conteudo: string | null
          criado_em: string
          dentista: string | null
          dias_afastamento: number | null
          id: string
          itens: Json
          paciente_id: string | null
          paciente_nome: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          assinado_em?: string | null
          assinante_nome?: string | null
          assinatura_data?: string | null
          assinatura_id?: string | null
          atualizado_em?: string
          cfo_codigo_validacao?: string | null
          cfo_emitido_em?: string | null
          cfo_link_validacao?: string | null
          cid?: string | null
          conteudo?: string | null
          criado_em?: string
          dentista?: string | null
          dias_afastamento?: number | null
          id?: string
          itens?: Json
          paciente_id?: string | null
          paciente_nome?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          assinado_em?: string | null
          assinante_nome?: string | null
          assinatura_data?: string | null
          assinatura_id?: string | null
          atualizado_em?: string
          cfo_codigo_validacao?: string | null
          cfo_emitido_em?: string | null
          cfo_link_validacao?: string | null
          cid?: string | null
          conteudo?: string | null
          criado_em?: string
          dentista?: string | null
          dias_afastamento?: number | null
          id?: string
          itens?: Json
          paciente_id?: string | null
          paciente_nome?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_clinicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_paciente: {
        Row: {
          analise_dados: Json | null
          analise_ia: string | null
          analise_status: string | null
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
          analise_dados?: Json | null
          analise_ia?: string | null
          analise_status?: string | null
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
          analise_dados?: Json | null
          analise_ia?: string | null
          analise_status?: string | null
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
      extratos_financeiros: {
        Row: {
          assinatura_paciente: Json | null
          atualizado_em: string
          criado_em: string
          dados: Json
          data_assinatura: string | null
          data_expiracao_link: string | null
          id: string
          paciente_id: string | null
          paciente_nome: string | null
          status_assinatura: string
          token_assinatura: string | null
          total: number
          total_pago: number
          total_pendente: number
          total_previsto: number
          user_id: string
        }
        Insert: {
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          dados?: Json
          data_assinatura?: string | null
          data_expiracao_link?: string | null
          id?: string
          paciente_id?: string | null
          paciente_nome?: string | null
          status_assinatura?: string
          token_assinatura?: string | null
          total?: number
          total_pago?: number
          total_pendente?: number
          total_previsto?: number
          user_id: string
        }
        Update: {
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          dados?: Json
          data_assinatura?: string | null
          data_expiracao_link?: string | null
          id?: string
          paciente_id?: string | null
          paciente_nome?: string | null
          status_assinatura?: string
          token_assinatura?: string | null
          total?: number
          total_pago?: number
          total_pendente?: number
          total_previsto?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extratos_financeiros_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      lixeira: {
        Row: {
          dados: Json
          entidade: string
          entidade_id: string | null
          excluido_em: string
          excluido_por: string | null
          expira_em: string
          id: string
          titulo: string | null
          user_id: string
        }
        Insert: {
          dados?: Json
          entidade: string
          entidade_id?: string | null
          excluido_em?: string
          excluido_por?: string | null
          expira_em?: string
          id?: string
          titulo?: string | null
          user_id: string
        }
        Update: {
          dados?: Json
          entidade?: string
          entidade_id?: string | null
          excluido_em?: string
          excluido_por?: string | null
          expira_em?: string
          id?: string
          titulo?: string | null
          user_id?: string
        }
        Relationships: []
      }
      medicamentos: {
        Row: {
          apresentacao: string | null
          ativo: boolean
          atualizado_em: string
          criado_em: string
          dosagem: string | null
          id: string
          nome: string
          observacoes: string | null
          periodo: string | null
          posologia: string | null
          principio_ativo: string | null
          quantidade: string | null
          user_id: string
        }
        Insert: {
          apresentacao?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dosagem?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          periodo?: string | null
          posologia?: string | null
          principio_ativo?: string | null
          quantidade?: string | null
          user_id: string
        }
        Update: {
          apresentacao?: string | null
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dosagem?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          periodo?: string | null
          posologia?: string | null
          principio_ativo?: string | null
          quantidade?: string | null
          user_id?: string
        }
        Relationships: []
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
      odontograma_versoes: {
        Row: {
          criado_em: string
          dados: Json
          id: string
          observacoes: string | null
          paciente_id: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          dados?: Json
          id?: string
          observacoes?: string | null
          paciente_id: string
          user_id: string
        }
        Update: {
          criado_em?: string
          dados?: Json
          id?: string
          observacoes?: string | null
          paciente_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odontograma_versoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      odontogramas: {
        Row: {
          atualizado_em: string
          criado_em: string
          dados: Json
          id: string
          paciente_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dados?: Json
          id?: string
          paciente_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dados?: Json
          id?: string
          paciente_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "odontogramas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          assinatura_paciente: Json | null
          atualizado_em: string
          criado_em: string
          data_assinatura: string | null
          data_expiracao_link: string | null
          desconto: number
          formas_pagamento: string | null
          id: string
          itens: Json
          observacoes: string | null
          paciente_id: string | null
          paciente_nome: string | null
          parceiro_id: string | null
          parceiro_nome: string | null
          parceiro_tipo_repasse: string | null
          parceiro_valor_repasse: number
          status: string
          titulo: string
          token_assinatura: string | null
          total: number
          user_id: string
          validade: string | null
        }
        Insert: {
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          data_assinatura?: string | null
          data_expiracao_link?: string | null
          desconto?: number
          formas_pagamento?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          parceiro_tipo_repasse?: string | null
          parceiro_valor_repasse?: number
          status?: string
          titulo?: string
          token_assinatura?: string | null
          total?: number
          user_id: string
          validade?: string | null
        }
        Update: {
          assinatura_paciente?: Json | null
          atualizado_em?: string
          criado_em?: string
          data_assinatura?: string | null
          data_expiracao_link?: string | null
          desconto?: number
          formas_pagamento?: string | null
          id?: string
          itens?: Json
          observacoes?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          parceiro_tipo_repasse?: string | null
          parceiro_valor_repasse?: number
          status?: string
          titulo?: string
          token_assinatura?: string | null
          total?: number
          user_id?: string
          validade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          alergias: string | null
          atualizado_em: string
          convenio: string | null
          cpf: string | null
          criado_em: string
          data_arquivamento: string | null
          data_nascimento: string | null
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
          data_nascimento?: string | null
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
          data_nascimento?: string | null
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
      parceiros: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          email: string | null
          especialidade: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo_repasse: string
          user_id: string
          valor_repasse: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo_repasse?: string
          user_id: string
          valor_repasse?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo_repasse?: string
          user_id?: string
          valor_repasse?: number
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
      seguranca_config: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          senha_mestre_hash: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          senha_mestre_hash?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          senha_mestre_hash?: string | null
          user_id?: string
        }
        Relationships: []
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
          orcamento_id: string | null
          paciente_id: string | null
          paciente_nome: string | null
          parceiro_id: string | null
          parceiro_nome: string | null
          parcelas: number | null
          status: string | null
          taxa_cartao_percentual: number | null
          taxa_cartao_valor: number | null
          tipo: string
          user_id: string
          valor: number
          valor_liquido: number | null
          valor_parceiro: number | null
          valor_parcela: number | null
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
          orcamento_id?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          parcelas?: number | null
          status?: string | null
          taxa_cartao_percentual?: number | null
          taxa_cartao_valor?: number | null
          tipo: string
          user_id: string
          valor?: number
          valor_liquido?: number | null
          valor_parceiro?: number | null
          valor_parcela?: number | null
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
          orcamento_id?: string | null
          paciente_id?: string | null
          paciente_nome?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          parcelas?: number | null
          status?: string | null
          taxa_cartao_percentual?: number | null
          taxa_cartao_valor?: number | null
          tipo?: string
          user_id?: string
          valor?: number
          valor_liquido?: number | null
          valor_parceiro?: number | null
          valor_parcela?: number | null
          vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
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
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_mensagens: {
        Row: {
          corpo: string | null
          criado_em: string
          direcao: string
          id: string
          media_url: string | null
          message_sid: string | null
          nome_contato: string | null
          paciente_id: string | null
          status: string
          telefone: string
          user_id: string
        }
        Insert: {
          corpo?: string | null
          criado_em?: string
          direcao?: string
          id?: string
          media_url?: string | null
          message_sid?: string | null
          nome_contato?: string | null
          paciente_id?: string | null
          status?: string
          telefone: string
          user_id: string
        }
        Update: {
          corpo?: string | null
          criado_em?: string
          direcao?: string
          id?: string
          media_url?: string | null
          message_sid?: string | null
          nome_contato?: string | null
          paciente_id?: string | null
          status?: string
          telefone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_paciente_id_fkey"
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
      app_role: "admin" | "dentista" | "recepcao"
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
      app_role: ["admin", "dentista", "recepcao"],
    },
  },
} as const

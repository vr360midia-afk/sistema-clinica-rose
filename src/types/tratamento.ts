export type StatusProcedimentoTratamento = 
  | 'nao_iniciado' 
  | 'em_tratamento' 
  | 'pausado' 
  | 'concluido' 
  | 'cancelado';

export type StatusSessaoTratamento = 
  | 'prevista' 
  | 'agendada' 
  | 'realizada' 
  | 'aguardando_confirmacao' 
  | 'confirmada' 
  | 'cancelada';

export type StatusConfirmacaoSessao = 
  | 'pendente' 
  | 'confirmado' 
  | 'recusado' 
  | 'expirado';

export interface ProcedimentoTratamento {
  id: string;
  user_id: string;
  clinica_id: string;
  paciente_id: string;
  orcamento_id: string;
  contrato_id?: string | null;
  procedimento_nome: string;
  procedimento_id?: string | null;
  item_orcamento_index: number;
  quantidade: number;
  valor_aprovado: number;
  status: StatusProcedimentoTratamento;
  justificativa_cancelamento?: string | null;
  profissional_responsavel_id?: string | null;
  profissional_responsavel_nome?: string | null;
  data_inicio?: string | null;
  data_conclusao?: string | null;
  termo_conclusao_id?: string | null;
  observacoes?: string | null;
  criado_em: string;
  atualizado_em: string;
  sessoes?: SessaoTratamento[];
}

export interface SessaoTratamento {
  id: string;
  tratamento_procedimento_id: string;
  clinica_id: string;
  paciente_id: string;
  numero_sessao: number;
  nome_objetivo: string;
  data_prevista?: string | null;
  data_realizada?: string | null;
  hora_realizada?: string | null;
  profissional_id?: string | null;
  profissional_nome: string;
  descricao_atos?: string | null;
  observacoes_clinicas?: string | null;
  status: StatusSessaoTratamento;
  justificativa_cancelamento?: string | null;
  consulta_id?: string | null;
  anexos?: Array<{ nome: string; url: string; tipo?: string }>;
  data_prevista_anterior?: string | null;
  motivo_reagendamento?: string | null;
  criado_em: string;
  atualizado_em: string;
  concluido_em?: string | null;
  confirmacao?: ConfirmacaoSessao | null;
}

export interface ConfirmacaoSessao {
  id: string;
  sessao_id: string;
  paciente_id: string;
  clinica_id: string;
  token: string;
  token_expira_em: string;
  status: StatusConfirmacaoSessao;
  declaracao_texto: string;
  observacoes_paciente?: string | null;
  concorda_realizacao?: boolean | null;
  assinatura_base64?: string | null;
  assinante_nome?: string | null;
  assinante_cpf?: string | null;
  ip_origem?: string | null;
  user_agent?: string | null;
  assinado_em?: string | null;
  hash_integridade?: string | null;
  documento_clinico_id?: string | null;
  criado_em: string;
}

export interface HistoricoTratamento {
  id: string;
  tratamento_procedimento_id?: string | null;
  sessao_id?: string | null;
  clinica_id: string;
  usuario_id: string;
  usuario_nome?: string | null;
  acao: string;
  dados_anteriores?: any;
  dados_novos?: any;
  justificativa?: string | null;
  criado_em: string;
}


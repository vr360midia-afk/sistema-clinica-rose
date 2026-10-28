export type StatusNovoLead =
  | 'Pendente'
  | 'Interessado'
  | 'Agendado'
  | 'Começou mas não deu andamento'
  | 'Convertido'
  | 'Perdido';

export type PrioridadeNovoLead = 'alta' | 'media' | 'baixa';

export interface RespostaFormulario {
  campo?: string;
  pergunta: string;
  resposta: string;
}

export interface AlertasAgendamento {
  h72: boolean;
  h48: boolean;
  h24: boolean;
  h3: boolean;
}

export interface FollowUpItem {
  id: string;
  etapa: '3h' | '15h' | '24h' | '3d' | '4d' | '6d' | '8d' | '15d' | '30d';
  label: string;
  prazoHoras: number;
  concluido: boolean;
  data_contato?: string;
  canal?: 'whatsapp' | 'ligacao' | 'email' | 'presencial';
  observacao?: string;
}

export interface NovoLead {
  id: string;
  nome: string;
  telefone: string;
  email?: string | null;
  origem: string;
  campanha?: string | null;
  status: StatusNovoLead;
  prioridade: PrioridadeNovoLead;
  respostas: RespostaFormulario[];
  revisado: boolean;
  revisado_em?: string | null;
  revisado_por?: string | null;
  data_criacao: string;
  data_atualizacao?: string | null;
  observacoes?: string | null;
  valor_estimado?: number | null;
  valor_venda?: number | null;
  motivo_perda?: string | null;
  arquivado?: boolean;
  agendado_para?: string | null;
  alertas_agendamento?: AlertasAgendamento;
  follow_ups: FollowUpItem[];
  meta_lead_id?: string | null;
  form_id?: string | null;
  ad_id?: string | null;
  paciente_id?: string | null;
  // Campos de compatibilidade legado
  name?: string | null;
  phone?: string | null;
  stage?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export const FOLLOW_UP_ETAPAS_PADRAO: Omit<FollowUpItem, 'id' | 'concluido'>[] = [
  { etapa: '3h', label: '1º Contato (3 horas)', prazoHoras: 3 },
  { etapa: '15h', label: '2º Contato (15 horas)', prazoHoras: 15 },
  { etapa: '24h', label: '3º Contato (24 horas / 1 dia)', prazoHoras: 24 },
  { etapa: '3d', label: '4º Contato (3º dia)', prazoHoras: 72 },
  { etapa: '4d', label: '5º Contato (4º dia)', prazoHoras: 96 },
  { etapa: '6d', label: '6º Contato (6º dia)', prazoHoras: 144 },
  { etapa: '8d', label: '7º Contato (8º dia)', prazoHoras: 192 },
  { etapa: '15d', label: '8º Contato (15º dia)', prazoHoras: 360 },
  { etapa: '30d', label: '9º Contato (30º dia)', prazoHoras: 720 },
];

export function gerarFollowUpsIniciais(): FollowUpItem[] {
  return FOLLOW_UP_ETAPAS_PADRAO.map((item, idx) => ({
    id: `fu_${item.etapa}_${idx}`,
    etapa: item.etapa,
    label: item.label,
    prazoHoras: item.prazoHoras,
    concluido: false,
  }));
}

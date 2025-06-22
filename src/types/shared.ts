
export interface BaseEntity {
  id: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface Paciente extends BaseEntity {
  nome: string;
  email: string;
  telefone: string;
  idade: number;
  foto?: string;
  convenio: string;
  origemLead: OrigemLead;
  status: StatusPaciente;
  ultimaConsulta?: string; // Alterado de Date para string
  proximaConsulta?: Date;
  historicoMedico?: string;
  alergias?: string;
  medicamentos?: string;
  observacoes?: string;
  // Campos adicionais
  endereco?: string;
  cpf?: string;
  rg?: string;
  profissao?: string;
  estadoCivil?: string;
  // Campos de arquivamento
  dataArquivamento?: Date;
  motivoArquivamento?: string;
}

export type OrigemLead = 
  | 'indicacao'
  | 'google'
  | 'facebook'
  | 'instagram'
  | 'site'
  | 'whatsapp'
  | 'panfleto'
  | 'outros';

export type StatusPaciente = 'Ativo' | 'Inativo' | 'Arquivado';

export interface Consulta extends BaseEntity {
  pacienteId: string;
  data: Date;
  hora: string;
  duracao: number;
  procedimento: string;
  status: StatusConsulta;
  dentista: string;
  observacoes?: string;
  valor?: number;
}

export type StatusConsulta = 'agendado' | 'confirmado' | 'realizado' | 'cancelado' | 'faltou';

export interface Transacao extends BaseEntity {
  pacienteId: string;
  consultaId?: string;
  valor: number;
  tipo: TipoTransacao;
  status: StatusTransacao;
  metodoPagamento: MetodoPagamento;
  data: Date;
  vencimento?: Date;
  descricao: string;
  observacoes?: string;
}

export type TipoTransacao = 'receita' | 'despesa';
export type StatusTransacao = 'pago' | 'pendente' | 'vencido' | 'cancelado';
export type MetodoPagamento = 'dinheiro' | 'cartao' | 'pix' | 'boleto' | 'transferencia';

export interface Prontuario extends BaseEntity {
  pacienteId: string;
  consultaId?: string;
  data: Date;
  queixaPrincipal: string;
  historiaDoenca: string;
  exameClinico: string;
  diagnostico?: string;
  planoTratamento?: string;
  procedimentosRealizados: string[];
  observacoes?: string;
  anexos?: string[];
}

export interface Anamnese extends BaseEntity {
  pacienteId: string;
  data: Date;
  queixaPrincipal: string;
  historiaAtual: string;
  historiaFamiliar?: string;
  historiaMedica?: string;
  alergias?: string;
  medicamentos?: string;
  habitosViciosPositivos?: string;
  habitosViciosNegativos?: string;
  exameExtraBucal?: string;
  exameIntraBucal?: string;
  observacoes?: string;
  anexos?: string[];
  // Campos de assinatura digital
  assinaturaPaciente?: SignatureData;
  assinaturaDoutor?: SignatureData;
  linkAssinatura?: string;
  tokenAssinatura?: string;
  statusAssinatura: StatusAssinatura;
  dataExpiracaoLink?: Date;
}

export interface SignatureData {
  signature: string;
  signerName: string;
  signerRole: 'paciente' | 'dentista';
  timestamp: Date;
  signerInfo?: {
    email?: string;
    cpf?: string;
  };
}

export type StatusAssinatura = 'pendente' | 'paciente_assinado' | 'completo' | 'expirado';

export interface DocumentoPaciente extends BaseEntity {
  pacienteId: string;
  tipo: TipoDocumento;
  nome: string;
  arquivo: string;
  tamanho?: number;
  descricao?: string;
}

export type TipoDocumento = 'foto' | 'raio-x' | 'exame' | 'receita' | 'atestado' | 'outro';

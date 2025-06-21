
import { z } from 'zod';

// Schema para Paciente
export const pacienteSchema = z.object({
  id: z.string().optional(),
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(10, 'Telefone deve ter pelo menos 10 dígitos'),
  idade: z.number().min(1).max(120, 'Idade deve estar entre 1 e 120 anos'),
  foto: z.string().optional(),
  convenio: z.string().min(1, 'Convênio é obrigatório'),
  origemLead: z.enum(['indicacao', 'google', 'facebook', 'instagram', 'site', 'whatsapp', 'panfleto', 'outros']),
  status: z.enum(['Ativo', 'Inativo', 'Arquivado']).default('Ativo'),
  ultimaConsulta: z.date().optional(),
  proximaConsulta: z.date().optional(),
  historicoMedico: z.string().optional(),
  alergias: z.string().optional(),
  medicamentos: z.string().optional(),
  observacoes: z.string().optional(),
  dataArquivamento: z.date().optional(),
  motivoArquivamento: z.string().optional(),
  criadoEm: z.date().default(() => new Date()),
  atualizadoEm: z.date().default(() => new Date())
});

// Schema para Consulta
export const consultaSchema = z.object({
  id: z.string().optional(),
  pacienteId: z.string().min(1, 'Paciente é obrigatório'),
  data: z.date(),
  hora: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido'),
  duracao: z.number().min(15, 'Duração mínima de 15 minutos'),
  procedimento: z.string().min(1, 'Procedimento é obrigatório'),
  status: z.enum(['agendado', 'confirmado', 'realizado', 'cancelado', 'faltou']).default('agendado'),
  dentista: z.string().min(1, 'Dentista é obrigatório'),
  observacoes: z.string().optional(),
  valor: z.number().optional(),
  criadoEm: z.date().default(() => new Date()),
  atualizadoEm: z.date().default(() => new Date())
});

// Schema para Transação
export const transacaoSchema = z.object({
  id: z.string().optional(),
  pacienteId: z.string().min(1, 'Paciente é obrigatório'),
  consultaId: z.string().optional(),
  valor: z.number().positive('Valor deve ser positivo'),
  tipo: z.enum(['receita', 'despesa']),
  status: z.enum(['pago', 'pendente', 'vencido', 'cancelado']).default('pendente'),
  metodoPagamento: z.enum(['dinheiro', 'cartao', 'pix', 'boleto', 'transferencia']),
  data: z.date(),
  vencimento: z.date().optional(),
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  observacoes: z.string().optional(),
  criadoEm: z.date().default(() => new Date()),
  atualizadoEm: z.date().default(() => new Date())
});

// Schema para Prontuário
export const prontuarioSchema = z.object({
  id: z.string().optional(),
  pacienteId: z.string().min(1, 'Paciente é obrigatório'),
  consultaId: z.string().optional(),
  data: z.date(),
  queixaPrincipal: z.string().min(1, 'Queixa principal é obrigatória'),
  historiaDoenca: z.string().min(1, 'História da doença é obrigatória'),
  exameClinico: z.string().min(1, 'Exame clínico é obrigatório'),
  diagnostico: z.string().optional(),
  planoTratamento: z.string().optional(),
  procedimentosRealizados: z.array(z.string()).default([]),
  observacoes: z.string().optional(),
  anexos: z.array(z.string()).default([]),
  criadoEm: z.date().default(() => new Date()),
  atualizadoEm: z.date().default(() => new Date())
});

export type PacienteFormData = z.infer<typeof pacienteSchema>;
export type ConsultaFormData = z.infer<typeof consultaSchema>;
export type TransacaoFormData = z.infer<typeof transacaoSchema>;
export type ProntuarioFormData = z.infer<typeof prontuarioSchema>;

import { createContext, useContext } from 'react';
import { Paciente, Consulta, Transacao, Prontuario, Anamnese, DocumentoPaciente } from '@/types/shared';

export interface DentalSystemContextType {
  // Estado
  pacientes: Paciente[];
  consultas: Consulta[];
  transacoes: Transacao[];
  prontuarios: Prontuario[];
  anamneses: Anamnese[];
  documentos: DocumentoPaciente[];
  loading: boolean;

  // Ações
  addPaciente: (paciente: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Paciente>;
  updatePaciente: (id: string, updates: Partial<Paciente>) => Promise<void>;
  deletePaciente: (id: string) => Promise<void>;
  arquivarPaciente: (id: string, motivo: string) => Promise<void>;
  archivePaciente: (id: string, motivo: string) => Promise<void>;
  reactivatePaciente: (id: string) => Promise<void>;

  addConsulta: (consulta: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateConsulta: (id: string, updates: Partial<Consulta>) => Promise<void>;
  deleteConsulta: (id: string) => Promise<void>;

  addTransacao: (transacao: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateTransacao: (id: string, updates: Partial<Transacao>) => Promise<void>;
  deleteTransacao: (id: string) => Promise<void>;

  addProntuario: (prontuario: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateProntuario: (id: string, updates: Partial<Prontuario>) => Promise<void>;
  deleteProntuario: (id: string) => Promise<void>;

  addAnamnese: (anamnese: Omit<Anamnese, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<Anamnese>;
  updateAnamnese: (id: string, updates: Partial<Anamnese>) => Promise<void>;
  deleteAnamnese: (id: string) => Promise<void>;
  generateSignatureLink: (anamneseId: string) => Promise<string>;
  signAnamnese: (id: string, signatureData: any, signerType: 'paciente' | 'dentista') => Promise<void>;

  addDocumento: (documento: Omit<DocumentoPaciente, 'id' | 'criadoEm' | 'atualizadoEm'>) => Promise<void>;
  updateDocumento: (id: string, updates: Partial<DocumentoPaciente>) => Promise<void>;
  deleteDocumento: (id: string) => Promise<void>;

  // Utilidades
  getPacienteById: (id: string) => Paciente | undefined;
  clearAllData: () => Promise<void>;
  clearPacientes: () => Promise<void>;
  clearTransacoes: () => Promise<void>;
  clearAnamneses: () => Promise<void>;
  migrateFromLocalStorage: () => Promise<void>;
}

export const DentalSystemContext = createContext<DentalSystemContextType | undefined>(undefined);

export const useDentalSystem = () => {
  const context = useContext(DentalSystemContext);
  if (context === undefined) {
    throw new Error('useDentalSystem must be used within a DentalSystemProvider');
  }
  return context;
};

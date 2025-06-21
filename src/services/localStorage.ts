
import { Paciente, Consulta, Transacao, Prontuario } from '@/types/shared';

const STORAGE_KEYS = {
  PACIENTES: 'dental-system-pacientes',
  CONSULTAS: 'dental-system-consultas',
  TRANSACOES: 'dental-system-transacoes',
  PRONTUARIOS: 'dental-system-prontuarios',
  SYSTEM_CONFIG: 'dental-system-config'
} as const;

class LocalStorageService {
  private getItem<T>(key: string): T[] {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item, this.dateReviver) : [];
    } catch (error) {
      console.error(`Erro ao ler ${key} do localStorage:`, error);
      return [];
    }
  }

  private setItem<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data, this.dateReplacer));
    } catch (error) {
      console.error(`Erro ao salvar ${key} no localStorage:`, error);
    }
  }

  private dateReplacer(key: string, value: any): any {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  private dateReviver(key: string, value: any): any {
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Pacientes
  getPacientes(): Paciente[] {
    return this.getItem<Paciente>(STORAGE_KEYS.PACIENTES);
  }

  savePaciente(paciente: Omit<Paciente, 'id' | 'criadoEm' | 'atualizadoEm'>): Paciente {
    const pacientes = this.getPacientes();
    const now = new Date();
    const newPaciente: Paciente = {
      ...paciente,
      id: this.generateId(),
      criadoEm: now,
      atualizadoEm: now
    };
    
    pacientes.push(newPaciente);
    this.setItem(STORAGE_KEYS.PACIENTES, pacientes);
    return newPaciente;
  }

  updatePaciente(id: string, updates: Partial<Paciente>): Paciente | null {
    const pacientes = this.getPacientes();
    const index = pacientes.findIndex(p => p.id === id);
    
    if (index === -1) return null;
    
    pacientes[index] = {
      ...pacientes[index],
      ...updates,
      atualizadoEm: new Date()
    };
    
    this.setItem(STORAGE_KEYS.PACIENTES, pacientes);
    return pacientes[index];
  }

  deletePaciente(id: string): boolean {
    const pacientes = this.getPacientes();
    const filteredPacientes = pacientes.filter(p => p.id !== id);
    
    if (filteredPacientes.length === pacientes.length) return false;
    
    this.setItem(STORAGE_KEYS.PACIENTES, filteredPacientes);
    return true;
  }

  // Consultas
  getConsultas(): Consulta[] {
    return this.getItem<Consulta>(STORAGE_KEYS.CONSULTAS);
  }

  saveConsulta(consulta: Omit<Consulta, 'id' | 'criadoEm' | 'atualizadoEm'>): Consulta {
    const consultas = this.getConsultas();
    const now = new Date();
    const newConsulta: Consulta = {
      ...consulta,
      id: this.generateId(),
      criadoEm: now,
      atualizadoEm: now
    };
    
    consultas.push(newConsulta);
    this.setItem(STORAGE_KEYS.CONSULTAS, consultas);
    return newConsulta;
  }

  updateConsulta(id: string, updates: Partial<Consulta>): Consulta | null {
    const consultas = this.getConsultas();
    const index = consultas.findIndex(c => c.id === id);
    
    if (index === -1) return null;
    
    consultas[index] = {
      ...consultas[index],
      ...updates,
      atualizadoEm: new Date()
    };
    
    this.setItem(STORAGE_KEYS.CONSULTAS, consultas);
    return consultas[index];
  }

  deleteConsulta(id: string): boolean {
    const consultas = this.getConsultas();
    const filteredConsultas = consultas.filter(c => c.id !== id);
    
    if (filteredConsultas.length === consultas.length) return false;
    
    this.setItem(STORAGE_KEYS.CONSULTAS, filteredConsultas);
    return true;
  }

  // Transações
  getTransacoes(): Transacao[] {
    return this.getItem<Transacao>(STORAGE_KEYS.TRANSACOES);
  }

  saveTransacao(transacao: Omit<Transacao, 'id' | 'criadoEm' | 'atualizadoEm'>): Transacao {
    const transacoes = this.getTransacoes();
    const now = new Date();
    const newTransacao: Transacao = {
      ...transacao,
      id: this.generateId(),
      criadoEm: now,
      atualizadoEm: now
    };
    
    transacoes.push(newTransacao);
    this.setItem(STORAGE_KEYS.TRANSACOES, transacoes);
    return newTransacao;
  }

  updateTransacao(id: string, updates: Partial<Transacao>): Transacao | null {
    const transacoes = this.getTransacoes();
    const index = transacoes.findIndex(t => t.id === id);
    
    if (index === -1) return null;
    
    transacoes[index] = {
      ...transacoes[index],
      ...updates,
      atualizadoEm: new Date()
    };
    
    this.setItem(STORAGE_KEYS.TRANSACOES, transacoes);
    return transacoes[index];
  }

  deleteTransacao(id: string): boolean {
    const transacoes = this.getTransacoes();
    const filteredTransacoes = transacoes.filter(t => t.id !== id);
    
    if (filteredTransacoes.length === transacoes.length) return false;
    
    this.setItem(STORAGE_KEYS.TRANSACOES, filteredTransacoes);
    return true;
  }

  // Prontuários
  getProntuarios(): Prontuario[] {
    return this.getItem<Prontuario>(STORAGE_KEYS.PRONTUARIOS);
  }

  saveProntuario(prontuario: Omit<Prontuario, 'id' | 'criadoEm' | 'atualizadoEm'>): Prontuario {
    const prontuarios = this.getProntuarios();
    const now = new Date();
    const newProntuario: Prontuario = {
      ...prontuario,
      id: this.generateId(),
      criadoEm: now,
      atualizadoEm: now
    };
    
    prontuarios.push(newProntuario);
    this.setItem(STORAGE_KEYS.PRONTUARIOS, prontuarios);
    return newProntuario;
  }

  updateProntuario(id: string, updates: Partial<Prontuario>): Prontuario | null {
    const prontuarios = this.getProntuarios();
    const index = prontuarios.findIndex(p => p.id === id);
    
    if (index === -1) return null;
    
    prontuarios[index] = {
      ...prontuarios[index],
      ...updates,
      atualizadoEm: new Date()
    };
    
    this.setItem(STORAGE_KEYS.PRONTUARIOS, prontuarios);
    return prontuarios[index];
  }

  deleteProntuario(id: string): boolean {
    const prontuarios = this.getProntuarios();
    const filteredProntuarios = prontuarios.filter(p => p.id !== id);
    
    if (filteredProntuarios.length === prontuarios.length) return false;
    
    this.setItem(STORAGE_KEYS.PRONTUARIOS, filteredProntuarios);
    return true;
  }

  // Métodos utilitários
  clearAllData(): void {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }

  exportData() {
    return {
      pacientes: this.getPacientes(),
      consultas: this.getConsultas(),
      transacoes: this.getTransacoes(),
      prontuarios: this.getProntuarios(),
      exportedAt: new Date()
    };
  }

  importData(data: any): boolean {
    try {
      if (data.pacientes) this.setItem(STORAGE_KEYS.PACIENTES, data.pacientes);
      if (data.consultas) this.setItem(STORAGE_KEYS.CONSULTAS, data.consultas);
      if (data.transacoes) this.setItem(STORAGE_KEYS.TRANSACOES, data.transacoes);
      if (data.prontuarios) this.setItem(STORAGE_KEYS.PRONTUARIOS, data.prontuarios);
      return true;
    } catch (error) {
      console.error('Erro ao importar dados:', error);
      return false;
    }
  }
}

export const localStorageService = new LocalStorageService();

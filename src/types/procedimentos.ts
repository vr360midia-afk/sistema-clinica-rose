
export interface Procedimento {
  id: string;
  nome: string;
  categoria: CategoriaProcedimento;
  subcategoria?: string;
  descricao: string;
  
  // Dados financeiros
  preco: number;
  precoConvenio?: number;
  custoMaterial?: number;
  
  // Dados operacionais
  duracaoMinutos: number;
  complexidade: ComplexidadeProcedimento;
  requererAnestesia: boolean;
  requererRaioX: boolean;
  
  // Dados técnicos
  codigoTUSS?: string;
  materiaisNecessarios: string[];
  equipamentosNecessarios: string[];
  
  // Status e controle
  ativo: boolean;
  observacoes?: string;
  criadoEm: Date;
  atualizadoEm: Date;
  criadoPor: string;
}

export type CategoriaProcedimento = 
  | 'preventivo'
  | 'restaurador'
  | 'endodontico'
  | 'periodontico'
  | 'cirurgico'
  | 'protese'
  | 'ortodontico'
  | 'estetico'
  | 'emergencia'
  | 'outros';

export type ComplexidadeProcedimento = 'baixa' | 'media' | 'alta' | 'muito-alta';

export interface PacoteProcedimentos {
  id: string;
  nome: string;
  descricao: string;
  procedimentos: string[]; // IDs dos procedimentos
  precoTotal: number;
  desconto: number;
  ativo: boolean;
}

export interface HistoricoProcedimento {
  id: string;
  procedimentoId: string;
  alteracao: string;
  valorAnterior: any;
  valorNovo: any;
  usuario: string;
  data: Date;
}

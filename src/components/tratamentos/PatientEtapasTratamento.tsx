import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Activity,
  FileText,
  DollarSign,
  Layers,
  X,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useTratamentos } from '@/hooks/useTratamentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import {
  OdontogramaVisual,
  DenticaoTipo,
  EstadoProcedimentoVisual,
} from './OdontogramaVisual';
import { ModalNovoProcedimento, ProcedimentoItemData } from './ModalNovoProcedimento';
import { ModalMarcarRealizado } from './ModalMarcarRealizado';
import { ModalDetalhesProcedimento } from './ModalDetalhesProcedimento';
import { ModalAnotacao, AnotacaoItem } from './ModalAnotacao';

interface Props {
  patient: any;
  onTabChange?: (tab: string) => void;
}

type FiltroPill = 'ficha_geral' | 'a_realizar' | 'iniciado' | 'realizado' | 'pre_existente';

const FILTROS_PILL: Array<{ id: FiltroPill; label: string }> = [
  { id: 'ficha_geral', label: 'Ficha geral' },
  { id: 'a_realizar', label: 'A realizar' },
  { id: 'iniciado', label: 'Iniciado' },
  { id: 'realizado', label: 'Realizado' },
  { id: 'pre_existente', label: 'Pré-existente' },
];

export const PatientEtapasTratamento: React.FC<Props> = ({ patient, onTabChange }) => {
  const { updatePaciente } = useDentalSystem();
  const {
    procedimentos: procedimentosTratamento,
    isLoading: isLoadingTratamentos,
    sincronizarOrcamento,
    concluirProcedimento,
    atualizarStatusProcedimento,
  } = useTratamentos(patient?.id);
  const { orcamentos } = useOrcamentos(patient?.id);

  // Estado da Dentição
  const [denticao, setDenticao] = useState<DenticaoTipo>('permanente');

  // Dente selecionado no odontograma (filtro adicional)
  const [selectedDente, setSelectedDente] = useState<string | null>(null);

  // Filtro de estado (Pills)
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroPill>('ficha_geral');

  // Filtro por tipo/categoria do procedimento
  const [tipoFiltro, setTipoFiltro] = useState<string>('todos');

  // Procedimentos locais persistidos no paciente (odontograma.procedimentos)
  const [procedimentosLocais, setProcedimentosLocais] = useState<ProcedimentoItemData[]>([]);

  // Anotações clínicas do paciente
  const [anotacoes, setAnotacoes] = useState<AnotacaoItem[]>([]);

  // Modais
  const [isModalNovoProcOpen, setIsModalNovoProcOpen] = useState(false);
  const [procEmEdicao, setProcEmEdicao] = useState<ProcedimentoItemData | null>(null);
  const [isModalMarcarRealizadoOpen, setIsModalMarcarRealizadoOpen] = useState(false);
  const [procParaConcluir, setProcParaConcluir] = useState<ProcedimentoItemData | null>(null);
  const [modalDetalhesProc, setModalDetalhesProc] = useState<{
    proc: ProcedimentoItemData;
    modo: 'detalhes' | 'debito';
  } | null>(null);
  const [isModalAnotacaoOpen, setIsModalAnotacaoOpen] = useState(false);

  // Carrega dados persistidos do paciente
  useEffect(() => {
    if (patient?.odontograma) {
      try {
        const parsed =
          typeof patient.odontograma === 'string'
            ? JSON.parse(patient.odontograma)
            : patient.odontograma;

        if (parsed?.tipoDenticao) {
          setDenticao(parsed.tipoDenticao);
        }

        if (Array.isArray(parsed?.procedimentos)) {
          setProcedimentosLocais(parsed.procedimentos);
        }

        if (Array.isArray(parsed?.anotacoes)) {
          setAnotacoes(parsed.anotacoes);
        } else if (patient?.observacoes && typeof patient.observacoes === 'string') {
          // Fallback caso haja observações antigas
          setAnotacoes([
            {
              id: 'nota_obs_1',
              texto: patient.observacoes,
              data: new Date().toISOString(),
              autor: 'Profissional',
            },
          ]);
        }
      } catch (err) {
        console.error('Erro ao ler odontograma persistido:', err);
      }
    } else if (patient?.observacoes && typeof patient.observacoes === 'string') {
      setAnotacoes([
        {
          id: 'nota_obs_1',
          texto: patient.observacoes,
          data: new Date().toISOString(),
          autor: 'Profissional',
        },
      ]);
    }
  }, [patient?.odontograma, patient?.observacoes]);

  // Salva no banco de dados através de updatePaciente
  const salvarNoPaciente = async (
    novosProcedimentos: ProcedimentoItemData[],
    novasAnotacoes: AnotacaoItem[],
    novaDenticao = denticao
  ) => {
    if (!patient?.id || !updatePaciente) return;

    let baseOdonto: any = {};
    if (typeof patient.odontograma === 'string') {
      try {
        baseOdonto = JSON.parse(patient.odontograma);
      } catch (_) {}
    } else if (typeof patient.odontograma === 'object' && patient.odontograma !== null) {
      baseOdonto = { ...patient.odontograma };
    }

    const payload = {
      ...baseOdonto,
      tipoDenticao: novaDenticao,
      procedimentos: novosProcedimentos,
      anotacoes: novasAnotacoes,
    };

    try {
      await updatePaciente(patient.id, { odontograma: payload });
    } catch (err) {
      console.error('Erro ao salvar odontograma no paciente:', err);
    }
  };

  // Alterna Dentição
  const handleToggleDenticao = (tipo: DenticaoTipo) => {
    setDenticao(tipo);
    salvarNoPaciente(procedimentosLocais, anotacoes, tipo);
  };

  // Unifica procedimentos locais com os sincronizados de tratamentos_procedimentos
  const procedimentosUnificados = useMemo(() => {
    const mapa = new Map<string, ProcedimentoItemData>();

    // 1. Procedimentos vindos de tratamentos_procedimentos (banco estruturado)
    (procedimentosTratamento || []).forEach((p) => {
      let denteExtraido = '16';
      // Tenta extrair número de dente de observações ou nome
      const matchDente =
        (p.observacoes && p.observacoes.match(/dente\s*(\d{2})/i)) ||
        p.procedimento_nome.match(/dente\s*(\d{2})/i) ||
        p.procedimento_nome.match(/\b(1[1-8]|2[1-8]|3[1-8]|4[1-8]|5[1-5]|6[1-5]|7[1-5]|8[1-5])\b/);

      if (matchDente && matchDente[1]) {
        denteExtraido = matchDente[1];
      }

      let estVisual: EstadoProcedimentoVisual = 'a_realizar';
      if (p.status === 'concluido') estVisual = 'realizado';
      else if (p.status === 'em_tratamento' || p.status === 'pausado') estVisual = 'iniciado';
      else estVisual = 'a_realizar';

      const item: ProcedimentoItemData = {
        id: p.id,
        nome: p.procedimento_nome,
        categoria: 'Tratamento Clínico',
        dente: denteExtraido,
        estado: estVisual,
        valor: p.valor_aprovado,
        orcamentoId: p.orcamento_id,
        orcamentoTitulo: `Orçamento #${p.orcamento_id.substring(0, 8)}`,
        dataRealizado: p.data_conclusao || undefined,
        dataPrevista: p.data_inicio || undefined,
        observacoes: p.observacoes || undefined,
        criadoEm: p.criado_em,
      };

      mapa.set(p.id, item);
    });

    // 2. Procedimentos locais (adicionados manualmente ou customizados)
    procedimentosLocais.forEach((p) => {
      mapa.set(p.id, p);
    });

    return Array.from(mapa.values());
  }, [procedimentosTratamento, procedimentosLocais]);

  // Mapa de status por dente para colorir o Odontograma anatômico
  const dentesStatus = useMemo(() => {
    const statusMap: Record<string, EstadoProcedimentoVisual> = {};

    procedimentosUnificados.forEach((p) => {
      if (!p.dente || p.dente === 'Geral / Arcada') return;
      const numDente = p.dente.replace(/\D/g, '');
      if (!numDente) return;

      // Prioridade visual: a_realizar (amarelo) > iniciado (azul) > realizado (verde) > pre_existente
      const estadoAtual = statusMap[numDente];
      if (!estadoAtual) {
        statusMap[numDente] = p.estado;
      } else if (p.estado === 'a_realizar') {
        statusMap[numDente] = 'a_realizar';
      } else if (p.estado === 'iniciado' && estadoAtual !== 'a_realizar') {
        statusMap[numDente] = 'iniciado';
      }
    });

    return statusMap;
  }, [procedimentosUnificados]);

  // Categorias disponíveis para o Select "Todos os tipos"
  const tiposDisponiveis = useMemo(() => {
    const set = new Set<string>();
    procedimentosUnificados.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
      else set.add('Geral');
    });
    return Array.from(set);
  }, [procedimentosUnificados]);

  // Procedimentos filtrados por Pill + Dente Selecionado + Categoria
  const procedimentosFiltrados = useMemo(() => {
    return procedimentosUnificados.filter((p) => {
      // Filtro de Pill
      if (filtroAtivo === 'a_realizar' && p.estado !== 'a_realizar') return false;
      if (filtroAtivo === 'iniciado' && p.estado !== 'iniciado') return false;
      if (filtroAtivo === 'realizado' && p.estado !== 'realizado') return false;
      if (filtroAtivo === 'pre_existente' && p.estado !== 'pre_existente') return false;

      // Filtro por Dente Selecionado no Odontograma
      if (selectedDente) {
        const numP = p.dente.replace(/\D/g, '');
        if (numP && numP !== selectedDente) return false;
      }

      // Filtro por Tipo / Categoria
      if (tipoFiltro !== 'todos') {
        if ((p.categoria || 'Geral') !== tipoFiltro) return false;
      }

      return true;
    });
  }, [procedimentosUnificados, filtroAtivo, selectedDente, tipoFiltro]);

  // Contagem por filtro para exibir nos botões
  const contagens = useMemo(() => {
    return {
      ficha_geral: procedimentosUnificados.length,
      a_realizar: procedimentosUnificados.filter((p) => p.estado === 'a_realizar').length,
      iniciado: procedimentosUnificados.filter((p) => p.estado === 'iniciado').length,
      realizado: procedimentosUnificados.filter((p) => p.estado === 'realizado').length,
      pre_existente: procedimentosUnificados.filter((p) => p.estado === 'pre_existente').length,
    };
  }, [procedimentosUnificados]);

  // Salvar ou Criar Procedimento
  const handleSaveProcedimento = (item: ProcedimentoItemData) => {
    let atualizados: ProcedimentoItemData[];
    const existe = procedimentosLocais.some((p) => p.id === item.id);

    if (existe) {
      atualizados = procedimentosLocais.map((p) => (p.id === item.id ? item : p));
      toast.success('Procedimento atualizado com sucesso!');
    } else {
      atualizados = [item, ...procedimentosLocais];
      toast.success('Procedimento adicionado com sucesso!');
    }

    setProcedimentosLocais(atualizados);
    salvarNoPaciente(atualizados, anotacoes);
  };

  // Excluir Procedimento
  const handleDeleteProcedimento = (item: ProcedimentoItemData) => {
    const confirmou = window.confirm(`Deseja realmente excluir o procedimento "${item.nome}"?`);
    if (!confirmou) return;

    const filtrados = procedimentosLocais.filter((p) => p.id !== item.id);
    setProcedimentosLocais(filtrados);
    salvarNoPaciente(filtrados, anotacoes);
    toast.success('Procedimento excluído com sucesso.');
  };

  // Concluir Procedimento (Marcar como realizado com data)
  const handleConfirmarConclusao = async (dataConclusao: string) => {
    if (!procParaConcluir) return;

    const id = procParaConcluir.id;
    // Se for um procedimento estruturado do useTratamentos, atualiza via serviço também
    try {
      if (concluirProcedimento) {
        await concluirProcedimento(id, dataConclusao);
      }
    } catch (_) {}

    const atualizados = procedimentosLocais.map((p) => {
      if (p.id === id) {
        return {
          ...p,
          estado: 'realizado' as EstadoProcedimentoVisual,
          dataRealizado: dataConclusao,
        };
      }
      return p;
    });

    // Se o procedimento não estava na lista local ainda (veio de tratamentos_procedimentos), adiciona cópia local atualizada
    const jaEstavaLocal = procedimentosLocais.some((p) => p.id === id);
    const listaFinal = jaEstavaLocal
      ? atualizados
      : [
          ...atualizados,
          {
            ...procParaConcluir,
            estado: 'realizado' as EstadoProcedimentoVisual,
            dataRealizado: dataConclusao,
          },
        ];

    setProcedimentosLocais(listaFinal);
    salvarNoPaciente(listaFinal, anotacoes);
    setProcParaConcluir(null);
    toast.success('Procedimento marcado como Realizado com sucesso!');
  };

  // Salvar Anotação
  const handleSaveAnotacao = (novaAnotacao: AnotacaoItem) => {
    const atualizadas = [novaAnotacao, ...anotacoes];
    setAnotacoes(atualizadas);
    salvarNoPaciente(procedimentosLocais, atualizadas);
    toast.success('Anotação adicionada com sucesso!');
  };

  // Excluir Anotação
  const handleDeleteAnotacao = (id: string) => {
    const atualizadas = anotacoes.filter((a) => a.id !== id);
    setAnotacoes(atualizadas);
    salvarNoPaciente(procedimentosLocais, atualizadas);
    toast.success('Anotação removida.');
  };

  // Alterna seleção de dente no Odontograma
  const handleSelectDente = (numeroDente: string) => {
    if (selectedDente === numeroDente) {
      setSelectedDente(null); // Desmarca se já estava selecionado
    } else {
      setSelectedDente(numeroDente);
    }
  };

  // Título da tabela
  const tituloFicha = useMemo(() => {
    const f = FILTROS_PILL.find((item) => item.id === filtroAtivo);
    const base = f ? f.label : 'Ficha Geral';
    if (selectedDente) {
      return `${base} — Dente ${selectedDente}`;
    }
    return base;
  }, [filtroAtivo, selectedDente]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Layout Principal: Coluna da Esquerda (Odontograma + Tabela) e Coluna da Direita (Anotações) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* ========================================================================= */}
        {/* COLUNA ESQUERDA: Odontograma, Filtros e Tabela de Procedimentos           */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Odontograma Visual Anatômico */}
          <OdontogramaVisual
            denticao={denticao}
            onToggleDenticao={handleToggleDenticao}
            selectedDente={selectedDente}
            onSelectDente={handleSelectDente}
            dentesStatus={dentesStatus}
            onNovoProcedimento={(dentePre) => {
              setProcEmEdicao(null);
              setSelectedDente(dentePre || null);
              setIsModalNovoProcOpen(true);
            }}
          />

          {/* Filtros em formato de Radio Pills (Ficha geral, A realizar, Iniciado, Realizado, Pré-existente) */}
          <div className="bg-card border border-border rounded-xl p-2.5 sm:p-3 shadow-2xs">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {FILTROS_PILL.map((f) => {
                const isSelected = filtroAtivo === f.id;
                const qtd = contagens[f.id];

                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroAtivo(f.id)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all shrink-0 ${
                      isSelected
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/30 text-purple-950 dark:text-purple-200 shadow-2xs ring-1 ring-purple-600/30'
                        : 'border-border/70 bg-background hover:bg-muted/60 text-foreground'
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isSelected ? 'border-purple-600' : 'border-muted-foreground/40'
                      }`}
                    >
                      {isSelected && <span className="h-2 w-2 rounded-full bg-purple-600" />}
                    </span>
                    <span>{f.label}</span>
                    {qtd > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected
                            ? 'bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {qtd}
                      </span>
                    )}
                  </button>
                );
              })}

              {selectedDente && (
                <button
                  type="button"
                  onClick={() => setSelectedDente(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0 ml-auto"
                  title="Limpar filtro de dente"
                >
                  <X className="h-3 w-3" />
                  <span>Dente {selectedDente}</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-barra: Dropdown de Tipos + Título da Ficha + Ações (Novo Orçamento / Novo Procedimento) */}
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              {/* Select "Todos os tipos (N)" */}
              <div className="w-full sm:w-auto">
                <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                  <SelectTrigger className="h-8.5 text-xs w-full sm:w-[210px] bg-background border-border">
                    <SelectValue placeholder={`Todos os tipos (${procedimentosFiltrados.length})`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos ({procedimentosUnificados.length})</SelectItem>
                    {tiposDisponiveis.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Botões de Ação */}
              <div className="flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    if (onTabChange) onTabChange('orcamentos');
                  }}
                  className="h-8.5 px-3.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg gap-1.5 shadow-2xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo Orçamento
                </Button>
              </div>
            </div>

            {/* Cabeçalho da Seção */}
            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-foreground">{tituloFicha}</h3>
              <span className="text-xs text-muted-foreground font-medium">
                {procedimentosFiltrados.length}{' '}
                {procedimentosFiltrados.length === 1 ? 'procedimento' : 'procedimentos'}
              </span>
            </div>

            {/* Tabela Oficial de Procedimentos (Procedimento | Dente | Estado | Ações) */}
            <div className="border border-border/70 rounded-lg overflow-hidden bg-background">
              {procedimentosFiltrados.length === 0 ? (
                /* Estado Vazio (conforme Imagem 5) */
                <div className="py-12 px-4 text-center space-y-3">
                  <p className="text-xs sm:text-sm text-foreground/80 font-medium max-w-md mx-auto">
                    Adicione procedimentos para facilitar o controle e acompanhamento dos tratamentos
                    de seu paciente!
                  </p>
                  <div>
                    <Button
                      type="button"
                      onClick={() => {
                        setProcEmEdicao(null);
                        setIsModalNovoProcOpen(true);
                      }}
                      className="h-9 px-4 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg gap-1.5 shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Novo Procedimento
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                        <th className="py-2.5 px-3 sm:px-4 text-left">Procedimento</th>
                        <th className="py-2.5 px-3 text-center">Dente</th>
                        <th className="py-2.5 px-3 text-center">Estado</th>
                        <th className="py-2.5 px-3 sm:px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {procedimentosFiltrados.map((proc) => (
                        <tr key={proc.id} className="hover:bg-muted/30 transition-colors">
                          {/* Coluna Procedimento */}
                          <td className="py-3 px-3 sm:px-4 font-medium text-foreground">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground truncate max-w-[220px] sm:max-w-xs">
                                {proc.nome}
                              </span>
                              {proc.faces && proc.faces.length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  Faces: {proc.faces.join(', ')}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Coluna Dente */}
                          <td className="py-3 px-3 text-center font-bold text-foreground">
                            {proc.dente}
                          </td>

                          {/* Coluna Estado (Badges interativos) */}
                          <td className="py-3 px-3 text-center">
                            {proc.estado === 'a_realizar' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProcParaConcluir(proc);
                                  setIsModalMarcarRealizadoOpen(true);
                                }}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 hover:opacity-85 transition-opacity"
                                title="Clique para marcar como realizado"
                              >
                                A realizar
                              </button>
                            )}

                            {proc.estado === 'iniciado' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProcParaConcluir(proc);
                                  setIsModalMarcarRealizadoOpen(true);
                                }}
                                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 hover:opacity-85 transition-opacity"
                                title="Clique para marcar como realizado"
                              >
                                Iniciado
                              </button>
                            )}

                            {proc.estado === 'realizado' && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Realizado em{' '}
                                {proc.dataRealizado
                                  ? format(new Date(proc.dataRealizado), 'dd/MM/yyyy')
                                  : 'Concluído'}
                              </span>
                            )}

                            {proc.estado === 'pre_existente' && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                Pré-existente
                              </span>
                            )}
                          </td>

                          {/* Coluna Ações (Link Orçamento + Botão 3 Pontos com Menu) */}
                          <td className="py-3 px-3 sm:px-4 text-right">
                            <div className="flex items-center justify-end gap-2.5">
                              {proc.orcamentoId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onTabChange) onTabChange('orcamentos');
                                    else {
                                      setModalDetalhesProc({ proc, modo: 'debito' });
                                    }
                                  }}
                                  className="text-purple-700 dark:text-purple-400 font-semibold text-xs hover:underline cursor-pointer"
                                >
                                  Orçamento
                                </button>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}

                              {/* Dropdown Menu (Conforme Imagem 4) */}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-7 w-7 rounded-md border-border text-foreground hover:bg-muted"
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 text-xs">
                                  <DropdownMenuItem
                                    onClick={() => setModalDetalhesProc({ proc, modo: 'debito' })}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Eye className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                                    <span>Visualizar débito</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setModalDetalhesProc({ proc, modo: 'detalhes' })
                                    }
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Eye className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                                    <span>Visualizar detalhes do procedimento</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setProcEmEdicao(proc);
                                      setIsModalNovoProcOpen(true);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Pencil className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                                    <span>Editar procedimento</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteProcedimento(proc)}
                                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    <span>Excluir procedimento</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUNA DIREITA: Anotações Clínicas do Paciente                            */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Anotações</h3>
              {anotacoes.length > 0 && (
                <span className="text-xs text-muted-foreground font-semibold">
                  {anotacoes.length} {anotacoes.length === 1 ? 'nota' : 'notas'}
                </span>
              )}
            </div>

            {/* Conteúdo das Anotações */}
            {anotacoes.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                O paciente não possui anotações adicionadas.
              </p>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
                {anotacoes.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-border bg-muted/30 space-y-1.5 relative group hover:border-purple-500/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span>{item.autor}</span>
                      <span>
                        {item.data ? format(new Date(item.data), "dd/MM/yyyy 'às' HH:mm") : ''}
                      </span>
                    </div>
                    <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                      {item.texto}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDeleteAnotacao(item.id)}
                      className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Excluir anotação"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Botão + Adicionar Anotação */}
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalAnotacaoOpen(true)}
                className="w-full h-9 text-xs font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg gap-1.5 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar anotação
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAIS (Novo Procedimento, Marcar Realizado, Detalhes/Débito, Anotação)    */}
      {/* ========================================================================= */}
      <ModalNovoProcedimento
        isOpen={isModalNovoProcOpen}
        onClose={() => {
          setIsModalNovoProcOpen(false);
          setProcEmEdicao(null);
        }}
        onSave={handleSaveProcedimento}
        pacienteId={patient?.id}
        denteInicial={selectedDente}
        procedimentoEmEdicao={procEmEdicao}
      />

      <ModalMarcarRealizado
        isOpen={isModalMarcarRealizadoOpen}
        onClose={() => {
          setIsModalMarcarRealizadoOpen(false);
          setProcParaConcluir(null);
        }}
        onConfirmar={handleConfirmarConclusao}
        procedimentoNome={procParaConcluir?.nome}
      />

      <ModalDetalhesProcedimento
        isOpen={Boolean(modalDetalhesProc)}
        onClose={() => setModalDetalhesProc(null)}
        procedimento={modalDetalhesProc?.proc || null}
        modo={modalDetalhesProc?.modo || 'detalhes'}
        onMarcarRealizado={(proc) => {
          setProcParaConcluir(proc);
          setIsModalMarcarRealizadoOpen(true);
        }}
        onAbrirOrcamento={(orcId) => {
          if (onTabChange) onTabChange('orcamentos');
        }}
      />

      <ModalAnotacao
        isOpen={isModalAnotacaoOpen}
        onClose={() => setIsModalAnotacaoOpen(false)}
        onSave={handleSaveAnotacao}
      />
    </div>
  );
};

export default PatientEtapasTratamento;

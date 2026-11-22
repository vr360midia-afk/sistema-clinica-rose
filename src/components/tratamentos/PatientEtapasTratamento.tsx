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
  ArrowRight,
  FileSignature,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useTratamentos } from '@/hooks/useTratamentos';
import { useOrcamentos, OrcamentoItem } from '@/hooks/useOrcamentos';
import {
  OdontogramaVisual,
  DenticaoTipo,
  EstadoProcedimentoVisual,
} from './OdontogramaVisual';
import { ModalNovoProcedimento, ProcedimentoItemData, FotoProcedimento } from './ModalNovoProcedimento';
import { ModalMarcarRealizado, DadosConclusaoProcedimento } from './ModalMarcarRealizado';
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
  const { orcamentos, saveOrcamento } = useOrcamentos(patient?.id);

  // Estado da Dentição
  const [denticao, setDenticao] = useState<DenticaoTipo>('permanente');

  // Dentes selecionados no odontograma (seleção múltipla e individual)
  const [selectedDentes, setSelectedDentes] = useState<string[]>([]);
  const [presetTipoModal, setPresetTipoModal] = useState<'lentes' | 'carie' | null>(null);
  const [isGerandoOrcamento, setIsGerandoOrcamento] = useState(false);

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
  const [anotacaoEmEdicao, setAnotacaoEmEdicao] = useState<AnotacaoItem | null>(null);
  const [textoAnotacaoRapida, setTextoAnotacaoRapida] = useState('');

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
      const textoObservacoes = novasAnotacoes.length > 0
        ? novasAnotacoes.map((a) => a.texto).join('\n\n')
        : patient?.observacoes;

      await updatePaciente(patient.id, {
        odontograma: payload,
        observacoes: textoObservacoes,
      });
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

  // Extrai lista de dentes envolvidos no procedimento
  const extrairDentesProcedimento = (p: ProcedimentoItemData): string[] => {
    if (Array.isArray(p.dentes) && p.dentes.length > 0) {
      return p.dentes;
    }
    if (!p.dente || p.dente === 'Geral / Arcada') return [];
    const matches = p.dente.match(/\b(1[1-8]|2[1-8]|3[1-8]|4[1-8]|5[1-5]|6[1-5]|7[1-5]|8[1-5])\b/g);
    if (matches && matches.length > 0) {
      return matches;
    }
    const numDente = p.dente.replace(/\D/g, '');
    return numDente ? [numDente] : [];
  };

  // Mapa de status por dente para colorir o Odontograma anatômico
  const dentesStatus = useMemo(() => {
    const statusMap: Record<string, EstadoProcedimentoVisual> = {};

    procedimentosUnificados.forEach((p) => {
      const dentes = extrairDentesProcedimento(p);
      dentes.forEach((numDente) => {
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

      // Filtro por Dentes Selecionados no Odontograma (se houver dentes selecionados)
      if (selectedDentes.length > 0) {
        const pDentes = extrairDentesProcedimento(p);
        const temIntersecao = selectedDentes.some((d) => pDentes.includes(d));
        if (!temIntersecao) return false;
      }

      // Filtro por Tipo / Categoria
      if (tipoFiltro !== 'todos') {
        if ((p.categoria || 'Geral') !== tipoFiltro) return false;
      }

      return true;
    });
  }, [procedimentosUnificados, filtroAtivo, selectedDentes, tipoFiltro]);

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

  // Procedimentos da Ficha que entram no orçamento (a realizar, iniciado ou com valor definido)
  const procedimentosOrcaveis = useMemo(() => {
    return procedimentosUnificados.filter((p) => {
      if (p.estado === 'pre_existente' && (!p.valor || p.valor <= 0)) return false;
      return true;
    });
  }, [procedimentosUnificados]);

  // Subtotal acumulado dos procedimentos da ficha
  const valorTotalOrcamento = useMemo(() => {
    return procedimentosOrcaveis.reduce((sum, p) => sum + (Number(p.valor) || 0), 0);
  }, [procedimentosOrcaveis]);

  // Orçamento em rascunho ativo do paciente (se houver)
  const rascunhoAtivo = useMemo(() => {
    return orcamentos.find((o) => o.status === 'rascunho') || null;
  }, [orcamentos]);

  // Sincroniza dinamicamente o rascunho do orçamento conforme procedimentos são colocados na ficha
  const sincronizarRascunhoOrcamento = async (procs: ProcedimentoItemData[]) => {
    if (!saveOrcamento || !patient?.id) return;

    const orcaveis = procs.filter((p) => {
      if (p.estado === 'pre_existente' && (!p.valor || p.valor <= 0)) return false;
      return true;
    });

    if (orcaveis.length === 0) return;

    const itens: OrcamentoItem[] = orcaveis.map((p) => {
      let denteTexto = '';
      if (p.dentes && p.dentes.length > 1) {
        denteTexto = ` (${p.dentes.length} dentes: ${p.dentes.join(', ')})`;
      } else if (p.dente && p.dente !== 'Geral / Arcada') {
        denteTexto = ` (Dente ${p.dente})`;
      }
      const facesTexto = p.faces && p.faces.length > 0 ? ` [Faces: ${p.faces.join(', ')}]` : '';

      return {
        nome: `${p.nome}${denteTexto}${facesTexto}`,
        quantidade: 1,
        valor: Number(p.valor || 0),
      };
    });

    const total = itens.reduce((acc, i) => acc + (i.valor || 0) * (i.quantidade || 1), 0);
    const rascunho = orcamentos.find((o) => o.status === 'rascunho');

    try {
      await saveOrcamento({
        id: rascunho?.id || undefined,
        pacienteId: patient.id,
        pacienteNome: patient.nome,
        titulo: `Plano de Tratamento - ${patient.nome || 'Paciente'}`,
        status: 'rascunho',
        itens,
        desconto: rascunho?.desconto || 0,
        total: Math.max(0, total - (rascunho?.desconto || 0)),
        observacoes: `Orçamento gerado e atualizado dinamicamente pela Ficha do Paciente.`,
      });
    } catch (err) {
      console.warn('Erro ao sincronizar rascunho de orçamento:', err);
    }
  };

  // Gerar Orçamento Oficial e Migrar para a aba Orçamentos
  const handleGerarEMigrarOrcamento = async () => {
    if (procedimentosOrcaveis.length === 0) {
      if (onTabChange) onTabChange('orcamentos');
      return;
    }

    setIsGerandoOrcamento(true);
    try {
      const itens: OrcamentoItem[] = procedimentosOrcaveis.map((p) => {
        let denteTexto = '';
        if (p.dentes && p.dentes.length > 1) {
          denteTexto = ` (${p.dentes.length} dentes: ${p.dentes.join(', ')})`;
        } else if (p.dente && p.dente !== 'Geral / Arcada') {
          denteTexto = ` (Dente ${p.dente})`;
        }
        const facesTexto = p.faces && p.faces.length > 0 ? ` [Faces: ${p.faces.join(', ')}]` : '';

        return {
          nome: `${p.nome}${denteTexto}${facesTexto}`,
          quantidade: 1,
          valor: Number(p.valor || 0),
        };
      });

      const total = itens.reduce((acc, i) => acc + (i.valor || 0) * (i.quantidade || 1), 0);
      const rascunho = orcamentos.find((o) => o.status === 'rascunho');

      let savedId: string | undefined;
      if (saveOrcamento) {
        savedId = await saveOrcamento({
          id: rascunho?.id || undefined,
          pacienteId: patient?.id,
          pacienteNome: patient?.nome,
          titulo: `Plano de Tratamento - ${patient?.nome || 'Paciente'}`,
          status: 'rascunho',
          itens,
          desconto: rascunho?.desconto || 0,
          total: Math.max(0, total - (rascunho?.desconto || 0)),
          observacoes: `Orçamento gerado a partir da Ficha do Paciente em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}.`,
        });
      }

      const idFinal = savedId || rascunho?.id;
      if (idFinal) {
        // Vincula orcamento aos procedimentos locais
        const vinculados = procedimentosLocais.map((p) => ({
          ...p,
          orcamentoId: idFinal,
          orcamentoTitulo: `Plano de Tratamento - ${patient?.nome || 'Paciente'}`,
        }));
        setProcedimentosLocais(vinculados);
        salvarNoPaciente(vinculados, anotacoes);

        // Marca para auto-abertura na tela de orçamentos
        try {
          sessionStorage.setItem('auto_open_orcamento_id', idFinal);
        } catch (_) {}
      }

      toast.success('Orçamento gerado com sucesso! Abrindo tela de Orçamentos...');
      if (onTabChange) {
        setTimeout(() => {
          onTabChange('orcamentos');
        }, 200);
      }
    } catch (err) {
      console.error('Erro ao gerar orçamento:', err);
      toast.error('Erro ao salvar orçamento. Abrindo tela de Orçamentos...');
      if (onTabChange) onTabChange('orcamentos');
    } finally {
      setIsGerandoOrcamento(false);
    }
  };

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

    // Conforme for sendo colocado na ficha do paciente, já vai gerando/sincronizando o orçamento
    sincronizarRascunhoOrcamento(atualizados);
  };

  // Excluir Procedimento
  const handleDeleteProcedimento = (item: ProcedimentoItemData) => {
    const confirmou = window.confirm(`Deseja realmente excluir o procedimento "${item.nome}"?`);
    if (!confirmou) return;

    const filtrados = procedimentosLocais.filter((p) => p.id !== item.id);
    setProcedimentosLocais(filtrados);
    salvarNoPaciente(filtrados, anotacoes);
    toast.success('Procedimento excluído com sucesso.');

    // Sincroniza orçamento
    sincronizarRascunhoOrcamento(filtrados);
  };

  // Concluir Procedimento (Marcar como realizado com data, observações e fotos)
  const handleConfirmarConclusao = async (dados: DadosConclusaoProcedimento | string) => {
    if (!procParaConcluir) return;

    const dataConclusao = typeof dados === 'string' ? dados : dados.dataConclusao;
    const observacoesConclusao = typeof dados === 'string' ? undefined : dados.observacoesConclusao;
    const fotosConclusao = typeof dados === 'string' ? undefined : dados.fotosConclusao;

    const id = procParaConcluir.id;
    // Se for um procedimento estruturado do useTratamentos, atualiza via serviço também
    try {
      if (concluirProcedimento) {
        await concluirProcedimento(id, dataConclusao);
      }
    } catch (_) {}

    const mesclarFotos = (existentes: FotoProcedimento[] = [], novas: FotoProcedimento[] = []) => {
      const ids = new Set(existentes.map((f) => f.id));
      const complementares = novas.filter((f) => !ids.has(f.id));
      return [...existentes, ...complementares];
    };

    const atualizados = procedimentosLocais.map((p) => {
      if (p.id === id) {
        const obsFinal = observacoesConclusao
          ? p.observacoes
            ? `${p.observacoes}\n\n[Conclusão]: ${observacoesConclusao}`
            : `[Conclusão]: ${observacoesConclusao}`
          : p.observacoes;

        return {
          ...p,
          estado: 'realizado' as EstadoProcedimentoVisual,
          dataRealizado: dataConclusao,
          observacoes: obsFinal,
          observacoesConclusao: observacoesConclusao || p.observacoesConclusao,
          fotos: fotosConclusao && fotosConclusao.length > 0 ? mesclarFotos(p.fotos, fotosConclusao) : p.fotos,
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
            observacoes: observacoesConclusao || procParaConcluir.observacoes,
            observacoesConclusao,
            fotos: fotosConclusao || procParaConcluir.fotos,
          },
        ];

    setProcedimentosLocais(listaFinal);
    salvarNoPaciente(listaFinal, anotacoes);
    setProcParaConcluir(null);
    toast.success('Procedimento marcado como Realizado com sucesso!');
  };

  // Salvar Anotação (Cria ou Atualiza)
  const handleSaveAnotacao = (item: AnotacaoItem) => {
    let atualizadas: AnotacaoItem[];
    const existe = anotacoes.some((a) => a.id === item.id);
    if (existe) {
      atualizadas = anotacoes.map((a) => (a.id === item.id ? item : a));
      toast.success('Anotação atualizada com sucesso!');
    } else {
      atualizadas = [item, ...anotacoes];
      toast.success('Anotação adicionada à Ficha do Paciente!');
    }

    setAnotacoes(atualizadas);
    salvarNoPaciente(procedimentosLocais, atualizadas);
    setAnotacaoEmEdicao(null);
  };

  // Salvar Anotação rápida digitada diretamente no painel
  const handleSalvarAnotacaoRapida = () => {
    if (!textoAnotacaoRapida.trim()) return;
    const novaAnotacao: AnotacaoItem = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      texto: textoAnotacaoRapida.trim(),
      data: new Date().toISOString(),
      autor: 'Profissional',
    };
    handleSaveAnotacao(novaAnotacao);
    setTextoAnotacaoRapida('');
  };

  // Excluir Anotação
  const handleDeleteAnotacao = (id: string) => {
    const confirmou = window.confirm('Deseja realmente remover esta anotação da ficha?');
    if (!confirmou) return;

    const atualizadas = anotacoes.filter((a) => a.id !== id);
    setAnotacoes(atualizadas);
    salvarNoPaciente(procedimentosLocais, atualizadas);
    toast.success('Anotação removida.');
  };

  // Alterna seleção de dente no Odontograma (individual ou múltiplo)
  const handleToggleSelectDente = (numeroDente: string) => {
    setSelectedDentes((prev) =>
      prev.includes(numeroDente) ? prev.filter((d) => d !== numeroDente) : [...prev, numeroDente]
    );
  };

  const handleSelectMultiplosDentes = (dentes: string[]) => {
    setSelectedDentes(dentes);
  };

  const handleLimparSelecaoDentes = () => {
    setSelectedDentes([]);
  };

  // Ação rápida: Lentes em Resina
  const handleColocarLentes = (dentes: string[]) => {
    setProcEmEdicao(null);
    setPresetTipoModal('lentes');
    setSelectedDentes(dentes);
    setIsModalNovoProcOpen(true);
  };

  // Ação rápida: Cáries / Restaurações
  const handleColocarCaries = (dentes: string[]) => {
    setProcEmEdicao(null);
    setPresetTipoModal('carie');
    setSelectedDentes(dentes);
    setIsModalNovoProcOpen(true);
  };

  // Título da tabela
  const tituloFicha = useMemo(() => {
    const f = FILTROS_PILL.find((item) => item.id === filtroAtivo);
    const base = f ? f.label : 'Ficha Geral';
    if (selectedDentes.length === 1) {
      return `${base} — Dente ${selectedDentes[0]}`;
    }
    if (selectedDentes.length > 1) {
      return `${base} — ${selectedDentes.length} dentes selecionados (${selectedDentes.join(', ')})`;
    }
    return base;
  }, [filtroAtivo, selectedDentes]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Layout Principal: Coluna da Esquerda (Odontograma + Tabela) e Coluna da Direita (Anotações) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* ========================================================================= */}
        {/* COLUNA ESQUERDA: Odontograma, Filtros e Tabela de Procedimentos           */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Odontograma Visual Anatômico com suporte a seleção múltipla */}
          <OdontogramaVisual
            denticao={denticao}
            onToggleDenticao={handleToggleDenticao}
            selectedDentes={selectedDentes}
            onToggleSelectDente={handleToggleSelectDente}
            onSelectMultiplosDentes={handleSelectMultiplosDentes}
            onLimparSelecao={handleLimparSelecaoDentes}
            dentesStatus={dentesStatus}
            onNovoProcedimento={(dentesPre) => {
              setProcEmEdicao(null);
              setPresetTipoModal(null);
              if (dentesPre && dentesPre.length > 0) {
                setSelectedDentes(dentesPre);
              }
              setIsModalNovoProcOpen(true);
            }}
            onColocarLentes={handleColocarLentes}
            onColocarCaries={handleColocarCaries}
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

              {selectedDentes.length > 0 && (
                <button
                  type="button"
                  onClick={handleLimparSelecaoDentes}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0 ml-auto cursor-pointer"
                  title="Limpar seleção de dentes"
                >
                  <X className="h-3 w-3" />
                  <span>
                    {selectedDentes.length === 1
                      ? `Dente ${selectedDentes[0]}`
                      : `${selectedDentes.length} dentes`}
                  </span>
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

              {/* Botões de Ação: Adicionar Anotação e Gerar Orçamento */}
              <div className="flex items-center gap-2 justify-end flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAnotacaoEmEdicao(null);
                    setIsModalAnotacaoOpen(true);
                  }}
                  className="h-8.5 px-3 text-xs font-semibold border-purple-400/60 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 rounded-lg gap-1.5 shadow-2xs"
                  title="Adicionar anotação clínica na Ficha Geral"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>+ Anotação na Ficha</span>
                </Button>

                <Button
                  type="button"
                  disabled={isGerandoOrcamento}
                  onClick={handleGerarEMigrarOrcamento}
                  className="h-8.5 px-3.5 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-lg gap-1.5 shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
                  title="Gerar orçamento a partir dos procedimentos cadastrados e migrar para a tela de Orçamentos"
                >
                  <FileText className="h-3.5 w-3.5 text-purple-200" />
                  <span>
                    {isGerandoOrcamento
                      ? 'Gerando...'
                      : procedimentosOrcaveis.length > 0
                      ? `Gerar Orçamento (${procedimentosOrcaveis.length} • R$ ${valorTotalOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`
                      : 'Gerar Orçamento'}
                  </span>
                  <ArrowRight className="h-3 w-3 opacity-80" />
                </Button>
              </div>
            </div>

            {/* Banner Dinâmico: O que for sendo colocado na Ficha já vai acumulando no Orçamento */}
            {procedimentosOrcaveis.length > 0 && (
              <div className="bg-gradient-to-r from-purple-50/90 via-purple-100/50 to-purple-50/90 dark:from-purple-950/40 dark:via-purple-900/20 dark:to-purple-950/40 border border-purple-200/90 dark:border-purple-800/60 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-purple-950 dark:text-purple-200">
                        Orçamento do Plano de Tratamento em Elaboração
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
                        {procedimentosOrcaveis.length} {procedimentosOrcaveis.length === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Total acumulado na ficha:{' '}
                      <strong className="text-foreground font-bold text-xs sm:text-sm text-purple-700 dark:text-purple-300">
                        R$ {valorTotalOrcamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="hidden sm:inline text-muted-foreground/80"> • Clique para migrar e definir condições de pagamento</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    disabled={isGerandoOrcamento}
                    onClick={handleGerarEMigrarOrcamento}
                    className="w-full sm:w-auto h-8 px-3.5 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-lg gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>{isGerandoOrcamento ? 'Gerando...' : 'Migrar para Orçamentos'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

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
                          <td className="py-3 px-3 text-center">
                            {proc.dentes && proc.dentes.length > 1 ? (
                              <div className="flex flex-col items-center">
                                <span className="font-bold text-foreground text-xs">
                                  {proc.dentes.length} dentes
                                </span>
                                <span
                                  className="text-[10px] text-purple-700 dark:text-purple-300 font-medium max-w-[130px] truncate"
                                  title={proc.dentes.join(', ')}
                                >
                                  {proc.dentes.join(', ')}
                                </span>
                              </div>
                            ) : (
                              <span className="font-bold text-foreground text-xs">{proc.dente}</span>
                            )}
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
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">Anotações</h3>
                {anotacoes.length > 0 && (
                  <span className="text-xs text-muted-foreground font-semibold">
                    {anotacoes.length} {anotacoes.length === 1 ? 'nota' : 'notas'}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAnotacaoEmEdicao(null);
                  setIsModalAnotacaoOpen(true);
                }}
                className="h-7 px-2.5 text-[11px] font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-md gap-1"
                title="Adicionar anotação na ficha clínica"
              >
                <Plus className="h-3 w-3" />
                <span>Adicionar anotação</span>
              </Button>
            </div>

            {/* Inserção Rápida de Anotação sem abrir Modal */}
            <div className="space-y-1.5 p-2.5 rounded-lg border border-purple-200/80 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20">
              <textarea
                value={textoAnotacaoRapida}
                onChange={(e) => setTextoAnotacaoRapida(e.target.value)}
                placeholder="Escreva uma anotação rápida na ficha..."
                rows={2}
                className="w-full text-xs p-2 rounded-md border border-border bg-background focus:ring-1 focus:ring-purple-600 outline-none resize-none leading-relaxed"
              />
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  disabled={!textoAnotacaoRapida.trim()}
                  onClick={handleSalvarAnotacaoRapida}
                  className="h-7 px-3 text-[11px] font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-md gap-1 shadow-2xs"
                >
                  <Plus className="h-3 w-3" />
                  Salvar Nota
                </Button>
              </div>
            </div>

            {/* Conteúdo das Anotações */}
            {anotacoes.length === 0 ? (
              <p className="text-xs text-muted-foreground leading-relaxed py-2">
                O paciente não possui anotações adicionadas. Use o campo acima para adicionar anotações clínicas na ficha geral.
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
                    <p className="text-xs text-foreground whitespace-pre-line leading-relaxed pr-8">
                      {item.texto}
                    </p>
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => {
                          setAnotacaoEmEdicao(item);
                          setIsModalAnotacaoOpen(true);
                        }}
                        className="p-1 text-muted-foreground hover:text-purple-600 rounded transition-colors"
                        title="Editar anotação"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAnotacao(item.id)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                        title="Excluir anotação"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
          setPresetTipoModal(null);
        }}
        onSave={handleSaveProcedimento}
        pacienteId={patient?.id}
        dentesIniciais={selectedDentes}
        procedimentoEmEdicao={procEmEdicao}
        presetTipo={presetTipoModal}
      />

      <ModalMarcarRealizado
        isOpen={isModalMarcarRealizadoOpen}
        onClose={() => {
          setIsModalMarcarRealizadoOpen(false);
          setProcParaConcluir(null);
        }}
        onConfirmar={handleConfirmarConclusao}
        procedimentoNome={procParaConcluir?.nome}
        procedimentoDente={procParaConcluir?.dente}
        pacienteId={patient?.id}
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
        onClose={() => {
          setIsModalAnotacaoOpen(false);
          setAnotacaoEmEdicao(null);
        }}
        onSave={handleSaveAnotacao}
        anotacaoEmEdicao={anotacaoEmEdicao}
      />
    </div>
  );
};

export default PatientEtapasTratamento;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useDentistas } from '@/hooks/useDentistas';
import { EstadoProcedimentoVisual } from './OdontogramaVisual';
import { Procedimento, CategoriaProcedimento } from '@/types/procedimentos';
import {
  Sparkles,
  AlertCircle,
  X,
  Plus,
  Calculator,
  Layers,
  FileText,
  Camera,
  UploadCloud,
  Loader2,
  DollarSign,
  User,
  Check,
  Search,
  ChevronsUpDown,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface FotoProcedimento {
  id: string;
  url: string;
  nome?: string;
  data?: string;
  tipo?: string;
}

export interface ProcedimentoItemData {
  id: string;
  nome: string;
  categoria?: string;
  dente: string;
  dentes?: string[];
  faces?: string[];
  estado: EstadoProcedimentoVisual;
  valor?: number;
  valorUnitario?: number;
  profissional?: string;
  orcamentoId?: string;
  orcamentoTitulo?: string;
  dataRealizado?: string;
  dataPrevista?: string;
  observacoes?: string;
  observacoesConclusao?: string;
  fotos?: FotoProcedimento[];
  criadoEm: string;
}

interface ModalNovoProcedimentoProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (procedimento: ProcedimentoItemData) => void;
  pacienteId: string;
  dentesIniciais?: string[];
  denteInicial?: string | null;
  procedimentoEmEdicao?: ProcedimentoItemData | null;
  presetTipo?: 'lentes' | 'carie' | null;
}

const FACES_OPCOES = [
  { id: 'C', label: 'C' },
  { id: 'D', label: 'D' },
  { id: 'I', label: 'I' },
  { id: 'M', label: 'M' },
  { id: 'P', label: 'P' },
  { id: 'V', label: 'V' },
];

const DENTES_SUPERIORES = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const DENTES_INFERIORES = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const PRESETS_LENTES_SUPERIOR = ['15', '14', '13', '12', '11', '21', '22', '23', '24', '25'];
const PRESETS_LENTES_INFERIOR = ['45', '44', '43', '42', '41', '31', '32', '33', '34', '35'];

const CATEGORIAS_PROCEDIMENTOS: { id: CategoriaProcedimento; label: string }[] = [
  { id: 'estetico', label: 'Estético' },
  { id: 'cirurgico', label: 'Cirúrgico' },
  { id: 'restaurador', label: 'Restaurador' },
  { id: 'preventivo', label: 'Preventivo' },
  { id: 'endodontico', label: 'Endodôntico (Canal)' },
  { id: 'periodontico', label: 'Periodôntico' },
  { id: 'protese', label: 'Prótese' },
  { id: 'ortodontico', label: 'Ortodôntico' },
  { id: 'emergencia', label: 'Emergência' },
  { id: 'outros', label: 'Outros' },
];

const formatMoneyDisplay = (valor?: number | null) => {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const ModalNovoProcedimento: React.FC<ModalNovoProcedimentoProps> = ({
  isOpen,
  onClose,
  onSave,
  pacienteId,
  dentesIniciais,
  denteInicial,
  procedimentoEmEdicao,
  presetTipo,
}) => {
  const { procedimentos: catalogoProcedimentos, addProcedimento } = useProcedimentos();
  const { orcamentos, saveOrcamento } = useOrcamentos(pacienteId);
  const { dentistas } = useDentistas();

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Geral');
  const [dentesSelecionados, setDentesSelecionados] = useState<string[]>([]);
  const [faces, setFaces] = useState<string[]>([]);
  const [estado, setEstado] = useState<EstadoProcedimentoVisual>('a_realizar');
  const [gerarLancamentoFinanceiro, setGerarLancamentoFinanceiro] = useState(true);
  const [valorUnitario, setValorUnitario] = useState<string>('');
  const [valorTotal, setValorTotal] = useState<string>('');
  const [profissional, setProfissional] = useState('Dra. Roseane');
  const [orcamentoId, setOrcamentoId] = useState<string>('nenhum');
  const [dataPrevista, setDataPrevista] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [isCriandoOrcamento, setIsCriandoOrcamento] = useState(false);
  const [fotos, setFotos] = useState<FotoProcedimento[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  // Estados da Busca no Catálogo (Dropdown estilo Orçamentos)
  const [buscaProcedimento, setBuscaProcedimento] = useState('');
  const [openBuscaProcedimento, setOpenBuscaProcedimento] = useState(false);
  const [selectedProcedimentoIndex, setSelectedProcedimentoIndex] = useState(0);
  const inputBuscaRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Estados para Cadastrar Novo Procedimento no Catálogo
  const [modalNovoCatalogoOpen, setModalNovoCatalogoOpen] = useState(false);
  const [novoProcNome, setNovoProcNome] = useState('');
  const [novoProcCategoria, setNovoProcCategoria] = useState<CategoriaProcedimento>('estetico');
  const [novoProcPreco, setNovoProcPreco] = useState('');
  const [novoProcDuracao, setNovoProcDuracao] = useState('60');
  const [isSalvandoCatalogo, setIsSalvandoCatalogo] = useState(false);

  // Inicialização do formulário
  useEffect(() => {
    if (procedimentoEmEdicao) {
      setNome(procedimentoEmEdicao.nome || '');
      setBuscaProcedimento(procedimentoEmEdicao.nome || '');
      setCategoria(procedimentoEmEdicao.categoria || 'Geral');
      const dArray =
        procedimentoEmEdicao.dentes && procedimentoEmEdicao.dentes.length > 0
          ? procedimentoEmEdicao.dentes
          : procedimentoEmEdicao.dente
            ? procedimentoEmEdicao.dente.split(',').map((s) => s.trim()).filter(Boolean)
            : ['16'];
      setDentesSelecionados(dArray);
      setFaces(procedimentoEmEdicao.faces || []);
      setEstado(procedimentoEmEdicao.estado || 'a_realizar');
      setValorTotal(procedimentoEmEdicao.valor ? String(procedimentoEmEdicao.valor) : '');
      setValorUnitario(procedimentoEmEdicao.valorUnitario ? String(procedimentoEmEdicao.valorUnitario) : '');
      setProfissional(procedimentoEmEdicao.profissional || 'Dra. Roseane');
      setGerarLancamentoFinanceiro(Boolean(procedimentoEmEdicao.valor || procedimentoEmEdicao.orcamentoId));
      setOrcamentoId(procedimentoEmEdicao.orcamentoId || 'nenhum');
      setDataPrevista(procedimentoEmEdicao.dataPrevista || '');
      setObservacoes(procedimentoEmEdicao.observacoes || '');
      setFotos(procedimentoEmEdicao.fotos || []);
    } else {
      let dPadrao: string[] = [];
      if (dentesIniciais && dentesIniciais.length > 0) {
        dPadrao = [...dentesIniciais];
      } else if (denteInicial) {
        dPadrao = [denteInicial];
      } else {
        dPadrao = ['16'];
      }
      setDentesSelecionados(dPadrao);
      setFotos([]);
      setProfissional('Dra. Roseane');
      setGerarLancamentoFinanceiro(true);

      if (presetTipo === 'lentes') {
        const qtd = dPadrao.length;
        const nomePreset = `Lentes em Resina Composta (${qtd} dentes)`;
        setNome(nomePreset);
        setBuscaProcedimento(nomePreset);
        setCategoria('Estético / Lentes');
        setFaces(['V', 'I']);
        setEstado('a_realizar');
        setValorUnitario('800');
        setValorTotal(String(800 * qtd));
        setObservacoes(`Planejamento de Lentes/Facetas em Resina nos dentes ${dPadrao.join(', ')}.`);
      } else if (presetTipo === 'carie') {
        const qtd = dPadrao.length;
        const nomePreset =
          qtd > 1
            ? `Tratamento de Cáries / Restaurações (${qtd} dentes)`
            : `Restauração em Resina (Cárie) - Dente ${dPadrao[0] || '16'}`;
        setNome(nomePreset);
        setBuscaProcedimento(nomePreset);
        setCategoria('Restaurador');
        setFaces(['I']);
        setEstado('a_realizar');
        setValorUnitario('250');
        setValorTotal(String(250 * qtd));
        setObservacoes(`Remoção de tecido cariado e restauração estética nos dentes ${dPadrao.join(', ')}.`);
      } else {
        setNome('');
        setBuscaProcedimento('');
        setCategoria('Geral');
        setFaces([]);
        setEstado('a_realizar');
        setValorUnitario('');
        setValorTotal('');
        setObservacoes('');
      }

      setOrcamentoId('nenhum');
      setDataPrevista(new Date().toISOString().split('T')[0]);
    }
  }, [procedimentoEmEdicao, dentesIniciais, denteInicial, presetTipo, isOpen]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputBuscaRef.current &&
        !inputBuscaRef.current.contains(e.target as Node)
      ) {
        setOpenBuscaProcedimento(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Procedimentos filtrados em tempo real
  const procedimentosFiltrados = useMemo(() => {
    const lista = catalogoProcedimentos || [];
    if (!buscaProcedimento.trim()) return lista;
    const termo = buscaProcedimento.toLowerCase().trim();
    return lista.filter((p) => {
      const nomeMatch = p.nome.toLowerCase().includes(termo);
      const catMatch = p.categoria && p.categoria.toLowerCase().includes(termo);
      return nomeMatch || catMatch;
    });
  }, [catalogoProcedimentos, buscaProcedimento]);

  // Recalcula valor total automaticamente quando altera valor unitário ou quantidade de dentes
  const handleValorUnitarioChange = (valStr: string) => {
    setValorUnitario(valStr);
    const unit = parseFloat(valStr.replace(',', '.'));
    if (!isNaN(unit) && unit >= 0) {
      const qtd = Math.max(1, dentesSelecionados.length);
      setValorTotal((unit * qtd).toFixed(2).replace(/\.00$/, ''));
    }
  };

  const toggleDente = (d: string) => {
    let novos: string[];
    if (dentesSelecionados.includes(d)) {
      if (dentesSelecionados.length === 1) return; // Mantém pelo menos um dente
      novos = dentesSelecionados.filter((item) => item !== d);
    } else {
      novos = [...dentesSelecionados, d];
    }
    setDentesSelecionados(novos);

    const unit = parseFloat(valorUnitario.replace(',', '.'));
    if (!isNaN(unit) && unit > 0) {
      setValorTotal((unit * novos.length).toFixed(2).replace(/\.00$/, ''));
    }
  };

  const toggleFace = (f: string) => {
    if (faces.includes(f)) {
      setFaces(faces.filter((item) => item !== f));
    } else {
      setFaces([...faces, f]);
    }
  };

  // Seleção de procedimento da lista do catálogo
  const handleSelectProcedimento = (p: Procedimento) => {
    setNome(p.nome);
    setBuscaProcedimento(p.nome);
    setCategoria(p.categoria || 'Geral');
    if (p.preco !== undefined && p.preco !== null && p.preco > 0) {
      handleValorUnitarioChange(String(p.preco));
    }
    setOpenBuscaProcedimento(false);
    toast.success(`Procedimento "${p.nome}" selecionado!`);
  };

  // Abrir modal de cadastro de novo procedimento no catálogo
  const handleAbrirCriarNovoProcedimento = (sugestaoNome?: string) => {
    setNovoProcNome(sugestaoNome || buscaProcedimento.trim());
    setNovoProcCategoria('estetico');
    setNovoProcPreco(valorUnitario || '');
    setNovoProcDuracao('60');
    setModalNovoCatalogoOpen(true);
  };

  // Salvar novo procedimento permanentemente no Supabase através do hook useProcedimentos
  const handleSalvarNovoNoCatalogo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoProcNome.trim()) {
      toast.error('Informe o nome do procedimento.');
      return;
    }

    setIsSalvandoCatalogo(true);
    try {
      const precoNum = parseFloat(novoProcPreco.replace(',', '.')) || 0;
      const duracaoNum = parseInt(novoProcDuracao) || 30;

      await addProcedimento({
        nome: novoProcNome.trim(),
        categoria: novoProcCategoria,
        preco: precoNum,
        duracaoMinutos: duracaoNum,
        complexidade: 'baixa',
        requererAnestesia: false,
        requererRaioX: false,
        materiaisNecessarios: [],
        equipamentosNecessarios: [],
        ativo: true,
        descricao: '',
      });

      // Seleciona automaticamente o novo procedimento no formulário
      setNome(novoProcNome.trim());
      setBuscaProcedimento(novoProcNome.trim());
      setCategoria(novoProcCategoria);
      if (precoNum > 0) {
        handleValorUnitarioChange(String(precoNum));
      }

      setModalNovoCatalogoOpen(false);
      setOpenBuscaProcedimento(false);
      toast.success(`Procedimento "${novoProcNome.trim()}" salvo permanentemente no catálogo e selecionado!`);
    } catch (err: any) {
      console.error('Erro ao salvar novo procedimento no catálogo:', err);
      toast.error('Erro ao cadastrar novo procedimento.');
    } finally {
      setIsSalvandoCatalogo(false);
    }
  };

  const handleGerarNovoOrcamento = async () => {
    if (!saveOrcamento) {
      toast.error('Módulo de orçamentos indisponível no momento.');
      return;
    }
    const tot = parseFloat(valorTotal.replace(',', '.')) || 0;
    const unit = parseFloat(valorUnitario.replace(',', '.')) || (dentesSelecionados.length > 0 ? tot / dentesSelecionados.length : tot);
    const tituloOrcamento = `${nome || 'Tratamento'} (${dentesSelecionados.length} dentes)`;

    setIsCriandoOrcamento(true);
    try {
      await saveOrcamento({
        pacienteId,
        titulo: tituloOrcamento,
        status: 'rascunho',
        itens: [
          {
            nome: `${nome || 'Procedimento'} - Dentes ${dentesSelecionados.join(', ')}`,
            quantidade: dentesSelecionados.length || 1,
            valor: unit,
          },
        ],
        total: tot,
      });
      toast.success('Novo orçamento criado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar orçamento rápido:', err);
      toast.error('Erro ao criar orçamento.');
    } finally {
      setIsCriandoOrcamento(false);
    }
  };

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFoto(true);
    try {
      const novasFotos: FotoProcedimento[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let url = '';
        try {
          const ext = file.name.split('.').pop() || 'jpg';
          const fileName = `${pacienteId || 'geral'}/proc_${Date.now()}_${i}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('documentos-pacientes')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

          if (upErr) throw upErr;

          const { data: urlData } = supabase.storage
            .from('documentos-pacientes')
            .getPublicUrl(fileName);
          url = urlData.publicUrl;
        } catch (storageErr) {
          // Fallback seguro em base64
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        novasFotos.push({
          id: `foto_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          url,
          nome: file.name.replace(/\.[^/.]+$/, ''),
          data: new Date().toISOString(),
          tipo: 'clinica',
        });
      }

      setFotos((prev) => [...prev, ...novasFotos]);
      toast.success(`${novasFotos.length} imagem(ns) adicionada(s)!`);
    } catch (err) {
      console.error('Erro ao anexar foto:', err);
      toast.error('Não foi possível carregar a imagem.');
    } finally {
      setUploadingFoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveFoto = (id: string) => {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nomeFinal = nome.trim() || buscaProcedimento.trim();
    if (!nomeFinal) {
      toast.error('Informe ou selecione o nome do procedimento.');
      return;
    }

    const orc = orcamentos.find((o) => o.id === orcamentoId);
    const dentesOrdenados = [...dentesSelecionados].sort((a, b) => parseInt(a) - parseInt(b));
    const denteFormatado =
      dentesOrdenados.length > 1
        ? `${dentesOrdenados.length} dentes (${dentesOrdenados[0]} ao ${dentesOrdenados[dentesOrdenados.length - 1]})`
        : dentesOrdenados[0] || '16';

    const novo: ProcedimentoItemData = {
      id: procedimentoEmEdicao?.id || `proc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      nome: nomeFinal,
      categoria,
      dente: denteFormatado,
      dentes: dentesOrdenados,
      faces,
      estado,
      valor: gerarLancamentoFinanceiro && valorTotal ? parseFloat(valorTotal.replace(',', '.')) : undefined,
      valorUnitario: gerarLancamentoFinanceiro && valorUnitario ? parseFloat(valorUnitario.replace(',', '.')) : undefined,
      profissional,
      orcamentoId: gerarLancamentoFinanceiro && orcamentoId !== 'nenhum' ? orcamentoId : undefined,
      orcamentoTitulo: orc ? orc.titulo : undefined,
      dataRealizado:
        estado === 'realizado'
          ? procedimentoEmEdicao?.dataRealizado || new Date().toISOString().split('T')[0]
          : undefined,
      dataPrevista: dataPrevista || undefined,
      observacoes: observacoes.trim() || undefined,
      observacoesConclusao: procedimentoEmEdicao?.observacoesConclusao,
      fotos,
      criadoEm: procedimentoEmEdicao?.criadoEm || new Date().toISOString(),
    };

    onSave(novo);
    onClose();
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full flex flex-col bg-background border-l border-border shadow-2xl z-50 overflow-hidden"
        >
          {/* Header do Drawer Lateral */}
          <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between shrink-0 bg-background">
            <SheetTitle className="text-base sm:text-lg font-bold text-foreground">
              {procedimentoEmEdicao ? 'Editar procedimento' : 'Adicionar procedimento'}
            </SheetTitle>
          </div>

          {/* Corpo com Rolagem Lateral Completa */}
          <form
            id="form-procedimento-lateral"
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar"
          >
            {/* 1. ABAS DE ESTADO (Conforme Imagem 2 de Referência) */}
            <div className="grid grid-cols-4 p-1 bg-muted/60 rounded-xl border border-border/80 gap-1 text-center">
              {(
                [
                  { id: 'a_realizar', label: 'A realizar' },
                  { id: 'iniciado', label: 'Iniciado' },
                  { id: 'realizado', label: 'Realizado' },
                  { id: 'pre_existente', label: 'Pré-existente' },
                ] as const
              ).map((est) => {
                const isActive = estado === est.id;
                return (
                  <button
                    key={est.id}
                    type="button"
                    onClick={() => setEstado(est.id)}
                    className={`py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${isActive
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                  >
                    {est.label}
                  </button>
                );
              })}
            </div>

            {/* 2. CARD: GERAR LANÇAMENTO FINANCEIRO (Conforme Imagem 2) */}
            <div
              onClick={() => setGerarLancamentoFinanceiro(!gerarLancamentoFinanceiro)}
              className="border border-border/80 rounded-xl p-3.5 bg-card hover:bg-muted/30 cursor-pointer transition-colors flex items-center justify-between gap-3 shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-foreground block">
                    Gerar lançamento financeiro
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Adicione meios de pagamento e faça a gestão dos valores desse paciente.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={gerarLancamentoFinanceiro}
                onChange={(e) => setGerarLancamentoFinanceiro(e.target.checked)}
                className="h-4.5 w-4.5 rounded border-purple-500 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
            </div>

            {/* 3. CAMPO PROCEDIMENTO - COM COMBOBOX E CATÁLOGO CADASTRADO (IGUAL ORÇAMENTO) */}
            <div className="space-y-1.5 relative">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Procedimento *</Label>
                <button
                  type="button"
                  onClick={() => handleAbrirCriarNovoProcedimento()}
                  className="text-[11px] text-purple-700 dark:text-purple-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Novo no catálogo</span>
                </button>
              </div>

              {/* Input com Busca e Dropdown idêntico ao de Orçamentos */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  ref={inputBuscaRef}
                  value={buscaProcedimento}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBuscaProcedimento(val);
                    setNome(val);
                    setSelectedProcedimentoIndex(0);
                    if (!openBuscaProcedimento) setOpenBuscaProcedimento(true);
                  }}
                  onFocus={() => setOpenBuscaProcedimento(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      if (!openBuscaProcedimento) {
                        setOpenBuscaProcedimento(true);
                      } else {
                        setSelectedProcedimentoIndex((prev) =>
                          Math.min(prev + 1, Math.max(0, procedimentosFiltrados.length - 1))
                        );
                      }
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setSelectedProcedimentoIndex((prev) => Math.max(prev - 1, 0));
                    } else if (e.key === 'Enter') {
                      if (openBuscaProcedimento && procedimentosFiltrados[selectedProcedimentoIndex]) {
                        e.preventDefault();
                        handleSelectProcedimento(procedimentosFiltrados[selectedProcedimentoIndex]);
                      }
                    } else if (e.key === 'Escape') {
                      setOpenBuscaProcedimento(false);
                    }
                  }}
                  placeholder="Digite o nome do procedimento (ex: canal, resina, limpeza)..."
                  className="pl-9 pr-16 h-10 text-xs sm:text-sm font-medium rounded-lg bg-background border-border"
                  required
                />

                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  {buscaProcedimento && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setBuscaProcedimento('');
                        setNome('');
                        inputBuscaRef.current?.focus();
                      }}
                      title="Limpar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setOpenBuscaProcedimento((prev) => !prev);
                      inputBuscaRef.current?.focus();
                    }}
                    title={openBuscaProcedimento ? 'Fechar lista' : 'Abrir lista'}
                  >
                    <ChevronsUpDown className="h-4 w-4 opacity-70" />
                  </Button>
                </div>

                {/* Dropdown Flutuante idêntico à imagem de Orçamentos */}
                {openBuscaProcedimento && (
                  <div
                    ref={dropdownRef}
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-popover rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95"
                  >
                    <div className="px-3.5 py-2 border-b border-border bg-muted/40 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>
                        {procedimentosFiltrados.length === 1
                          ? '1 procedimento encontrado'
                          : `${procedimentosFiltrados.length} procedimentos encontrados`}
                      </span>
                      <span className="text-[10px] text-purple-700 dark:text-purple-400 hidden sm:inline font-medium">
                        ↑↓ navega • Enter seleciona • Esc fecha
                      </span>
                    </div>

                    <div className="max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-border/40 overscroll-contain no-scrollbar">
                      {procedimentosFiltrados.length === 0 ? (
                        <div className="p-4 text-center space-y-2.5">
                          <p className="text-xs text-muted-foreground">
                            Nenhum procedimento cadastrado para{' '}
                            <strong className="text-foreground">"{buscaProcedimento}"</strong>.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5 border-dashed border-purple-500 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                            onClick={() => handleAbrirCriarNovoProcedimento(buscaProcedimento)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Cadastrar "{buscaProcedimento.trim()}" no catálogo</span>
                          </Button>
                        </div>
                      ) : (
                        procedimentosFiltrados.map((p, index) => {
                          const isSelected = index === selectedProcedimentoIndex;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onMouseEnter={() => setSelectedProcedimentoIndex(index)}
                              onClick={() => handleSelectProcedimento(p)}
                              className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-center justify-between gap-3 group focus:outline-none cursor-pointer ${isSelected ? 'bg-accent/90 text-accent-foreground' : 'hover:bg-accent/60'
                                }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-xs sm:text-sm font-semibold truncate ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-foreground'
                                    }`}
                                >
                                  {p.nome}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {p.categoria && (
                                    <span className="text-[10px] text-muted-foreground capitalize bg-muted/80 px-1.5 py-0.2 rounded border border-border/50">
                                      {p.categoria}
                                    </span>
                                  )}
                                  {p.duracaoMinutos && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      ⏱ {p.duracaoMinutos} min
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                  {formatMoneyDisplay(p.preco)}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Barra de ação inferior para adicionar novo no catálogo */}
                    <div className="p-2 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAbrirCriarNovoProcedimento()}
                        className="w-full text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100/60 dark:hover:bg-purple-950/60 justify-center gap-1.5 h-8"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>+ Cadastrar novo procedimento no catálogo</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Presets Rápidos de Procedimentos Populares */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[
                  { rotulo: '+ Exodontia Siso Inferior', nome: 'Exodontia Siso Inferior', cat: 'Cirurgia', preco: '1000' },
                  { rotulo: '+ Exodontia Siso Superior', nome: 'Exodontia Siso Superior', cat: 'Cirurgia', preco: '900' },
                  { rotulo: '+ Lentes em Resina Inferior', nome: 'Lentes em Resina Inferior', cat: 'Estético / Lentes', preco: '4500' },
                  { rotulo: '+ Lentes em Resina Superior', nome: 'Lentes em Resina Superior', cat: 'Estético / Lentes', preco: '6500' },
                  { rotulo: '+ Tratamento de Cáries', nome: 'Tratamento de Cáries / Restauração', cat: 'Restaurador', preco: '250' },
                ].map((p) => (
                  <button
                    key={p.rotulo}
                    type="button"
                    onClick={() => {
                      setNome(p.nome);
                      setBuscaProcedimento(p.nome);
                      setCategoria(p.cat);
                      handleValorUnitarioChange(p.preco);
                    }}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-300/60 hover:bg-purple-100 transition-colors cursor-pointer"
                  >
                    {p.rotulo}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. CAMPO VALOR (OPCIONAL) */}
            {gerarLancamentoFinanceiro && (
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border/80 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold">Valor Unitário</Label>
                      <span className="text-[11px] text-muted-foreground">Opcional</span>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorUnitario}
                      onChange={(e) => handleValorUnitarioChange(e.target.value)}
                      placeholder="R$ 0,00"
                      className="h-10 text-xs rounded-lg"
                    />
                    {dentesSelecionados.length > 1 && (
                      <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold block">
                        × {dentesSelecionados.length} dentes selecionados
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                        Valor Total
                      </Label>
                      <span className="text-[11px] text-muted-foreground">Opcional</span>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={valorTotal}
                      onChange={(e) => setValorTotal(e.target.value)}
                      placeholder="R$ 0,00"
                      className="h-10 text-xs font-bold text-foreground rounded-lg"
                    />
                  </div>
                </div>

                {/* Vínculo de Orçamento */}
                <div className="space-y-1.5 pt-1.5 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Orçamento Vinculado</Label>
                    <span className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                      {orcamentos.length} orçamento(s)
                    </span>
                  </div>
                  <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                    <SelectTrigger className="h-9.5 text-xs rounded-lg">
                      <SelectValue placeholder="Selecione o orçamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum orçamento (Lançamento Clínico)</SelectItem>
                      {orcamentos.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.titulo} — R$ {Number(o.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({o.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={isCriandoOrcamento || dentesSelecionados.length === 0}
                      onClick={handleGerarNovoOrcamento}
                      className="text-[11px] text-purple-700 dark:text-purple-400 hover:text-purple-900 font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <FileText className="h-3 w-3" />
                      <span>{isCriandoOrcamento ? 'Gerando...' : '+ Gerar novo orçamento com estes dentes'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. CAMPO DENTES (OPCIONAL) - Conforme Imagem 2 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Dentes</Label>
                <span className="text-[11px] text-muted-foreground">Opcional</span>
              </div>

              {/* Container Seletor com Chips */}
              <div className="p-2 rounded-xl border border-border/80 bg-background flex flex-wrap items-center gap-1.5 min-h-[44px]">
                {dentesSelecionados.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-muted text-foreground border border-border shadow-2xs"
                  >
                    <span>{d}</span>
                    <button
                      type="button"
                      onClick={() => toggleDente(d)}
                      className="hover:bg-muted-foreground/20 rounded p-0.5 text-muted-foreground hover:text-foreground"
                      title="Remover dente"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}

                {/* Seletor rápido para adicionar dente individual */}
                <div className="ml-auto">
                  <Select
                    value=""
                    onValueChange={(val) => {
                      if (val && !dentesSelecionados.includes(val)) {
                        toggleDente(val);
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs border-dashed text-muted-foreground">
                      <SelectValue placeholder="+ Dente" />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28', '48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'].map((num) => (
                        <SelectItem key={num} value={num}>
                          Dente {num} {dentesSelecionados.includes(num) ? '(já selecionado)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Botões Rápidos de Lote para Dentes */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setDentesSelecionados(PRESETS_LENTES_SUPERIOR)}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-purple-100 hover:text-purple-800 border border-border transition-colors cursor-pointer"
                >
                  💎 10 Sup (15 ao 25)
                </button>
                <button
                  type="button"
                  onClick={() => setDentesSelecionados(PRESETS_LENTES_INFERIOR)}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-purple-100 hover:text-purple-800 border border-border transition-colors cursor-pointer"
                >
                  💎 10 Inf (45 ao 35)
                </button>
                <button
                  type="button"
                  onClick={() => setDentesSelecionados(DENTES_SUPERIORES)}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-purple-100 border border-border transition-colors cursor-pointer"
                >
                  Arcada Superior
                </button>
                <button
                  type="button"
                  onClick={() => setDentesSelecionados(DENTES_INFERIORES)}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-muted hover:bg-purple-100 border border-border transition-colors cursor-pointer"
                >
                  Arcada Inferior
                </button>
              </div>
            </div>

            {/* 6. FACES DO DENTE (OPCIONAL) - Conforme Imagem 2 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Faces do dente {dentesSelecionados.length > 0 ? `- ${dentesSelecionados.join(', ')}` : ''}
                </Label>
                <span className="text-[11px] text-muted-foreground">Opcional</span>
              </div>
              <div className="flex items-center gap-5 sm:gap-7 pt-1 flex-wrap">
                {FACES_OPCOES.map((f) => {
                  const active = faces.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      onClick={() => toggleFace(f.id)}
                      className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none hover:text-purple-700"
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => { }}
                        className="h-4.5 w-4.5 rounded border-border text-purple-600 focus:ring-purple-500 cursor-pointer"
                      />
                      <span className="font-semibold">{f.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 7. PROFISSIONAL (OPCIONAL) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Profissional</Label>
                <span className="text-[11px] text-muted-foreground">Opcional</span>
              </div>
              <Select value={profissional} onValueChange={setProfissional}>
                <SelectTrigger className="h-10 text-xs rounded-lg">
                  <SelectValue placeholder="Selecione um profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dra. Roseane">Dra. Roseane (Responsável Técnica)</SelectItem>
                  {dentistas.map((d) => (
                    <SelectItem key={d.id} value={d.nome}>
                      {d.nome} {d.cro ? `(CRO ${d.cro})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 8. OBSERVAÇÕES (OPCIONAL) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Observações</Label>
                <span className="text-[11px] text-muted-foreground">Opcional</span>
              </div>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Digite aqui sua observação"
                className="text-xs min-h-[90px] rounded-lg"
              />
            </div>

            {/* 9. FOTOS E IMAGENS CLÍNICAS */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Fotos e Imagens Clínicas</span>
                </Label>
                {fotos.length > 0 && (
                  <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">
                    {fotos.length} foto(s)
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                <div className="flex flex-wrap gap-2.5 items-center">
                  <label
                    htmlFor="proc-lateral-upload"
                    className={`h-20 w-24 rounded-lg border-2 border-dashed border-purple-400/50 hover:border-purple-600 dark:border-purple-800/80 dark:hover:border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50/70 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${uploadingFoto ? 'opacity-50 pointer-events-none' : ''
                      }`}
                  >
                    <input
                      id="proc-lateral-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleUploadFoto}
                      disabled={uploadingFoto}
                    />
                    {uploadingFoto ? (
                      <>
                        <Loader2 className="h-5 w-5 text-purple-600 animate-spin" />
                        <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">Enviando...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <span className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold">+ Anexar</span>
                      </>
                    )}
                  </label>

                  {fotos.map((f) => (
                    <div
                      key={f.id}
                      className="relative h-20 w-24 rounded-lg overflow-hidden border border-border group bg-black/5 shadow-2xs"
                    >
                      <img
                        src={f.url}
                        alt={f.nome || 'Foto clínica'}
                        className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setPreviewFoto(f.url)}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFoto(f.id);
                        }}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 hover:bg-destructive text-white flex items-center justify-center transition-colors shadow-xs"
                        title="Remover foto"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {fotos.length === 0 && !uploadingFoto && (
                    <span className="text-[11px] text-muted-foreground ml-2">
                      Adicione fotos do planejamento, antes/depois ou exames.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </form>

          {/* Rodapé Fixo com Botão Salvar (Conforme Imagem 2) */}
          <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-xs flex items-center justify-end gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 px-4 text-xs font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-procedimento-lateral"
              className="h-10 px-8 text-xs sm:text-sm font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-xl shadow-xs cursor-pointer"
            >
              Salvar
            </Button>
          </div>

          {/* Modal de Zoom da Imagem */}
          {previewFoto && (
            <Dialog open={Boolean(previewFoto)} onOpenChange={() => setPreviewFoto(null)}>
              <DialogContent position="center" className="max-w-2xl p-2 bg-black/95 border-none">
                <div className="relative flex items-center justify-center p-2">
                  <img src={previewFoto} alt="Pré-visualização" className="max-h-[80vh] w-auto rounded-lg object-contain" />
                </div>
              </DialogContent>
            </Dialog>
          )}
        </SheetContent>
      </Sheet>

      {/* DIALOG PARA CADASTRAR NOVO PROCEDIMENTO NO CATÁLOGO PERMANENTE */}
      <Dialog open={modalNovoCatalogoOpen} onOpenChange={setModalNovoCatalogoOpen}>
        <DialogContent className="max-w-md p-5 rounded-2xl bg-background border-border shadow-2xl">
          <DialogHeader className="text-left pb-1">
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Plus className="h-5 w-5 text-purple-700 dark:text-purple-400" />
              <span>Cadastrar Novo Procedimento no Catálogo</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Este procedimento ficará salvo permanentemente na lista da clínica para uso em orçamentos e fichas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarNovoNoCatalogo} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome do Procedimento *</Label>
              <Input
                value={novoProcNome}
                onChange={(e) => setNovoProcNome(e.target.value)}
                placeholder="Ex: Lentes em Resina Composta, Frenectomia..."
                className="h-9.5 text-xs sm:text-sm"
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria *</Label>
                <Select
                  value={novoProcCategoria}
                  onValueChange={(val) => setNovoProcCategoria(val as CategoriaProcedimento)}
                >
                  <SelectTrigger className="h-9.5 text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIAS_PROCEDIMENTOS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Preço Base (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={novoProcPreco}
                  onChange={(e) => setNovoProcPreco(e.target.value)}
                  placeholder="0,00"
                  className="h-9.5 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Duração Estimada (minutos)</Label>
              <Select value={novoProcDuracao} onValueChange={setNovoProcDuracao}>
                <SelectTrigger className="h-9.5 text-xs">
                  <SelectValue placeholder="Duração" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min (1h)</SelectItem>
                  <SelectItem value="90">90 min (1h30)</SelectItem>
                  <SelectItem value="120">120 min (2h)</SelectItem>
                  <SelectItem value="180">180 min (3h)</SelectItem>
                  <SelectItem value="240">240 min (4h)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/60">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoCatalogoOpen(false)}
                className="h-9 px-4 text-xs font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSalvandoCatalogo}
                className="h-9 px-5 text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-2xs gap-1.5 cursor-pointer"
              >
                {isSalvandoCatalogo ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Salvar no Catálogo
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ModalNovoProcedimento;
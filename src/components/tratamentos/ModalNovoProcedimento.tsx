import React, { useState, useEffect } from 'react';
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
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { useDentistas } from '@/hooks/useDentistas';
import { EstadoProcedimentoVisual } from './OdontogramaVisual';
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
  { id: 'C', label: 'Cervical' },
  { id: 'D', label: 'Distal' },
  { id: 'I', label: 'Incisal / Oclusal' },
  { id: 'M', label: 'Mesial' },
  { id: 'P', label: 'Palatina / Lingual' },
  { id: 'V', label: 'Vestibular' },
  { id: 'Geral', label: 'Toda a Coroa' },
];

const DENTES_SUPERIORES = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const DENTES_INFERIORES = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const PRESETS_LENTES_SUPERIOR = ['15', '14', '13', '12', '11', '21', '22', '23', '24', '25'];
const PRESETS_LENTES_INFERIOR = ['45', '44', '43', '42', '41', '31', '32', '33', '34', '35'];

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
  const { procedimentos: catalogoProcedimentos } = useProcedimentos();
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

  // Inicialização do formulário
  useEffect(() => {
    if (procedimentoEmEdicao) {
      setNome(procedimentoEmEdicao.nome || '');
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
        setNome(`Lentes em Resina Composta (${qtd} dentes)`);
        setCategoria('Estético / Lentes');
        setFaces(['V', 'I']);
        setEstado('a_realizar');
        setValorUnitario('800');
        setValorTotal(String(800 * qtd));
        setObservacoes(`Planejamento de Lentes/Facetas em Resina nos dentes ${dPadrao.join(', ')}.`);
      } else if (presetTipo === 'carie') {
        const qtd = dPadrao.length;
        setNome(
          qtd > 1
            ? `Tratamento de Cáries / Restaurações (${qtd} dentes)`
            : `Restauração em Resina (Cárie) - Dente ${dPadrao[0] || '16'}`
        );
        setCategoria('Restaurador');
        setFaces(['I']);
        setEstado('a_realizar');
        setValorUnitario('250');
        setValorTotal(String(250 * qtd));
        setObservacoes(`Remoção de tecido cariado e restauração estética nos dentes ${dPadrao.join(', ')}.`);
      } else {
        setNome('');
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

  // Recalcula valor total automaticamente quando altera valor unitário ou quantidade de dentes
  const handleValorUnitarioChange = (valStr: string) => {
    setValorUnitario(valStr);
    const unit = parseFloat(valStr);
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

    const unit = parseFloat(valorUnitario);
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

  const aplicarPresetRapido = (tipo: 'lentes' | 'carie') => {
    const qtd = dentesSelecionados.length;
    if (tipo === 'lentes') {
      setNome(`Lentes em Resina Composta (${qtd} dentes)`);
      setCategoria('Estético / Lentes');
      setFaces(['V', 'I']);
      setValorUnitario('800');
      setValorTotal(String(800 * qtd));
      setObservacoes(`Planejamento de Lentes/Facetas em Resina nos dentes ${dentesSelecionados.join(', ')}.`);
    } else {
      setNome(`Tratamento de Cáries / Restaurações (${qtd} dentes)`);
      setCategoria('Restaurador');
      setFaces(['I']);
      setValorUnitario('250');
      setValorTotal(String(250 * qtd));
      setObservacoes(`Remoção de tecido cariado e restauração nos dentes ${dentesSelecionados.join(', ')}.`);
    }
  };

  const handleGerarNovoOrcamento = async () => {
    if (!saveOrcamento) {
      toast.error('Módulo de orçamentos indisponível no momento.');
      return;
    }
    const tot = parseFloat(valorTotal) || 0;
    const unit = parseFloat(valorUnitario) || (dentesSelecionados.length > 0 ? tot / dentesSelecionados.length : tot);
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
    if (!nome.trim()) {
      toast.error('Informe o nome do procedimento.');
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
      nome: nome.trim(),
      categoria,
      dente: denteFormatado,
      dentes: dentesOrdenados,
      faces,
      estado,
      valor: gerarLancamentoFinanceiro && valorTotal ? parseFloat(valorTotal) : undefined,
      valorUnitario: gerarLancamentoFinanceiro && valorUnitario ? parseFloat(valorUnitario) : undefined,
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full flex flex-col bg-background border-l border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* Header do Drawer Lateral */}
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between shrink-0 bg-card/60">
          <SheetTitle className="text-base sm:text-lg font-bold text-foreground">
            {procedimentoEmEdicao ? 'Editar procedimento' : 'Adicionar procedimento'}
          </SheetTitle>
        </div>

        {/* Corpo com Rolagem Lateral Completa */}
        <form
          id="form-procedimento-lateral"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar"
        >
          {/* 1. ABAS DE ESTADO (Conforme Imagem 2 de Referência) */}
          <div className="grid grid-cols-4 p-1 bg-muted/70 rounded-xl border border-border/80 gap-1 text-center">
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
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-700 text-white shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
            className="border border-border/80 rounded-xl p-3 sm:p-3.5 bg-card hover:bg-muted/30 cursor-pointer transition-colors flex items-center justify-between gap-3 shadow-2xs"
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

          {/* 3. CAMPO PROCEDIMENTO */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Procedimento *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Lentes em Resina, Exodontia Siso, Restauração..."
              className="h-9.5 text-xs sm:text-sm font-medium"
              required
            />

            {/* Presets Rápidos de Procedimentos Populares */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { rotulo: '+ Exodontia Siso Inferior', nome: 'Exodontia Siso Inferior', cat: 'Cirurgia' },
                { rotulo: '+ Exodontia Siso Superior', nome: 'Exodontia Siso Superior', cat: 'Cirurgia' },
                { rotulo: '+ Lentes em Resina Inferior', nome: 'Lentes em Resina Inferior', cat: 'Estético / Lentes' },
                { rotulo: '+ Lentes em Resina Superior', nome: 'Lentes em Resina Superior', cat: 'Estético / Lentes' },
                { rotulo: '+ Tratamento de Cáries', nome: 'Tratamento de Cáries / Restauração', cat: 'Restaurador' },
              ].map((p) => (
                <button
                  key={p.rotulo}
                  type="button"
                  onClick={() => {
                    setNome(p.nome);
                    setCategoria(p.cat);
                  }}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-300/60 hover:bg-purple-100 transition-colors cursor-pointer"
                >
                  {p.rotulo}
                </button>
              ))}
            </div>
          </div>

          {/* 4. CAMPO VALOR (OPCIONAL) */}
          {gerarLancamentoFinanceiro && (
            <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Valor Unitário (R$)</Label>
                    <span className="text-[11px] text-muted-foreground">Opcional</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorUnitario}
                    onChange={(e) => handleValorUnitarioChange(e.target.value)}
                    placeholder="Ex: 800,00"
                    className="h-9 text-xs"
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
                      Valor Total (R$)
                    </Label>
                    <span className="text-[11px] text-muted-foreground">Opcional</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    value={valorTotal}
                    onChange={(e) => setValorTotal(e.target.value)}
                    placeholder="0,00"
                    className="h-9 text-xs font-bold text-foreground"
                  />
                </div>
              </div>

              {/* Vínculo de Orçamento */}
              <div className="space-y-1 pt-1 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Orçamento Vinculado</Label>
                  <span className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                    {orcamentos.length} orçamento(s)
                  </span>
                </div>
                <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                  <SelectTrigger className="h-9 text-xs">
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

          {/* 5. CAMPO DENTES (OPCIONAL) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Dentes</Label>
              <span className="text-[11px] text-muted-foreground">Opcional</span>
            </div>

            {/* Chips de Dentes Selecionados */}
            <div className="p-2.5 rounded-xl border border-border/80 bg-background flex flex-wrap gap-1.5 min-h-[42px] items-center">
              {dentesSelecionados.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border border-purple-300 shadow-2xs"
                >
                  <span>{d}</span>
                  <button
                    type="button"
                    onClick={() => toggleDente(d)}
                    className="hover:bg-purple-300 dark:hover:bg-purple-800 rounded p-0.5"
                    title="Remover dente"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
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

          {/* 6. FACES DO DENTE (OPCIONAL) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Faces do dente {dentesSelecionados.length > 0 ? `(${dentesSelecionados.join(', ')})` : ''}
              </Label>
              <span className="text-[11px] text-muted-foreground">Opcional</span>
            </div>
            <div className="flex flex-wrap gap-2 pt-0.5">
              {FACES_OPCOES.map((f) => {
                const active = faces.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFace(f.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      active
                        ? 'bg-purple-700 text-white border-purple-700 shadow-2xs'
                        : 'border-border bg-background hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                        active ? 'border-white bg-purple-700' : 'border-muted-foreground/50'
                      }`}
                    >
                      {active && <Check className="h-2.5 w-2.5 text-white" />}
                    </span>
                    <span>
                      {f.id} {f.label !== f.id ? `(${f.label})` : ''}
                    </span>
                  </button>
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
              <SelectTrigger className="h-9.5 text-xs">
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
              placeholder="Digite aqui sua observação clínica..."
              className="text-xs min-h-[75px]"
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
                  className={`h-20 w-24 rounded-lg border-2 border-dashed border-purple-400/50 hover:border-purple-600 dark:border-purple-800/80 dark:hover:border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50/70 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                    uploadingFoto ? 'opacity-50 pointer-events-none' : ''
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
            <DialogContent className="max-w-2xl p-2 bg-black/95 border-none">
              <div className="relative flex items-center justify-center p-2">
                <img src={previewFoto} alt="Pré-visualização" className="max-h-[80vh] w-auto rounded-lg object-contain" />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ModalNovoProcedimento;

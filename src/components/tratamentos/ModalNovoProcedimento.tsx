import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { EstadoProcedimentoVisual } from './OdontogramaVisual';
import { Sparkles, AlertCircle, X, Plus, Calculator, Layers, FileText } from 'lucide-react';
import { toast } from 'sonner';

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
  orcamentoId?: string;
  orcamentoTitulo?: string;
  dataRealizado?: string;
  dataPrevista?: string;
  observacoes?: string;
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
  { id: 'O', label: 'Oclusal / Incisal' },
  { id: 'V', label: 'Vestibular' },
  { id: 'L', label: 'Lingual / Palatina' },
  { id: 'M', label: 'Mesial' },
  { id: 'D', label: 'Distal' },
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

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Geral');
  const [dentesSelecionados, setDentesSelecionados] = useState<string[]>([]);
  const [faces, setFaces] = useState<string[]>([]);
  const [estado, setEstado] = useState<EstadoProcedimentoVisual>('a_realizar');
  const [valorUnitario, setValorUnitario] = useState<string>('');
  const [valorTotal, setValorTotal] = useState<string>('');
  const [orcamentoId, setOrcamentoId] = useState<string>('nenhum');
  const [dataPrevista, setDataPrevista] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');
  const [isCriandoOrcamento, setIsCriandoOrcamento] = useState(false);

  // Inicialização do formulário
  useEffect(() => {
    if (procedimentoEmEdicao) {
      setNome(procedimentoEmEdicao.nome || '');
      setCategoria(procedimentoEmEdicao.categoria || 'Geral');
      const dArray = procedimentoEmEdicao.dentes && procedimentoEmEdicao.dentes.length > 0
        ? procedimentoEmEdicao.dentes
        : procedimentoEmEdicao.dente
        ? procedimentoEmEdicao.dente.split(',').map((s) => s.trim()).filter(Boolean)
        : ['16'];
      setDentesSelecionados(dArray);
      setFaces(procedimentoEmEdicao.faces || []);
      setEstado(procedimentoEmEdicao.estado || 'a_realizar');
      setValorTotal(procedimentoEmEdicao.valor ? String(procedimentoEmEdicao.valor) : '');
      setValorUnitario(procedimentoEmEdicao.valorUnitario ? String(procedimentoEmEdicao.valorUnitario) : '');
      setOrcamentoId(procedimentoEmEdicao.orcamentoId || 'nenhum');
      setDataPrevista(procedimentoEmEdicao.dataPrevista || '');
      setObservacoes(procedimentoEmEdicao.observacoes || '');
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

      if (presetTipo === 'lentes') {
        const qtd = dPadrao.length;
        setNome(`Lentes em Resina Composta (${qtd} dentes)`);
        setCategoria('Estético / Lentes');
        setFaces(['V', 'O']);
        setEstado('a_realizar');
        setValorUnitario('800');
        setValorTotal(String(800 * qtd));
        setObservacoes(`Planejamento de Lentes/Facetas em Resina nos dentes ${dPadrao.join(', ')}.`);
      } else if (presetTipo === 'carie') {
        const qtd = dPadrao.length;
        setNome(qtd > 1 ? `Tratamento de Cáries / Restaurações (${qtd} dentes)` : `Restauração em Resina (Cárie) - Dente ${dPadrao[0] || '16'}`);
        setCategoria('Restaurador');
        setFaces(['O']);
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

    // Ajusta o valor total se houver valor unitário
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
      setFaces(['V', 'O']);
      setValorUnitario('800');
      setValorTotal(String(800 * qtd));
      setObservacoes(`Planejamento de Lentes/Facetas em Resina nos dentes ${dentesSelecionados.join(', ')}.`);
    } else {
      setNome(`Tratamento de Cáries / Restaurações (${qtd} dentes)`);
      setCategoria('Restaurador');
      setFaces(['O']);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

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
      valor: valorTotal ? parseFloat(valorTotal) : undefined,
      valorUnitario: valorUnitario ? parseFloat(valorUnitario) : undefined,
      orcamentoId: orcamentoId !== 'nenhum' ? orcamentoId : undefined,
      orcamentoTitulo: orc ? orc.titulo : undefined,
      dataRealizado:
        estado === 'realizado'
          ? procedimentoEmEdicao?.dataRealizado || new Date().toISOString().split('T')[0]
          : undefined,
      dataPrevista: dataPrevista || undefined,
      observacoes: observacoes.trim() || undefined,
      criadoEm: procedimentoEmEdicao?.criadoEm || new Date().toISOString(),
    };

    onSave(novo);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-xl p-5 rounded-2xl max-h-[92vh] overflow-y-auto no-scrollbar">
        <DialogHeader className="pb-1 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center justify-between">
            <span>{procedimentoEmEdicao ? 'Editar Procedimento' : 'Novo Procedimento'}</span>
            {dentesSelecionados.length > 1 && (
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold text-xs border-purple-300">
                {dentesSelecionados.length} dentes selecionados
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Botões Rápidos de Preset */}
        <div className="flex items-center gap-2 pt-1 pb-1">
          <button
            type="button"
            onClick={() => aplicarPresetRapido('lentes')}
            className="flex-1 py-1.5 px-2.5 rounded-lg border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-800 dark:text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Configurar Lentes em Resina
          </button>
          <button
            type="button"
            onClick={() => aplicarPresetRapido('carie')}
            className="flex-1 py-1.5 px-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            Configurar Cáries / Restauração
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {/* SELEÇÃO EM LOTE DOS DENTES */}
          <div className="space-y-1.5 p-3 rounded-xl border border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-purple-950 dark:text-purple-200">
                Dentes Envolvidos ({dentesSelecionados.length}) *
              </Label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDentesSelecionados(PRESETS_LENTES_SUPERIOR)}
                  className="text-purple-700 dark:text-purple-400 font-semibold hover:underline"
                >
                  10 Sup (15-25)
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setDentesSelecionados(PRESETS_LENTES_INFERIOR)}
                  className="text-purple-700 dark:text-purple-400 font-semibold hover:underline"
                >
                  10 Inf (45-35)
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setDentesSelecionados(DENTES_SUPERIORES)}
                  className="text-purple-700 dark:text-purple-400 font-semibold hover:underline"
                >
                  Toda Sup
                </button>
              </div>
            </div>

            {/* Chips de Dentes Selecionados */}
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar pt-1">
              {dentesSelecionados.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-purple-700 text-white shadow-2xs"
                >
                  Dente {d}
                  <button
                    type="button"
                    onClick={() => toggleDente(d)}
                    className="hover:text-red-300 focus:outline-hidden"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Adicionar mais dentes facilmente */}
            <div className="pt-1 flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-medium">Adicionar dente:</span>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {[...DENTES_SUPERIORES, ...DENTES_INFERIORES]
                  .filter((num) => !dentesSelecionados.includes(num))
                  .slice(0, 10)
                  .map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => toggleDente(num)}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-border bg-background hover:bg-muted text-foreground font-medium"
                    >
                      +{num}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Nome do Procedimento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nome do Procedimento *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Lentes em Resina Composta, Restauração em Resina..."
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Categoria e Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Categoria</Label>
              <Select value={categoria} onValueChange={setCategoria}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Estético / Lentes">Estético / Lentes em Resina</SelectItem>
                  <SelectItem value="Restaurador">Restaurador / Cáries</SelectItem>
                  <SelectItem value="Endodôntico">Endodôntico (Canal)</SelectItem>
                  <SelectItem value="Periodôntico">Periodôntico (Gengiva)</SelectItem>
                  <SelectItem value="Ortodôntico">Ortodôntico</SelectItem>
                  <SelectItem value="Cirúrgico">Cirúrgico</SelectItem>
                  <SelectItem value="Prótese">Prótese</SelectItem>
                  <SelectItem value="Geral">Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Estado do Procedimento *</Label>
              <Select value={estado} onValueChange={(val: EstadoProcedimentoVisual) => setEstado(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_realizar">A realizar (Amarelo)</SelectItem>
                  <SelectItem value="iniciado">Iniciado (Azul)</SelectItem>
                  <SelectItem value="realizado">Realizado (Verde)</SelectItem>
                  <SelectItem value="pre_existente">Pré-existente (Roxo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Faces do Dente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Faces do Dente</Label>
            <div className="flex flex-wrap gap-1.5">
              {FACES_OPCOES.map((f) => {
                const active = faces.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFace(f.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-purple-700 text-white border-purple-700'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {f.id} ({f.label})
                  </button>
                );
              })}
            </div>
          </div>

          {/* VALORES E CÁLCULO AUTOMÁTICO EM LOTE */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-muted/40 border border-border/60">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Valor por Dente (R$)</span>
                {dentesSelecionados.length > 1 && (
                  <span className="text-[10px] text-purple-700 font-bold">
                    × {dentesSelecionados.length} dentes
                  </span>
                )}
              </Label>
              <Input
                type="number"
                step="0.01"
                value={valorUnitario}
                onChange={(e) => handleValorUnitarioChange(e.target.value)}
                placeholder="Ex: 800,00"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                Valor Total do Tratamento (R$)
              </Label>
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

          {/* VÍNCULO COM ORÇAMENTO */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center justify-between">
              <span>Vincular ao Orçamento do Paciente</span>
              <span className="text-[11px] text-purple-700 font-medium">
                {orcamentos.length} orçamento(s) cadastrado(s)
              </span>
            </Label>
            <Select value={orcamentoId} onValueChange={setOrcamentoId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione o orçamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum orçamento (Lançamento Clínico Direto)</SelectItem>
                {orcamentos.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.titulo} — R$ {Number(o.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ({o.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Ação rápida para gerar orçamento com estes dentes */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                disabled={isCriandoOrcamento || dentesSelecionados.length === 0}
                onClick={handleGerarNovoOrcamento}
                className="text-[11px] text-purple-700 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-200 font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-purple-600" />
                <span>
                  {isCriandoOrcamento
                    ? 'Gerando orçamento...'
                    : `+ Gerar novo orçamento oficial para estes ${dentesSelecionados.length} dente(s)`}
                </span>
              </button>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Observações Clínicas</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Cor de resina BL2, protocolo adesivo, cuidados pós-procedimento..."
              className="text-xs min-h-[55px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-9 px-5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg shadow-2xs"
            >
              Salvar Procedimento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ModalNovoProcedimento;

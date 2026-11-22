import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { EstadoProcedimentoVisual } from './OdontogramaVisual';

export interface ProcedimentoItemData {
  id: string;
  nome: string;
  categoria?: string;
  dente: string;
  faces?: string[];
  estado: EstadoProcedimentoVisual;
  valor?: number;
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
  denteInicial?: string | null;
  procedimentoEmEdicao?: ProcedimentoItemData | null;
}

const FACES_OPCOES = [
  { id: 'O', label: 'Oclusal / Incisal' },
  { id: 'V', label: 'Vestibular' },
  { id: 'L', label: 'Lingual / Palatina' },
  { id: 'M', label: 'Mesial' },
  { id: 'D', label: 'Distal' },
  { id: 'Geral', label: 'Toda a Coroa' },
];

const DENTES_TODOS = [
  'Geral / Arcada',
  '18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28',
  '48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38',
  '55', '54', '53', '52', '51', '61', '62', '63', '64', '65',
  '85', '84', '83', '82', '81', '71', '72', '73', '74', '75',
];

export const ModalNovoProcedimento: React.FC<ModalNovoProcedimentoProps> = ({
  isOpen,
  onClose,
  onSave,
  pacienteId,
  denteInicial,
  procedimentoEmEdicao,
}) => {
  const { procedimentos: catalogoProcedimentos } = useProcedimentos();
  const { orcamentos } = useOrcamentos(pacienteId);

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Geral');
  const [dente, setDente] = useState(denteInicial || '16');
  const [faces, setFaces] = useState<string[]>([]);
  const [estado, setEstado] = useState<EstadoProcedimentoVisual>('a_realizar');
  const [valor, setValor] = useState<string>('');
  const [orcamentoId, setOrcamentoId] = useState<string>('nenhum');
  const [dataPrevista, setDataPrevista] = useState<string>('');
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (procedimentoEmEdicao) {
      setNome(procedimentoEmEdicao.nome || '');
      setCategoria(procedimentoEmEdicao.categoria || 'Geral');
      setDente(procedimentoEmEdicao.dente || denteInicial || '16');
      setFaces(procedimentoEmEdicao.faces || []);
      setEstado(procedimentoEmEdicao.estado || 'a_realizar');
      setValor(procedimentoEmEdicao.valor ? String(procedimentoEmEdicao.valor) : '');
      setOrcamentoId(procedimentoEmEdicao.orcamentoId || 'nenhum');
      setDataPrevista(procedimentoEmEdicao.dataPrevista || '');
      setObservacoes(procedimentoEmEdicao.observacoes || '');
    } else {
      setNome('');
      setCategoria('Geral');
      setDente(denteInicial || '16');
      setFaces([]);
      setEstado('a_realizar');
      setValor('');
      setOrcamentoId('nenhum');
      setDataPrevista(new Date().toISOString().split('T')[0]);
      setObservacoes('');
    }
  }, [procedimentoEmEdicao, denteInicial, isOpen]);

  const toggleFace = (f: string) => {
    if (faces.includes(f)) {
      setFaces(faces.filter((item) => item !== f));
    } else {
      setFaces([...faces, f]);
    }
  };

  const handleSelectCatalogo = (procNome: string) => {
    setNome(procNome);
    const cat = catalogoProcedimentos.find((p) => p.nome === procNome);
    if (cat) {
      if (cat.preco) setValor(String(cat.preco));
      if (cat.categoria) setCategoria(cat.categoria);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    const orc = orcamentos.find((o) => o.id === orcamentoId);

    const novo: ProcedimentoItemData = {
      id: procedimentoEmEdicao?.id || `proc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      nome: nome.trim(),
      categoria,
      dente,
      faces,
      estado,
      valor: valor ? parseFloat(valor) : undefined,
      orcamentoId: orcamentoId !== 'nenhum' ? orcamentoId : undefined,
      orcamentoTitulo: orc ? orc.titulo : undefined,
      dataRealizado: estado === 'realizado' ? (procedimentoEmEdicao?.dataRealizado || new Date().toISOString().split('T')[0]) : undefined,
      dataPrevista: dataPrevista || undefined,
      observacoes: observacoes.trim() || undefined,
      criadoEm: procedimentoEmEdicao?.criadoEm || new Date().toISOString(),
    };

    onSave(novo);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md sm:max-w-lg p-5 rounded-2xl max-h-[90vh] overflow-y-auto no-scrollbar">
        <DialogHeader className="pb-1 text-left">
          <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
            {procedimentoEmEdicao ? 'Editar Procedimento' : 'Novo Procedimento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Nome do Procedimento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Nome do Procedimento *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Acompanhamento de tratamento, Restauração em Resina..."
              className="h-9 text-xs"
              required
            />
            {/* Sugestões do catálogo da clínica */}
            {catalogoProcedimentos.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto no-scrollbar">
                {catalogoProcedimentos.slice(0, 6).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCatalogo(cat.nome)}
                    className="text-[10px] px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-500/15"
                  >
                    + {cat.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Dente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Dente *</Label>
              <Select value={dente} onValueChange={setDente}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o dente" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {DENTES_TODOS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d === 'Geral / Arcada' ? d : `Dente ${d}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Estado Inicial */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Estado *</Label>
              <Select value={estado} onValueChange={(val: EstadoProcedimentoVisual) => setEstado(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_realizar">A realizar</SelectItem>
                  <SelectItem value="iniciado">Iniciado</SelectItem>
                  <SelectItem value="realizado">Realizado</SelectItem>
                  <SelectItem value="pre_existente">Pré-existente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Faces Envolvidas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Faces do Dente (Opcional)</Label>
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

          <div className="grid grid-cols-2 gap-3">
            {/* Valor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="h-9 text-xs"
              />
            </div>

            {/* Vínculo com Orçamento */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Orçamento Vinculado</Label>
              <Select value={orcamentoId} onValueChange={setOrcamentoId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum orçamento</SelectItem>
                  {orcamentos.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.titulo} (R$ {Number(o.total || 0).toLocaleString('pt-BR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Observações Clínicas</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Detalhes sobre a técnica, resina utilizada, cuidados adicionais..."
              className="text-xs min-h-[60px]"
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

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  Clock,
  User,
  Sparkles,
  Phone,
  MessageSquare,
  AlertCircle,
  Search,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  TarefaInterna,
  TipoTarefa,
  PrioridadeTarefa,
  TIPO_TAREFA_INFO,
} from '@/hooks/useTarefasInternas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ModalNovaTarefaProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dados: Omit<TarefaInterna, 'id' | 'criadoEm' | 'updatedAt'>) => Promise<boolean>;
  tarefaToEdit?: TarefaInterna | null;
  initialDate?: string;
}

const PRESETS = [
  {
    tipo: 'chamar_lead' as TipoTarefa,
    titulo: 'Chamar Novo Lead no WhatsApp',
    descricao: 'Apresentar a clínica, tirar dúvidas e convidar para avaliação inicial.',
    icon: '📞',
    cor: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  {
    tipo: 'followup_orcamento' as TipoTarefa,
    titulo: 'Follow-up de Orçamento Pendente',
    descricao: 'Verificar se o paciente ficou com dúvidas sobre o plano de tratamento ou formas de pagamento.',
    icon: '💬',
    cor: 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  },
  {
    tipo: 'confirmar_paciente' as TipoTarefa,
    titulo: 'Confirmar Consultas de Amanhã',
    descricao: 'Enviar mensagem no WhatsApp confirmando horário e presença do paciente.',
    icon: '⏰',
    cor: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    tipo: 'pos_operatorio' as TipoTarefa,
    titulo: 'Checar Pós-Operatório do Paciente',
    descricao: 'Perguntar como passou a noite, se há dor/inchaço e reforçar a medicação prescrita.',
    icon: '🩺',
    cor: 'border-pink-500/40 bg-pink-500/10 text-pink-700 dark:text-pink-300',
  },
  {
    tipo: 'laboratorio' as TipoTarefa,
    titulo: 'Cobrar Prótese / Laboratório',
    descricao: 'Verificar status da entrega do trabalho protético com o laboratório.',
    icon: '📦',
    cor: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    tipo: 'geral' as TipoTarefa,
    titulo: 'Tarefa Administrativa',
    descricao: '',
    icon: '📋',
    cor: 'border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
];

export const ModalNovaTarefa: React.FC<ModalNovaTarefaProps> = ({
  isOpen,
  onClose,
  onSave,
  tarefaToEdit,
  initialDate,
}) => {
  const hojeStr = new Date().toISOString().split('T')[0];

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(initialDate || hojeStr);
  const [hora, setHora] = useState('');
  const [tipo, setTipo] = useState<TipoTarefa>('chamar_lead');
  const [prioridade, setPrioridade] = useState<PrioridadeTarefa>('media');
  const [responsavel, setResponsavel] = useState('Recepção');

  // Vínculos
  const [vinculoTipo, setVinculoTipo] = useState<'nenhum' | 'lead' | 'paciente'>('lead');
  const [buscaContato, setBuscaContato] = useState('');
  const [contatosEncontrados, setContatosEncontrados] = useState<any[]>([]);
  const [contatoSelecionado, setContatoSelecionado] = useState<{
    id: string;
    nome: string;
    telefone: string;
    tipo: 'lead' | 'paciente';
  } | null>(null);

  const [saving, setSaving] = useState(false);

  // Carrega contatos recentes do banco (Leads e Pacientes)
  useEffect(() => {
    if (!isOpen) return;

    if (tarefaToEdit) {
      setTitulo(tarefaToEdit.titulo);
      setDescricao(tarefaToEdit.descricao || '');
      setData(tarefaToEdit.data);
      setHora(tarefaToEdit.hora || '');
      setTipo(tarefaToEdit.tipo);
      setPrioridade(tarefaToEdit.prioridade);
      setResponsavel(tarefaToEdit.responsavel || 'Recepção');

      if (tarefaToEdit.leadNome) {
        setVinculoTipo('lead');
        setContatoSelecionado({
          id: tarefaToEdit.leadId || '',
          nome: tarefaToEdit.leadNome,
          telefone: tarefaToEdit.leadTelefone || '',
          tipo: 'lead',
        });
      } else if (tarefaToEdit.pacienteNome) {
        setVinculoTipo('paciente');
        setContatoSelecionado({
          id: tarefaToEdit.pacienteId || '',
          nome: tarefaToEdit.pacienteNome,
          telefone: tarefaToEdit.pacienteTelefone || '',
          tipo: 'paciente',
        });
      } else {
        setVinculoTipo('nenhum');
        setContatoSelecionado(null);
      }
    } else {
      // Padrão novo
      setTitulo('');
      setDescricao('');
      setData(initialDate || hojeStr);
      setHora('10:00');
      setTipo('chamar_lead');
      setPrioridade('media');
      setResponsavel('Recepção');
      setVinculoTipo('lead');
      setContatoSelecionado(null);
      setBuscaContato('');
    }
  }, [isOpen, tarefaToEdit, initialDate, hojeStr]);

  // Busca rápida de Leads ou Pacientes quando digita
  useEffect(() => {
    if (!isOpen || vinculoTipo === 'nenhum' || !buscaContato.trim()) {
      setContatosEncontrados([]);
      return;
    }

    const timer = setTimeout(async () => {
      const termo = `%${buscaContato.trim()}%`;
      if (vinculoTipo === 'lead') {
        const { data: leads } = await supabase
          .from('crm_leads')
          .select('id, name, nome, phone, telefone, stage')
          .or(`name.ilike.${termo},nome.ilike.${termo},phone.ilike.${termo},telefone.ilike.${termo}`)
          .limit(6);

        if (leads) {
          setContatosEncontrados(
            leads.map((l: any) => ({
              id: l.id,
              nome: l.name || l.nome || 'Lead sem nome',
              telefone: l.phone || l.telefone || '',
              extra: l.stage ? `Etapa: ${l.stage}` : 'Lead WhatsApp',
              tipo: 'lead',
            }))
          );
        }
      } else {
        const { data: pacientes } = await supabase
          .from('pacientes')
          .select('id, nome, telefone')
          .or(`nome.ilike.${termo},telefone.ilike.${termo}`)
          .limit(6);

        if (pacientes) {
          setContatosEncontrados(
            pacientes.map((p: any) => ({
              id: p.id,
              nome: p.nome || 'Paciente sem nome',
              telefone: p.telefone || '',
              extra: 'Paciente cadastrado',
              tipo: 'paciente',
            }))
          );
        }
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [buscaContato, vinculoTipo, isOpen]);

  const aplicarPreset = (preset: typeof PRESETS[0]) => {
    setTipo(preset.tipo);
    setTitulo(preset.titulo);
    setDescricao(preset.descricao);
    if (preset.tipo === 'chamar_lead' || preset.tipo === 'followup_orcamento') {
      setVinculoTipo('lead');
    } else if (preset.tipo === 'pos_operatorio' || preset.tipo === 'confirmar_paciente') {
      setVinculoTipo('paciente');
    }
  };

  const selecionarContato = (contato: any) => {
    setContatoSelecionado(contato);
    setBuscaContato('');
    setContatosEncontrados([]);

    // Sugere título enriquecido com o nome do contato se estiver vazio ou genérico
    if (!titulo || titulo.startsWith('Chamar') || titulo.startsWith('Follow-up') || titulo.startsWith('Checar')) {
      if (tipo === 'chamar_lead') {
        setTitulo(`Chamar Lead: ${contato.nome}`);
      } else if (tipo === 'followup_orcamento') {
        setTitulo(`Follow-up Orçamento: ${contato.nome}`);
      } else if (tipo === 'pos_operatorio') {
        setTitulo(`Pós-Operatório: ${contato.nome}`);
      } else if (tipo === 'confirmar_paciente') {
        setTitulo(`Confirmar Consulta: ${contato.nome}`);
      }
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast.error('Informe o título da tarefa');
      return;
    }
    if (!data) {
      toast.error('Informe a data da tarefa');
      return;
    }

    setSaving(true);
    try {
      const payload: Omit<TarefaInterna, 'id' | 'criadoEm' | 'updatedAt'> = {
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        data,
        hora: hora || undefined,
        tipo,
        prioridade,
        status: tarefaToEdit ? tarefaToEdit.status : 'pendente',
        responsavel: responsavel.trim() || undefined,
        leadId: contatoSelecionado?.tipo === 'lead' ? contatoSelecionado.id : undefined,
        leadNome: contatoSelecionado?.tipo === 'lead' ? contatoSelecionado.nome : undefined,
        leadTelefone: contatoSelecionado?.tipo === 'lead' ? contatoSelecionado.telefone : undefined,
        pacienteId: contatoSelecionado?.tipo === 'paciente' ? contatoSelecionado.id : undefined,
        pacienteNome: contatoSelecionado?.tipo === 'paciente' ? contatoSelecionado.nome : undefined,
        pacienteTelefone: contatoSelecionado?.tipo === 'paciente' ? contatoSelecionado.telefone : undefined,
      };

      const ok = await onSave(payload);
      if (ok) {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border shadow-2xl">
        <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white p-4">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {tarefaToEdit ? 'Editar Tarefa da Equipe' : 'Nova Tarefa no Calendário'}
          </DialogTitle>
          <DialogDescription className="text-teal-100 text-xs mt-0.5">
            Agende ligações, mensagens de WhatsApp com leads, confirmações e tarefas diárias.
          </DialogDescription>
        </div>

        <form onSubmit={handleSalvar} className="p-4 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Presets Rápidos */}
          {!tarefaToEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Modelos Prontos de Tarefa (1 Clique):
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.tipo}
                    type="button"
                    onClick={() => aplicarPreset(p)}
                    className={`text-left p-2 rounded-lg border text-xs font-medium transition-all hover:scale-[1.02] flex items-center gap-1.5 ${
                      tipo === p.tipo ? 'ring-2 ring-primary shadow-xs ' + p.cor : 'bg-muted/40 hover:bg-muted/80'
                    }`}
                  >
                    <span className="text-base">{p.icon}</span>
                    <span className="truncate">{p.titulo.split(' ')[0]} {p.titulo.split(' ')[1] || ''}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tipo e Prioridade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo da Tarefa</Label>
              <Select value={tipo} onValueChange={(val) => setTipo(val as TipoTarefa)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_TAREFA_INFO).map(([key, info]) => (
                    <SelectItem key={key} value={key} className="text-xs">
                      <span className="mr-1.5">{info.icon}</span>
                      {info.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Prioridade</Label>
              <Select value={prioridade} onValueChange={(val) => setPrioridade(val as PrioridadeTarefa)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa" className="text-xs">
                    🟢 Baixa
                  </SelectItem>
                  <SelectItem value="media" className="text-xs">
                    🟡 Média
                  </SelectItem>
                  <SelectItem value="alta" className="text-xs">
                    🔴 Alta (Urgente)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vínculo com Lead ou Paciente */}
          <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                Vincular a um Lead ou Paciente
              </Label>
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setVinculoTipo('lead');
                    setContatoSelecionado(null);
                  }}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    vinculoTipo === 'lead' ? 'bg-emerald-600 text-white font-semibold' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Lead (CRM)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVinculoTipo('paciente');
                    setContatoSelecionado(null);
                  }}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    vinculoTipo === 'paciente' ? 'bg-primary text-white font-semibold' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Paciente
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVinculoTipo('nenhum');
                    setContatoSelecionado(null);
                  }}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    vinculoTipo === 'nenhum' ? 'bg-muted-foreground/30 font-semibold' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Nenhum
                </button>
              </div>
            </div>

            {vinculoTipo !== 'nenhum' && (
              <div className="space-y-1.5 pt-1">
                {contatoSelecionado ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-background border text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
                        {contatoSelecionado.nome.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate">{contatoSelecionado.nome}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contatoSelecionado.telefone || 'Sem telefone'}
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setContatoSelecionado(null)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder={`Digite o nome ou telefone do ${vinculoTipo === 'lead' ? 'lead do CRM' : 'paciente'}...`}
                      value={buscaContato}
                      onChange={(e) => setBuscaContato(e.target.value)}
                      className="h-8 pl-8 text-xs bg-background"
                    />

                    {contatosEncontrados.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden divide-y text-xs">
                        {contatosEncontrados.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => selecionarContato(item)}
                            className="p-2 hover:bg-muted cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-foreground">{item.nome}</div>
                              <div className="text-[10px] text-muted-foreground">{item.telefone} • {item.extra}</div>
                            </div>
                            <Button type="button" size="sm" variant="outline" className="h-6 text-[10px] px-1.5">
                              Selecionar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Título da Tarefa */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Título da Tarefa *</Label>
            <Input
              required
              placeholder="Ex.: Chamar João no WhatsApp sobre prótese"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Data, Horário e Responsável */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                Data *
              </Label>
              <Input
                type="date"
                required
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                Horário
              </Label>
              <Input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Responsável</Label>
              <Input
                placeholder="Ex.: Dra. Rose"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Descrição / Observações */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Observações / Detalhes</Label>
            <Textarea
              placeholder="Ex.: Dúvida sobre parcelamento em 12x no cartão. Enviar simulação."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2 gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {saving ? 'Salvando...' : tarefaToEdit ? 'Salvar Alterações' : 'Adicionar ao Calendário'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

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
import { Badge } from '@/components/ui/badge';
import {
  UserCheck,
  AlertTriangle,
  UserPlus,
  Link as LinkIcon,
  CheckCircle2,
  Phone,
  Mail,
  FileText,
  Search,
} from 'lucide-react';
import { NovoLead } from '@/types/novosLeads';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { formatarTelefoneExibicao, novosLeadsService } from '@/services/novosLeadsService';
import { toast } from 'sonner';

interface ModalRevisarLeadProps {
  isOpen: boolean;
  onClose: () => void;
  lead: NovoLead | null;
  onLeadAtualizado: (lead: NovoLead) => void;
}

export default function ModalRevisarLead({
  isOpen,
  onClose,
  lead,
  onLeadAtualizado,
}: ModalRevisarLeadProps) {
  const { user, clinicaId } = useAuth();
  const [verificando, setVerificando] = useState(true);
  const [pacienteCorrespondente, setPacienteCorrespondente] = useState<any | null>(null);

  // Formulário de novo cadastro
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [convenio, setConvenio] = useState('Particular');
  const [observacoes, setObservacoes] = useState('');

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!lead || !isOpen) return;

    setNome(lead.nome || '');
    setTelefone(lead.telefone || '');
    setEmail(lead.email || '');

    // Extrai informações das respostas se disponíveis
    const respostasTexto = (lead.respostas || [])
      .map((r) => `${r.pergunta}: ${r.resposta}`)
      .join('\n');
    setObservacoes(
      respostasTexto
        ? `Interesse capturado via Meta Ads:\n${respostasTexto}\n\n${lead.observacoes || ''}`
        : lead.observacoes || ''
    );

    // Executa varredura de duplicidades em pacientes
    checarDuplicidades(lead);
  }, [lead, isOpen]);

  const checarDuplicidades = async (leadAlvo: NovoLead) => {
    setVerificando(true);
    setPacienteCorrespondente(null);

    try {
      const telDigitos = (leadAlvo.telefone || '').replace(/\D/g, '');
      const sufixo = telDigitos.length >= 8 ? telDigitos.slice(-8) : '';

      const { data: todosPacientes } = await supabase
        .from('pacientes')
        .select('id, nome, telefone, cpf, email, criado_em, convenio')
        .limit(500);

      if (todosPacientes && todosPacientes.length > 0) {
        // 1. Procura por telefone correspondente
        let match = todosPacientes.find((p: any) => {
          if (!sufixo) return false;
          const pTel = (p.telefone || '').replace(/\D/g, '');
          return pTel.endsWith(sufixo);
        });

        // 2. Procura por nome muito similar se não achou por telefone
        if (!match && leadAlvo.nome) {
          const nomeAlvo = leadAlvo.nome.toLowerCase().trim();
          match = todosPacientes.find((p: any) => {
            const pNome = (p.nome || '').toLowerCase().trim();
            return pNome === nomeAlvo && nomeAlvo.length > 4;
          });
        }

        if (match) {
          setPacienteCorrespondente(match);
        }
      }
    } catch (err) {
      console.warn('[ModalRevisarLead] Falha ao verificar pacientes:', err);
    } finally {
      setVerificando(false);
    }
  };

  if (!lead) return null;

  // Apenas marcar como revisado sem cadastrar paciente
  const handleApenasRevisar = async () => {
    setSalvando(true);
    try {
      const atualizado = await novosLeadsService.marcarComoRevisado(
        lead.id,
        user?.user_metadata?.nome || user?.email || 'Equipe'
      );
      onLeadAtualizado(atualizado);
      toast.success('Lead marcado como revisado!');
      onClose();
    } catch (err: any) {
      toast.error('Erro ao marcar lead: ' + (err.message || 'Tente novamente'));
    } finally {
      setSalvando(false);
    }
  };

  // Vincular ao paciente já existente
  const handleVincularExistente = async () => {
    if (!pacienteCorrespondente) return;
    setSalvando(true);
    try {
      const atualizado = await novosLeadsService.vincularPacienteExistente(
        lead.id,
        pacienteCorrespondente.id
      );
      onLeadAtualizado(atualizado);
      toast.success(`Lead vinculado ao prontuário de ${pacienteCorrespondente.nome}!`);
      onClose();
    } catch (err: any) {
      toast.error('Erro ao vincular: ' + (err.message || 'Tente novamente'));
    } finally {
      setSalvando(false);
    }
  };

  // Cadastrar novo paciente com segurança
  const handleCadastrarNovoPaciente = async () => {
    if (!nome.trim()) {
      toast.error('O nome do paciente é obrigatório.');
      return;
    }
    if (!telefone.trim()) {
      toast.error('O telefone do paciente é obrigatório.');
      return;
    }

    setSalvando(true);
    try {
      const { lead: leadAtualizado, paciente } =
        await novosLeadsService.converterEmPaciente({
          lead,
          clinicaId,
          userId: user?.id,
          dadosPaciente: {
            nome,
            telefone,
            cpf,
            email,
            nascimento,
            convenio,
            observacoes,
          },
        });

      onLeadAtualizado(leadAtualizado);
      toast.success(`🎉 Paciente "${paciente.nome}" cadastrado com prontuário ativo!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar paciente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-blue-600">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-lg">
              <UserCheck className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-xl">Revisão e Validação de Lead</DialogTitle>
          </div>
          <DialogDescription>
            Confira as informações capturadas da Meta, valide se o paciente já possui cadastro e evite prontuários duplicados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card com dados recebidos do anúncio / formulário */}
          <div className="p-3.5 bg-muted/40 rounded-xl border border-border/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Dados Capturados da Meta
              </span>
              <Badge variant="outline" className="text-xs">
                {lead.origem} {lead.campanha ? `• ${lead.campanha}` : ''}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Nome:</span>{' '}
                <strong className="text-foreground">{lead.nome}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Telefone:</span>{' '}
                <strong className="text-foreground">
                  {formatarTelefoneExibicao(lead.telefone)}
                </strong>
              </div>
              {lead.email && (
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="text-foreground">{lead.email}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Data de Entrada:</span>{' '}
                <span className="text-foreground">
                  {new Date(lead.data_criacao).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>

            {/* Respostas do formulário se houver */}
            {lead.respostas && lead.respostas.length > 0 && (
              <div className="mt-2 pt-2 border-t border-border/50 space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">
                  Perguntas e Respostas do Formulário Meta Ads:
                </span>
                <div className="space-y-1">
                  {lead.respostas.map((r, i) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-background text-xs border border-border/40"
                    >
                      <div className="font-semibold text-foreground text-[11px]">
                        {r.pergunta}
                      </div>
                      <div className="text-blue-700 dark:text-blue-400 font-medium mt-0.5">
                        {r.resposta}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Alerta de Verificação de Duplicidade */}
          {verificando ? (
            <div className="p-3 rounded-xl border border-border flex items-center gap-2 text-xs text-muted-foreground">
              <Search className="w-4 h-4 animate-spin text-blue-600" />
              Verificando base de pacientes para evitar duplicidades...
            </div>
          ) : pacienteCorrespondente ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/60 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <h5 className="font-bold text-amber-900 dark:text-amber-200 text-sm">
                    Paciente Já Cadastrado na Clínica!
                  </h5>
                  <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                    Encontramos um prontuário existente com dados correspondentes a este lead. Para evitar duplicidades, vincule o lead ao cadastro existente:
                  </p>
                </div>
              </div>

              <div className="p-3 bg-background rounded-lg border border-amber-200 dark:border-amber-900/50 text-xs space-y-1">
                <div className="flex justify-between font-bold text-foreground">
                  <span>{pacienteCorrespondente.nome}</span>
                  <Badge variant="outline">Prontuário #{pacienteCorrespondente.id.slice(0, 8)}</Badge>
                </div>
                <div className="text-muted-foreground">
                  Telefone: {formatarTelefoneExibicao(pacienteCorrespondente.telefone)}
                  {pacienteCorrespondente.cpf && ` | CPF: ${pacienteCorrespondente.cpf}`}
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleVincularExistente}
                  disabled={salvando}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs"
                >
                  <LinkIcon className="w-3.5 h-3.5 mr-1.5" />
                  Vincular Lead a este Prontuário
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Nenhum paciente duplicado encontrado. Pronto para cadastrar com segurança!
            </div>
          )}

          {/* Formulário para converter em novo paciente */}
          {!pacienteCorrespondente && (
            <div className="space-y-3 border-t pt-3">
              <h5 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-blue-600" />
                Dados para Cadastro no Prontuário
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome Completo *</Label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Telefone / WhatsApp *</Label>
                  <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CPF (opcional)</Label>
                  <Input
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">E-mail (opcional)</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações do Prontuário</Label>
                <Textarea
                  rows={2}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Fechar
          </Button>

          {!lead.revisado && (
            <Button
              variant="secondary"
              onClick={handleApenasRevisar}
              disabled={salvando}
              className="font-medium"
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-blue-600" />
              Apenas Marcar como Revisado
            </Button>
          )}

          {!pacienteCorrespondente && (
            <Button
              onClick={handleCadastrarNovoPaciente}
              disabled={salvando}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              {salvando ? 'Cadastrando...' : 'Cadastrar Paciente e Gerar Prontuário'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

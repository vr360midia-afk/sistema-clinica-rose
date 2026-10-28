import React, { useState } from 'react';
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
import { UserPlus, Sparkles } from 'lucide-react';
import { NovoLead, StatusNovoLead, PrioridadeNovoLead } from '@/types/novosLeads';
import { normalizarTelefone, novosLeadsService } from '@/services/novosLeadsService';
import { toast } from 'sonner';

interface ModalNovoLeadManualProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCriado: () => void;
}

export default function ModalNovoLeadManual({
  isOpen,
  onClose,
  onLeadCriado,
}: ModalNovoLeadManualProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [origem, setOrigem] = useState('Meta Lead Ads');
  const [campanha, setCampanha] = useState('');
  const [status, setStatus] = useState<StatusNovoLead>('Pendente');
  const [prioridade, setPrioridade] = useState<PrioridadeNovoLead>('media');
  const [respostasTexto, setRespostasTexto] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  const resetar = () => {
    setNome('');
    setTelefone('');
    setEmail('');
    setOrigem('Meta Lead Ads');
    setCampanha('');
    setStatus('Pendente');
    setPrioridade('media');
    setRespostasTexto('');
    setObservacoes('');
    setSalvando(false);
  };

  const handleSalvar = async () => {
    if (!nome.trim() && !telefone.trim()) {
      toast.error('Informe ao menos o nome ou telefone do lead.');
      return;
    }

    setSalvando(true);
    try {
      const respostas = respostasTexto
        ? respostasTexto
            .split('\n')
            .filter(Boolean)
            .map((l) => {
              const [p, ...r] = l.split(':');
              return {
                pergunta: (p || 'Pergunta').trim(),
                resposta: (r.join(':') || p).trim(),
              };
            })
        : [];

      await novosLeadsService.salvarLead({
        nome: nome || 'Novo Lead',
        telefone: normalizarTelefone(telefone) || telefone,
        email: email || null,
        origem,
        campanha: campanha || null,
        status,
        prioridade,
        respostas,
        observacoes,
        revisado: false,
      });

      toast.success('Lead cadastrado com sucesso!');
      onLeadCriado();
      onClose();
      resetar();
    } catch (err: any) {
      toast.error('Erro ao salvar lead: ' + (err.message || 'Tente novamente'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        if (!aberto) resetar();
        onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-blue-600">
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-lg">
              <UserPlus className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-xl">Novo Lead Manual</DialogTitle>
          </div>
          <DialogDescription>
            Cadastre um lead manualmente recebido via redes sociais, WhatsApp ou indicação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Nome do Lead *</Label>
              <Input
                placeholder="Ex: João Ferreira"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Telefone / WhatsApp *</Label>
              <Input
                placeholder="(82) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">E-mail</Label>
              <Input
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Origem</Label>
              <Select value={origem} onValueChange={setOrigem}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Meta Lead Ads">Meta Lead Ads (Instagram / Facebook)</SelectItem>
                  <SelectItem value="Instagram Direct">Instagram Direct</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Google Ads">Google Ads</SelectItem>
                  <SelectItem value="Indicação">Indicação de Paciente</SelectItem>
                  <SelectItem value="Outro">Outro Canal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs font-semibold">Campanha / Anúncio</Label>
              <Input
                placeholder="Ex: Campanha Lentes Resina Maio"
                value={campanha}
                onChange={(e) => setCampanha(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={(v) => setPrioridade(v as PrioridadeNovoLead)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">🔴 Alta</SelectItem>
                  <SelectItem value="media">🟡 Média</SelectItem>
                  <SelectItem value="baixa">🟢 Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">
              Perguntas e Respostas do Formulário (Formato: Pergunta: Resposta)
            </Label>
            <Textarea
              rows={2}
              placeholder="Procedimento desejado: Facetas de Resina&#10;Melhor turno: Tarde"
              value={respostasTexto}
              onChange={(e) => setRespostasTexto(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Observações Iniciais</Label>
            <Textarea
              rows={2}
              placeholder="Anotações internas sobre o lead..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {salvando ? 'Salvando...' : 'Cadastrar Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

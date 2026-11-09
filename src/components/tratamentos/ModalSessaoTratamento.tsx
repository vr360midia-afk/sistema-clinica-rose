import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, User, FileText, Plus, AlertCircle, CalendarPlus } from 'lucide-react';
import { SessaoTratamento, StatusSessaoTratamento } from '@/types/tratamento';
import { useDentalSystem } from '@/context/DentalSystemContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSalvar: (dados: any) => Promise<any>;
  procedimentoId: string;
  pacienteId: string;
  clinicaId: string;
  sessaoExistente?: SessaoTratamento | null;
  proximoNumeroSessao: number;
}

export const ModalSessaoTratamento: React.FC<Props> = ({
  isOpen,
  onClose,
  onSalvar,
  procedimentoId,
  pacienteId,
  clinicaId,
  sessaoExistente,
  proximoNumeroSessao,
}) => {
  const { dentistas, consultas } = useDentalSystem();
  const [numeroSessao, setNumeroSessao] = useState<number>(proximoNumeroSessao);
  const [nomeObjetivo, setNomeObjetivo] = useState<string>('');
  const [dataPrevista, setDataPrevista] = useState<string>('');
  const [profissionalNome, setProfissionalNome] = useState<string>('');
  const [profissionalId, setProfissionalId] = useState<string>('');
  const [descricaoAtos, setDescricaoAtos] = useState<string>('');
  const [observacoesClinicas, setObservacoesClinicas] = useState<string>('');
  const [consultaId, setConsultaId] = useState<string>('');
  const [status, setStatus] = useState<StatusSessaoTratamento>('prevista');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (sessaoExistente) {
      setNumeroSessao(sessaoExistente.numero_sessao);
      setNomeObjetivo(sessaoExistente.nome_objetivo);
      setDataPrevista(sessaoExistente.data_prevista || '');
      setProfissionalNome(sessaoExistente.profissional_nome || '');
      setProfissionalId(sessaoExistente.profissional_id || '');
      setDescricaoAtos(sessaoExistente.descricao_atos || '');
      setObservacoesClinicas(sessaoExistente.observacoes_clinicas || '');
      setConsultaId(sessaoExistente.consulta_id || '');
      setStatus(sessaoExistente.status);
    } else {
      setNumeroSessao(proximoNumeroSessao);
      setNomeObjetivo(`Sessão ${proximoNumeroSessao}: `);
      setDataPrevista(new Date().toISOString().split('T')[0]);
      if (dentistas && dentistas.length > 0) {
        setProfissionalNome(dentistas[0].nome);
        setProfissionalId(dentistas[0].id);
      }
      setDescricaoAtos('');
      setObservacoesClinicas('');
      setConsultaId('');
      setStatus('prevista');
    }
  }, [sessaoExistente, proximoNumeroSessao, dentistas, isOpen]);

  // Consultas do paciente disponíveis para vínculo
  const consultasPaciente = (consultas || []).filter(c => c.paciente_id === pacienteId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeObjetivo.trim()) return;

    setIsSubmitting(true);
    try {
      await onSalvar({
        tratamento_procedimento_id: procedimentoId,
        paciente_id: pacienteId,
        clinica_id: clinicaId,
        numero_sessao: numeroSessao,
        nome_objetivo: nomeObjetivo.trim(),
        data_prevista: dataPrevista || null,
        profissional_id: profissionalId || null,
        profissional_nome: profissionalNome || 'Dra. Rosângela Santos Pereira',
        descricao_atos: descricaoAtos.trim() || null,
        observacoes_clinicas: observacoesClinicas.trim() || null,
        consulta_id: consultaId || null,
        status,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Plus className="h-5 w-5 text-emerald-600" />
            {sessaoExistente ? `Editar Sessão ${numeroSessao}` : `Adicionar Sessão ${numeroSessao}`}
          </DialogTitle>
          <DialogDescription>
            Defina o objetivo clínico da sessão, data prevista e profissional responsável.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="num-sessao">Nº da Sessão</Label>
              <Input
                id="num-sessao"
                type="number"
                min={1}
                value={numeroSessao}
                onChange={e => setNumeroSessao(Number(e.target.value))}
                required
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="nome-obj">Objetivo / Nome da Sessão *</Label>
              <Input
                id="nome-obj"
                placeholder="Ex: Mockup e Preparo Dental"
                value={nomeObjetivo}
                onChange={e => setNomeObjetivo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="data-prev">Data Prevista</Label>
              <Input
                id="data-prev"
                type="date"
                value={dataPrevista}
                onChange={e => setDataPrevista(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prof-resp">Profissional Responsável *</Label>
              <Select
                value={profissionalNome}
                onValueChange={val => {
                  setProfissionalNome(val);
                  const d = dentistas?.find(item => item.nome === val);
                  if (d) setProfissionalId(d.id);
                }}
              >
                <SelectTrigger id="prof-resp">
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {dentistas && dentistas.length > 0 ? (
                    dentistas.map(d => (
                      <SelectItem key={d.id} value={d.nome}>
                        {d.nome}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="Dra. Rosângela Santos Pereira">
                      Dra. Rosângela Santos Pereira
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Vínculo opcional com a Agenda */}
          <div className="space-y-1.5">
            <Label htmlFor="vinculo-agenda" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarPlus className="h-3.5 w-3.5 text-blue-500" />
              Vincular a uma consulta da Agenda (opcional)
            </Label>
            <Select
              value={consultaId || 'nenhuma'}
              onValueChange={val => setConsultaId(val === 'nenhuma' ? '' : val)}
            >
              <SelectTrigger id="vinculo-agenda">
                <SelectValue placeholder="Selecione um agendamento existente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Sem vínculo com agendamento</SelectItem>
                {consultasPaciente.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    📅 {c.data} às {c.hora} — {c.procedimento || 'Consulta'} ({c.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc-atos">Descrição dos Atos Clínicos Planejados</Label>
            <Textarea
              id="desc-atos"
              rows={3}
              placeholder="Descreva o planejamento técnico e materiais a utilizar nesta sessão..."
              value={descricaoAtos}
              onChange={e => setDescricaoAtos(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-clin">Observações e Orientações</Label>
            <Input
              id="obs-clin"
              placeholder="Ex: Anestesia infiltrativa, dente 11 e 21..."
              value={observacoesClinicas}
              onChange={e => setObservacoesClinicas(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Salvando...' : 'Salvar Sessão'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

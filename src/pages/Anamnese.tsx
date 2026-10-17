import React, { useState, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  ClipboardList,
  Plus,
  Eye,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  Pill,
  HeartPulse,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import AnamneseModal from '@/components/anamnese/AnamneseModal';
import { openWhatsApp } from '@/lib/whatsapp';
import { Anamnese as AnamneseType } from '@/types/shared';

const Anamnese = () => {
  const { anamneses, pacientes, generateSignatureLink, deleteAnamnese } = useDentalSystem();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendente' | 'assinado'>('todos');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [copiandoId, setCopiandoId] = useState<string | null>(null);
  const [gerandoLinkId, setGerandoLinkId] = useState<string | null>(null);
  const [selectedAnamnese, setSelectedAnamnese] = useState<AnamneseType | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Mapeamento rápido de pacientes por id
  const pacientesMap = useMemo(() => {
    const map = new Map<string, any>();
    (pacientes || []).forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [pacientes]);

  const obterPaciente = (pacienteId: string) => {
    return pacientesMap.get(pacienteId);
  };

  const isAnamneseAssinada = (a: AnamneseType) => {
    return Boolean(
      a.assinaturaPaciente ||
      a.statusAssinatura === 'completo' ||
      a.statusAssinatura === 'paciente_assinado'
    );
  };

  // Estatísticas rápidas
  const stats = useMemo(() => {
    const total = (anamneses || []).length;
    const assinadas = (anamneses || []).filter(isAnamneseAssinada).length;
    const pendentes = total - assinadas;
    return { total, assinadas, pendentes };
  }, [anamneses]);

  // Filtro de anamneses
  const filteredAnamneses = useMemo(() => {
    return (anamneses || [])
      .filter((a) => {
        const paciente = obterPaciente(a.pacienteId);
        const pacienteNome = (paciente?.nome || (a as any).pacienteNome || '').toLowerCase();
        const telefone = (paciente?.telefone || '').toLowerCase();
        const cpf = (paciente?.cpf || '').toLowerCase();
        const queixa = (a.queixaPrincipal || '').toLowerCase();
        const termo = searchTerm.toLowerCase().trim();

        const matchBusca =
          !termo ||
          pacienteNome.includes(termo) ||
          telefone.includes(termo) ||
          cpf.includes(termo) ||
          queixa.includes(termo);

        if (!matchBusca) return false;

        const assinada = isAnamneseAssinada(a);
        if (statusFilter === 'assinado') return assinada;
        if (statusFilter === 'pendente') return !assinada;
        return true;
      })
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [anamneses, searchTerm, statusFilter, pacientesMap]);

  // Obter ou gerar link dinâmico
  const obterLink = async (anamnese: AnamneseType): Promise<string> => {
    if (anamnese.linkAssinatura && anamnese.tokenAssinatura) {
      return anamnese.linkAssinatura;
    }
    const link = await generateSignatureLink(anamnese.id);
    return link;
  };

  // Copiar link para área de transferência
  const handleCopiarLink = async (anamnese: AnamneseType) => {
    try {
      setGerandoLinkId(anamnese.id);
      const link = await obterLink(anamnese);
      if (!link) {
        toast.error('Não foi possível gerar o link da anamnese.');
        return;
      }
      await navigator.clipboard.writeText(link);
      setCopiandoId(anamnese.id);
      toast.success('Link da anamnese copiado para a área de transferência!');
      setTimeout(() => setCopiandoId(null), 2500);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      toast.error('Erro ao gerar/copiar link da anamnese');
    } finally {
      setGerandoLinkId(null);
    }
  };

  // Enviar link via WhatsApp
  const handleEnviarWhatsApp = async (anamnese: AnamneseType) => {
    try {
      setGerandoLinkId(anamnese.id);
      const link = await obterLink(anamnese);
      if (!link) {
        toast.error('Não foi possível gerar o link da anamnese.');
        return;
      }

      const paciente = obterPaciente(anamnese.pacienteId);
      const pacienteNome = paciente?.nome || (anamnese as any).pacienteNome || 'Paciente';
      const telefone = paciente?.telefone;

      const mensagem =
        `Olá, *${pacienteNome}*!\n\n` +
        `Para agilizar o seu atendimento e garantir sua máxima segurança clínica, por favor acesse o link abaixo para conferir e assinar digitalmente a sua *Ficha de Anamnese*:\n\n` +
        `👉 ${link}\n\n` +
        `Você pode responder e assinar diretamente pelo celular. Fica salvo no seu prontuário odontológico. Qualquer dúvida, estamos à disposição!`;

      if (!telefone || !openWhatsApp(telefone, mensagem)) {
        await navigator.clipboard.writeText(link);
        toast.info('Paciente sem telefone válido cadastrado. O link foi copiado para a área de transferência!');
      } else {
        toast.success('Abrindo WhatsApp com o link da anamnese...');
      }
    } catch (err) {
      console.error('Erro ao enviar por WhatsApp:', err);
      toast.error('Erro ao preparar mensagem do WhatsApp');
    } finally {
      setGerandoLinkId(null);
    }
  };

  // Abrir link no navegador
  const handleAbrirLink = async (anamnese: AnamneseType) => {
    try {
      setGerandoLinkId(anamnese.id);
      const link = await obterLink(anamnese);
      if (!link) {
        toast.error('Não foi possível obter o link.');
        return;
      }
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error('Erro ao abrir link');
    } finally {
      setGerandoLinkId(null);
    }
  };

  // Visualizar modal com detalhes
  const handleVisualizar = (anamnese: AnamneseType) => {
    setSelectedAnamnese(anamnese);
    setIsViewModalOpen(true);
  };

  // Excluir anamnese
  const handleExcluir = async (anamnese: AnamneseType) => {
    const paciente = obterPaciente(anamnese.pacienteId);
    const nome = paciente?.nome || 'este paciente';
    if (!window.confirm(`Tem certeza que deseja excluir a anamnese de ${nome}?`)) {
      return;
    }
    try {
      await deleteAnamnese(anamnese.id);
      if (selectedAnamnese?.id === anamnese.id) {
        setIsViewModalOpen(false);
        setSelectedAnamnese(null);
      }
    } catch (e) {
      console.error('Erro ao excluir anamnese:', e);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Anamnese Odontológica</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Questionários de saúde, histórico clínico e assinaturas digitais com envio por link e WhatsApp.
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsNewModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nova Anamnese
          </Button>
        </div>

        {/* Estatísticas Rápidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="p-4 border-border/80 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total de Anamneses</p>
                <p className="text-2xl font-bold text-foreground mt-0.5">{stats.total}</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ClipboardList className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Assinadas Digitalmente</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {stats.assinadas}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
          </Card>

          <Card className="p-4 border-border/80 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Aguardando Assinatura</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                  {stats.pendentes}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-5 w-5" />
              </div>
            </div>
          </Card>
        </div>

        {/* Barra de Busca e Filtros */}
        <Card className="p-3 sm:p-4 border-border/80 shadow-xs">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por paciente, telefone, CPF ou queixa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 text-xs sm:text-sm bg-background"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Button
                size="sm"
                variant={statusFilter === 'todos' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('todos')}
                className="text-xs h-8"
              >
                Todas ({stats.total})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'pendente' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('pendente')}
                className="text-xs h-8"
              >
                Aguardando ({stats.pendentes})
              </Button>
              <Button
                size="sm"
                variant={statusFilter === 'assinado' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('assinado')}
                className="text-xs h-8"
              >
                Assinadas ({stats.assinadas})
              </Button>
            </div>
          </div>
        </Card>

        {/* Lista de Anamneses */}
        {filteredAnamneses.length === 0 ? (
          <Card className="text-center py-12 border-dashed border-2 border-border/80">
            <CardContent className="space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                <ClipboardList className="h-6 w-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Nenhuma anamnese encontrada</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {searchTerm || statusFilter !== 'todos'
                  ? 'Tente ajustar os filtros ou o termo de busca pesquisado.'
                  : 'Crie a primeira anamnese para coletar o histórico médico e enviar o link de assinatura para o paciente.'}
              </p>
              <Button
                onClick={() => setIsNewModalOpen(true)}
                className="mt-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Criar Nova Anamnese
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3.5">
            {filteredAnamneses.map((anamnese) => {
              const paciente = obterPaciente(anamnese.pacienteId);
              const pacienteNome = paciente?.nome || (anamnese as any).pacienteNome || 'Paciente';
              const assinada = isAnamneseAssinada(anamnese);
              const isGerandoEste = gerandoLinkId === anamnese.id;

              return (
                <Card
                  key={anamnese.id}
                  className="hover:border-primary/40 transition-colors border-border/80 shadow-xs overflow-hidden"
                >
                  <CardHeader className="p-4 pb-2.5 border-b border-border/40">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase shrink-0">
                          {pacienteNome.slice(0, 2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground text-sm sm:text-base">
                              {pacienteNome}
                            </span>
                            {assinada ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px] gap-1 font-semibold">
                                <CheckCircle2 className="h-3 w-3" />
                                Assinada Digitalmente
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[11px] gap-1 font-semibold">
                                <Clock className="h-3 w-3" />
                                Aguardando Assinatura
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(anamnese.data).toLocaleDateString('pt-BR')}
                            </span>
                            {paciente?.telefone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {paciente.telefone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação Principais */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-2 sm:pt-0">
                        {/* Botão WhatsApp */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEnviarWhatsApp(anamnese)}
                          disabled={isGerandoEste}
                          className="h-8 text-xs border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 gap-1.5 font-semibold"
                          title="Enviar link de preenchimento e assinatura pelo WhatsApp"
                        >
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="hidden sm:inline">WhatsApp</span>
                        </Button>

                        {/* Botão Copiar Link */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopiarLink(anamnese)}
                          disabled={isGerandoEste}
                          className="h-8 text-xs gap-1.5"
                          title="Copiar link para a área de transferência"
                        >
                          {copiandoId === anamnese.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-semibold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="hidden sm:inline">Copiar Link</span>
                            </>
                          )}
                        </Button>

                        {/* Botão Abrir Link */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAbrirLink(anamnese)}
                          disabled={isGerandoEste}
                          className="h-8 text-xs gap-1.5"
                          title="Abrir formulário e tela de assinatura em nova guia"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="hidden md:inline">Abrir Link</span>
                        </Button>

                        {/* Botão Visualizar Detalhes */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVisualizar(anamnese)}
                          className="h-8 text-xs gap-1.5"
                          title="Ver respostas completas e assinaturas"
                        >
                          <Eye className="h-3.5 w-3.5 text-blue-600" />
                          <span>Visualizar</span>
                        </Button>

                        {/* Botão Excluir */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExcluir(anamnese)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          title="Excluir anamnese"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-3 space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-foreground">Queixa Principal: </span>
                      <span className="text-muted-foreground">
                        {anamnese.queixaPrincipal || 'Avaliação clínica odontológica'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {anamnese.alergias && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium border border-amber-500/20">
                          <AlertTriangle className="h-3 w-3" />
                          Alergias: {anamnese.alergias}
                        </span>
                      )}

                      {anamnese.medicamentos && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 text-[11px] font-medium border border-blue-500/20">
                          <Pill className="h-3 w-3" />
                          Medicamentos: {anamnese.medicamentos}
                        </span>
                      )}

                      {anamnese.historiaMedica && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-300 text-[11px] font-medium border border-slate-500/20">
                          <HeartPulse className="h-3 w-3" />
                          Histórico Médico registrado
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal de Criação de Nova Anamnese */}
        <AnamneseModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSave={() => {
            setIsNewModalOpen(false);
          }}
        />

        {/* Modal de Visualização Detalhada da Anamnese */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Ficha de Anamnese Odontológica
              </DialogTitle>
              <DialogDescription>
                Registro clínico detalhado e comprovante de assinatura digital
              </DialogDescription>
            </DialogHeader>

            {selectedAnamnese && (() => {
              const paciente = obterPaciente(selectedAnamnese.pacienteId);
              const pacienteNome = paciente?.nome || (selectedAnamnese as any).pacienteNome || 'Paciente';
              const assinada = isAnamneseAssinada(selectedAnamnese);
              const assinatura = selectedAnamnese.assinaturaPaciente;

              return (
                <div className="space-y-4 pt-2 text-xs sm:text-sm">
                  {/* Resumo do Paciente e Status */}
                  <div className="p-3.5 rounded-lg bg-muted/60 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Paciente</p>
                      <p className="font-bold text-base text-foreground">{pacienteNome}</p>
                      {paciente?.cpf && (
                        <p className="text-xs text-muted-foreground">CPF: {paciente.cpf}</p>
                      )}
                    </div>

                    <div className="sm:text-right">
                      <p className="text-[11px] text-muted-foreground uppercase font-semibold">Data</p>
                      <p className="font-semibold text-foreground">
                        {new Date(selectedAnamnese.data).toLocaleDateString('pt-BR')}
                      </p>
                      <div className="mt-1">
                        {assinada ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[11px]">
                            Assinada Digitalmente
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[11px]">
                            Aguardando Assinatura
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Respostas da Anamnese */}
                  <div className="space-y-3 divide-y divide-border/50">
                    <div className="pt-2">
                      <p className="font-bold text-foreground">1. Queixa Principal:</p>
                      <p className="text-muted-foreground mt-0.5">
                        {selectedAnamnese.queixaPrincipal || 'Não informada'}
                      </p>
                    </div>

                    {selectedAnamnese.historiaAtual && (
                      <div className="pt-2">
                        <p className="font-bold text-foreground">2. História Atual:</p>
                        <p className="text-muted-foreground mt-0.5">{selectedAnamnese.historiaAtual}</p>
                      </div>
                    )}

                    <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="font-bold text-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Alergias:
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {selectedAnamnese.alergias || 'Nenhuma alergia informada'}
                        </p>
                      </div>

                      <div>
                        <p className="font-bold text-foreground flex items-center gap-1">
                          <Pill className="h-3.5 w-3.5 text-blue-600" /> Medicamentos em Uso:
                        </p>
                        <p className="text-muted-foreground mt-0.5">
                          {selectedAnamnese.medicamentos || 'Nenhum medicamento informado'}
                        </p>
                      </div>
                    </div>

                    {selectedAnamnese.historiaMedica && (
                      <div className="pt-2">
                        <p className="font-bold text-foreground">3. História Médica Pregressa:</p>
                        <p className="text-muted-foreground mt-0.5">{selectedAnamnese.historiaMedica}</p>
                      </div>
                    )}

                    {selectedAnamnese.historiaFamiliar && (
                      <div className="pt-2">
                        <p className="font-bold text-foreground">4. História Familiar:</p>
                        <p className="text-muted-foreground mt-0.5">{selectedAnamnese.historiaFamiliar}</p>
                      </div>
                    )}

                    {(selectedAnamnese.habitosViciosPositivos || selectedAnamnese.habitosViciosNegativos) && (
                      <div className="pt-2">
                        <p className="font-bold text-foreground">5. Hábitos e Vícios:</p>
                        <p className="text-muted-foreground mt-0.5">
                          {[selectedAnamnese.habitosViciosPositivos, selectedAnamnese.habitosViciosNegativos]
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </div>
                    )}

                    {selectedAnamnese.observacoes && (
                      <div className="pt-2">
                        <p className="font-bold text-foreground">6. Observações Gerais:</p>
                        <p className="text-muted-foreground mt-0.5">{selectedAnamnese.observacoes}</p>
                      </div>
                    )}
                  </div>

                  {/* Bloco de Assinatura Digital */}
                  <div className="rounded-lg border-2 border-border/80 p-3.5 bg-card space-y-2 mt-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold flex items-center gap-1.5 text-foreground text-xs uppercase tracking-wide">
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        Autenticação e Assinatura Digital
                      </span>
                      {assinada ? (
                        <Badge className="bg-emerald-600 text-white text-[10px]">Documento Assinado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/40 text-[10px]">
                          Pendente de Assinatura
                        </Badge>
                      )}
                    </div>

                    {assinada && assinatura ? (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Assinado por:</span>
                            <span className="font-semibold text-foreground">
                              {assinatura.signerName || pacienteNome}
                            </span>
                          </div>

                          <div>
                            <span className="text-muted-foreground block text-[11px]">Data e Hora:</span>
                            <span className="font-semibold text-foreground">
                              {assinatura.timestamp ? new Date(assinatura.timestamp).toLocaleString('pt-BR') : 'Registrada'}
                            </span>
                          </div>

                          {assinatura.signerInfo?.cpf && (
                            <div>
                              <span className="text-muted-foreground block text-[11px]">CPF:</span>
                              <span className="font-mono text-foreground">{assinatura.signerInfo.cpf}</span>
                            </div>
                          )}

                          {assinatura.signerInfo?.email && (
                            <div>
                              <span className="text-muted-foreground block text-[11px]">E-mail:</span>
                              <span className="text-foreground">{assinatura.signerInfo.email}</span>
                            </div>
                          )}
                        </div>

                        {/* Imagem do Traço de Assinatura */}
                        {assinatura.signature && (
                          <div className="pt-2">
                            <span className="text-[11px] text-muted-foreground block mb-1">Traço Digital:</span>
                            <div className="p-2 border rounded-md bg-white max-w-sm">
                              <img
                                src={assinatura.signature}
                                alt="Assinatura Digital"
                                className="h-20 w-auto object-contain mx-auto"
                              />
                            </div>
                          </div>
                        )}

                        {/* Foto Selfie (se houver) */}
                        {(assinatura as any).selfie && (
                          <div className="pt-2">
                            <span className="text-[11px] text-muted-foreground block mb-1">Foto Selfie de Validação:</span>
                            <img
                              src={(assinatura as any).selfie}
                              alt="Selfie do Assinante"
                              className="h-24 w-24 rounded-md object-cover border"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          Esta anamnese ainda não foi assinada pelo paciente. Envie o link pelo WhatsApp ou copie o link para que o paciente assine em seu celular.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleEnviarWhatsApp(selectedAnamnese)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            Enviar WhatsApp
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopiarLink(selectedAnamnese)}
                            className="text-xs gap-1.5"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copiar Link
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAbrirLink(selectedAnamnese)}
                            className="text-xs gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir Link
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Anamnese;

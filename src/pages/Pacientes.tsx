import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PatientForm from '@/components/pacientes/PatientForm';
import PatientDetails from '@/components/pacientes/PatientDetails';
import PatientArchiveModal from '@/components/pacientes/PatientArchiveModal';
import PatientDeleteModal from '@/components/pacientes/PatientDeleteModal';
import ManutencaoLentesCard from '@/components/pacientes/ManutencaoLentesCard';
import ConsultaModal from '@/components/agenda/ConsultaModal';
import ProntuarioModal from '@/components/prontuarios/ProntuarioModal';
import ProcedimentoForm from '@/components/procedimentos/ProcedimentoForm';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { openWhatsApp } from '@/lib/whatsapp';
import { useSecurityGate } from '@/context/SecurityContext';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, Plus, UserCheck, Calendar, Archive, MoreVertical, MoreHorizontal, ChevronDown, Filter, X, Edit2, Trash2, RotateCcw, Stethoscope, Sparkles, ClipboardList, Link2, UploadCloud, MessageSquare } from 'lucide-react';
import { Procedimento } from '@/types/procedimentos';
import { ScannerProntuarioModal } from '@/components/pacientes/ScannerProntuarioModal';
import { ModalLeitorPdfFichas } from '@/components/pacientes/ModalLeitorPdfFichas';
import { ModalComandosWhatsapp } from '@/components/pacientes/ModalComandosWhatsapp';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { ModalEnviarAnamnese } from '@/components/anamnese/ModalEnviarAnamnese';
import { PacienteCombobox } from '@/components/pacientes/PacienteCombobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';


const Pacientes = () => {
  const { 
    pacientes, 
    loading, 
    deletePaciente, 
    archivePaciente, 
    reactivatePaciente 
  } = useDentalSystem();

  const {
    addProcedimento,
    updateProcedimento,
  } = useProcedimentos();
  
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [editingPatient, setEditingPatient] = useState(null);
  const [schedulingPatient, setSchedulingPatient] = useState<any>(null);

  const handleConsultaSaved = (savedDate?: Date) => {
    setSchedulingPatient(null);
    const dataStr = savedDate instanceof Date && !isNaN(savedDate.getTime()) 
      ? `${savedDate.getFullYear()}-${String(savedDate.getMonth() + 1).padStart(2, '0')}-${String(savedDate.getDate()).padStart(2, '0')}`
      : '';
    toast.success('Consulta agendada com sucesso!', {
      action: {
        label: 'Ver na Agenda',
        onClick: () => navigate(dataStr ? `/agenda?data=${dataStr}` : '/agenda')
      }
    });
  };
  const [procedimentoPatient, setProcedimentoPatient] = useState<any>(null);
  const [pacienteAnamneseModal, setPacienteAnamneseModal] = useState<any>(null);
  const [isEscolherPacienteAnamneseOpen, setIsEscolherPacienteAnamneseOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ativos');
  const [anoArquivo, setAnoArquivo] = useState('todos');
  const [tipoData, setTipoData] = useState<'cadastro' | 'atendimento'>('cadastro');
  const [mesFiltro, setMesFiltro] = useState('todos');
  const [anoFiltro, setAnoFiltro] = useState('todos');
  const [showFiltros, setShowFiltros] = useState(false);
  const { requireMasterPassword } = useSecurityGate();
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isLeitorPdfOpen, setIsLeitorPdfOpen] = useState(false);
  const [isComandosWhatsappOpen, setIsComandosWhatsappOpen] = useState(false);
  const { configuracoes } = useConfiguracoes();

  const handleScannerResult = (dadosExtraidos: any) => {
    setEditingPatient({
      id: '',
      nome: dadosExtraidos.nome || '',
      telefone: dadosExtraidos.telefone || '',
      cpf: dadosExtraidos.cpf || '',
      dataNascimento: dadosExtraidos.dataNascimento || '',
      endereco: dadosExtraidos.endereco || '',
      historicoMedico: dadosExtraidos.historicoMedico || '',
      alergias: dadosExtraidos.alergias || '',
      medicamentos: dadosExtraidos.medicamentos || '',
      observacoes: dadosExtraidos.observacoes || '',
      status: 'Ativo',
      criadoEm: new Date().toISOString()
    } as any);
    setShowForm(true);
  };

  // Modals
  const [archiveModal, setArchiveModal] = useState({ isOpen: false, patient: null });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, patient: null });
  
  // Procedimento modal
  const [showProcedimentoForm, setShowProcedimentoForm] = useState(false);
  const [selectedProcedimento, setSelectedProcedimento] = useState<Procedimento | null>(null);

  const handleSelectPatient = (patient: any) => {
    setSelectedPatient(patient);
    if (patient?.id) {
      sessionStorage.setItem('dental_ultimo_paciente_id', patient.id);
      searchParams.set('id', patient.id);
      setSearchParams(searchParams, { replace: true });
    }
  };

  React.useEffect(() => {
    const idFromUrl = searchParams.get('id');
    const idFromStorage = sessionStorage.getItem('dental_ultimo_paciente_id');
    const id = idFromUrl || idFromStorage;
    if (id && pacientes.length > 0) {
      const patient = pacientes.find(p => p.id === id);
      if (patient) {
        setSelectedPatient((prev: any) => prev?.id === id ? prev : patient);
        if (!idFromUrl) {
          searchParams.set('id', id);
          setSearchParams(searchParams, { replace: true });
        }
      }
    }
  }, [searchParams, pacientes]);

  React.useEffect(() => {
    if (selectedPatient) {
      const updated = pacientes.find(p => p.id === selectedPatient.id);
      if (updated && updated !== selectedPatient) {
        setSelectedPatient(updated);
      }
    }
  }, [pacientes]);

  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const totalFiltrosAtivos = (statusFiltro !== 'todos' ? 1 : 0) +
    (mesFiltro !== 'todos' ? 1 : 0) +
    (anoFiltro !== 'todos' ? 1 : 0);
  const temFiltroAtivo = totalFiltrosAtivos > 0;



  const pacientesAtivos = (pacientes || []).filter(p => p && p.status !== 'Arquivado');
  const pacientesArquivados = (pacientes || []).filter(p => p && p.status === 'Arquivado');

  const anosArquivo = Array.from(
    new Set(
      pacientesArquivados
        .filter(p => p.dataArquivamento)
        .map(p => String(new Date(p.dataArquivamento).getFullYear()))
    )
  ).sort((a, b) => Number(b) - Number(a));

  const arquivadosFiltradosPorAno = anoArquivo === 'todos'
    ? pacientesArquivados
    : pacientesArquivados.filter(
        p => p.dataArquivamento && String(new Date(p.dataArquivamento).getFullYear()) === anoArquivo
      );

  const currentPacientes = activeTab === 'ativos' ? pacientesAtivos : arquivadosFiltradosPorAno;

  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const getDataReferencia = (paciente: any): Date | null => {
    const valor = tipoData === 'cadastro' ? paciente.criadoEm : paciente.ultimaConsulta;
    if (!valor) return null;
    const d = new Date(valor);
    return isNaN(d.getTime()) ? null : d;
  };

  const anosDisponiveis = Array.from(
    new Set(
      pacientes
        .map(p => {
          const v = tipoData === 'cadastro' ? (p as any).criadoEm : p.ultimaConsulta;
          if (!v) return null;
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : String(d.getFullYear());
        })
        .filter(Boolean) as string[]
    )
  ).sort((a, b) => Number(b) - Number(a));

  const normalizar = (txt: string) =>
    (txt || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  const termoNorm = normalizar(searchTerm);
  const apenasDigitosTermo = searchTerm.replace(/\D/g, '');

  const filteredPacientes = currentPacientes.filter(paciente => {
    if (termoNorm) {
      const nomeNorm = normalizar(paciente.nome);
      const emailNorm = normalizar(paciente.email);
      const telDigitos = (paciente.telefone || '').replace(/\D/g, '');
      const cpfDigitos = (paciente.cpf || '').replace(/\D/g, '');

      const tokens = termoNorm.split(/\s+/).filter(Boolean);
      const matchTokens = tokens.length === 0 || tokens.every(tok => {
        const tokDigitos = tok.replace(/\D/g, '');
        return (
          nomeNorm.includes(tok) ||
          emailNorm.includes(tok) ||
          (tokDigitos.length >= 2 && (telDigitos.includes(tokDigitos) || cpfDigitos.includes(tokDigitos)))
        );
      });

      const matchDigitos =
        apenasDigitosTermo.length >= 2 &&
        (telDigitos.includes(apenasDigitosTermo) || cpfDigitos.includes(apenasDigitosTermo));

      if (!matchTokens && !matchDigitos) return false;
    }

    if (statusFiltro !== 'todos' && (paciente.status || 'Ativo') !== statusFiltro) return false;

    if (mesFiltro === 'todos' && anoFiltro === 'todos') return true;

    const data = getDataReferencia(paciente);
    if (!data) return false;
    if (mesFiltro !== 'todos' && data.getMonth() !== Number(mesFiltro)) return false;
    if (anoFiltro !== 'todos' && data.getFullYear() !== Number(anoFiltro)) return false;
    return true;
  });


  const handleClosePatientDetails = () => {
    setSelectedPatient(null);
    sessionStorage.removeItem('dental_ultimo_paciente_id');
    if (searchParams.get('id')) {
      searchParams.delete('id');
      setSearchParams(searchParams, { replace: true });
    }
  };

  const handleEditPatient = (patient: any) => {
    console.log('Editing patient:', patient);
    setEditingPatient(patient);
    setShowForm(true);
    setSelectedPatient(null);
  };

  const handleCloseForm = () => {
    console.log('Closing form');
    setShowForm(false);
    setEditingPatient(null);
  };

  const handleArchivePatient = (patient: any) => {
    setArchiveModal({ isOpen: true, patient });
  };

  const confirmArchive = async (motivo: string) => {
    const patient = archiveModal.patient;
    setArchiveModal({ isOpen: false, patient: null });
    if (patient) {
      try {
        await archivePaciente(patient.id, motivo);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDeletePatient = (patient: any) => {
    setDeleteModal({ isOpen: true, patient });
  };

  const confirmDelete = async () => {
    const patient = deleteModal.patient;
    setDeleteModal({ isOpen: false, patient: null });
    if (patient) {
      const autorizado = await requireMasterPassword(
        `O paciente "${patient.nome}" será movido para a lixeira e poderá ser restaurado por 30 dias.`
      );
      if (!autorizado) return;
      try {
        await deletePaciente(patient.id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleReactivatePatient = async (patient: any) => {
    await reactivatePaciente(patient.id);
  };

  const handleAddProcedimento = () => {
    setSelectedProcedimento(null);
    setShowProcedimentoForm(true);
  };

  const handleSaveProcedimento = async (
    procedimentoData: Omit<Procedimento, 'id' | 'criadoEm' | 'atualizadoEm'>
  ) => {
    setShowProcedimentoForm(false);
    if (selectedProcedimento) {
      await updateProcedimento(selectedProcedimento.id, procedimentoData);
    } else {
      await addProcedimento(procedimentoData);
    }
    setSelectedProcedimento(null);
  };

  const handleCancelProcedimento = () => {
    setShowProcedimentoForm(false);
    setSelectedProcedimento(null);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Ativo':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300">Ativo</Badge>;
      case 'Pendente':
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300">Pendente</Badge>;
      case 'Em Tratamento':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300">Em Tratamento</Badge>;
      case 'Tratamento Concluido':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300">Tratamento Concluído</Badge>;
      case 'Arquivado':
        return <Badge className="bg-muted text-foreground border-border">Arquivado</Badge>;
      case 'Inativo':
        return <Badge variant="secondary">Inativo</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Ativo'}</Badge>;
    }
  };

  const getOrigemLead = (origem: string) => {
    const origens: { [key: string]: string } = {
      'indicacao': 'Indicação',
      'google': 'Google',
      'facebook': 'Facebook',
      'instagram': 'Instagram',
      'site': 'Site',
      'whatsapp': 'WhatsApp',
      'panfleto': 'Panfleto',
      'outros': 'Outros'
    };
    return origens[origem] || origem;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" text="Carregando pacientes..." />
        </div>
      </Layout>
    );
  }

  if (showForm) {
    return (
      <Layout>
        <PatientForm
          patient={editingPatient}
          onClose={handleCloseForm}
        />
      </Layout>
    );
  }

  if (selectedPatient) {
    const currentPatient = (pacientes || []).find((p: any) => p.id === (selectedPatient as any).id) || selectedPatient;
    return (
      <Layout>
        <PatientDetails
          patient={currentPatient}
          onClose={handleClosePatientDetails}
          onEdit={() => handleEditPatient(currentPatient)}
          onSchedule={() => setSchedulingPatient(currentPatient)}
          onAddProcedimento={() => setProcedimentoPatient(currentPatient)}
        />
        <ConsultaModal
          isOpen={Boolean(schedulingPatient)}
          onClose={() => setSchedulingPatient(null)}
          initialPatientId={schedulingPatient?.id}
          onSaved={handleConsultaSaved}
        />
        <ProntuarioModal
          isOpen={Boolean(procedimentoPatient)}
          onClose={() => setProcedimentoPatient(null)}
          preSelectedPatient={procedimentoPatient?.id}
          onSave={() => setProcedimentoPatient(null)}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 pb-16 lg:pb-6">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600 shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Pacientes</h1>
          </div>

          <div className="flex items-center gap-2 w-full xl:w-auto">
            {/* Buscador de Paciente */}
            <div className="relative flex-1 min-w-0 sm:w-80 md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none" />
              <Input
                placeholder="Buscar paciente..."
                className="pl-9 pr-8 h-10 w-full bg-background border border-input focus:border-blue-600 dark:focus:border-blue-500 text-sm font-medium rounded-lg shadow-xs transition-all placeholder:text-muted-foreground"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground text-xs rounded-full hover:bg-muted transition-colors cursor-pointer"
                  title="Limpar busca"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Barra de Ações: Apenas Ícones no Mobile (Minimalista e Otimizado), com Texto no Desktop */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* 1. Novo Paciente: Apenas ícone (+) no mobile */}
              <Button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 hover:bg-blue-700 h-10 w-10 sm:w-auto sm:px-4 p-0 font-semibold text-white shadow-xs shrink-0 flex items-center justify-center gap-1.5"
                title="Cadastrar Novo Paciente"
                aria-label="Novo Paciente"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Novo Paciente</span>
              </Button>

              {/* 2. Enviar Anamnese: Direto no desktop, agrupado no menu no mobile */}
              <Button
                onClick={() => setIsEscolherPacienteAnamneseOpen(true)}
                variant="outline"
                className="hidden md:inline-flex border-indigo-300 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300 dark:bg-indigo-950/40 h-10 font-semibold shadow-xs shrink-0 gap-1.5"
                title="Gerar e enviar link de anamnese para qualquer paciente preencher ou assinar"
              >
                <ClipboardList className="h-4 w-4 mr-1 text-indigo-600" />
                <span>Enviar Anamnese</span>
              </Button>

              {/* 3. Símbolo de Filtros: Apenas ícone no mobile, com texto e badge no desktop */}
              <Button
                type="button"
                variant={showFiltros || temFiltroAtivo ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFiltros((prev) => !prev)}
                className={cn(
                  "h-10 w-10 sm:w-auto sm:px-3 p-0 font-semibold shadow-xs shrink-0 gap-1.5 transition-all cursor-pointer relative flex items-center justify-center",
                  (showFiltros || temFiltroAtivo)
                    ? "bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 border-transparent"
                    : "border-border/80 text-foreground hover:bg-muted/60"
                )}
                title={showFiltros ? "Ocultar filtros" : "Filtrar pacientes por status, data, mês ou ano"}
                aria-label="Filtros"
              >
                <Filter className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-xs font-semibold hidden sm:inline">Filtros</span>
                {totalFiltrosAtivos > 0 && (
                  <Badge variant="secondary" className="absolute -top-1 -right-1 sm:static sm:top-auto sm:right-auto h-4 min-w-[16px] sm:h-5 px-1 sm:px-1.5 text-[9px] sm:text-[10px] font-bold bg-blue-500 text-white rounded-full flex items-center justify-center">
                    {totalFiltrosAtivos}
                  </Badge>
                )}
              </Button>

              {/* 4. Menu Mais (Ferramentas): Apenas ícone no mobile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 w-10 sm:w-auto sm:px-3 p-0 font-semibold shadow-xs shrink-0 gap-1.5 border-border/80 text-foreground hover:bg-muted/60 flex items-center justify-center"
                    title="Mais ferramentas e ações"
                    aria-label="Mais opções"
                  >
                    <MoreHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs font-semibold hidden sm:inline">Mais</span>
                    <ChevronDown className="h-3 w-3 opacity-60 hidden sm:inline" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl bg-popover border border-border">
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-semibold px-2 py-1">
                    Ferramentas & Integrações
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setIsEscolherPacienteAnamneseOpen(true)}
                    className="cursor-pointer gap-2.5 py-2 text-xs font-medium md:hidden"
                  >
                    <ClipboardList className="h-4 w-4 text-indigo-600" />
                    <span>Enviar Anamnese</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsLeitorPdfOpen(true)}
                    className="cursor-pointer gap-2.5 py-2 text-xs font-medium"
                  >
                    <UploadCloud className="h-4 w-4 text-emerald-600" />
                    <span>Importar Fichas PDF</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsComandosWhatsappOpen(true)}
                    className="cursor-pointer gap-2.5 py-2 text-xs font-medium"
                  >
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    <span>Comandos WhatsApp</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setIsScannerOpen(true)}
                    className="cursor-pointer gap-2.5 py-2 text-xs font-medium"
                  >
                    <Sparkles className="h-4 w-4 text-indigo-600" />
                    <span>Ficha Digital (IA)</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleAddProcedimento}
                    className="cursor-pointer gap-2.5 py-2 text-xs font-medium"
                  >
                    <Stethoscope className="h-4 w-4 text-blue-600" />
                    <span>Novo Procedimento</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Pacientes</p>
                  <p className="text-xl sm:text-2xl font-bold">{pacientes.length}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pacientes Ativos</p>
                  <p className="text-xl sm:text-2xl font-bold">{(pacientes || []).filter(p => p?.status === 'Ativo').length}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{(pacientes || []).filter(p => p?.status === 'Em Tratamento').length} em tratamento</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-xl sm:text-2xl font-bold">{(pacientes || []).filter(p => p?.status === 'Pendente').length}</p>
                  <p className="text-xs text-purple-600 mt-0.5">{(pacientes || []).filter(p => p?.status === 'Tratamento Concluido').length} concluídos</p>
                </div>
                <Calendar className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Arquivados</p>
                  <p className="text-xl sm:text-2xl font-bold">{(pacientes || []).filter(p => p?.status === 'Arquivado').length}</p>
                </div>
                <Archive className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Manutenção de Lentes */}
        <ManutencaoLentesCard
          onSchedule={(pacienteId) => {
            const p = pacientes.find((x) => x.id === pacienteId);
            if (p) setSchedulingPatient(p);
          }}
        />

        {/* Abas e Filtros */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="ativos" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ativos ({pacientesAtivos.length})
              </TabsTrigger>
              <TabsTrigger value="arquivados" className="flex items-center gap-2">
                <Archive className="h-4 w-4" />
                Arquivados ({pacientesArquivados.length})
              </TabsTrigger>
            </TabsList>

            {searchTerm && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/70 border border-border px-3 py-1.5 rounded-lg">
                <span>Filtrando busca: <strong className="text-foreground">"{searchTerm}"</strong></span>
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-blue-600 hover:text-blue-700 font-semibold hover:underline ml-1 cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          {/* Painel de Filtros Oculto por Padrão: Aberto pelo símbolo de filtros no topo */}
          {showFiltros && (
            <div className="p-3.5 mt-3 rounded-xl border border-border/80 bg-muted/30 dark:bg-muted/10 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                    Filtros de Pacientes
                  </span>
                  {totalFiltrosAtivos > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-300">
                      {totalFiltrosAtivos} {totalFiltrosAtivos === 1 ? 'filtro ativo' : 'filtros ativos'}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {temFiltroAtivo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setMesFiltro('todos');
                        setAnoFiltro('todos');
                        setStatusFiltro('todos');
                        setTipoData('cadastro');
                      }}
                      className="h-7 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 font-medium"
                    >
                      Limpar filtros
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowFiltros(false)}
                    className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="Fechar painel de filtros"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="w-full h-9 text-xs bg-background">
                    <SelectValue placeholder="Filtrar por Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os status</SelectItem>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Pendente">Pendente</SelectItem>
                    <SelectItem value="Em Tratamento">Em Tratamento</SelectItem>
                    <SelectItem value="Tratamento Concluido">Tratamento Concluído</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={tipoData} onValueChange={(v) => setTipoData(v as 'cadastro' | 'atendimento')}>
                  <SelectTrigger className="w-full h-9 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cadastro">Data de cadastro</SelectItem>
                    <SelectItem value="atendimento">Data do último atendimento</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={mesFiltro} onValueChange={setMesFiltro}>
                  <SelectTrigger className="w-full h-9 text-xs bg-background">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os meses</SelectItem>
                    {MESES.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={anoFiltro} onValueChange={setAnoFiltro}>
                  <SelectTrigger className="w-full h-9 text-xs bg-background">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os anos</SelectItem>
                    {anosDisponiveis.map((ano) => (
                      <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Indicador sutil de filtros ativos quando o painel estiver fechado */}
          {!showFiltros && temFiltroAtivo && (
            <div className="flex items-center gap-1.5 flex-wrap pt-2 text-xs">
              <span className="text-muted-foreground text-[11px] font-medium flex items-center gap-1">
                <Filter className="h-3 w-3 text-blue-500" />
                Filtros ativos:
              </span>
              {statusFiltro !== 'todos' && (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Status: {statusFiltro}
                  <button type="button" onClick={() => setStatusFiltro('todos')} className="hover:text-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              )}
              {mesFiltro !== 'todos' && (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Mês: {MESES[Number(mesFiltro)]}
                  <button type="button" onClick={() => setMesFiltro('todos')} className="hover:text-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              )}
              {anoFiltro !== 'todos' && (
                <Badge variant="secondary" className="gap-1 text-[11px] h-6 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Ano: {anoFiltro}
                  <button type="button" onClick={() => setAnoFiltro('todos')} className="hover:text-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              )}
              <button
                type="button"
                onClick={() => {
                  setMesFiltro('todos');
                  setAnoFiltro('todos');
                  setStatusFiltro('todos');
                  setTipoData('cadastro');
                }}
                className="text-[11px] text-blue-600 hover:underline ml-1 cursor-pointer font-medium"
              >
                Limpar todos
              </button>
            </div>
          )}


          <TabsContent value="ativos">
            <Card>
              <CardHeader>
                <CardTitle>Pacientes Ativos ({filteredPacientes.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {filteredPacientes.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="Nenhum paciente encontrado"
                    description={searchTerm ? 'Tente buscar com outros termos' : 'Comece adicionando um novo paciente ao sistema'}
                    action={!searchTerm ? {
                      label: 'Adicionar Paciente',
                      onClick: () => setShowForm(true)
                    } : undefined}
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredPacientes.map((paciente) => (
                      <div
                        key={paciente.id}
                        className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-muted transition-colors"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => handleSelectPatient(paciente)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <img
                                src={paciente.foto || '/placeholder.svg'}
                                alt={paciente.nome}
                                className="h-12 w-12 rounded-full object-cover border-2 border-border"
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-foreground truncate">
                                  {paciente.nome}
                                </h3>
                                {getStatusBadge(paciente.status)}
                              </div>
                              <div className="mt-1 flex flex-col sm:flex-row sm:flex-wrap sm:space-x-6">
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  <span>{paciente.email}</span>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  {paciente.telefone ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openWhatsApp(paciente.telefone, '');
                                      }}
                                      className="text-primary hover:underline focus:outline-none"
                                      title="Abrir conversa no WhatsApp"
                                    >
                                      {paciente.telefone}
                                    </button>
                                  ) : (
                                    <span>—</span>
                                  )}
                                </div>
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  <span>Convênio: {paciente.convenio}</span>
                                </div>
                                <div className="mt-2 flex items-center text-sm text-muted-foreground">
                                  <span>Origem: {getOrigemLead(paciente.origemLead)}</span>
                                </div>
                              </div>
                              <div className="mt-2 flex items-center text-xs text-muted-foreground">
                                {paciente.ultimaConsulta && (
                                  <span>Última consulta: {new Date(paciente.ultimaConsulta).toLocaleDateString('pt-BR')}</span>
                                )}
                                {paciente.proximaConsulta && (
                                  <span className="ml-4">Próxima consulta: {new Date(paciente.proximaConsulta).toLocaleDateString('pt-BR')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPacienteAnamneseModal(paciente);
                            }}
                            className="hidden sm:inline-flex h-8 px-2.5 text-xs font-semibold gap-1.5 border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100 dark:border-indigo-800 dark:text-indigo-300 dark:bg-indigo-950/40 shadow-xs"
                            title="Enviar link para o paciente preencher ou assinar a anamnese"
                          >
                            <ClipboardList className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Enviar Anamnese</span>
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setPacienteAnamneseModal(paciente)}>
                                <ClipboardList className="h-4 w-4 mr-2 text-indigo-600" />
                                Enviar Anamnese por Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditPatient(paciente)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleArchivePatient(paciente)}>
                              <Archive className="h-4 w-4 mr-2" />
                              Arquivar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeletePatient(paciente)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="arquivados">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle>Pacientes Arquivados ({filteredPacientes.length})</CardTitle>
                  <Select value={anoArquivo} onValueChange={setAnoArquivo}>
                    <SelectTrigger className="w-full sm:w-44">
                      <SelectValue placeholder="Ano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os anos</SelectItem>
                      {anosArquivo.map((ano) => (
                        <SelectItem key={ano} value={ano}>{ano}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPacientes.length === 0 ? (
                  <EmptyState
                    icon={Archive}
                    title="Nenhum paciente arquivado"
                    description="Pacientes arquivados aparecerão aqui"
                  />
                ) : (
                  <div className="space-y-4">
                    {filteredPacientes.map((paciente) => (
                      <div
                        key={paciente.id}
                        className="flex items-center space-x-4 p-4 border rounded-lg bg-muted"
                      >
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedPatient(paciente)}
                        >
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              <img
                                src={paciente.foto || '/placeholder.svg'}
                                alt={paciente.nome}
                                className="h-12 w-12 rounded-full object-cover border-2 border-border opacity-60"
                              />
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-medium text-foreground truncate">
                                  {paciente.nome}
                                </h3>
                                {getStatusBadge(paciente.status)}
                              </div>
                              {paciente.dataArquivamento && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                  Arquivado em: {new Date(paciente.dataArquivamento).toLocaleDateString('pt-BR')}
                                </div>
                              )}
                              {paciente.motivoArquivamento && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Motivo: {paciente.motivoArquivamento}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleReactivatePatient(paciente)}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Reativar
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeletePatient(paciente)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <PatientArchiveModal
          isOpen={archiveModal.isOpen}
          onClose={() => setArchiveModal({ isOpen: false, patient: null })}
          onConfirm={confirmArchive}
          patientName={archiveModal.patient?.nome || ''}
        />

        <PatientDeleteModal
          isOpen={deleteModal.isOpen}
          onClose={() => setDeleteModal({ isOpen: false, patient: null })}
          onConfirm={confirmDelete}
          patientName={deleteModal.patient?.nome || ''}
          isArchived={deleteModal.patient?.status === 'Arquivado'}
        />

        {showProcedimentoForm && (
          <ProcedimentoForm
            procedimento={selectedProcedimento}
            onSave={handleSaveProcedimento}
            onCancel={handleCancelProcedimento}
          />
        )}

        <ConsultaModal
          isOpen={Boolean(schedulingPatient)}
          onClose={() => setSchedulingPatient(null)}
          initialPatientId={schedulingPatient?.id}
          onSaved={handleConsultaSaved}
        />

        {pacienteAnamneseModal && (
          <ModalEnviarAnamnese
            isOpen={Boolean(pacienteAnamneseModal)}
            patient={pacienteAnamneseModal}
            onClose={() => setPacienteAnamneseModal(null)}
          />
        )}

        <Dialog open={isEscolherPacienteAnamneseOpen} onOpenChange={setIsEscolherPacienteAnamneseOpen}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-600" />
                Enviar Anamnese ao Paciente
              </DialogTitle>
              <DialogDescription>
                Selecione o paciente para gerar o link individual e amigável para preenchimento ou assinatura digital.
              </DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <PacienteCombobox
                pacientes={pacientes}
                value=""
                onChange={(pacienteId) => {
                  const p = pacientes.find(item => item.id === pacienteId);
                  if (p) {
                    setIsEscolherPacienteAnamneseOpen(false);
                    setPacienteAnamneseModal(p);
                  }
                }}
                placeholder="Buscar paciente por nome, CPF ou telefone..."
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <ScannerProntuarioModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        geminiApiKey={configuracoes?.geminiApiKey || ''}
        openaiApiKey={configuracoes?.openaiApiKey || ''}
        onExtraido={handleScannerResult}
      />
      <ModalLeitorPdfFichas
        isOpen={isLeitorPdfOpen}
        onClose={() => setIsLeitorPdfOpen(false)}
      />
      <ModalComandosWhatsapp
        isOpen={isComandosWhatsappOpen}
        onClose={() => setIsComandosWhatsappOpen(false)}
        onPacienteCriado={(id) => handleSelectPatient({ id })}
      />
    </Layout>
  );
};

export default Pacientes;





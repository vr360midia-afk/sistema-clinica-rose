
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CalendarPlus, Edit2, Plus, User, FileText, ClipboardList, ListChecks, FolderOpen, History, DollarSign, Stethoscope, MessageCircle } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';
import PatientPersonalInfo from './PatientPersonalInfo';
import PatientMedicalRecords from './PatientMedicalRecords';
import PatientAnamnesis from './PatientAnamnesis';
import PatientDocuments from './PatientDocuments';
import PatientTimeline from './PatientTimeline';
import PatientFinancial from './PatientFinancial';
import PatientOrcamentos from './PatientOrcamentos';
import PatientDocumentosClinicos from './PatientDocumentosClinicos';
import { ImpressaoDocs } from './ImpressaoDocs';


interface PatientDetailsProps {
  patient: any;
  onClose: () => void;
  onEdit: () => void;
  onSchedule: () => void;
  onAddProcedimento?: () => void;
}

const PatientDetails = ({ patient, onClose, onEdit, onSchedule, onAddProcedimento }: PatientDetailsProps) => {
  const [activeTab, setActiveTab] = React.useState<string>(() => {
    return (patient?.id && sessionStorage.getItem(`dental_tab_${patient.id}`)) || 'personal';
  });

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (patient?.id) {
      sessionStorage.setItem(`dental_tab_${patient.id}`, val);
    }
  };

  const renderStatusBadge = (status?: string) => {
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

  return (
    <div className="space-y-4 sm:space-y-6 pb-16 lg:pb-6">
      {/* Cabeçalho do Paciente com Ações Elegantes e Responsivas */}
      <div className="bg-card border border-border rounded-xl p-3.5 sm:p-5 shadow-xs space-y-3.5">
        {/* Linha 1: Voltar + Dados de Identificação */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9 shrink-0 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground mt-0.5"
            title="Voltar para a lista de pacientes"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground leading-tight truncate">
                {patient?.nome}
              </h1>
              {renderStatusBadge(patient?.status || 'Ativo')}
            </div>
            <div className="flex items-center gap-2.5 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
              {patient.telefone && (
                <button
                  type="button"
                  onClick={() => openWhatsApp(patient.telefone, '')}
                  className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  title="Abrir conversa no WhatsApp"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  <span>{patient.telefone}</span>
                </button>
              )}
              {patient.telefone && patient.email && <span>•</span>}
              {patient.email && (
                <span className="truncate max-w-[200px] sm:max-w-none text-muted-foreground/90">
                  {patient.email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Linha 2: Barra de Ações Rápida e Elegante */}
        <div className="pt-3 border-t border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Ações Principais: Agendar, Procedimento, Editar */}
          <div className="grid grid-cols-3 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <Button
              onClick={onSchedule}
              size="sm"
              className="h-9 px-2 sm:px-3 text-xs font-semibold gap-1.5 shadow-xs justify-center"
            >
              <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
              <span>Agendar</span>
            </Button>

            {onAddProcedimento && (
              <Button
                onClick={onAddProcedimento}
                variant="secondary"
                size="sm"
                className="h-9 px-2 sm:px-3 text-xs font-semibold gap-1.5 border border-border/80 shadow-xs justify-center"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Procedimento</span>
              </Button>
            )}

            <Button
              onClick={onEdit}
              variant="outline"
              size="sm"
              className="h-9 px-2 sm:px-3 text-xs font-medium gap-1.5 hover:bg-muted justify-center"
              title="Editar dados cadastrais"
            >
              <Edit2 className="h-3.5 w-3.5 shrink-0" />
              <span>Editar</span>
            </Button>
          </div>

          {/* Documentos & Assinaturas: Anamnese, Contrato, Atestado, Receita */}
          <div className="grid grid-cols-4 sm:flex sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <ImpressaoDocs patient={patient} />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 sm:space-y-6">
        <TabsList className="flex overflow-x-auto sm:grid w-full sm:grid-cols-4 lg:grid-cols-8 h-auto p-1 gap-1 border border-border bg-muted/60 no-scrollbar">
          <TabsTrigger value="personal" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <User className="h-4 w-4" />
            <span>Dados Pessoais</span>
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <FileText className="h-4 w-4" />
            <span>Prontuários</span>
          </TabsTrigger>
          <TabsTrigger value="anamnesis" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <ClipboardList className="h-4 w-4" />
            <span>Anamneses</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <History className="h-4 w-4" />
            <span>Linha do tempo</span>
          </TabsTrigger>
          <TabsTrigger value="financial" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <DollarSign className="h-4 w-4" />
            <span>Financeiro</span>
          </TabsTrigger>
          <TabsTrigger value="orcamentos" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <ListChecks className="h-4 w-4" />
            <span>Orçamentos</span>
          </TabsTrigger>
          <TabsTrigger value="clinicos" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <Stethoscope className="h-4 w-4" />
            <span>Receitas</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5 shrink-0 text-xs py-2">
            <FolderOpen className="h-4 w-4" />
            <span>Documentos</span>
          </TabsTrigger>
        </TabsList>


        <TabsContent value="personal" className="space-y-6">
          <PatientPersonalInfo patient={patient} />
        </TabsContent>

        <TabsContent value="records" className="space-y-6">
          <PatientMedicalRecords patient={patient} />
        </TabsContent>

        <TabsContent value="anamnesis" className="space-y-6">
          <PatientAnamnesis patient={patient} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <PatientTimeline patient={patient} />
        </TabsContent>

        <TabsContent value="financial" className="space-y-6">
          <PatientFinancial patient={patient} />
        </TabsContent>

        <TabsContent value="orcamentos" className="space-y-6">
          <PatientOrcamentos patient={patient} />
        </TabsContent>

        <TabsContent value="clinicos" className="space-y-6">
          <PatientDocumentosClinicos patient={patient} />
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <PatientDocuments patient={patient} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientDetails;

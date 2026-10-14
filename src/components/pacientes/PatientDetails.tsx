
import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, CalendarPlus, Edit2, Plus, User, FileText, ClipboardList, ListChecks, FolderOpen, History, DollarSign, Stethoscope } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">{patient.nome}</h1>
              {renderStatusBadge(patient.status)}
            </div>
            <p className="text-sm text-muted-foreground">
              {patient.email}
              {patient.email && patient.telefone ? ' • ' : ''}
              {patient.telefone ? (
                <button
                  type="button"
                  onClick={() => openWhatsApp(patient.telefone, '')}
                  className="text-primary hover:underline focus:outline-none"
                  title="Abrir conversa no WhatsApp"
                >
                  {patient.telefone}
                </button>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <ImpressaoDocs patient={patient} />
          
          <Button onClick={onSchedule}>
            <CalendarPlus className="h-4 w-4 mr-2" />
            Agendar
          </Button>
          {onAddProcedimento && (
            <Button onClick={onAddProcedimento} variant="secondary">
              <Plus className="h-4 w-4 mr-2" />
              Procedimento
            </Button>
          )}
          <Button onClick={onEdit} variant="outline">
            <Edit2 className="h-4 w-4 mr-2" />
            Editar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="flex overflow-x-auto sm:grid w-full sm:grid-cols-4 lg:grid-cols-8 h-auto p-1 gap-1 border border-border bg-muted/60">
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

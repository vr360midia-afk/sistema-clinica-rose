
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Edit2, User, FileText, ClipboardList, FolderOpen, History, DollarSign } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';
import PatientPersonalInfo from './PatientPersonalInfo';
import PatientMedicalRecords from './PatientMedicalRecords';
import PatientAnamnesis from './PatientAnamnesis';
import PatientDocuments from './PatientDocuments';
import PatientTimeline from './PatientTimeline';
import PatientFinancial from './PatientFinancial';


interface PatientDetailsProps {
  patient: any;
  onClose: () => void;
  onEdit: () => void;
}

const PatientDetails = ({ patient, onClose, onEdit }: PatientDetailsProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">{patient.nome}</h1>
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
        <Button onClick={onEdit} className="bg-blue-600 hover:bg-blue-700">
          <Edit2 className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
          <TabsTrigger value="personal" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Dados Pessoais
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Prontuários
          </TabsTrigger>
          <TabsTrigger value="anamnesis" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Anamneses
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Linha do tempo
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Documentos
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

        <TabsContent value="documents" className="space-y-6">
          <PatientDocuments patient={patient} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientDetails;

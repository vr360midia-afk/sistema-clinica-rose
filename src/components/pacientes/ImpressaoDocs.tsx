import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSignature, FileText, Pill } from 'lucide-react';
import { GeradorPDF } from './GeradorPDF';
import ContratoModal from '@/components/contratos/ContratoModal';
import { cn } from '@/lib/utils';

interface ImpressaoDocsProps {
  patient: any;
  buttonClassName?: string;
}

export const ImpressaoDocs = ({ patient, buttonClassName }: ImpressaoDocsProps) => {
  const [contratoOpen, setContratoOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 px-2.5 text-xs font-medium gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
        onClick={() => setContratoOpen(true)}
        title="Gerar contrato de prestação de serviços odontológicos"
      >
        <FileSignature className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>Contrato</span>
      </Button>

      <GeradorPDF 
        patient={patient} 
        tipo="atestado" 
        conteudo="Necessita de 1 (um) dia de repouso por motivos de tratamento odontológico." 
        label="Atestado"
        icon={<FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
        className={cn(
          "h-9 px-2.5 text-xs font-medium gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
      />
      <GeradorPDF 
        patient={patient} 
        tipo="receita" 
        conteudo="Uso oral: \n1x Dipirona 500mg de 6 em 6 horas em caso de dor." 
        label="Receita"
        icon={<Pill className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
        className={cn(
          "h-9 px-2.5 text-xs font-medium gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
      />

      {contratoOpen && (
        <ContratoModal
          isOpen={contratoOpen}
          onClose={() => setContratoOpen(false)}
          patient={patient}
        />
      )}
    </>
  );
};

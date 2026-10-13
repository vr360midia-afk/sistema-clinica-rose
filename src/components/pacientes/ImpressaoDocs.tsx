import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSignature } from 'lucide-react';
import { GeradorPDF } from './GeradorPDF';
import ContratoModal from '@/components/contratos/ContratoModal';

export const ImpressaoDocs = ({ patient }: { patient: any }) => {
  const [contratoOpen, setContratoOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setContratoOpen(true)}
        title="Gerar contrato de prestação de serviços odontológicos"
      >
        <FileSignature className="h-4 w-4 text-primary" />
        Contrato
      </Button>

      <GeradorPDF 
        patient={patient} 
        tipo="atestado" 
        conteudo="Necessita de 1 (um) dia de repouso por motivos de tratamento odontológico." 
      />
      <GeradorPDF 
        patient={patient} 
        tipo="receita" 
        conteudo="Uso oral: \n1x Dipirona 500mg de 6 em 6 horas em caso de dor." 
      />

      {contratoOpen && (
        <ContratoModal
          isOpen={contratoOpen}
          onClose={() => setContratoOpen(false)}
          patient={patient}
        />
      )}
    </div>
  );
};


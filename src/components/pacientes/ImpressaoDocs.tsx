import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, ChevronDown } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { GeradorPDF } from './GeradorPDF';

export const ImpressaoDocs = ({ patient }: { patient: any }) => {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-2">
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
    </div>
  );
};

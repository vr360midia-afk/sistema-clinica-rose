import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSignature, FileText, Pill } from 'lucide-react';
import ContratoModal from '@/components/contratos/ContratoModal';
import { ModalGerarAtestado } from './ModalGerarAtestado';
import { ModalGerarReceita } from './ModalGerarReceita';
import { cn } from '@/lib/utils';

interface ImpressaoDocsProps {
  patient: any;
  buttonClassName?: string;
}

export const ImpressaoDocs = ({ patient, buttonClassName }: ImpressaoDocsProps) => {
  const [contratoOpen, setContratoOpen] = useState(false);
  const [atestadoOpen, setAtestadoOpen] = useState(false);
  const [receitaOpen, setReceitaOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 px-2 sm:px-2.5 text-xs font-medium gap-1 sm:gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
        onClick={() => setContratoOpen(true)}
        title="Gerar contrato de prestação de serviços odontológicos"
      >
        <FileSignature className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>Contrato</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 px-2 sm:px-2.5 text-xs font-medium gap-1 sm:gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
        onClick={() => setAtestadoOpen(true)}
        title="Gerar atestado odontológico interativo"
      >
        <FileText className="h-3.5 w-3.5 text-sky-500 shrink-0" />
        <span>Atestado</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 px-2 sm:px-2.5 text-xs font-medium gap-1 sm:gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
        onClick={() => setReceitaOpen(true)}
        title="Gerar receita odontológica interativa"
      >
        <Pill className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>Receita</span>
      </Button>

      {contratoOpen && (
        <ContratoModal
          isOpen={contratoOpen}
          onClose={() => setContratoOpen(false)}
          patient={patient}
        />
      )}

      {atestadoOpen && (
        <ModalGerarAtestado
          isOpen={atestadoOpen}
          onClose={() => setAtestadoOpen(false)}
          patient={patient}
        />
      )}

      {receitaOpen && (
        <ModalGerarReceita
          isOpen={receitaOpen}
          onClose={() => setReceitaOpen(false)}
          patient={patient}
        />
      )}
    </>
  );
};

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSignature, FileText, Pill, ClipboardList } from 'lucide-react';
import ContratoModal from '@/components/contratos/ContratoModal';
import { ModalGerarAtestado } from './ModalGerarAtestado';
import { ModalGerarReceita } from './ModalGerarReceita';
import { ModalEnviarAnamnese } from '@/components/anamnese/ModalEnviarAnamnese';
import AnamneseModal from '@/components/anamnese/AnamneseModal';
import { cn } from '@/lib/utils';

interface ImpressaoDocsProps {
  patient: any;
  buttonClassName?: string;
}

export const ImpressaoDocs = ({ patient, buttonClassName }: ImpressaoDocsProps) => {
  const [contratoOpen, setContratoOpen] = useState(false);
  const [atestadoOpen, setAtestadoOpen] = useState(false);
  const [receitaOpen, setReceitaOpen] = useState(false);
  const [anamneseLinkOpen, setAnamneseLinkOpen] = useState(false);
  const [anamneseClinicaOpen, setAnamneseClinicaOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 px-1.5 sm:px-2.5 text-[11px] sm:text-xs font-medium gap-1 sm:gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
        onClick={() => setAnamneseLinkOpen(true)}
        title="Enviar link de anamnese para preencher e assinar digitalmente"
      >
        <ClipboardList className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <span>Anamnese</span>
      </Button>

      <Button
        variant="outline"
        size="sm"
        className={cn(
          "h-9 px-1.5 sm:px-2.5 text-[11px] sm:text-xs font-medium gap-1 sm:gap-1.5 hover:bg-muted justify-center",
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
          "h-9 px-1.5 sm:px-2.5 text-[11px] sm:text-xs font-medium gap-1 sm:gap-1.5 hover:bg-muted justify-center",
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
          "h-9 px-1.5 sm:px-2.5 text-[11px] sm:text-xs font-medium gap-1 sm:gap-1.5 hover:bg-muted justify-center",
          buttonClassName
        )}
        onClick={() => setReceitaOpen(true)}
        title="Gerar receita odontológica interativa"
      >
        <Pill className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>Receita</span>
      </Button>

      {anamneseLinkOpen && (
        <ModalEnviarAnamnese
          isOpen={anamneseLinkOpen}
          onClose={() => setAnamneseLinkOpen(false)}
          patient={patient}
          onOpenClinicaModal={() => setAnamneseClinicaOpen(true)}
        />
      )}

      {anamneseClinicaOpen && (
        <AnamneseModal
          isOpen={anamneseClinicaOpen}
          onClose={() => setAnamneseClinicaOpen(false)}
          preSelectedPatient={patient?.id}
        />
      )}

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

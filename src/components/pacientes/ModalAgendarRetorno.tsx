import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AgendarRetornoCard } from './AgendarRetornoCard';
import { RotateCcw, User, Phone } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { PacienteCombobox } from '@/components/pacientes/PacienteCombobox';
import { Badge } from '@/components/ui/badge';

interface ModalAgendarRetornoProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: any;
  initialPatientId?: string;
  onSuccess?: () => void;
}

export const ModalAgendarRetorno = ({
  isOpen,
  onClose,
  patient,
  initialPatientId,
  onSuccess
}: ModalAgendarRetornoProps) => {
  const { pacientes } = useDentalSystem();
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');

  useEffect(() => {
    if (patient?.id) {
      setSelectedPatientId(patient.id);
    } else if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    } else {
      setSelectedPatientId('');
    }
  }, [patient, initialPatientId, isOpen]);

  const activePatient = patient || (pacientes || []).find((p: any) => p.id === selectedPatientId) || null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-[95vw] p-0 overflow-hidden border-border bg-card shadow-2xl">
        <DialogHeader className="p-4 pb-3 border-b border-border/60 bg-blue-50/40 dark:bg-blue-950/20">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-blue-900 dark:text-blue-200">
              <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Agendar Retorno Clínico
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Defina o retorno clínico com prazos pré-estabelecidos (+15d, +30d, +60d, +90d, +6m) ou data personalizada.
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Se o paciente não foi pré-fornecido, permite selecionar */}
          {!patient ? (
            <div className="space-y-1.5 p-3 rounded-lg border border-border bg-muted/30">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-blue-600" />
                <span>Paciente:</span>
              </label>
              <PacienteCombobox
                pacientes={pacientes || []}
                value={selectedPatientId}
                onChange={(id) => setSelectedPatientId(id)}
                placeholder="Buscar paciente por nome, CPF ou telefone..."
              />
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/30">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-blue-600/10 text-blue-600 font-bold flex items-center justify-center shrink-0 text-sm">
                  {activePatient?.nome?.charAt(0) || 'P'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{activePatient?.nome}</p>
                  {activePatient?.telefone && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                      <Phone className="h-3 w-3" />
                      {activePatient.telefone}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] bg-blue-100/50 text-blue-700 dark:text-blue-300 border-blue-300">
                Paciente
              </Badge>
            </div>
          )}

          {activePatient ? (
            <AgendarRetornoCard
              patient={activePatient}
              onSuccess={() => {
                onSuccess?.();
                onClose();
              }}
              compact
            />
          ) : (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <User className="h-8 w-8 text-muted-foreground/30" />
              <p>Selecione um paciente acima para definir o retorno clínico.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModalAgendarRetorno;

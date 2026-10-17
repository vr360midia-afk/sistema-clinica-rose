import React from 'react';
import { Label } from '@/components/ui/label';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { PacienteCombobox } from '@/components/pacientes/PacienteCombobox';

interface PatientSelectorProps {
  patients?: any[];
  value: string;
  onChange: (patientId: string) => void;
}

const PatientSelector = ({ patients: propPatients, value, onChange }: PatientSelectorProps) => {
  const { pacientes } = useDentalSystem();
  const patients = propPatients && propPatients.length > 0 ? propPatients : pacientes;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="patient-select" className="text-xs font-semibold text-foreground">
        Selecionar Paciente *
      </Label>
      <PacienteCombobox
        id="patient-select"
        pacientes={patients}
        value={value}
        onChange={onChange}
        placeholder="Digite o nome ou CPF para buscar o paciente..."
      />
    </div>
  );
};

export default PatientSelector;

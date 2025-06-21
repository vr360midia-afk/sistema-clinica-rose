
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useDentalSystem } from '@/context/DentalSystemContext';

interface PatientSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const PatientSelector = ({ value, onChange }: PatientSelectorProps) => {
  const { pacientes } = useDentalSystem();
  
  // Filtrar apenas pacientes ativos
  const activePacientes = pacientes.filter(p => p.status === 'Ativo');

  return (
    <div className="space-y-2">
      <Label htmlFor="patient-select" className="text-base font-semibold">
        Selecionar Paciente *
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Selecione um paciente..." />
        </SelectTrigger>
        <SelectContent>
          {activePacientes.map((patient) => (
            <SelectItem key={patient.id} value={patient.id}>
              {patient.nome} - {patient.idade} anos
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PatientSelector;

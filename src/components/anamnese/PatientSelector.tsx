
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { calcularIdade } from '@/utils/idade';
import { useDentalSystem } from '@/context/DentalSystemContext';

interface PatientSelectorProps {
  patients?: any[];
  value: string;
  onChange: (patientId: string) => void;
}

const PatientSelector = ({ patients: propPatients, value, onChange }: PatientSelectorProps) => {
  const { pacientes } = useDentalSystem();
  const patients = propPatients && propPatients.length > 0 ? propPatients : pacientes;

  return (
    <div className="space-y-2">
      <Label htmlFor="patient-select">Selecionar Paciente</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id="patient-select" className="w-full">
          <SelectValue placeholder="Selecione um paciente..." />
        </SelectTrigger>
        <SelectContent>
          {patients.map((patient) => {
            const idade = calcularIdade(patient.dataNascimento) ?? patient.idade;
            return (
              <SelectItem key={patient.id} value={patient.id}>
                {patient.nome} - {idade !== undefined && idade !== null ? `${idade} anos` : 'idade não informada'}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PatientSelector;

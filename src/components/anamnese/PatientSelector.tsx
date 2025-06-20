
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface PatientSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const mockPatients = [
  { id: '1', name: 'Maria Silva', age: 35 },
  { id: '2', name: 'João Santos', age: 42 },
  { id: '3', name: 'Ana Costa', age: 28 },
  { id: '4', name: 'Carlos Oliveira', age: 55 },
  { id: '5', name: 'Fernanda Lima', age: 31 }
];

const PatientSelector = ({ value, onChange }: PatientSelectorProps) => {
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
          {mockPatients.map((patient) => (
            <SelectItem key={patient.id} value={patient.id}>
              {patient.name} - {patient.age} anos
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PatientSelector;


import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface ToothStatus {
  [key: number]: 'healthy' | 'cavity' | 'restoration' | 'crown' | 'extraction' | 'root-canal' | 'prophylaxis' | 'veneer' | 'wisdom' | 'whitening' | 'aesthetic-aligners' | 'invisible-aligners';
}

const Odontogram = () => {
  const [teethStatus, setTeethStatus] = useState<ToothStatus>({});
  const [selectedTreatment, setSelectedTreatment] = useState<string>('healthy');

  // Dentes superiores (18-11, 21-28)
  const upperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  // Dentes inferiores (48-41, 31-38)
  const lowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  const treatments = [
    { id: 'healthy', label: 'Saudável', color: 'bg-card' },
    { id: 'cavity', label: 'Cárie', color: 'bg-red-500' },
    { id: 'restoration', label: 'Restauração', color: 'bg-blue-500' },
    { id: 'crown', label: 'Coroa', color: 'bg-yellow-500' },
    { id: 'extraction', label: 'Extração', color: 'bg-black' },
    { id: 'root-canal', label: 'Canal', color: 'bg-purple-500' },
    { id: 'prophylaxis', label: 'Profilaxia', color: 'bg-green-400' },
    { id: 'veneer', label: 'Facetas', color: 'bg-pink-400' },
    { id: 'wisdom', label: 'Siso', color: 'bg-orange-500' },
    { id: 'whitening', label: 'Clareamento', color: 'bg-cyan-300' },
    { id: 'aesthetic-aligners', label: 'Alinhadores Estéticos', color: 'bg-indigo-400' },
    { id: 'invisible-aligners', label: 'Alinhadores Invisíveis', color: 'bg-muted' }
  ];

  const handleToothClick = (toothNumber: number) => {
    setTeethStatus(prev => ({
      ...prev,
      [toothNumber]: selectedTreatment as any
    }));
  };

  const getToothColor = (toothNumber: number) => {
    const status = teethStatus[toothNumber] || 'healthy';
    return treatments.find(t => t.id === status)?.color || 'bg-card';
  };

  const renderTooth = (toothNumber: number) => (
    <div
      key={toothNumber}
      className={`w-8 h-10 border-2 border-border rounded-sm cursor-pointer hover:border-blue-500 transition-colors ${getToothColor(toothNumber)}`}
      onClick={() => handleToothClick(toothNumber)}
      title={`Dente ${toothNumber}`}
    >
      <div className="h-full flex items-center justify-center">
        <span className="text-xs font-semibold text-foreground">{toothNumber}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Seletor de Tratamento */}
      <div>
        <h3 className="text-lg font-medium mb-3">Selecione o Tratamento:</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {treatments.map((treatment) => (
            <Button
              key={treatment.id}
              variant={selectedTreatment === treatment.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedTreatment(treatment.id)}
              className="flex items-center gap-2 justify-start text-left h-auto p-2"
            >
              <div className={`w-4 h-4 rounded ${treatment.color} border flex-shrink-0`}></div>
              <span className="text-xs">{treatment.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Odontograma */}
      <div className="bg-muted p-8 rounded-lg">
        <div className="max-w-4xl mx-auto">
          {/* Dentes Superiores */}
          <div className="mb-8">
            <h4 className="text-center mb-4 font-medium">Arcada Superior</h4>
            <div className="flex justify-center gap-1">
              {upperTeeth.map(renderTooth)}
            </div>
          </div>

          {/* Linha divisória */}
          <div className="border-t-2 border-border my-6"></div>

          {/* Dentes Inferiores */}
          <div>
            <h4 className="text-center mb-4 font-medium">Arcada Inferior</h4>
            <div className="flex justify-center gap-1">
              {lowerTeeth.map(renderTooth)}
            </div>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
        {treatments.map((treatment) => (
          <div key={treatment.id} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${treatment.color} border flex-shrink-0`}></div>
            <span className="text-sm">{treatment.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Odontogram;

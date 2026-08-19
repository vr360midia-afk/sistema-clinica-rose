
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save, RotateCcw } from 'lucide-react';
import { useOdontograma } from '@/hooks/useOdontograma';

interface OdontogramProps {
  pacienteId?: string;
}

const Odontogram = ({ pacienteId }: OdontogramProps) => {
  const { dados, setDados, loading, saving, salvar } = useOdontograma(pacienteId);
  const [selectedTreatment, setSelectedTreatment] = React.useState<string>('healthy');

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
    setDados((prev) => ({ ...prev, [String(toothNumber)]: selectedTreatment }));
  };

  const getToothColor = (toothNumber: number) => {
    const status = dados[String(toothNumber)] || 'healthy';
    return treatments.find(t => t.id === status)?.color || 'bg-card';
  };

  const renderTooth = (toothNumber: number) => (
    <div
      key={toothNumber}
      className={`w-7 h-9 sm:w-8 sm:h-10 border-2 border-border rounded-sm cursor-pointer hover:border-primary transition-colors ${getToothColor(toothNumber)}`}
      onClick={() => handleToothClick(toothNumber)}
      title={`Dente ${toothNumber}`}
    >
      <div className="h-full flex items-center justify-center">
        <span className="text-[10px] sm:text-xs font-semibold text-foreground mix-blend-difference">{toothNumber}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Seletor de Tratamento */}
      <div>
        <h3 className="text-base sm:text-lg font-medium mb-3">Selecione o Tratamento:</h3>
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
      <div className="bg-muted p-3 sm:p-8 rounded-lg overflow-x-auto">
        <div className="max-w-4xl mx-auto min-w-[520px]">
          <div className="mb-8">
            <h4 className="text-center mb-4 font-medium">Arcada Superior</h4>
            <div className="flex justify-center gap-1">
              {upperTeeth.map(renderTooth)}
            </div>
          </div>

          <div className="border-t-2 border-border my-6"></div>

          <div>
            <h4 className="text-center mb-4 font-medium">Arcada Inferior</h4>
            <div className="flex justify-center gap-1">
              {lowerTeeth.map(renderTooth)}
            </div>
          </div>
        </div>
      </div>

      {pacienteId && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => salvar(dados)} disabled={saving || loading}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar odontograma'}
          </Button>
          <Button variant="outline" onClick={() => setDados({})} disabled={saving || loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Limpar
          </Button>
        </div>
      )}

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

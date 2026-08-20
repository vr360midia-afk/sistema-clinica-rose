import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, RotateCcw } from 'lucide-react';
import { useOdontograma } from '@/hooks/useOdontograma';
import { TREATMENTS, UPPER_TEETH, LOWER_TEETH, treatmentColor } from '@/lib/odontograma';
import OdontogramaComparativo from './OdontogramaComparativo';

interface OdontogramProps {
  pacienteId?: string;
}

const Odontogram = ({ pacienteId }: OdontogramProps) => {
  const { dados, setDados, versoes, loading, saving, salvar } = useOdontograma(pacienteId);
  const [selectedTreatment, setSelectedTreatment] = React.useState<string>('healthy');
  const [observacao, setObservacao] = React.useState('');

  const handleToothClick = (toothNumber: number) => {
    setDados((prev) => ({ ...prev, [String(toothNumber)]: selectedTreatment }));
  };

  const renderTooth = (toothNumber: number) => (
    <div
      key={toothNumber}
      className={`w-7 h-9 sm:w-8 sm:h-10 border-2 border-border rounded-sm cursor-pointer hover:border-primary transition-colors ${treatmentColor(dados[String(toothNumber)])}`}
      onClick={() => handleToothClick(toothNumber)}
      title={`Dente ${toothNumber}`}
    >
      <div className="h-full flex items-center justify-center">
        <span className="text-[10px] sm:text-xs font-semibold text-foreground mix-blend-difference">{toothNumber}</span>
      </div>
    </div>
  );

  const handleSalvar = async () => {
    await salvar(dados, observacao.trim() || undefined);
    setObservacao('');
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Tratamento */}
      <div>
        <h3 className="text-base sm:text-lg font-medium mb-3">Selecione o Tratamento:</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {TREATMENTS.map((treatment) => (
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
              {UPPER_TEETH.map(renderTooth)}
            </div>
          </div>

          <div className="border-t-2 border-border my-6"></div>

          <div>
            <h4 className="text-center mb-4 font-medium">Arcada Inferior</h4>
            <div className="flex justify-center gap-1">
              {LOWER_TEETH.map(renderTooth)}
            </div>
          </div>
        </div>
      </div>

      {pacienteId && (
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação desta versão (ex: pós-tratamento)"
            className="sm:max-w-xs"
          />
          <Button onClick={handleSalvar} disabled={saving || loading}>
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
        {TREATMENTS.map((treatment) => (
          <div key={treatment.id} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded ${treatment.color} border flex-shrink-0`}></div>
            <span className="text-sm">{treatment.label}</span>
          </div>
        ))}
      </div>

      {pacienteId && <OdontogramaComparativo versoes={versoes} atual={dados} />}
    </div>
  );
};

export default Odontogram;

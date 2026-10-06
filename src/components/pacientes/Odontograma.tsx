import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Activity, Circle, CheckCircle2, AlertCircle } from 'lucide-react';

const DENTES_SUPERIORES = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const DENTES_INFERIORES = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

type EstadoDente = 'saudavel' | 'carie' | 'restaurado' | 'extraido' | 'canal';

interface DenteStatus {
  [numero: number]: EstadoDente;
}

export const Odontograma = ({ patient }: { patient: any }) => {
  // Inicializa todos como saudáveis
  const [status, setStatus] = useState<DenteStatus>({});
  const [selectedDente, setSelectedDente] = useState<number | null>(null);

  const getCorDente = (estado?: EstadoDente) => {
    switch (estado) {
      case 'carie': return 'fill-red-500 text-red-500';
      case 'restaurado': return 'fill-blue-500 text-blue-500';
      case 'extraido': return 'fill-gray-800 text-gray-800 opacity-30';
      case 'canal': return 'fill-purple-500 text-purple-500';
      default: return 'fill-white text-gray-300';
    }
  };

  const mudarEstado = (estado: EstadoDente) => {
    if (selectedDente === null) return;
    setStatus({ ...status, [selectedDente]: estado });
    setSelectedDente(null);
  };

  // Ícone de dente simplificado (Molar)
  const DenteIcon = ({ num, estado }: { num: number, estado?: EstadoDente }) => (
    <div 
      className={`flex flex-col items-center justify-center p-1 cursor-pointer rounded transition-all hover:bg-slate-100 dark:hover:bg-slate-800 ${selectedDente === num ? 'ring-2 ring-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : ''}`}
      onClick={() => setSelectedDente(num)}
    >
      <span className="text-[10px] font-medium text-slate-500 mb-1">{num}</span>
      <svg width="24" height="28" viewBox="0 0 24 28" className={getCorDente(estado)}>
        <path d="M5.5 2C3 2 2 4.5 2 7C2 9.5 3 12 4.5 14L5 20C5 22 7 24 9.5 24C11 24 12 23 12 21.5C12 23 13 24 14.5 24C17 24 19 22 19 20L19.5 14C21 12 22 9.5 22 7C22 4.5 21 2 18.5 2C16.5 2 15 3.5 14 5C13 3.5 11.5 2 9.5 2C7.5 2 6.5 2 5.5 2Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );

  return (
    <Card className="mt-6 border-border shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
        <CardTitle className="text-md flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" />
          Odontograma Interativo
        </CardTitle>
        <CardDescription>Clique no dente para alterar o estado clínico</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        
        {/* Odontograma Grid */}
        <div className="flex flex-col gap-6 items-center overflow-x-auto pb-4">
          
          {/* Superior */}
          <div className="flex gap-1 md:gap-2">
            {DENTES_SUPERIORES.map(num => (
              <DenteIcon key={num} num={num} estado={status[num]} />
            ))}
          </div>

          <div className="w-full h-px bg-border max-w-3xl" />

          {/* Inferior */}
          <div className="flex gap-1 md:gap-2">
            {DENTES_INFERIORES.map(num => (
              <DenteIcon key={num} num={num} estado={status[num]} />
            ))}
          </div>
        </div>

        {/* Action Panel */}
        {selectedDente && (
          <div className="mt-6 p-4 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-black flex items-center justify-center font-bold text-lg text-indigo-600 border border-indigo-200">
                {selectedDente}
              </div>
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">Alterar estado do dente {selectedDente}</p>
                <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70">Selecione o diagnóstico</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button size="sm" variant="outline" className="border-green-200 hover:bg-green-50 text-green-700" onClick={() => mudarEstado('saudavel')}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Saudável
              </Button>
              <Button size="sm" variant="outline" className="border-red-200 hover:bg-red-50 text-red-700" onClick={() => mudarEstado('carie')}>
                <AlertCircle className="w-4 h-4 mr-1" /> Cárie
              </Button>
              <Button size="sm" variant="outline" className="border-blue-200 hover:bg-blue-50 text-blue-700" onClick={() => mudarEstado('restaurado')}>
                <Circle className="w-4 h-4 mr-1" /> Restauração
              </Button>
              <Button size="sm" variant="outline" className="border-purple-200 hover:bg-purple-50 text-purple-700" onClick={() => mudarEstado('canal')}>
                <Activity className="w-4 h-4 mr-1" /> Canal
              </Button>
              <Button size="sm" variant="outline" className="border-gray-200 hover:bg-gray-100 text-gray-700" onClick={() => mudarEstado('extraido')}>
                Extraído
              </Button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full border border-gray-300 bg-white"></div> Saudável</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Cárie</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-blue-500"></div> Restaurado</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-purple-500"></div> Canal</div>
          <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-gray-800 opacity-30"></div> Extraído</div>
        </div>

      </CardContent>
    </Card>
  );
};

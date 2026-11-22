import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Sparkles, AlertCircle, Check, X, Layers, ShieldAlert } from 'lucide-react';

export type DenticaoTipo = 'permanente' | 'decidua';
export type EstadoProcedimentoVisual = 'a_realizar' | 'iniciado' | 'realizado' | 'pre_existente';

interface OdontogramaVisualProps {
  denticao: DenticaoTipo;
  onToggleDenticao: (tipo: DenticaoTipo) => void;
  selectedDentes: string[];
  onToggleSelectDente: (dente: string) => void;
  onSelectMultiplosDentes: (dentes: string[]) => void;
  onLimparSelecao: () => void;
  dentesStatus: Record<string, EstadoProcedimentoVisual>;
  onNovoProcedimento: (dentesPreselecionados?: string[]) => void;
  onColocarLentes: (dentes: string[]) => void;
  onColocarCaries: (dentes: string[]) => void;
}

// Numeração FDI oficial
const DENTES_SUPERIORES_PERMANENTE = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const DENTES_INFERIORES_PERMANENTE = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

const DENTES_SUPERIORES_DECIDUA = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'];
const DENTES_INFERIORES_DECIDUA = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'];

// Atalhos clínicos rápidos de seleção em lote
const PRESETS_LENTES_SUPERIOR = ['15', '14', '13', '12', '11', '21', '22', '23', '24', '25'];
const PRESETS_LENTES_INFERIOR = ['45', '44', '43', '42', '41', '31', '32', '33', '34', '35'];
const PRESETS_ANTERIORES_SUP = ['13', '12', '11', '21', '22', '23'];

function getTipoMorfologico(numero: string): 'molar' | 'premolar' | 'canino' | 'incisivo' {
  const d = parseInt(numero, 10);
  const digito = d % 10;
  if (digito >= 6) return 'molar';
  if (digito === 4 || digito === 5) return 'premolar';
  if (digito === 3) return 'canino';
  return 'incisivo';
}

function getCorEstado(estado?: EstadoProcedimentoVisual) {
  switch (estado) {
    case 'a_realizar':
      return {
        fill: '#F59E0B',
        stroke: '#D97706',
        text: 'text-amber-600',
        bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
      };
    case 'iniciado':
      return {
        fill: '#3B82F6',
        stroke: '#2563EB',
        text: 'text-blue-600',
        bg: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
      };
    case 'realizado':
      return {
        fill: '#10B981',
        stroke: '#059669',
        text: 'text-emerald-600',
        bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
      };
    case 'pre_existente':
      return {
        fill: '#8B5CF6',
        stroke: '#7C3AED',
        text: 'text-purple-600',
        bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
      };
    default:
      return {
        fill: 'transparent',
        stroke: 'currentColor',
        text: 'text-muted-foreground',
        bg: '',
      };
  }
}

// Desenhos anatômicos do dente Superior (Raiz em cima, Coroa em baixo)
const UpperToothSVG: React.FC<{ tipo: 'molar' | 'premolar' | 'canino' | 'incisivo'; estado?: EstadoProcedimentoVisual }> = ({
  tipo,
  estado,
}) => {
  const cor = getCorEstado(estado);
  const isFilled = Boolean(estado);

  return (
    <svg width="24" height="30" viewBox="0 0 24 30" className="transition-all duration-150">
      {tipo === 'molar' && (
        <path
          d="M4 2C3.5 5 4 10 5.5 14C3 15 2 17 2 20C2 24.5 4 28 8 28C10 28 11 26.5 12 26.5C13 26.5 14 28 16 28C20 28 22 24.5 22 20C22 17 21 15 18.5 14C20 10 20.5 5 20 2C18 3 16 8 14 13C13 10 12.5 5 12 2C11.5 5 11 10 10 13C8 8 6 3 4 2Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
      {tipo === 'premolar' && (
        <path
          d="M6 2C5.5 5 6.5 10 8 14C5 15.5 4 18 4 21C4 25 6 28 9.5 28C11 28 11.5 27 12 27C12.5 27 13 28 14.5 28C18 28 20 25 20 21C20 18 19 15.5 16 14C17.5 10 18.5 5 18 2C15.5 4 13.5 9 12.5 13C11.5 9 9.5 4 6 2Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
      {tipo === 'canino' && (
        <path
          d="M12 2C9.5 7 8 12 7.5 15C5.5 17 5 19.5 5 22C5 25.5 8 28.5 12 29C16 28.5 19 25.5 19 22C19 19.5 18.5 17 16.5 15C16 12 14.5 7 12 2Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
      {tipo === 'incisivo' && (
        <path
          d="M12 2C10 7 9 12 8.5 15C6.5 16.5 6 18.5 6 21C6 24.5 7.5 27.5 12 27.5C16.5 27.5 18 24.5 18 21C18 18.5 17.5 16.5 15.5 15C15 12 14 7 12 2Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

// Desenhos anatômicos do dente Inferior (Coroa em cima, Raiz em baixo)
const LowerToothSVG: React.FC<{ tipo: 'molar' | 'premolar' | 'canino' | 'incisivo'; estado?: EstadoProcedimentoVisual }> = ({
  tipo,
  estado,
}) => {
  const cor = getCorEstado(estado);
  const isFilled = Boolean(estado);

  return (
    <svg width="24" height="30" viewBox="0 0 24 30" className="transition-all duration-150">
      {tipo === 'molar' && (
        <path
          d="M8 2C4 2 2 5.5 2 10C2 13 3 15 5.5 16C4 20 3.5 25 4 28C6 27 8 22 10 17C11 20 11.5 25 12 28C12.5 25 13 20 14 17C16 22 18 27 20 28C20.5 25 20 20 18.5 16C21 15 22 13 22 10C22 5.5 20 2 16 2C14 2 13 3.5 12 3.5C11 3.5 10 2 8 2Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
      {tipo === 'premolar' && (
        <path
          d="M9.5 2C6 2 4 5 4 9C4 12 5 14.5 8 16C6.5 20 5.5 25 6 28C9.5 26 11.5 21 12.5 17C13.5 21 15.5 26 18 28C18.5 25 17.5 20 16 16C19 14.5 20 12 20 9C20 5 18 2 14.5 2C13 2 12.5 3 12 3C11.5 3 11 2 9.5 2Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
      {tipo === 'canino' && (
        <path
          d="M12 1C8 1.5 5 4.5 5 8C5 10.5 5.5 13 7.5 15C8 18 9.5 23 12 28C14.5 23 16 18 16.5 15C18.5 13 19 10.5 19 8C19 4.5 16 1.5 12 1Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
      {tipo === 'incisivo' && (
        <path
          d="M12 2.5C7.5 2.5 6 5.5 6 9C6 11.5 6.5 13.5 8.5 15C9 18 10 23 12 28C14 23 15 18 15.5 15C17.5 13.5 18 11.5 18 9C18 5.5 16.5 2.5 12 2.5Z"
          fill={cor.fill}
          stroke={cor.stroke}
          strokeWidth={isFilled ? '1.8' : '1.3'}
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

// Caixa clássica de 5 faces do dente (Oclusal, Vestibular, Lingual/Palatina, Mesial, Distal)
const ToothFaceMap: React.FC<{ isSelected?: boolean }> = ({ isSelected }) => {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="my-1 transition-transform hover:scale-105">
      <rect x="1" y="1" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-purple-600/70 dark:text-purple-400/70" />
      <polygon points="1,1 19,1 14,6 6,6" fill="transparent" stroke="currentColor" strokeWidth="0.8" className="text-purple-600/60 dark:text-purple-400/60 hover:fill-purple-500/20" />
      <polygon points="6,14 14,14 19,19 1,19" fill="transparent" stroke="currentColor" strokeWidth="0.8" className="text-purple-600/60 dark:text-purple-400/60 hover:fill-purple-500/20" />
      <polygon points="1,1 6,6 6,14 1,19" fill="transparent" stroke="currentColor" strokeWidth="0.8" className="text-purple-600/60 dark:text-purple-400/60 hover:fill-purple-500/20" />
      <polygon points="19,1 19,19 14,14 14,6" fill="transparent" stroke="currentColor" strokeWidth="0.8" className="text-purple-600/60 dark:text-purple-400/60 hover:fill-purple-500/20" />
      <rect
        x="6"
        y="6"
        width="8"
        height="8"
        fill={isSelected ? '#7C3AED' : 'transparent'}
        stroke="currentColor"
        strokeWidth="1"
        className="text-purple-600/80 dark:text-purple-400/80 hover:fill-purple-500/30"
      />
    </svg>
  );
};

export const OdontogramaVisual: React.FC<OdontogramaVisualProps> = ({
  denticao,
  onToggleDenticao,
  selectedDentes,
  onToggleSelectDente,
  onSelectMultiplosDentes,
  onLimparSelecao,
  dentesStatus,
  onNovoProcedimento,
  onColocarLentes,
  onColocarCaries,
}) => {
  const dentesSuperiores = denticao === 'permanente' ? DENTES_SUPERIORES_PERMANENTE : DENTES_SUPERIORES_DECIDUA;
  const dentesInferiores = denticao === 'permanente' ? DENTES_INFERIORES_PERMANENTE : DENTES_INFERIORES_DECIDUA;

  const totalSelecionados = selectedDentes.length;

  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-5 shadow-xs space-y-4">
      {/* Barra de Título + Botão Novo Procedimento + Alternador Permanente/Decídua */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg font-bold text-foreground">Odontograma</h2>
          <span className="text-[11px] text-muted-foreground hidden sm:inline-block">
            (Clique nos dentes para selecionar múltiplos)
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => onNovoProcedimento(selectedDentes.length > 0 ? selectedDentes : undefined)}
            className="h-8 sm:h-8.5 px-3.5 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg gap-1.5 shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Procedimento {totalSelecionados > 0 && `(${totalSelecionados})`}
          </Button>

          {/* Toggle Permanente / Decídua */}
          <div className="flex items-center bg-muted/80 p-0.5 rounded-full border border-border/60 text-xs">
            <button
              type="button"
              onClick={() => onToggleDenticao('permanente')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                denticao === 'permanente'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Permanente
            </button>
            <button
              type="button"
              onClick={() => onToggleDenticao('decidua')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                denticao === 'decidua'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Decídua
            </button>
          </div>
        </div>
      </div>

      {/* Atalhos Rápidos de Seleção em Lote (Lentes 10 Dentes, Arcadas, etc.) */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
        <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-purple-600" /> Seleção rápida:
        </span>
        <button
          type="button"
          onClick={() => onSelectMultiplosDentes(PRESETS_LENTES_SUPERIOR)}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-500/15 transition-colors"
        >
          💎 10 Sup (15 ao 25)
        </button>
        <button
          type="button"
          onClick={() => onSelectMultiplosDentes(PRESETS_LENTES_INFERIOR)}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-purple-500/30 bg-purple-500/5 text-purple-700 dark:text-purple-300 hover:bg-purple-500/15 transition-colors"
        >
          💎 10 Inf (45 ao 35)
        </button>
        <button
          type="button"
          onClick={() => onSelectMultiplosDentes(PRESETS_ANTERIORES_SUP)}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-muted/40 text-foreground hover:bg-muted transition-colors"
        >
          6 Anteriores (13 ao 23)
        </button>
        <button
          type="button"
          onClick={() => onSelectMultiplosDentes(dentesSuperiores)}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-muted/40 text-foreground hover:bg-muted transition-colors"
        >
          Arcada Superior
        </button>
        <button
          type="button"
          onClick={() => onSelectMultiplosDentes(dentesInferiores)}
          className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-border bg-muted/40 text-foreground hover:bg-muted transition-colors"
        >
          Arcada Inferior
        </button>
        {totalSelecionados > 0 && (
          <button
            type="button"
            onClick={onLimparSelecao}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors ml-auto"
          >
            Limpar seleção ({totalSelecionados})
          </button>
        )}
      </div>

      {/* BARRA DE AÇÃO EM LOTE QUANDO HÁ DENTES SELECIONADOS */}
      {totalSelecionados > 0 && (
        <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              {totalSelecionados}
            </div>
            <div>
              <p className="text-xs font-bold text-purple-950 dark:text-purple-200">
                {totalSelecionados} {totalSelecionados === 1 ? 'dente selecionado' : 'dentes selecionados'}
              </p>
              <p className="text-[11px] text-purple-700/80 dark:text-purple-300/80 font-mono">
                {selectedDentes.sort((a, b) => parseInt(a) - parseInt(b)).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Ação 1: Colocar Lentes nos Dentes Selecionados */}
            <Button
              type="button"
              onClick={() => onColocarLentes(selectedDentes)}
              size="sm"
              className="h-8 text-xs font-semibold bg-purple-700 hover:bg-purple-800 text-white rounded-lg gap-1.5 shadow-2xs"
              title="Adicionar Lentes em Resina para todos os dentes selecionados"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Colocar Lentes ({totalSelecionados})
            </Button>

            {/* Ação 2: Marcar Cáries / Restaurações nos Dentes Selecionados */}
            <Button
              type="button"
              onClick={() => onColocarCaries(selectedDentes)}
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 rounded-lg gap-1.5"
              title="Lançar cáries/restaurações e orçamento para os dentes selecionados"
            >
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              Cáries / Restauração ({totalSelecionados})
            </Button>

            <button
              type="button"
              onClick={onLimparSelecao}
              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md"
              title="Desmarcar dentes"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grade Anatômica do Odontograma com Scroll Horizontal Suave */}
      <div className="overflow-x-auto pb-2 pt-1 no-scrollbar">
        <div className="min-w-[620px] sm:min-w-[680px] flex flex-col items-center justify-center gap-2 select-none">
          {/* Arcada Superior */}
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full">
            {dentesSuperiores.map((num) => {
              const tipo = getTipoMorfologico(num);
              const estado = dentesStatus[num];
              const isSelected = selectedDentes.includes(num);

              return (
                <div
                  key={`sup-${num}`}
                  onClick={() => onToggleSelectDente(num)}
                  className={`flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg cursor-pointer transition-all hover:bg-purple-500/15 relative group ${
                    isSelected
                      ? 'ring-2 ring-purple-600 bg-purple-100/70 dark:bg-purple-900/40 shadow-xs'
                      : ''
                  }`}
                  title={`Dente ${num} ${estado ? `(${estado.replace('_', ' ')})` : ''} - Clique para selecionar`}
                >
                  {/* Badge de Selecionado */}
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}

                  <div className="text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                    <UpperToothSVG tipo={tipo} estado={estado} />
                  </div>
                  <ToothFaceMap isSelected={isSelected} />
                  <span
                    className={`text-[11px] font-semibold mt-0.5 transition-colors ${
                      isSelected
                        ? 'text-purple-700 dark:text-purple-300 font-extrabold'
                        : estado
                        ? 'text-foreground font-bold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {num}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 leading-none h-2">...</span>
                </div>
              );
            })}
          </div>

          {/* Arcada Inferior */}
          <div className="flex items-center justify-center gap-1 sm:gap-1.5 w-full pt-1 border-t border-border/40">
            {dentesInferiores.map((num) => {
              const tipo = getTipoMorfologico(num);
              const estado = dentesStatus[num];
              const isSelected = selectedDentes.includes(num);

              return (
                <div
                  key={`inf-${num}`}
                  onClick={() => onToggleSelectDente(num)}
                  className={`flex flex-col items-center justify-center p-1 sm:p-1.5 rounded-lg cursor-pointer transition-all hover:bg-purple-500/15 relative group ${
                    isSelected
                      ? 'ring-2 ring-purple-600 bg-purple-100/70 dark:bg-purple-900/40 shadow-xs'
                      : ''
                  }`}
                  title={`Dente ${num} ${estado ? `(${estado.replace('_', ' ')})` : ''} - Clique para selecionar`}
                >
                  {/* Badge de Selecionado */}
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}

                  <span className="text-[10px] text-muted-foreground/60 leading-none h-2">...</span>
                  <span
                    className={`text-[11px] font-semibold mb-0.5 transition-colors ${
                      isSelected
                        ? 'text-purple-700 dark:text-purple-300 font-extrabold'
                        : estado
                        ? 'text-foreground font-bold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {num}
                  </span>
                  <ToothFaceMap isSelected={isSelected} />
                  <div className="text-purple-600 dark:text-purple-400 group-hover:scale-105 transition-transform">
                    <LowerToothSVG tipo={tipo} estado={estado} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OdontogramaVisual;

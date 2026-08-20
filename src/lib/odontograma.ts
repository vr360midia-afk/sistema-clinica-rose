export interface Treatment {
  id: string;
  label: string;
  color: string;
}

export const TREATMENTS: Treatment[] = [
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
  { id: 'invisible-aligners', label: 'Alinhadores Invisíveis', color: 'bg-muted' },
];

export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const ALL_TEETH = [...UPPER_TEETH, ...LOWER_TEETH];

export const treatmentLabel = (id?: string) =>
  TREATMENTS.find((t) => t.id === (id || 'healthy'))?.label || 'Saudável';

export const treatmentColor = (id?: string) =>
  TREATMENTS.find((t) => t.id === (id || 'healthy'))?.color || 'bg-card';

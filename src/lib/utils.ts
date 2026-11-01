import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Garante disponibilidade global imediata para evitar 'cn is not defined' em qualquer contexto
if (typeof window !== 'undefined') {
  (window as any).cn = cn;
}
if (typeof globalThis !== 'undefined') {
  (globalThis as any).cn = cn;
}

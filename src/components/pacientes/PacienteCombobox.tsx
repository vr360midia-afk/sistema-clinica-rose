import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Search, X, UserX, UserPlus, Phone } from 'lucide-react';
import { Paciente } from '@/types/shared';
import { cn } from '@/lib/utils';

export interface PacienteComboboxProps {
  pacientes: Paciente[];
  value: string;
  onChange: (pacienteId: string) => void;
  fallbackNome?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  onAddNew?: () => void;
  id?: string;
  required?: boolean;
}

// Utilitário para remover acentuação e padronizar busca
const normalizarTexto = (texto: string): string => {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export const PacienteCombobox: React.FC<PacienteComboboxProps> = ({
  pacientes = [],
  value,
  onChange,
  fallbackNome,
  placeholder = 'Buscar paciente por nome...',
  disabled = false,
  className,
  triggerClassName,
  onAddNew,
  id,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Paciente atualmente selecionado
  const pacienteSelecionado = useMemo(() => {
    if (!value) return null;
    return (pacientes || []).find((p) => p.id === value) || null;
  }, [pacientes, value]);

  const nomeExibicao = pacienteSelecionado?.nome || fallbackNome || '';

  // Filtragem otimizada com suporte a múltiplos termos, acentuação, telefone e CPF
  const pacientesFiltrados = useMemo(() => {
    const lista = [...(pacientes || [])].sort((a, b) =>
      (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
    );

    const termo = normalizarTexto(search);
    if (!termo) {
      // Retorna até os primeiros 100 para manter máxima fluidez de renderização e rolagem no celular
      return lista.slice(0, 100);
    }

    const tokens = termo.split(/\s+/).filter(Boolean);
    const apenasDigitosTermo = search.replace(/\D/g, '');

    return lista.filter((p) => {
      const nomeNorm = normalizarTexto(p.nome);
      const emailNorm = normalizarTexto(p.email || '');
      const telDigitos = (p.telefone || '').replace(/\D/g, '');
      const cpfDigitos = (p.cpf || '').replace(/\D/g, '');

      // Todos os tokens de texto precisam casar no nome ou email
      const casaTexto = tokens.every(
        (token) => nomeNorm.includes(token) || emailNorm.includes(token)
      );

      // Ou se o usuário digitou números, busca no telefone ou CPF
      const casaNumero =
        apenasDigitosTermo.length >= 2 &&
        (telDigitos.includes(apenasDigitosTermo) || cpfDigitos.includes(apenasDigitosTermo));

      return casaTexto || casaNumero;
    }).slice(0, 80);
  }, [pacientes, search]);

  // Reset de busca ao abrir e foco suave
  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Teclado para navegar entre resultados
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < pacientesFiltrados.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, pacientesFiltrados.length - 1)
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (pacientesFiltrados[highlightedIndex]) {
        onChange(pacientesFiltrados[highlightedIndex].id);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className={cn('relative w-full min-w-0', className)}>
      <Popover modal={true} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full h-10 px-3 justify-between font-normal text-left bg-background border border-input hover:bg-accent/40 hover:text-accent-foreground transition-all duration-150 select-none',
              !nomeExibicao && 'text-muted-foreground',
              triggerClassName
            )}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
              {nomeExibicao ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {nomeExibicao.trim().charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate font-medium text-foreground text-sm">
                    {nomeExibicao}
                  </span>
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-sm">{placeholder}</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
              {nomeExibicao && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange('');
                  }}
                  className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Limpar seleção"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
            </div>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className={cn(
            "p-0 z-[70] shadow-2xl rounded-xl border border-border/80 bg-popover text-popover-foreground flex flex-col overflow-hidden",
            // Responsividade blindada: no celular fica com margem lateral perfeita, no desktop acompanha o gatilho
            "w-[calc(100vw-2.5rem)] max-w-[420px] sm:w-[var(--radix-popover-trigger-width)] sm:min-w-[320px]"
          )}
          align="start"
          side="bottom"
          sideOffset={6}
          avoidCollisions={true}
          collisionPadding={{ top: 12, right: 14, bottom: 12, left: 14 }}
          onOpenAutoFocus={(e) => {
            // Evita scroll jump do Dialog mantendo o foco suave no input
            e.preventDefault();
            setTimeout(() => {
              inputRef.current?.focus();
            }, 50);
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
          }}
          onPointerDownCapture={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Cabeçalho de Busca com Input Real - 16px font-size para evitar zoom no iOS */}
          <div className="p-2.5 border-b bg-muted/20">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-emerald-500 shrink-0 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Digite o nome, telefone ou CPF..."
                className="w-full h-10 pl-9 pr-9 rounded-lg bg-background border border-input text-[16px] sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 shadow-inner transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2.5 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                  title="Limpar busca"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Contador sutil */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1 pt-1.5 font-medium">
              <span>
                {pacientesFiltrados.length === 1
                  ? '1 paciente encontrado'
                  : `${pacientesFiltrados.length} pacientes`}
              </span>
              {search ? (
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Filtrando
                </span>
              ) : (
                pacientes.length > 100 && (
                  <span className="text-muted-foreground text-[10px]">
                    (Mostrando 100 de {pacientes.length})
                  </span>
                )
              )}
            </div>
          </div>

          {/* Lista de Pacientes com Rolagem Fluida, Protegida contra Trava de Toque e Descarte de Teclado ao Rolar */}
          <div
            ref={listRef}
            className="max-h-[min(280px,46vh)] sm:max-h-72 overflow-y-auto overscroll-contain touch-pan-y divide-y divide-border/30 select-none"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
            }}
            onTouchStart={() => {
              // Se o teclado virtual estiver aberto no celular e o usuário começar a rolar, esconde o teclado suavemente para dar visibilidade aos itens
              if (document.activeElement === inputRef.current) {
                inputRef.current?.blur();
              }
            }}
            onTouchMove={(e) => {
              // Impede que eventos de toque sejam cancelados por react-remove-scroll de modais superiores
              e.stopPropagation();
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
          >
            {pacientesFiltrados.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                <UserX className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                <p>
                  Nenhum paciente encontrado para{' '}
                  <strong className="text-foreground font-semibold">"{search}"</strong>
                </p>
                {onAddNew && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      onAddNew();
                    }}
                    className="mt-2 text-xs border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 gap-1"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Cadastrar "{search}"
                  </Button>
                )}
              </div>
            ) : (
              pacientesFiltrados.map((paciente, idx) => {
                const isSelected = paciente.id === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={paciente.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(paciente.id);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={cn(
                      'px-3 py-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 font-medium'
                        : isHighlighted
                        ? 'bg-accent/80'
                        : 'hover:bg-accent/50',
                      'active:bg-emerald-500/20'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                          isSelected
                            ? 'bg-emerald-500 text-white shadow-xs'
                            : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        )}
                      >
                        {paciente.nome?.trim().charAt(0).toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-foreground truncate">
                          {paciente.nome}
                        </div>
                        {(paciente.telefone || paciente.cpf) && (
                          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                            {paciente.telefone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-2.5 w-2.5 opacity-60" />
                                {paciente.telefone}
                              </span>
                            )}
                            {paciente.telefone && paciente.cpf && <span>•</span>}
                            {paciente.cpf && <span>CPF: {paciente.cpf}</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground shrink-0">
                        Selecionar
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé com atalho de cadastro caso onAddNew seja passado */}
          {onAddNew && (
            <div className="p-2 border-t bg-muted/20 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">
                Não encontrou o paciente?
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                  onAddNew();
                }}
                className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 gap-1 px-2 font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" /> Novo Paciente
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PacienteCombobox;

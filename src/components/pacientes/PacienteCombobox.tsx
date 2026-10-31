import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Search, X, UserX, UserPlus, Phone, ArrowLeft } from 'lucide-react';
import { Paciente } from '@/types/shared';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobileHook = useIsMobile();
  const isMobile = isMobileHook ?? (typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopListRef = useRef<HTMLDivElement>(null);

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
      // Retorna até os primeiros 300 para navegação completa e fluida
      return lista.slice(0, 300);
    }

    const tokens = termo.split(/\s+/).filter(Boolean);
    const apenasDigitosTermo = search.replace(/\D/g, '');

    return lista.filter((p) => {
      const nomeNorm = normalizarTexto(p.nome);
      const emailNorm = normalizarTexto(p.email || '');
      const telDigitos = (p.telefone || '').replace(/\D/g, '');
      const cpfDigitos = (p.cpf || '').replace(/\D/g, '');

      // Cada termo digitado pode casar no nome, email, telefone ou CPF
      const casaTokens = tokens.every((token) => {
        const tokenDigitos = token.replace(/\D/g, '');
        const bateNomeEmail = nomeNorm.includes(token) || emailNorm.includes(token);
        const bateNumeros =
          tokenDigitos.length >= 2 &&
          (telDigitos.includes(tokenDigitos) || cpfDigitos.includes(tokenDigitos));
        return bateNomeEmail || bateNumeros;
      });

      // Busca direta por dígitos caso o usuário tenha colado número com traços/parênteses
      const casaNumeroDireto =
        apenasDigitosTermo.length >= 2 &&
        (telDigitos.includes(apenasDigitosTermo) || cpfDigitos.includes(apenasDigitosTermo));

      return casaTokens || casaNumeroDireto;
    }).slice(0, 150);
  }, [pacientes, search]);

  // Reset de busca ao abrir e foco adequado para Mobile e Desktop
  useEffect(() => {
    if (open) {
      setSearch('');
      setHighlightedIndex(0);
      if (isMobile) {
        const timer = setTimeout(() => {
          mobileInputRef.current?.focus();
        }, 100);
        return () => clearTimeout(timer);
      } else {
        requestAnimationFrame(() => {
          desktopInputRef.current?.focus();
        });
      }
    }
  }, [open, isMobile]);

  // Fecha com tecla Escape
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open]);

  // Teclado para navegar entre resultados no Desktop
  const handleDesktopKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setOpen(true);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSearch(e.key);
        setOpen(true);
        return;
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

  // Botão Gatilho Compartilhado
  const renderTriggerButton = (props?: React.ComponentPropsWithoutRef<typeof Button>) => (
    <Button
      type="button"
      id={id}
      role="combobox"
      aria-expanded={open}
      disabled={disabled}
      className={cn(
        'w-full h-10 px-3 justify-between font-normal text-left bg-background border border-input hover:bg-accent/40 hover:text-accent-foreground transition-all duration-150 select-none cursor-pointer',
        !nomeExibicao && 'text-muted-foreground',
        triggerClassName
      )}
      onClick={() => {
        if (!disabled) {
          setOpen((prev) => !prev);
        }
      }}
      onKeyDown={!isMobile ? handleDesktopKeyDown : undefined}
      {...props}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        {nomeExibicao ? (
          <>
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center justify-center shrink-0">
              {nomeExibicao.trim().charAt(0).toUpperCase()}
            </div>
            <span className="truncate font-medium text-foreground text-xs sm:text-sm">
              {nomeExibicao}
            </span>
            {pacienteSelecionado?.telefone && (
              <span className="text-[11px] text-muted-foreground truncate hidden sm:inline shrink-0 opacity-80">
                {pacienteSelecionado.telefone}
              </span>
            )}
          </>
        ) : (
          <>
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate text-xs sm:text-sm">{placeholder}</span>
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
  );

  return (
    <div className={cn('relative w-full min-w-0', className)}>
      {/* ============================================================ */}
      {/* VERSÃO MOBILE: Tela de busca dedicada, rápida e 100% destravada */}
      {/* ============================================================ */}
      {isMobile ? (
        <>
          {renderTriggerButton()}

          {open && (
            <div
              className="fixed inset-0 z-[100] bg-background flex flex-col animate-in fade-in-0 duration-150 rounded-lg overflow-hidden shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label="Buscar paciente"
            >
              {/* Topo: Barra com Voltar, Título e Fechar */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-card/95 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="p-1.5 -ml-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
                    aria-label="Voltar"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">Selecionar Paciente</h3>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {pacientesFiltrados.length} {pacientesFiltrados.length === 1 ? 'paciente' : 'pacientes encontrados'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95 transition-all cursor-pointer"
                  aria-label="Fechar busca"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Campo de Busca Real, Direto e Nativo */}
              <div className="p-3 border-b border-border/70 bg-muted/20 shrink-0">
                <div className="relative flex items-center">
                  <Search className="absolute left-3.5 h-4 w-4 text-emerald-500 pointer-events-none shrink-0" />
                  <input
                    ref={mobileInputRef}
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Digite o nome, telefone ou CPF..."
                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-background border border-input text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 shadow-xs transition-all pointer-events-auto"
                    autoCapitalize="words"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        mobileInputRef.current?.focus();
                      }}
                      className="absolute right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                      title="Limpar busca"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista de Pacientes Mobile com Rolagem Fluida Nativa e Toque Destravado */}
              <div
                className="flex-1 overflow-y-auto overscroll-contain touch-pan-y divide-y divide-border/30 p-2"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  touchAction: 'pan-y',
                }}
              >
                {pacientesFiltrados.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground space-y-3 px-4">
                    <UserX className="h-10 w-10 mx-auto opacity-40 text-muted-foreground" />
                    <p className="text-sm">
                      Nenhum paciente encontrado para <strong className="text-foreground">"{search}"</strong>
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
                        className="mt-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1.5 h-9"
                      >
                        <UserPlus className="h-4 w-4" /> Cadastrar "{search}"
                      </Button>
                    )}
                  </div>
                ) : (
                  pacientesFiltrados.map((paciente) => {
                    const isSelected = paciente.id === value;

                    return (
                      <div
                        key={paciente.id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          onChange(paciente.id);
                          setOpen(false);
                        }}
                        className={cn(
                          'p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-colors active:bg-emerald-500/15',
                          isSelected
                            ? 'bg-emerald-500/10 border border-emerald-500/30 font-medium'
                            : 'hover:bg-accent/40'
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0',
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
                              <div className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                                {paciente.telefone && (
                                  <span className="flex items-center gap-1 shrink-0">
                                    <Phone className="h-3 w-3 opacity-60" />
                                    {paciente.telefone}
                                  </span>
                                )}
                                {paciente.telefone && paciente.cpf && <span>•</span>}
                                {paciente.cpf && <span className="truncate">CPF: {paciente.cpf}</span>}
                              </div>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Rodapé Opcional com Novo Paciente */}
              {onAddNew && (
                <div className="p-3 border-t border-border bg-card/95 flex items-center justify-between shrink-0">
                  <span className="text-xs text-muted-foreground">Não encontrou o paciente?</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      onAddNew();
                    }}
                    className="h-8 text-xs border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 gap-1 font-medium"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Novo Paciente
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* ============================================================ */
        /* VERSÃO DESKTOP: Popover flutuante clássico, com modal={false} */
        /* ============================================================ */
        <Popover modal={false} open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            {renderTriggerButton()}
          </PopoverTrigger>

          <PopoverContent
            className={cn(
              "p-0 z-[70] shadow-2xl rounded-xl border border-border/80 bg-popover text-popover-foreground flex flex-col overflow-hidden pointer-events-auto",
              "w-[var(--radix-popover-trigger-width)] min-w-[320px] max-w-[420px]"
            )}
            align="start"
            side="bottom"
            sideOffset={6}
            avoidCollisions={true}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              desktopInputRef.current?.focus();
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
            }}
          >
            {/* Cabeçalho de Busca Desktop */}
            <div className="p-2.5 border-b bg-muted/20">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-emerald-500 shrink-0 pointer-events-none" />
                <input
                  ref={desktopInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  onKeyDown={handleDesktopKeyDown}
                  placeholder="Digite o nome, telefone ou CPF..."
                  className="w-full h-9 pl-9 pr-9 rounded-lg bg-background border border-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 shadow-inner transition-all select-text cursor-text"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      desktopInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Contador */}
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
                  pacientes.length > 300 && (
                    <span className="text-muted-foreground text-[10px]">
                      (Mostrando 300 de {pacientes.length})
                    </span>
                  )
                )}
              </div>
            </div>

            {/* Lista Desktop */}
            <div
              ref={desktopListRef}
              className="max-h-72 overflow-y-auto divide-y divide-border/30 select-none"
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
                        'px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer transition-colors',
                        isSelected
                          ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 font-medium'
                          : isHighlighted
                          ? 'bg-accent/80'
                          : 'hover:bg-accent/50'
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0',
                            isSelected
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          )}
                        >
                          {paciente.nome?.trim().charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs text-foreground truncate">
                            {paciente.nome}
                          </div>
                          {(paciente.telefone || paciente.cpf) && (
                            <div className="text-[10px] text-muted-foreground truncate flex items-center gap-2 mt-0.5">
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

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Rodapé Desktop */}
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
      )}
    </div>
  );
};

export default PacienteCombobox;

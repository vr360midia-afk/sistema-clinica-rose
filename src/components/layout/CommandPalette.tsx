import React, { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Calendar, DollarSign, Settings, Plus, FileText, X } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { pacientes } = useDentalSystem();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-background rounded-xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
        <Command label="Comandos Globais" className="w-full bg-transparent flex flex-col h-full max-h-[60vh]">
          <div className="flex items-center border-b border-border px-3">
            <Search className="w-5 h-5 text-muted-foreground mr-2 shrink-0" />
            <Command.Input 
              placeholder="Digite um comando ou busque pacientes..." 
              className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            <button onClick={() => setOpen(false)} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          <Command.List className="overflow-y-auto p-2 scrollbar-thin">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </Command.Empty>

            <Command.Group heading="Ações Rápidas" className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1">
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/pacientes'))}
                className="flex items-center px-2 py-2.5 text-sm rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Plus className="w-4 h-4 mr-2" />
                Novo Paciente
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/agenda'))}
                className="flex items-center px-2 py-2.5 text-sm rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Agendar Consulta
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Navegação" className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1 mt-3">
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/dashboard'))}
                className="flex items-center px-2 py-2.5 text-sm rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Search className="w-4 h-4 mr-2" />
                Dashboard
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/pacientes'))}
                className="flex items-center px-2 py-2.5 text-sm rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Users className="w-4 h-4 mr-2" />
                Pacientes
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/financeiro'))}
                className="flex items-center px-2 py-2.5 text-sm rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Financeiro
              </Command.Item>
              <Command.Item 
                onSelect={() => runCommand(() => navigate('/configuracoes'))}
                className="flex items-center px-2 py-2.5 text-sm rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Command.Item>
            </Command.Group>

            {pacientes.length > 0 && (
              <Command.Group heading="Pacientes" className="text-xs font-medium text-muted-foreground px-2 py-1.5 mb-1 mt-3">
                {pacientes.slice(0, 5).map(paciente => (
                  <Command.Item 
                    key={paciente.id}
                    value={`paciente ${paciente.nome}`}
                    onSelect={() => runCommand(() => navigate('/pacientes'))}
                    className="flex items-center px-2 py-2.5 text-sm rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <Users className="w-4 h-4 mr-2 opacity-50" />
                    <span className="flex-1 truncate">{paciente.nome}</span>
                    <span className="text-xs opacity-50 ml-2 border border-border px-1.5 rounded">Ficha</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
};

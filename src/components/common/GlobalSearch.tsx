import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { Users, Calendar, DollarSign, LayoutDashboard, Settings, Wrench, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paginas = [
  { nome: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { nome: 'Pacientes', href: '/pacientes', icon: Users },
  { nome: 'Agenda', href: '/agenda', icon: Calendar },
  { nome: 'Financeiro', href: '/financeiro', icon: DollarSign },
  { nome: 'Procedimentos', href: '/procedimentos', icon: Wrench },
  { nome: 'Prontuários', href: '/prontuarios', icon: FileText },
  { nome: 'Configurações', href: '/configuracoes', icon: Settings },
];

const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const { pacientes, consultas, transacoes } = useDentalSystem();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const termo = query.trim().toLowerCase();

  const pacientesFiltrados = useMemo(
    () =>
      termo
        ? pacientes
            .filter(
              (p) =>
                p.nome?.toLowerCase().includes(termo) ||
                p.telefone?.includes(termo) ||
                p.email?.toLowerCase().includes(termo)
            )
            .slice(0, 6)
        : pacientes.slice(0, 5),
    [pacientes, termo]
  );

  const nomePaciente = useMemo(() => {
    const map = new Map(pacientes.map((p) => [p.id, p.nome]));
    return (id?: string) => (id ? map.get(id) : undefined);
  }, [pacientes]);

  const consultasFiltradas = useMemo(
    () =>
      termo
        ? consultas
            .filter(
              (c) =>
                nomePaciente(c.pacienteId)?.toLowerCase().includes(termo) ||
                c.procedimento?.toLowerCase().includes(termo) ||
                c.dentista?.toLowerCase().includes(termo)
            )
            .slice(0, 5)
        : [],
    [consultas, termo, nomePaciente]
  );

  const transacoesFiltradas = useMemo(
    () =>
      termo
        ? transacoes
            .filter(
              (t) =>
                t.descricao?.toLowerCase().includes(termo) ||
                nomePaciente(t.pacienteId)?.toLowerCase().includes(termo)
            )
            .slice(0, 5)
        : [],
    [transacoes, termo, nomePaciente]
  );

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar pacientes, consultas, lançamentos..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

        {pacientesFiltrados.length > 0 && (
          <CommandGroup heading="Pacientes">
            {pacientesFiltrados.map((p) => (
              <CommandItem key={p.id} value={`paciente-${p.nome}-${p.id}`} onSelect={() => go(`/pacientes?q=${encodeURIComponent(p.nome)}`)}>
                <Users className="mr-2 h-4 w-4" />
                <span className="truncate">{p.nome}</span>
                {p.telefone && <span className="ml-auto text-xs text-muted-foreground">{p.telefone}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {consultasFiltradas.length > 0 && (
          <CommandGroup heading="Consultas">
            {consultasFiltradas.map((c) => (
              <CommandItem key={c.id} value={`consulta-${c.id}`} onSelect={() => go('/agenda')}>
                <Calendar className="mr-2 h-4 w-4" />
                <span className="truncate">
                  {nomePaciente(c.pacienteId) || 'Consulta'} — {c.procedimento || 'Atendimento'}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {format(new Date(c.data), 'dd/MM')} {c.hora}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {transacoesFiltradas.length > 0 && (
          <CommandGroup heading="Financeiro">
            {transacoesFiltradas.map((t) => (
              <CommandItem key={t.id} value={`transacao-${t.id}`} onSelect={() => go('/financeiro')}>
                <DollarSign className="mr-2 h-4 w-4" />
                <span className="truncate">{t.descricao || nomePaciente(t.pacienteId) || 'Lançamento'}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(t.valor || 0)}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Ir para">
          {paginas.map((p) => (
            <CommandItem key={p.href} value={`pagina-${p.nome}`} onSelect={() => go(p.href)}>
              <p.icon className="mr-2 h-4 w-4" />
              {p.nome}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearch;

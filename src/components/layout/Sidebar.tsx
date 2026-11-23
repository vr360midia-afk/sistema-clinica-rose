
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUserRoles, AppRole } from '@/hooks/useUserRoles';
import { useTheme } from '@/context/ThemeContext';
import {
  Target,
  Home,
  Users,
  Calendar,
  FileText,
  Clipboard,
  Wrench,
  DollarSign,
  MessageSquare,
  Package,
  BarChart3,
  Settings,
  Shield,
  X,
  StickyNote,
  Trash2,
  Handshake,
  CalendarCheck2,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import { useNovosLeadsBadgeCount } from '@/hooks/useNovosLeadsBadgeCount';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: typeof Home;
  allow?: AppRole[];
  badge?: boolean;
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Novos Leads', href: '/novos-leads', icon: Sparkles, badge: true },
  { name: 'CRM / Leads', href: '/crm', icon: Target },
  { name: 'Agenda', href: '/agenda', icon: Calendar },
  { name: 'Tarefas da Equipe', href: '/tarefas', icon: CalendarCheck2 },
  { name: 'Notas', href: '/notas', icon: StickyNote },
  { name: 'Pacientes', href: '/pacientes', icon: Users },
  { name: 'Anamnese', href: '/anamnese', icon: FileText },
  { name: 'Prontuários', href: '/prontuarios', icon: Clipboard },
  { name: 'Procedimentos', href: '/procedimentos', icon: Wrench },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign, allow: ['admin'] },
  { name: 'Parceiros (Fat.)', href: '/faturamento-parceiros', icon: Handshake, allow: ['admin'] },
  { name: 'Comunicação', href: '/comunicacao', icon: MessageSquare },
  { name: 'Estoque', href: '/estoque', icon: Package },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3, allow: ['admin'] },
  { name: 'Configurações', href: '/configuracoes', icon: Settings, allow: ['admin'] },
  { name: 'Lixeira', href: '/lixeira', icon: Trash2, allow: ['admin'] },
  { name: 'Admin', href: '/admin', icon: Shield, allow: ['admin'] },
];

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();
  const unreviewedLeadsCount = useNovosLeadsBadgeCount();
  const { theme, toggleTheme } = useTheme();

  const { roles } = useUserRoles();
  const semPerfil = roles.length === 0;
  const podeVer = (item: NavItem) =>
    !item.allow || semPerfil || roles.includes('admin') || item.allow.some((r) => roles.includes(r));
  const itensVisiveis = navigation.filter(podeVer);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:hidden animate-in fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] bg-card border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col safe-top',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-14 sm:h-16 px-4 border-b border-border lg:hidden shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/logo.png" alt="Dra. Rosangela Santos" className="h-9 sm:h-10 object-contain" />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted flex-shrink-0"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-2 px-2 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] flex-1 overflow-y-auto overscroll-contain safe-bottom">
          <ul className="space-y-1">
            {itensVisiveis.map((item) => {
              const isActive =
                location.pathname === item.href ||
                (item.href === '/' && location.pathname === '/dashboard');
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors w-full active:scale-[0.99]',
                      isActive
                        ? 'bg-purple-100/90 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-r-2 border-purple-700 font-semibold'
                        : 'text-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate flex-1 text-left">{item.name}</span>
                    {item.badge && unreviewedLeadsCount > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold text-white bg-purple-600 rounded-full shadow-sm animate-pulse">
                        {unreviewedLeadsCount > 99 ? '99+' : unreviewedLeadsCount}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Alternador de Tema Claro / Escuro no rodapé da Sidebar */}
        <div className="p-3 border-t border-border bg-card/60 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-foreground hover:bg-muted border border-border/60 transition-colors shadow-2xs cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
            </div>
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-300/40">
              {theme === 'dark' ? 'Ativar Claro' : 'Ativar Escuro'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;


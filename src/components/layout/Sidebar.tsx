
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUserRoles, AppRole } from '@/hooks/useUserRoles';
import {
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
  Handshake
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: typeof Home;
  allow?: AppRole[];
}

const navigation: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Notas', href: '/notas', icon: StickyNote },
  { name: 'Pacientes', href: '/pacientes', icon: Users },
  { name: 'Agenda', href: '/agenda', icon: Calendar },
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
          'fixed inset-y-0 left-0 z-50 w-60 bg-card border-r border-border transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-border lg:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <h1 className="text-xl font-bold text-foreground truncate">Dental do Milh�o</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:bg-muted flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-2 px-2 pb-24 h-full overflow-y-auto overscroll-contain safe-bottom">
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
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;

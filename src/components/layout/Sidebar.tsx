
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
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
  StickyNote
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Notas', href: '/notas', icon: StickyNote },
  { name: 'Pacientes', href: '/pacientes', icon: Users },
  { name: 'Agenda', href: '/agenda', icon: Calendar },
  { name: 'Anamnese', href: '/anamnese', icon: FileText },
  { name: 'Prontuários', href: '/prontuarios', icon: Clipboard },
  { name: 'Procedimentos', href: '/procedimentos', icon: Wrench },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
  { name: 'Comunicação', href: '/comunicacao', icon: MessageSquare },
  { name: 'Estoque', href: '/estoque', icon: Package },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3 },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
  { name: 'Admin', href: '/admin', icon: Shield },
];

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 lg:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 truncate">Dental IA</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 flex-shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="mt-2 px-2 pb-4 h-full overflow-y-auto">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors w-full',
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
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

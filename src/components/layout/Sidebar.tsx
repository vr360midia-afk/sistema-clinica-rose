
import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  FileText, 
  CreditCard, 
  MessageSquare,
  BarChart3,
  Package,
  Settings,
  X,
  Clipboard,
  TrendingUp,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const menuItems = [
  { name: 'Dashboard', icon: BarChart3, path: '/' },
  { name: 'Pacientes', icon: Users, path: '/pacientes' },
  { name: 'Agenda', icon: Calendar, path: '/agenda' },
  { name: 'Anamnese', icon: Clipboard, path: '/anamnese' },
  { name: 'Prontuários', icon: FileText, path: '/prontuarios' },
  { name: 'Financeiro', icon: CreditCard, path: '/financeiro' },
  { name: 'Comunicação', icon: MessageSquare, path: '/comunicacao' },
  { name: 'Estoque', icon: Package, path: '/estoque' },
  { name: 'Relatórios', icon: TrendingUp, path: '/relatorios' },
  { name: 'Configurações', icon: Settings, path: '/configuracoes' },
  { name: 'Personalização', icon: Palette, path: '/admin' },
];

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 bg-gray-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <h2 className="text-lg font-bold">Dental IA</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.name}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    )
                  }
                  onClick={() => window.innerWidth < 1024 && onClose()}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;

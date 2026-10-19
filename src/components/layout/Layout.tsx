import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useBackupAutomatico } from '@/hooks/useBackupAutomatico';
import { CommandPalette } from './CommandPalette';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, Link } from 'react-router-dom';
import { Home, Users, Calendar, CalendarCheck2, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  useBackupAutomatico();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="min-h-screen bg-muted flex w-full overflow-x-hidden">
      <CommandPalette />
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 flex flex-col min-w-0 w-full lg:pl-60 overflow-x-hidden">
        <Header onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-x-hidden w-full px-3.5 sm:px-6 py-4 sm:py-6 pb-28 lg:pb-12 pb-mobile-nav safe-left safe-right">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-7xl mx-auto h-full min-w-0"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Barra de Navegação Inferior no Mobile (Símbolo + Texto sempre visíveis) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border flex items-center justify-around px-1 lg:hidden shadow-lg nav-mobile-height">
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors",
            location.pathname === '/' || location.pathname === '/dashboard'
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Home className="h-4 w-4 mb-0.5 shrink-0" />
          <span>Início</span>
        </Link>

        <Link
          to="/pacientes"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors",
            location.pathname.startsWith('/pacientes')
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="h-4 w-4 mb-0.5 shrink-0" />
          <span>Pacientes</span>
        </Link>

        <Link
          to="/agenda"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors",
            location.pathname.startsWith('/agenda')
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="h-4 w-4 mb-0.5 shrink-0" />
          <span>Agenda</span>
        </Link>

        <Link
          to="/tarefas"
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors",
            location.pathname.startsWith('/tarefas')
              ? "text-primary font-bold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarCheck2 className="h-4 w-4 mb-0.5 shrink-0" />
          <span>Tarefas</span>
        </Link>

        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            "flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-medium transition-colors",
            sidebarOpen ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Menu className="h-4 w-4 mb-0.5 shrink-0" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
};

export default Layout;

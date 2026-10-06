import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { useBackupAutomatico } from '@/hooks/useBackupAutomatico';
import { CommandPalette } from './CommandPalette';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

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

      <div className="flex-1 flex flex-col min-w-0 w-full lg:pl-60">
        <Header onMenuToggle={toggleSidebar} />
        <main className="flex-1 overflow-x-hidden w-full px-3 sm:px-4 lg:px-6 py-3 sm:py-4 pb-10 safe-bottom">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-7xl mx-auto h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

export default Layout;

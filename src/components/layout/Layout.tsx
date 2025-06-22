
import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex w-full">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0 w-full">
        <Header onMenuToggle={toggleSidebar} />
        <main className="flex-1 p-2 sm:p-3 lg:p-4 overflow-x-hidden w-full">
          <div className="w-full max-w-none mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;

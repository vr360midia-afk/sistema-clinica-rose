import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
interface LayoutProps {
  children: React.ReactNode;
}
const Layout = ({
  children
}: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  const closeSidebar = () => {
    setSidebarOpen(false);
  };
  return <div className="min-h-screen bg-gray-50 flex w-full">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      
      <div className="flex-1 flex flex-col lg:ml-56 min-w-0 w-full">
        <Header onMenuToggle={toggleSidebar} />
        <main className="flex-1 p-1 sm:p-2 lg:p-3 overflow-x-hidden w-full mx-0 my-0 px-[6px] py-[14px]">
          <div className="w-full max-w-none mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>;
};
export default Layout;
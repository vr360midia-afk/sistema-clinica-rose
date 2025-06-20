
import React, { useState } from 'react';
import { Bell, Search, User, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header = ({ onMenuToggle }: HeaderProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      console.log('Buscando paciente:', searchTerm);
      // Implementar busca de pacientes aqui
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onMenuToggle}
          className="lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">D</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Dental IA</h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <form onSubmit={handleSearch} className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Buscar pacientes..."
            className="pl-10 w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>

        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            3
          </span>
        </Button>

        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-blue-100 text-blue-600">
              DR
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900">Dr. Ana Silva</p>
            <p className="text-xs text-gray-500">Administradora</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

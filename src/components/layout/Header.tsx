import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, Menu, LogOut, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
import GlobalSearch from '@/components/common/GlobalSearch';
import NotificationsBell from '@/components/common/NotificationsBell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header = ({ onMenuToggle }: HeaderProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchTerm.trim();
    if (!term) return;
    navigate(`/pacientes?q=${encodeURIComponent(term)}`);
    setMobileSearchOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
  };


  return (
    <>
    <GlobalSearch open={commandOpen} onOpenChange={setCommandOpen} />
    <header className="sticky top-0 z-30 bg-card border-b border-border w-full">
      <div className="px-3 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden h-10 w-10"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

                    <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="Dental Angel" className="h-8 sm:h-10 object-contain" />
          </div>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            className="relative hidden md:flex items-center gap-2 w-48 lg:w-64 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Buscar tudo...</span>
            <kbd className="ml-auto text-[10px] border border-border rounded px-1.5 py-0.5">⌘K</kbd>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-10 w-10"
            onClick={() => setCommandOpen(true)}
            aria-label="Buscar"
          >
            {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </Button>

          <NotificationsBell />


          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-1 sm:px-2 h-10">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-blue-100 text-blue-600">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-left min-w-0">
                  <p className="text-sm font-medium text-foreground truncate max-w-32">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Usuário</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-50 bg-card border shadow-lg">
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {mobileSearchOpen && (
        <form onSubmit={handleSearch} className="md:hidden px-3 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              autoFocus
              placeholder="Buscar pacientes..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </form>
      )}
    </header>
    </>
  );
};

export default Header;


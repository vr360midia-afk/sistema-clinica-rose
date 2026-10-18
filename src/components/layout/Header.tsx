import React from 'react';
import { Menu, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/context/AuthContext';
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
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="sticky top-0 z-30 bg-card/95 backdrop-blur-md border-b border-border w-full safe-top transition-[padding] duration-150">
      <div className="px-3.5 sm:px-4 lg:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-1 sm:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onMenuToggle}
            className="lg:hidden h-9 px-2.5 text-xs font-semibold gap-1.5 border-border bg-background text-foreground shadow-xs hover:bg-muted"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4 text-primary" />
            <span>Menu</span>
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <img src="/logo.png" alt="Dra. Rosangela Santos" className="h-8 sm:h-10 object-contain" />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-3">
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
    </header>
  );
};

export default Header;


import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Settings2, Sparkles } from 'lucide-react';
import { useOrigensLead } from '@/hooks/useOrigensLead';
import { useNavigate } from 'react-router-dom';

interface SelectOrigemLeadProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

export const SelectOrigemLead: React.FC<SelectOrigemLeadProps> = ({
  value,
  onChange,
  placeholder = 'Como conheceu a clínica?',
  triggerClassName = 'h-10 mt-1',
  disabled = false,
}) => {
  const { origensAtivas, adicionarOrigem } = useOrigensLead();
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const navigate = useNavigate();

  const handleSelectChange = (val: string) => {
    if (val === '__adicionar_nova__') {
      setNovoNome('');
      setModalNovoAberto(true);
      return;
    }
    onChange(val);
  };

  const handleSalvarNovaOrigem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!novoNome.trim()) return;

    setSalvando(true);
    try {
      const item = adicionarOrigem(novoNome.trim());
      if (item) {
        onChange(item.id);
        setModalNovoAberto(false);
        setNovoNome('');
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <Select
        value={value || ''}
        onValueChange={handleSelectChange}
        disabled={disabled}
      >
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {origensAtivas.map((origem) => (
            <SelectItem key={origem.id} value={origem.id}>
              {origem.label}
            </SelectItem>
          ))}

          <SelectSeparator className="my-1" />

          {/* Opção para adicionar na hora */}
          <SelectItem
            value="__adicionar_nova__"
            className="text-primary font-medium focus:bg-primary/10 focus:text-primary cursor-pointer py-2"
          >
            <div className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              <span>+ Adicionar nova origem...</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Modal para Personalização Imediata (Na Hora) */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <DialogTitle>Personalizar Origem de Lead</DialogTitle>
            </div>
            <DialogDescription>
              Adicione um novo canal de captação ou indicação. Ele será salvo no sistema e selecionado imediatamente para este paciente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarNovaOrigem} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nomeNovaOrigem" className="font-medium">
                Nome do Canal / Origem
              </Label>
              <Input
                id="nomeNovaOrigem"
                autoFocus
                placeholder="Ex: TikTok, Rádio Gazeta, Evento Empresarial, Dr. João"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Dica: você também pode gerenciar, renomear ou desativar todas as origens na aba Configurações.
              </p>
            </div>

            <DialogFooter className="flex items-center justify-between sm:justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1 hover:text-foreground"
                onClick={() => {
                  setModalNovoAberto(false);
                  navigate('/configuracoes?tab=origens');
                }}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Abrir em Configurações
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalNovoAberto(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!novoNome.trim() || salvando}
                >
                  Salvar e Selecionar
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SelectOrigemLead;


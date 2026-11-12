import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Sparkles,
  Search,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { useOrigensLead, OrigemLeadItem } from '@/hooks/useOrigensLead';

export const OrigensLeadManager: React.FC = () => {
  const {
    origens,
    origensAtivas,
    adicionarOrigem,
    editarOrigem,
    removerOrigem,
    alternarStatus,
    restaurarPadroes,
  } = useOrigensLead();

  const [busca, setBusca] = useState('');
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [novoNome, setNovoNome] = useState('');

  const [itemEditando, setItemEditando] = useState<OrigemLeadItem | null>(null);
  const [editNome, setEditNome] = useState('');

  const [confirmarRestauracao, setConfirmarRestauracao] = useState(false);
  const [itemParaRemover, setItemParaRemover] = useState<OrigemLeadItem | null>(null);

  const origensFiltradas = origens.filter((o) =>
    o.label.toLowerCase().includes(busca.toLowerCase().trim())
  );

  const handleSalvarNovo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    const criado = adicionarOrigem(novoNome.trim());
    if (criado) {
      setNovoNome('');
      setModalNovoAberto(false);
    }
  };

  const handleSalvarEdicao = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemEditando || !editNome.trim()) return;
    const ok = editarOrigem(itemEditando.id, editNome.trim());
    if (ok) {
      setItemEditando(null);
      setEditNome('');
    }
  };

  const handleConfirmarRemocao = () => {
    if (itemParaRemover) {
      removerOrigem(itemParaRemover.id);
      setItemParaRemover(null);
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Megaphone className="h-4 w-4" />
              </div>
              <CardTitle className="text-xl font-bold">
                Canais de Origem (Como nos Conheceu)
              </CardTitle>
            </div>
            <CardDescription className="text-sm text-muted-foreground">
              Personalize a lista de opções que aparecem no cadastro de novos pacientes. Adicione novos canais sob demanda ou desative canais que não utiliza.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setConfirmarRestauracao(true)}
              title="Restaurar lista de canais para o padrão de fábrica"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar Padrões
            </Button>

            <Button
              type="button"
              size="sm"
              className="gap-1.5 text-xs font-semibold shadow-xs"
              onClick={() => {
                setNovoNome('');
                setModalNovoAberto(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Novo Canal
            </Button>
          </div>
        </div>

        {/* Barra de pesquisa e contagem */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar canal ou origem..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-xs font-normal">
              {origensAtivas.length} ativas de {origens.length} cadastradas
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {origensFiltradas.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground space-y-2">
            <Share2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium">Nenhum canal encontrado</p>
            <p className="text-xs">Tente buscar por outro termo ou adicione um novo canal acima.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {origensFiltradas.map((item) => (
              <div
                key={item.id}
                className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                  item.ativo
                    ? 'bg-card border-border hover:border-primary/40'
                    : 'bg-muted/40 border-dashed border-border opacity-70'
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{item.label}</span>
                    {item.padrao ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        Padrão
                      </Badge>
                    ) : (
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0 h-4">
                        Personalizado
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    ID interno: {item.id}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 mr-1" title={item.ativo ? 'Canal ativo no formulário' : 'Canal desativado'}>
                    <Switch
                      checked={item.ativo}
                      onCheckedChange={(checked) => alternarStatus(item.id, checked)}
                      aria-label="Ativar ou desativar canal"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setItemEditando(item);
                      setEditNome(item.label);
                    }}
                    title="Editar nome do canal"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setItemParaRemover(item)}
                    title={item.padrao ? 'Desativar canal padrão' : 'Excluir canal personalizado'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Modal de Criação */}
      <Dialog open={modalNovoAberto} onOpenChange={setModalNovoAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <DialogTitle>Adicionar Novo Canal de Origem</DialogTitle>
            </div>
            <DialogDescription>
              Cadastre um novo canal ou fonte de indicação. Ele ficará disponível imediatamente nos formulários de pacientes e agendamentos.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarNovo} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="nomeCanal">Nome da Origem / Canal</Label>
              <Input
                id="nomeCanal"
                autoFocus
                placeholder="Ex: TikTok, Rádio Gazeta, Evento ABC, Indicação Médica"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="h-10"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalNovoAberto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!novoNome.trim()}>
                Salvar Canal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog
        open={Boolean(itemEditando)}
        onOpenChange={(aberto) => !aberto && setItemEditando(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Nome do Canal</DialogTitle>
            <DialogDescription>
              Altere a descrição visível para este canal de aquisição.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarEdicao} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="editNomeCanal">Nome de Exibição</Label>
              <Input
                id="editNomeCanal"
                autoFocus
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="h-10"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setItemEditando(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={!editNome.trim()}>
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de Remoção / Desativação */}
      <AlertDialog
        open={Boolean(itemParaRemover)}
        onOpenChange={(aberto) => !aberto && setItemParaRemover(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemParaRemover?.padrao
                ? `Desativar canal padrão "${itemParaRemover?.label}"?`
                : `Excluir canal "${itemParaRemover?.label}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemParaRemover?.padrao
                ? 'Como se trata de um canal padrão do sistema, ele será ocultado do formulário de novos pacientes, mas os dados históricos de pacientes já cadastrados com esta origem permanecerão preservados.'
                : 'Esta origem personalizada não aparecerá mais nos formulários de cadastro. Pacientes que já tiverem essa origem registrada continuarão com o histórico intacto.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmarRemocao}
            >
              {itemParaRemover?.padrao ? 'Desativar' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de Restauração para Padrões */}
      <AlertDialog
        open={confirmarRestauracao}
        onOpenChange={setConfirmarRestauracao}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar opções padrão do sistema?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso reativará todos os canais padrões (Indicação, Google, Facebook, Instagram, Site, WhatsApp, Panfleto e Outros). As origens personalizadas que você adicionou serão redefinidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                restaurarPadroes();
                setConfirmarRestauracao(false);
              }}
            >
              Confirmar Restauração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default OrigensLeadManager;


import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabaseService, MembroEquipe } from '@/services/supabaseService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Users, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const modulosDisponiveis = [
  { id: 'pacientes', label: 'Pacientes (Ver e Editar)' },
  { id: 'agenda', label: 'Agenda e Consultas' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'prontuarios', label: 'Prontuários e Anamneses' },
  { id: 'estoque', label: 'Estoque de Materiais' },
  { id: 'configuracoes', label: 'Configurações' },
];

const EquipeManager = () => {
  const { toast } = useToast();
  const [membros, setMembros] = useState<MembroEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para o modal de novo membro
  const [isNovoMembroOpen, setIsNovoMembroOpen] = useState(false);
  const [novoEmail, setNovoEmail] = useState('');
  const [novoPermissoes, setNovoPermissoes] = useState<Record<string, boolean>>({
    pacientes: true,
    agenda: true,
    financeiro: true,
    prontuarios: true,
    estoque: true,
    configuracoes: false,
  });
  const [adicionando, setAdicionando] = useState(false);

  // Estado para editar permissões
  const [membroEditando, setMembroEditando] = useState<string | null>(null);
  const [permissoesEditando, setPermissoesEditando] = useState<Record<string, boolean>>({});
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarEquipe();
  }, []);

  const carregarEquipe = async () => {
    setLoading(true);
    try {
      const equipe = await supabaseService.getEquipe();
      setMembros(equipe);
    } catch (error) {
      console.error('Erro ao carregar equipe:', error);
      toast({ title: 'Erro ao carregar equipe', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembro = async () => {
    if (!novoEmail) return;
    setAdicionando(true);
    try {
      const novo = await supabaseService.addMembroEquipe(novoEmail, novoPermissoes);
      setMembros([novo, ...membros]);
      setIsNovoMembroOpen(false);
      setNovoEmail('');
      toast({ title: 'Funcionário adicionado com sucesso!' });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao adicionar', 
        description: error.message || 'Tente novamente.', 
        variant: 'destructive' 
      });
    } finally {
      setAdicionando(false);
    }
  };

  const handleRemoverMembro = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este funcionário? Ele perderá o acesso aos dados da sua clínica.')) return;
    
    try {
      await supabaseService.deleteMembroEquipe(id);
      setMembros(membros.filter(m => m.id !== id));
      toast({ title: 'Funcionário removido!' });
    } catch (error) {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    }
  };

  const handleSalvarPermissoes = async (id: string) => {
    setSalvando(true);
    try {
      const atualizado = await supabaseService.updateMembroEquipe(id, permissoesEditando);
      setMembros(membros.map(m => m.id === id ? atualizado : m));
      setMembroEditando(null);
      toast({ title: 'Permissões atualizadas!' });
    } catch (error) {
      toast({ title: 'Erro ao salvar permissões', variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (membro: MembroEquipe) => {
    setMembroEditando(membro.id);
    setPermissoesEditando({ ...membro.permissoes });
  };

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Equipe da Clínica
            </CardTitle>
            <CardDescription>
              Adicione outros dentistas, recepcionistas ou administradores para acessar seu sistema.
            </CardDescription>
          </div>
          
          <Dialog open={isNovoMembroOpen} onOpenChange={setIsNovoMembroOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Funcionário
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Convidar para a Equipe</DialogTitle>
                <DialogDescription>
                  Importante: O funcionário já deve ter criado uma conta no sistema com o email abaixo.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Email do funcionário</Label>
                  <Input 
                    placeholder="email@exemplo.com" 
                    type="email"
                    value={novoEmail}
                    onChange={(e) => setNovoEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-3 mt-2">
                  <Label>Permissões de Acesso</Label>
                  {modulosDisponiveis.map(modulo => (
                    <div key={modulo.id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={`novo-${modulo.id}`} 
                        checked={novoPermissoes[modulo.id] || false}
                        onCheckedChange={(checked) => setNovoPermissoes({...novoPermissoes, [modulo.id]: checked === true})}
                      />
                      <label htmlFor={`novo-${modulo.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {modulo.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsNovoMembroOpen(false)}>Cancelar</Button>
                <Button onClick={handleAddMembro} disabled={adicionando || !novoEmail}>
                  {adicionando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Adicionar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        
        <CardContent>
          {membros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Ninguém na sua equipe ainda.</p>
              <p className="text-sm">Clique no botão acima para dar acesso aos seus funcionários.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {membros.map(membro => (
                <div key={membro.id} className="p-4 border rounded-lg bg-card shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-lg">{membro.nome}</h3>
                      <p className="text-sm text-muted-foreground">{membro.email}</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={() => handleRemoverMembro(membro.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </Button>
                  </div>
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-muted-foreground">Permissões</Label>
                      {membroEditando !== membro.id ? (
                        <Button variant="outline" size="sm" onClick={() => iniciarEdicao(membro)}>
                          Editar Permissões
                        </Button>
                      ) : (
                        <div className="space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => setMembroEditando(null)}>Cancelar</Button>
                          <Button size="sm" onClick={() => handleSalvarPermissoes(membro.id)} disabled={salvando}>
                            {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                            Salvar
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {modulosDisponiveis.map(modulo => {
                        const hasPerm = membroEditando === membro.id 
                          ? permissoesEditando[modulo.id]
                          : membro.permissoes[modulo.id];
                          
                        return (
                          <div key={modulo.id} className="flex items-center space-x-2">
                            <Checkbox 
                              id={`${membro.id}-${modulo.id}`} 
                              checked={hasPerm || false}
                              disabled={membroEditando !== membro.id}
                              onCheckedChange={(checked) => setPermissoesEditando({...permissoesEditando, [modulo.id]: checked === true})}
                            />
                            <label 
                              htmlFor={`${membro.id}-${modulo.id}`} 
                              className={`text-sm font-medium leading-none ${!hasPerm ? 'opacity-50' : ''}`}
                            >
                              {modulo.label}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EquipeManager;

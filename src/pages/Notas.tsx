
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Save, X, Calendar, Bell, AlertCircle, CheckCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import Layout from '@/components/layout/Layout';

interface Nota {
  id: string;
  titulo: string;
  conteudo: string;
  prazo?: string;
  lembrete_data?: string;
  lembrete_ativo: boolean;
  prioridade: 'baixa' | 'media' | 'alta';
  categoria: string;
  concluida: boolean;
  created_at: string;
  updated_at: string;
}

const Notas = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newNota, setNewNota] = useState({
    titulo: '',
    conteudo: '',
    prazo: '',
    lembrete_data: '',
    lembrete_ativo: false,
    prioridade: 'media' as 'baixa' | 'media' | 'alta',
    categoria: 'geral',
    concluida: false
  });

  useEffect(() => {
    if (user) {
      fetchNotas();
    }
  }, [user]);

  const fetchNotas = async () => {
    try {
      const { data, error } = await supabase
        .from('notas')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Garantir que todos os campos obrigatórios existam
      const notasWithDefaults = (data || []).map(nota => ({
        ...nota,
        prazo: nota.prazo || undefined,
        lembrete_data: nota.lembrete_data || undefined,
        lembrete_ativo: nota.lembrete_ativo || false,
        prioridade: nota.prioridade || 'media' as 'baixa' | 'media' | 'alta',
        categoria: nota.categoria || 'geral',
        concluida: nota.concluida || false
      }));
      
      setNotas(notasWithDefaults);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar as notas",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createNota = async () => {
    if (!newNota.titulo.trim()) return;

    try {
      const notaData: any = {
        titulo: newNota.titulo,
        conteudo: newNota.conteudo,
        categoria: newNota.categoria,
        prioridade: newNota.prioridade,
        concluida: newNota.concluida,
        lembrete_ativo: newNota.lembrete_ativo,
        user_id: user?.id
      };

      if (newNota.prazo) {
        notaData.prazo = newNota.prazo;
      }

      if (newNota.lembrete_data) {
        notaData.lembrete_data = new Date(newNota.lembrete_data).toISOString();
      }

      const { error } = await supabase
        .from('notas')
        .insert(notaData);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nota criada com sucesso"
      });

      setNewNota({
        titulo: '',
        conteudo: '',
        prazo: '',
        lembrete_data: '',
        lembrete_ativo: false,
        prioridade: 'media',
        categoria: 'geral',
        concluida: false
      });
      setShowNew(false);
      fetchNotas();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a nota",
        variant: "destructive"
      });
    }
  };

  const updateNota = async (id: string, titulo: string, conteudo: string, dados?: Partial<Nota>) => {
    try {
      const updateData: any = {
        titulo,
        conteudo,
        updated_at: new Date().toISOString(),
        ...dados
      };

      const { error } = await supabase
        .from('notas')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nota atualizada com sucesso"
      });

      setEditingId(null);
      fetchNotas();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a nota",
        variant: "destructive"
      });
    }
  };

  const deleteNota = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nota excluída com sucesso"
      });

      fetchNotas();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a nota",
        variant: "destructive"
      });
    }
  };

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'alta': return 'text-red-600 bg-red-50';
      case 'media': return 'text-yellow-600 bg-yellow-50';
      case 'baixa': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando notas...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Minhas Notas</h1>
          <Button onClick={() => setShowNew(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Nota
          </Button>
        </div>

        {showNew && (
          <Card>
            <CardHeader>
              <CardTitle>Nova Nota</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-titulo">Título</Label>
                  <Input
                    id="new-titulo"
                    value={newNota.titulo}
                    onChange={(e) => setNewNota({ ...newNota, titulo: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="new-categoria">Categoria</Label>
                  <Input
                    id="new-categoria"
                    value={newNota.categoria}
                    onChange={(e) => setNewNota({ ...newNota, categoria: e.target.value })}
                    placeholder="Ex: trabalho, pessoal, estudos"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="new-conteudo">Conteúdo</Label>
                <Textarea
                  id="new-conteudo"
                  value={newNota.conteudo}
                  onChange={(e) => setNewNota({ ...newNota, conteudo: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="new-prioridade">Prioridade</Label>
                  <Select 
                    value={newNota.prioridade} 
                    onValueChange={(value: 'baixa' | 'media' | 'alta') => setNewNota({ ...newNota, prioridade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="new-prazo">Data de Prazo</Label>
                  <Input
                    id="new-prazo"
                    type="date"
                    value={newNota.prazo}
                    onChange={(e) => setNewNota({ ...newNota, prazo: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="new-lembrete">Lembrete</Label>
                  <Input
                    id="new-lembrete"
                    type="datetime-local"
                    value={newNota.lembrete_data}
                    onChange={(e) => setNewNota({ ...newNota, lembrete_data: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="new-lembrete-ativo"
                  checked={newNota.lembrete_ativo}
                  onCheckedChange={(checked) => setNewNota({ ...newNota, lembrete_ativo: !!checked })}
                />
                <Label htmlFor="new-lembrete-ativo">Ativar lembrete</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={createNota}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
                <Button variant="outline" onClick={() => setShowNew(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4">
          {notas.map((nota) => (
            <NotaCard
              key={nota.id}
              nota={nota}
              isEditing={editingId === nota.id}
              onEdit={() => setEditingId(nota.id)}
              onSave={(titulo, conteudo, dados) => updateNota(nota.id, titulo, conteudo, dados)}
              onCancel={() => setEditingId(null)}
              onDelete={() => deleteNota(nota.id)}
              getPrioridadeColor={getPrioridadeColor}
            />
          ))}
        </div>

        {notas.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Nenhuma nota encontrada. Crie sua primeira nota!</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

interface NotaCardProps {
  nota: Nota;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (titulo: string, conteudo: string, dados?: Partial<Nota>) => void;
  onCancel: () => void;
  onDelete: () => void;
  getPrioridadeColor: (prioridade: string) => string;
}

const NotaCard: React.FC<NotaCardProps> = ({
  nota,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  getPrioridadeColor
}) => {
  const [titulo, setTitulo] = useState(nota.titulo);
  const [conteudo, setConteudo] = useState(nota.conteudo);
  const [categoria, setCategoria] = useState(nota.categoria || 'geral');
  const [prioridade, setPrioridade] = useState<'baixa' | 'media' | 'alta'>(nota.prioridade || 'media');
  const [prazo, setPrazo] = useState(nota.prazo || '');
  const [lembreteData, setLembreteData] = useState(nota.lembrete_data || '');
  const [lembreteAtivo, setLembreteAtivo] = useState(nota.lembrete_ativo || false);
  const [concluida, setConcluida] = useState(nota.concluida || false);

  const handleSave = () => {
    const dados: Partial<Nota> = {
      categoria,
      prioridade,
      concluida,
      lembrete_ativo: lembreteAtivo
    };

    if (prazo) dados.prazo = prazo;
    if (lembreteData) dados.lembrete_data = new Date(lembreteData).toISOString();

    onSave(titulo, conteudo, dados);
  };

  const handleToggleConcluida = () => {
    const novoStatus = !concluida;
    setConcluida(novoStatus);
    onSave(titulo, conteudo, { concluida: novoStatus });
  };

  return (
    <Card className={`${nota.concluida ? 'opacity-75' : ''} ${nota.prazo && new Date(nota.prazo) < new Date() && !nota.concluida ? 'border-red-200' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {isEditing ? (
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="text-lg font-semibold mb-2"
              />
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className={nota.concluida ? 'line-through text-gray-500' : ''}>{nota.titulo}</CardTitle>
                {nota.concluida && <CheckCircle className="h-4 w-4 text-green-600" />}
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className={getPrioridadeColor(nota.prioridade)}>
                {nota.prioridade}
              </Badge>
              <Badge variant="secondary">{nota.categoria}</Badge>
              {nota.prazo && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(nota.prazo).toLocaleDateString('pt-BR')}
                  {new Date(nota.prazo) < new Date() && !nota.concluida && (
                    <AlertCircle className="h-3 w-3 text-red-600" />
                  )}
                </Badge>
              )}
              {nota.lembrete_ativo && nota.lembrete_data && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Bell className="h-3 w-3" />
                  {new Date(nota.lembrete_data).toLocaleDateString('pt-BR')}
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant={nota.concluida ? "default" : "outline"}
              onClick={handleToggleConcluida}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={onEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <Textarea
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              rows={4}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Input
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select 
                  value={prioridade} 
                  onValueChange={(value: 'baixa' | 'media' | 'alta') => setPrioridade(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Data de Prazo</Label>
                <Input
                  type="date"
                  value={prazo}
                  onChange={(e) => setPrazo(e.target.value)}
                />
              </div>
              <div>
                <Label>Lembrete</Label>
                <Input
                  type="datetime-local"
                  value={lembreteData}
                  onChange={(e) => setLembreteData(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={lembreteAtivo}
                onCheckedChange={(checked) => setLembreteAtivo(!!checked)}
              />
              <Label>Ativar lembrete</Label>
            </div>
          </div>
        ) : (
          <p className={`whitespace-pre-wrap ${nota.concluida ? 'line-through text-gray-500' : ''}`}>
            {nota.conteudo}
          </p>
        )}
        
        <div className="mt-4 text-sm text-gray-500">
          Criada em: {new Date(nota.created_at).toLocaleString('pt-BR')}
          {nota.updated_at !== nota.created_at && (
            <span className="ml-4">
              Atualizada em: {new Date(nota.updated_at).toLocaleString('pt-BR')}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Notas;

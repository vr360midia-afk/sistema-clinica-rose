
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Save, X } from 'lucide-react';
import Layout from '@/components/layout/Layout';

interface Nota {
  id: string;
  titulo: string;
  conteudo: string;
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
  const [newNota, setNewNota] = useState({ titulo: '', conteudo: '' });

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
      setNotas(data || []);
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
      const { error } = await supabase
        .from('notas')
        .insert({
          titulo: newNota.titulo,
          conteudo: newNota.conteudo,
          user_id: user?.id
        });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Nota criada com sucesso"
      });

      setNewNota({ titulo: '', conteudo: '' });
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

  const updateNota = async (id: string, titulo: string, conteudo: string) => {
    try {
      const { error } = await supabase
        .from('notas')
        .update({ titulo, conteudo, updated_at: new Date().toISOString() })
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
              <div>
                <Label htmlFor="new-titulo">Título</Label>
                <Input
                  id="new-titulo"
                  value={newNota.titulo}
                  onChange={(e) => setNewNota({ ...newNota, titulo: e.target.value })}
                />
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
              onSave={(titulo, conteudo) => updateNota(nota.id, titulo, conteudo)}
              onCancel={() => setEditingId(null)}
              onDelete={() => deleteNota(nota.id)}
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
  onSave: (titulo: string, conteudo: string) => void;
  onCancel: () => void;
  onDelete: () => void;
}

const NotaCard: React.FC<NotaCardProps> = ({
  nota,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  onDelete
}) => {
  const [titulo, setTitulo] = useState(nota.titulo);
  const [conteudo, setConteudo] = useState(nota.conteudo);

  const handleSave = () => {
    onSave(titulo, conteudo);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          {isEditing ? (
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="text-lg font-semibold"
            />
          ) : (
            <CardTitle>{nota.titulo}</CardTitle>
          )}
          <div className="flex gap-2">
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
          <Textarea
            value={conteudo}
            onChange={(e) => setConteudo(e.target.value)}
            rows={4}
          />
        ) : (
          <p className="whitespace-pre-wrap">{nota.conteudo}</p>
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

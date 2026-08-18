
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabaseService } from '@/services/supabaseService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Package, AlertTriangle } from 'lucide-react';
import Layout from '@/components/layout/Layout';

interface Produto {
  id: string;
  nome: string;
  categoria: string;
  quantidade: number;
  minimo: number;
  preco: number;
}

const Estoque = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    quantidade: 0,
    minimo: 0,
    preco: 0
  });

  const categorias = [
    'Materiais de Restauração',
    'Instrumentos',
    'Anestésicos',
    'Medicamentos',
    'Descartáveis',
    'Equipamentos',
    'Outros'
  ];

  useEffect(() => {
    if (user) {
      fetchProdutos();
    }
  }, [user]);

  const fetchProdutos = async () => {
    try {
      const data = await supabaseService.getProdutos();
      setProdutos(data);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await supabaseService.updateProduto(editingId, formData);
        toast({
          title: "Sucesso",
          description: "Produto atualizado com sucesso"
        });
      } else {
        await supabaseService.saveProduto(formData);
        toast({
          title: "Sucesso",
          description: "Produto criado com sucesso"
        });
      }
      
      resetForm();
      fetchProdutos();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o produto",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (produto: Produto) => {
    setFormData({
      nome: produto.nome,
      categoria: produto.categoria,
      quantidade: produto.quantidade,
      minimo: produto.minimo,
      preco: produto.preco
    });
    setEditingId(produto.id);
    setShowNew(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await supabaseService.deleteProduto(id);
      toast({
        title: "Sucesso",
        description: "Produto excluído com sucesso"
      });
      fetchProdutos();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o produto",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      categoria: '',
      quantidade: 0,
      minimo: 0,
      preco: 0
    });
    setEditingId(null);
    setShowNew(false);
  };

  const getStatusBadge = (produto: Produto) => {
    if (produto.quantidade === 0) {
      return <Badge variant="destructive">Sem Estoque</Badge>;
    }
    if (produto.quantidade <= produto.minimo) {
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Estoque Baixo</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800">Em Estoque</Badge>;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Carregando estoque...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl font-bold">Controle de Estoque</h1>
          <Button onClick={() => setShowNew(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>

        {/* Formulário */}
        {showNew && (
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome do Produto</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select value={formData.categoria} onValueChange={(value) => setFormData({ ...formData, categoria: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categorias.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      value={formData.quantidade}
                      onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 0 })}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="minimo">Estoque Mínimo</Label>
                    <Input
                      id="minimo"
                      type="number"
                      value={formData.minimo}
                      onChange={(e) => setFormData({ ...formData, minimo: parseInt(e.target.value) || 0 })}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="preco">Preço Unitário (R$)</Label>
                    <Input
                      id="preco"
                      type="number"
                      step="0.01"
                      value={formData.preco}
                      onChange={(e) => setFormData({ ...formData, preco: parseFloat(e.target.value) || 0 })}
                      min="0"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">
                    {editingId ? 'Atualizar' : 'Criar'} Produto
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de Produtos */}
        <div className="grid gap-4">
          {produtos.map((produto) => (
            <Card key={produto.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Package className="h-8 w-8 text-gray-400" />
                    <div>
                      <h3 className="font-semibold">{produto.nome}</h3>
                      <p className="text-sm text-gray-600">{produto.categoria}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">{produto.quantidade}</span>
                        {produto.quantidade <= produto.minimo && (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Mín: {produto.minimo} | R$ {produto.preco.toFixed(2)}
                      </p>
                    </div>
                    
                    {getStatusBadge(produto)}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(produto)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(produto.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {produtos.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">Nenhum produto encontrado. Adicione o primeiro produto!</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Estoque;

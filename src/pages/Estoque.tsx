
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Package, Plus, AlertTriangle, Minus, Edit2 } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';

const Estoque = () => {
  const { toast } = useToast();
  const { produtos, addProduto, updateProduto } = useDentalSystem();

  const [novoProduto, setNovoProduto] = useState({
    nome: '',
    categoria: '',
    quantidade: 0,
    minimo: 0,
    preco: 0
  });

  const adicionarProduto = () => {
    if (!novoProduto.nome || !novoProduto.categoria) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    addProduto(novoProduto);
    setNovoProduto({ nome: '', categoria: '', quantidade: 0, minimo: 0, preco: 0 });
  };

  const ajustarQuantidade = (id: number, novaQuantidade: number) => {
    updateProduto(id, { quantidade: Math.max(0, novaQuantidade) });
  };

  const getStatusBadge = (quantidade: number, minimo: number) => {
    if (quantidade === 0) {
      return <Badge variant="destructive">Sem Estoque</Badge>;
    } else if (quantidade <= minimo) {
      return <Badge className="bg-yellow-500">Estoque Baixo</Badge>;
    } else {
      return <Badge className="bg-green-500">Em Estoque</Badge>;
    }
  };

  const produtosComAlerta = produtos.filter(p => p.quantidade <= p.minimo);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Controle de Estoque</h1>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Novo Produto</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="nome">Nome do Produto</Label>
                  <Input
                    id="nome"
                    value={novoProduto.nome}
                    onChange={(e) => setNovoProduto({...novoProduto, nome: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    value={novoProduto.categoria}
                    onChange={(e) => setNovoProduto({...novoProduto, categoria: e.target.value})}
                    placeholder="EPI, Medicamento, Material, etc."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      value={novoProduto.quantidade}
                      onChange={(e) => setNovoProduto({...novoProduto, quantidade: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="minimo">Estoque Mínimo</Label>
                    <Input
                      id="minimo"
                      type="number"
                      value={novoProduto.minimo}
                      onChange={(e) => setNovoProduto({...novoProduto, minimo: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="preco">Preço Unitário (R$)</Label>
                  <Input
                    id="preco"
                    type="number"
                    step="0.01"
                    value={novoProduto.preco}
                    onChange={(e) => setNovoProduto({...novoProduto, preco: parseFloat(e.target.value) || 0})}
                  />
                </div>
                <Button onClick={adicionarProduto} className="w-full">
                  Adicionar Produto
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {produtosComAlerta.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                Alertas de Estoque
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {produtosComAlerta.map(produto => (
                  <div key={produto.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium">{produto.nome}</span>
                    <span className="text-yellow-700">
                      {produto.quantidade === 0 ? 'SEM ESTOQUE' : `Restam apenas ${produto.quantidade} unidades`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Produtos em Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {produtos.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Nenhum produto cadastrado</p>
                </div>
              ) : (
                produtos.map((produto) => (
                  <div key={produto.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{produto.nome}</h3>
                        {getStatusBadge(produto.quantidade, produto.minimo)}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Categoria: {produto.categoria} | Preço: R$ {produto.preco.toFixed(2)}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => ajustarQuantidade(produto.id, produto.quantidade - 1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-medium min-w-[3rem] text-center">
                          {produto.quantidade}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => ajustarQuantidade(produto.id, produto.quantidade + 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <Button variant="ghost" size="sm">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Estoque;

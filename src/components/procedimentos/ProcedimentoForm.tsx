
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { Procedimento, CategoriaProcedimento, ComplexidadeProcedimento } from '@/types/procedimentos';

interface ProcedimentoFormProps {
  procedimento: Procedimento | null;
  onSave: (procedimento: Omit<Procedimento, 'id' | 'criadoEm' | 'atualizadoEm'>) => void;
  onCancel: () => void;
}

const categorias: { value: CategoriaProcedimento; label: string }[] = [
  { value: 'preventivo', label: 'Preventivo' },
  { value: 'restaurador', label: 'Restaurador' },
  { value: 'endodontico', label: 'Endodôntico' },
  { value: 'periodontico', label: 'Periodontico' },
  { value: 'cirurgico', label: 'Cirúrgico' },
  { value: 'protese', label: 'Prótese' },
  { value: 'ortodontico', label: 'Ortodôntico' },
  { value: 'estetico', label: 'Estético' },
  { value: 'emergencia', label: 'Emergência' },
  { value: 'outros', label: 'Outros' }
];

const complexidades: { value: ComplexidadeProcedimento; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
  { value: 'muito-alta', label: 'Muito Alta' }
];

const ProcedimentoForm = ({ procedimento, onSave, onCancel }: ProcedimentoFormProps) => {
  const [formData, setFormData] = useState({
    nome: '',
    categoria: 'preventivo' as CategoriaProcedimento,
    subcategoria: '',
    descricao: '',
    preco: 0,
    precoConvenio: 0,
    custoMaterial: 0,
    duracaoMinutos: 60,
    complexidade: 'media' as ComplexidadeProcedimento,
    requererAnestesia: false,
    requererRaioX: false,
    codigoTUSS: '',
    materiaisNecessarios: [] as string[],
    equipamentosNecessarios: [] as string[],
    ativo: true,
    observacoes: '',
    criadoPor: 'Dr. Silva'
  });

  const [novoMaterial, setNovoMaterial] = useState('');
  const [novoEquipamento, setNovoEquipamento] = useState('');

  useEffect(() => {
    if (procedimento) {
      setFormData({
        nome: procedimento.nome,
        categoria: procedimento.categoria,
        subcategoria: procedimento.subcategoria || '',
        descricao: procedimento.descricao,
        preco: procedimento.preco,
        precoConvenio: procedimento.precoConvenio || 0,
        custoMaterial: procedimento.custoMaterial || 0,
        duracaoMinutos: procedimento.duracaoMinutos,
        complexidade: procedimento.complexidade,
        requererAnestesia: procedimento.requererAnestesia,
        requererRaioX: procedimento.requererRaioX,
        codigoTUSS: procedimento.codigoTUSS || '',
        materiaisNecessarios: procedimento.materiaisNecessarios,
        equipamentosNecessarios: procedimento.equipamentosNecessarios,
        ativo: procedimento.ativo,
        observacoes: procedimento.observacoes || '',
        criadoPor: procedimento.criadoPor
      });
    }
  }, [procedimento]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const addMaterial = () => {
    if (novoMaterial.trim()) {
      setFormData(prev => ({
        ...prev,
        materiaisNecessarios: [...prev.materiaisNecessarios, novoMaterial.trim()]
      }));
      setNovoMaterial('');
    }
  };

  const removeMaterial = (index: number) => {
    setFormData(prev => ({
      ...prev,
      materiaisNecessarios: prev.materiaisNecessarios.filter((_, i) => i !== index)
    }));
  };

  const addEquipamento = () => {
    if (novoEquipamento.trim()) {
      setFormData(prev => ({
        ...prev,
        equipamentosNecessarios: [...prev.equipamentosNecessarios, novoEquipamento.trim()]
      }));
      setNovoEquipamento('');
    }
  };

  const removeEquipamento = (index: number) => {
    setFormData(prev => ({
      ...prev,
      equipamentosNecessarios: prev.equipamentosNecessarios.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {procedimento ? 'Editar Procedimento' : 'Novo Procedimento'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs defaultValue="basico">
            <TabsList className="grid w-full grid-cols-2 h-auto">
              <TabsTrigger value="basico">Básico</TabsTrigger>
              <TabsTrigger value="recursos">Recursos</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações Básicas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome do Procedimento *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        placeholder="Ex: Limpeza Dental"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="categoria">Categoria *</Label>
                      <Select
                        value={formData.categoria}
                        onValueChange={(value: CategoriaProcedimento) => 
                          setFormData(prev => ({ ...prev, categoria: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="subcategoria">Subcategoria</Label>
                    <Input
                      id="subcategoria"
                      value={formData.subcategoria}
                      onChange={(e) => setFormData(prev => ({ ...prev, subcategoria: e.target.value }))}
                      placeholder="Ex: Profilaxia"
                    />
                  </div>

                  <div>
                    <Label htmlFor="descricao">Descrição</Label>
                    <Textarea
                      id="descricao"
                      value={formData.descricao}
                      onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descreva detalhadamente o procedimento..."
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="preco-basico">Preço Particular (R$) *</Label>
                      <Input
                        id="preco-basico"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.preco === 0 ? '' : formData.preco}
                        placeholder="0,00"
                        onChange={(e) => { const v = e.target.value.replace(/^0+(?=\d)/, ''); setFormData(prev => ({ ...prev, preco: v === '' ? 0 : parseFloat(v) || 0 })); }}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="precoConvenio-basico">Preço Convênio (R$)</Label>
                      <Input
                        id="precoConvenio-basico"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.precoConvenio === 0 ? '' : formData.precoConvenio}
                        placeholder="0,00"
                        onChange={(e) => { const v = e.target.value.replace(/^0+(?=\d)/, ''); setFormData(prev => ({ ...prev, precoConvenio: v === '' ? 0 : parseFloat(v) || 0 })); }}
                      />
                    </div>
                    <div>
                      <Label htmlFor="custoMaterial-basico">Custo Material (R$)</Label>
                      <Input
                        id="custoMaterial-basico"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.custoMaterial === 0 ? '' : formData.custoMaterial}
                        placeholder="0,00"
                        onChange={(e) => { const v = e.target.value.replace(/^0+(?=\d)/, ''); setFormData(prev => ({ ...prev, custoMaterial: v === '' ? 0 : parseFloat(v) || 0 })); }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="duracaoMinutos">Duração (minutos) *</Label>
                      <Input
                        id="duracaoMinutos"
                        type="number"
                        min="1"
                        value={formData.duracaoMinutos === 0 ? '' : formData.duracaoMinutos}
                        onChange={(e) => { const v = e.target.value.replace(/^0+(?=\d)/, ''); setFormData(prev => ({ ...prev, duracaoMinutos: v === '' ? 0 : parseInt(v) || 0 })); }}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="complexidade">Complexidade</Label>
                      <Select
                        value={formData.complexidade}
                        onValueChange={(value: ComplexidadeProcedimento) => 
                          setFormData(prev => ({ ...prev, complexidade: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {complexidades.map((comp) => (
                            <SelectItem key={comp.value} value={comp.value}>
                              {comp.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requererAnestesia"
                        checked={formData.requererAnestesia}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, requererAnestesia: checked as boolean }))
                        }
                      />
                      <Label htmlFor="requererAnestesia">Requer anestesia</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="requererRaioX"
                        checked={formData.requererRaioX}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, requererRaioX: checked as boolean }))
                        }
                      />
                      <Label htmlFor="requererRaioX">Requer raio-X</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="ativo"
                        checked={formData.ativo}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, ativo: checked as boolean }))
                        }
                      />
                      <Label htmlFor="ativo">Procedimento ativo</Label>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                      placeholder="Observações adicionais sobre o procedimento..."
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recursos" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Materiais Necessários</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={novoMaterial}
                        onChange={(e) => setNovoMaterial(e.target.value)}
                        placeholder="Nome do material"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMaterial())}
                      />
                      <Button type="button" onClick={addMaterial} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.materiaisNecessarios.map((material, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {material}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeMaterial(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Equipamentos Necessários</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={novoEquipamento}
                        onChange={(e) => setNovoEquipamento(e.target.value)}
                        placeholder="Nome do equipamento"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEquipamento())}
                      />
                      <Button type="button" onClick={addEquipamento} size="sm">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.equipamentosNecessarios.map((equipamento, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {equipamento}
                          <X
                            className="h-3 w-3 cursor-pointer"
                            onClick={() => removeEquipamento(index)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit">
              {procedimento ? 'Atualizar' : 'Salvar'} Procedimento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProcedimentoForm;

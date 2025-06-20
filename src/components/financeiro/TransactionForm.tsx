
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { CreditCard, Receipt, QrCode, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactionData: any) => void;
}

const proceduresList = [
  { name: 'Limpeza', price: 150 },
  { name: 'Restauração', price: 200 },
  { name: 'Canal', price: 800 },
  { name: 'Extração', price: 100 },
  { name: 'Implante', price: 2500 },
  { name: 'Aparelho Ortodôntico', price: 3500 },
  { name: 'Clareamento', price: 600 }
];

const TransactionForm = ({ isOpen, onClose, onSave }: TransactionFormProps) => {
  const [formData, setFormData] = useState({
    patientName: '',
    paymentMethod: '',
    cardBrand: '',
    installments: 1,
    procedures: [{ name: '', originalPrice: 0, finalPrice: 0, discount: 0 }],
    totalAmount: 0,
    observations: ''
  });

  const handleAddProcedure = () => {
    setFormData(prev => ({
      ...prev,
      procedures: [...prev.procedures, { name: '', originalPrice: 0, finalPrice: 0, discount: 0 }]
    }));
  };

  const handleProcedureChange = (index: number, field: string, value: any) => {
    const newProcedures = [...formData.procedures];
    newProcedures[index] = { ...newProcedures[index], [field]: value };
    
    if (field === 'name') {
      const selectedProcedure = proceduresList.find(p => p.name === value);
      if (selectedProcedure) {
        newProcedures[index].originalPrice = selectedProcedure.price;
        newProcedures[index].finalPrice = selectedProcedure.price;
        newProcedures[index].discount = 0;
      }
    }
    
    if (field === 'discount') {
      const discountAmount = (newProcedures[index].originalPrice * value) / 100;
      newProcedures[index].finalPrice = newProcedures[index].originalPrice - discountAmount;
    }
    
    setFormData(prev => {
      const total = newProcedures.reduce((sum, proc) => sum + proc.finalPrice, 0);
      return {
        ...prev,
        procedures: newProcedures,
        totalAmount: total
      };
    });
  };

  const handleSave = () => {
    if (!formData.patientName || !formData.paymentMethod || formData.procedures.length === 0) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const transactionData = {
      ...formData,
      id: Date.now(),
      date: new Date().toLocaleDateString('pt-BR'),
      status: 'Pendente'
    };

    onSave(transactionData);
    toast.success('Transação cadastrada com sucesso!');
    onClose();
    
    // Reset form
    setFormData({
      patientName: '',
      paymentMethod: '',
      cardBrand: '',
      installments: 1,
      procedures: [{ name: '', originalPrice: 0, finalPrice: 0, discount: 0 }],
      totalAmount: 0,
      observations: ''
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dados do Paciente */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="patientName">Nome do Paciente *</Label>
                  <Input
                    id="patientName"
                    value={formData.patientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, patientName: e.target.value }))}
                    placeholder="Digite o nome do paciente"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Procedimentos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                Procedimentos
                <Button type="button" onClick={handleAddProcedure} size="sm">
                  Adicionar Procedimento
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formData.procedures.map((procedure, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 border rounded-lg">
                    <div>
                      <Label>Procedimento</Label>
                      <Select 
                        value={procedure.name} 
                        onValueChange={(value) => handleProcedureChange(index, 'name', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {proceduresList.map((proc) => (
                            <SelectItem key={proc.name} value={proc.name}>
                              {proc.name} - R$ {proc.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label>Preço Original</Label>
                      <Input
                        type="number"
                        value={procedure.originalPrice}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    
                    <div>
                      <Label>Desconto (%)</Label>
                      <div className="relative">
                        <Input
                          type="number"
                          value={procedure.discount}
                          onChange={(e) => handleProcedureChange(index, 'discount', Number(e.target.value))}
                          min="0"
                          max="100"
                        />
                        <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                    
                    <div>
                      <Label>Preço Final</Label>
                      <Input
                        type="number"
                        value={procedure.finalPrice}
                        readOnly
                        className="bg-gray-50 font-semibold"
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <Button 
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          const newProcedures = formData.procedures.filter((_, i) => i !== index);
                          const total = newProcedures.reduce((sum, proc) => sum + proc.finalPrice, 0);
                          setFormData(prev => ({ ...prev, procedures: newProcedures, totalAmount: total }));
                        }}
                        disabled={formData.procedures.length === 1}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                ))}
                
                <div className="text-right">
                  <p className="text-xl font-bold">
                    Total: R$ {formData.totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Forma de Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Forma de Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Método de Pagamento *</Label>
                <Select 
                  value={formData.paymentMethod} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.paymentMethod === 'cartao' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Bandeira do Cartão</Label>
                    <Select 
                      value={formData.cardBrand} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, cardBrand: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="visa">Visa</SelectItem>
                        <SelectItem value="mastercard">Mastercard</SelectItem>
                        <SelectItem value="american">American Express</SelectItem>
                        <SelectItem value="elo">Elo</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Parcelas</Label>
                    <Select 
                      value={formData.installments.toString()} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, installments: Number(value) }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...Array(12)].map((_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {i + 1}x {formData.installments === (i + 1) && `de R$ ${(formData.totalAmount / (i + 1)).toFixed(2)}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div>
                <Label>Observações</Label>
                <Textarea
                  value={formData.observations}
                  onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Transação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionForm;

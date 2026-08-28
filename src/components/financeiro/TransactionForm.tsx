
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Stethoscope, Handshake } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useParceiros } from '@/hooks/useParceiros';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { calcularSaldoOrcamento } from '@/utils/orcamentoSaldo';
import { TipoTransacao, StatusTransacao, MetodoPagamento } from '@/types/shared';
import { toast } from 'sonner';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: any) => void;
  transacao?: any | null;
}

const TransactionForm = ({ isOpen, onClose, onSave, transacao }: TransactionFormProps) => {
  const { pacientes, transacoes, addTransacao, updateTransacao, deleteTransacao } = useDentalSystem();
  const { procedimentos } = useProcedimentos();
  const { parceiros } = useParceiros();
  const { orcamentos } = useOrcamentos();
  const isEdit = !!transacao?.id;
  const anoAtual = new Date().getFullYear();


  const [formData, setFormData] = useState({
    pacienteId: '',
    valor: '',
    tipo: 'receita' as TipoTransacao,
    status: 'pendente' as StatusTransacao,
    metodoPagamento: 'dinheiro' as MetodoPagamento,
    taxaCartaoPercentual: '',
    parcelas: '1',
    data: new Date(),
    vencimento: null as Date | null,
    descricao: '',
    observacoes: '',
    parceiroId: '',
    valorParceiro: '',
    orcamentoId: ''
  });

  const emptyForm = {
    pacienteId: '',
    valor: '',
    tipo: 'receita' as TipoTransacao,
    status: 'pendente' as StatusTransacao,
    metodoPagamento: 'dinheiro' as MetodoPagamento,
    taxaCartaoPercentual: '',
    parcelas: '1',
    data: new Date(),
    vencimento: null as Date | null,
    descricao: '',
    observacoes: '',
    parceiroId: '',
    valorParceiro: '',
    orcamentoId: ''
  };

  useEffect(() => {
    if (!isOpen) return;
    if (transacao) {
      setFormData({
        pacienteId: transacao.pacienteId || '',
        valor: String(transacao.valor ?? ''),
        tipo: (transacao.tipo || 'receita') as TipoTransacao,
        status: (transacao.status || 'pendente') as StatusTransacao,
        metodoPagamento: (transacao.metodoPagamento || 'dinheiro') as MetodoPagamento,
        taxaCartaoPercentual: transacao.taxaCartaoPercentual ? String(transacao.taxaCartaoPercentual) : '',
        parcelas: String(transacao.parcelas || 1),
        data: transacao.data ? new Date(transacao.data) : new Date(),
        vencimento: transacao.vencimento ? new Date(transacao.vencimento) : null,
        descricao: transacao.descricao || '',
        observacoes: transacao.observacoes || '',
        parceiroId: transacao.parceiroId || '',
        valorParceiro: transacao.valorParceiro ? String(transacao.valorParceiro) : '',
        orcamentoId: transacao.orcamentoId || ''
      });
    } else {
      setFormData(emptyForm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, transacao]);

  const valorBruto = parseFloat(formData.valor) || 0;
  const isCartao = formData.metodoPagamento === 'cartao';
  const taxaPerc = isCartao ? parseFloat(formData.taxaCartaoPercentual) || 0 : 0;
  const parcelas = isCartao ? Math.max(1, parseInt(formData.parcelas) || 1) : 1;
  const taxaValor = (valorBruto * taxaPerc) / 100;
  const valorLiquido = valorBruto - taxaValor;
  const valorParcela = parcelas > 0 ? valorBruto / parcelas : valorBruto;
  const parceiro = parceiros.find((p) => p.id === formData.parceiroId);
  const valorParceiro = parseFloat(formData.valorParceiro) || 0;
  const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.pacienteId || !formData.valor || !formData.descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const { taxaCartaoPercentual, parcelas: _p, valorParceiro: _vp, orcamentoId: _oid, ...rest } = formData;
      const transactionData = {
        ...rest,
        valor: valorBruto,
        categoria: formData.tipo === 'despesa' && parceiro ? 'parceria' : (rest as any).categoria,
        taxaCartaoPercentual: taxaPerc,
        taxaCartaoValor: taxaValor,
        parcelas,
        valorParcela,
        valorLiquido,
        parceiroId: formData.parceiroId || undefined,
        parceiroNome: parceiro?.nome,
        valorParceiro: parceiro ? valorParceiro : undefined,
        orcamentoId: formData.orcamentoId || undefined,
      };

      if (isEdit) {
        await updateTransacao(transacao.id, transactionData);

        // Mantém a despesa de repasse do parceiro sincronizada com a receita editada
        if (formData.tipo === 'receita') {
          const descAntiga = transacao.descricao || '';
          const repasseExistente = (transacoes as any[]).find(
            (t) =>
              t.tipo === 'despesa' &&
              t.categoria === 'parceria' &&
              typeof t.descricao === 'string' &&
              t.descricao.startsWith('Repasse parceiro ') &&
              (t.descricao.endsWith(`— ${descAntiga}`) || t.descricao.endsWith(`— ${formData.descricao}`))
          );

          if (parceiro && valorParceiro > 0) {
            const repasseData = {
              pacienteId: formData.pacienteId,
              tipo: 'despesa' as TipoTransacao,
              status: formData.status,
              categoria: 'parceria',
              metodoPagamento: formData.metodoPagamento,
              data: formData.data,
              descricao: `Repasse parceiro ${parceiro.nome} — ${formData.descricao}`,
              valor: valorParceiro,
              parceiroId: parceiro.id,
              parceiroNome: parceiro.nome,
              valorParceiro,
            };
            if (repasseExistente) {
              await updateTransacao(repasseExistente.id, repasseData as any);
            } else {
              await addTransacao(repasseData as any);
            }
          } else if (repasseExistente) {
            await deleteTransacao(repasseExistente.id);
          }
        }

        toast.success('Transação atualizada');
      } else {
        await addTransacao(transactionData);
        // Repasse ao parceiro entra automaticamente como despesa/parceria
        if (parceiro && valorParceiro > 0 && formData.tipo === 'receita') {
          await addTransacao({
            pacienteId: formData.pacienteId,
            tipo: 'despesa',
            status: formData.status,
            categoria: 'parceria',
            metodoPagamento: formData.metodoPagamento,
            data: formData.data,
            descricao: `Repasse parceiro ${parceiro.nome} — ${formData.descricao}`,
            valor: valorParceiro,
            parceiroId: parceiro.id,
            parceiroNome: parceiro.nome,
            valorParceiro,
          });
          toast.success('Transação criada com repasse ao parceiro');
        } else {
          toast.success('Transação criada');
        }
      }
      onSave(transactionData);
      setFormData(emptyForm);
    } catch (error) {
      console.error('Erro ao salvar transação:', error);
      toast.error('Erro ao salvar transação');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="paciente">Paciente *</Label>
            <Select value={formData.pacienteId} onValueChange={(value) => setFormData(prev => ({ ...prev, pacienteId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o paciente" />
              </SelectTrigger>
              <SelectContent>
                {pacientes.map((paciente) => (
                  <SelectItem key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="procedimento">Procedimento cadastrado ou texto livre</Label>
            <div className="relative">
              <Stethoscope className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="procedimento"
                list="procedimentos-financeiro"
                className="pl-8"
                placeholder="Selecione ou escreva algo..."
                value={formData.descricao}
                onChange={(e) => {
                  const value = e.target.value;
                  const proc = procedimentos.find((p) => p.nome === value);
                  setFormData((prev) => ({
                    ...prev,
                    descricao: value,
                    valor: proc ? String(proc.preco || '') : prev.valor,
                  }));
                }}
              />
              <datalist id="procedimentos-financeiro">
                {procedimentos.map((proc) => (
                  <option key={proc.id} value={proc.nome}>
                    {Number(proc.preco || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </option>
                ))}
              </datalist>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Escolher um procedimento preenche a descrição e o valor. Você também pode digitar qualquer texto.
            </p>
          </div>


          <div>
            <Label htmlFor="parceiro">Parceiro (opcional)</Label>
            <Select
              value={formData.parceiroId || 'none'}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, parceiroId: value === 'none' ? '' : value, valorParceiro: '' }))
              }
            >
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Sem parceiro" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem parceiro</SelectItem>
                {parceiros.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — {p.tipoRepasse === 'percentual' ? `${p.valorRepasse}%` : money(p.valorRepasse || 0)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="tipo">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(value: TipoTransacao) => setFormData(prev => ({ ...prev, tipo: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.valor}
                onChange={(e) => setFormData(prev => ({ ...prev, valor: e.target.value }))}
              />
            </div>
          </div>

          {parceiro && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="valorParceiro">Valor pago ao parceiro (R$) *</Label>
              <Input
                id="valorParceiro"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={formData.valorParceiro}
                onChange={(e) => setFormData((prev) => ({ ...prev, valorParceiro: e.target.value }))}
              />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Repasse ao parceiro: {money(valorParceiro)} (lançado como despesa/parceria)</p>
                <p>Resultado da clínica: {money(valorBruto - valorParceiro)}</p>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              placeholder="Ex: Consulta de rotina, Limpeza dental..."
              value={formData.descricao}
              onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value: StatusTransacao) => setFormData(prev => ({ ...prev, status: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="metodo">Método de Pagamento</Label>
              <Select value={formData.metodoPagamento} onValueChange={(value: MetodoPagamento) => setFormData(prev => ({ ...prev, metodoPagamento: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isCartao && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="taxa">Taxa da máquina (%)</Label>
                  <Input
                    id="taxa"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 3.99"
                    value={formData.taxaCartaoPercentual}
                    onChange={(e) => setFormData(prev => ({ ...prev, taxaCartaoPercentual: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="parcelas">Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="1"
                    max="24"
                    value={formData.parcelas}
                    onChange={(e) => setFormData(prev => ({ ...prev, parcelas: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor pago pelo cliente</span>
                  <span>{money(valorBruto)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelamento</span>
                  <span>{parcelas}x de {money(valorParcela)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Desconto da taxa ({taxaPerc}%)</span>
                  <span className="text-destructive">- {money(taxaValor)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Valor líquido</span>
                  <span className="text-primary">{money(valorLiquido)}</span>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data da Transação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.data, 'dd/MM/yyyy', { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.data}
                    defaultMonth={formData.data}
                    onSelect={(date) => setFormData(prev => ({ ...prev, data: date || prev.data }))}
                    locale={ptBR}
                    captionLayout="dropdown-buttons"
                    fromYear={anoAtual - 10}
                    toYear={anoAtual + 10}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Vencimento (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.vencimento ? format(formData.vencimento, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.vencimento || undefined}
                    defaultMonth={formData.vencimento || formData.data}
                    onSelect={(date) => setFormData(prev => ({ ...prev, vencimento: date || null }))}
                    locale={ptBR}
                    captionLayout="dropdown-buttons"
                    fromYear={anoAtual - 10}
                    toYear={anoAtual + 10}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>


          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Observações adicionais..."
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1">
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionForm;

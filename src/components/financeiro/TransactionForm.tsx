
import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Stethoscope, Handshake, FileText, UploadCloud, Eye, Loader2, X, Plus, Trash2, Layers, CheckCircle2, AlertCircle, CreditCard, Wallet, Split } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { useParceiros } from '@/hooks/useParceiros';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { calcularSaldoOrcamento } from '@/utils/orcamentoSaldo';
import { TipoTransacao, StatusTransacao, MetodoPagamento } from '@/types/shared';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { somarMesesSeguro } from '@/utils/documentoFormat';
import { useMaquinasCartao, calcularTaxaCartao } from '@/hooks/useMaquinasCartao';

interface TransactionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: any) => void;
  transacao?: any | null;
  pacienteId?: string;
  isEdit?: boolean;
}

const TransactionForm = ({ isOpen, onClose, onSave, transacao, pacienteId }: TransactionFormProps) => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const { pacientes, transacoes, addTransacao, updateTransacao, deleteTransacao, addDocumento } = useDentalSystem();
  const { procedimentos } = useProcedimentos();
  const { parceiros } = useParceiros();
  const { orcamentos } = useOrcamentos();
  const { operadoras, operadoraPadrao } = useMaquinasCartao();
  const [selectedOperadoraId, setSelectedOperadoraId] = useState<string>('infinitepay');
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
    orcamentoId: '',
    comprovantes: [] as string[]
  });

  // Múltiplas Formas de Pagamento (Split / Entrada + Restante)
  const [modoMultiplasFormas, setModoMultiplasFormas] = useState(false);
  const [formasSplit, setFormasSplit] = useState<
    Array<{
      id: string;
      rotulo: string;
      metodo: MetodoPagamento;
      valor: string;
      parcelas: string;
      taxaCartaoPercentual: string;
      status: StatusTransacao;
      data: Date;
      vencimento: Date | null;
    }>
  >([
    {
      id: '1',
      rotulo: 'Entrada PIX',
      metodo: 'pix',
      valor: '',
      parcelas: '1',
      taxaCartaoPercentual: '',
      status: 'pago',
      data: new Date(),
      vencimento: null,
    },
    {
      id: '2',
      rotulo: 'Restante Cartão',
      metodo: 'cartao',
      valor: '',
      parcelas: '3',
      taxaCartaoPercentual: '',
      status: 'pendente',
      data: new Date(),
      vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  ]);

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
    orcamentoId: '',
    comprovantes: [] as string[]
  };

  const prevIsOpenRef = useRef(false);
  const currentTransacaoIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const transacaoId = transacao?.id;
    const transacaoIdMudou = isOpen && transacaoId !== currentTransacaoIdRef.current;

    if (justOpened || transacaoIdMudou) {
      currentTransacaoIdRef.current = transacaoId;

      if (transacao) {
        const metodoIni = (transacao.metodoPagamento || 'pix') as MetodoPagamento;
        const tipoIni = (transacao.tipo || 'receita') as TipoTransacao;
        // Para uma receita em pix ou dinheiro, ou se vier explicitamente pago, define como pago
        const statusIni = (transacao.status || (tipoIni === 'receita' && (metodoIni === 'pix' || metodoIni === 'dinheiro') ? 'pago' : 'pago')) as StatusTransacao;

        setFormData({
          pacienteId: transacao.pacienteId || pacienteId || '',
          valor: transacao.valor !== undefined && transacao.valor !== null ? String(transacao.valor) : '',
          tipo: tipoIni,
          status: statusIni,
          metodoPagamento: metodoIni,
          taxaCartaoPercentual: transacao.taxaCartaoPercentual ? String(transacao.taxaCartaoPercentual) : '',
          parcelas: String(transacao.parcelas || 1),
          data: transacao.data ? new Date(transacao.data) : new Date(),
          vencimento: transacao.vencimento ? new Date(transacao.vencimento) : null,
          descricao: transacao.descricao || '',
          observacoes: transacao.observacoes || '',
          parceiroId: transacao.parceiroId || '',
          valorParceiro: transacao.valorParceiro ? String(transacao.valorParceiro) : '',
          orcamentoId: transacao.orcamentoId || '',
          comprovantes: Array.isArray(transacao.comprovantes)
            ? transacao.comprovantes
            : (transacao.comprovanteUrl ? [transacao.comprovanteUrl] : [])
        });
      } else {
        setFormData({
          ...emptyForm,
          status: 'pago',
          metodoPagamento: 'pix',
          pacienteId: pacienteId || '',
        });
        setModoMultiplasFormas(false);
        setFormasSplit([
          {
            id: '1',
            rotulo: 'Entrada PIX',
            metodo: 'pix',
            valor: '',
            parcelas: '1',
            taxaCartaoPercentual: '',
            status: 'pago',
            data: new Date(),
            vencimento: null,
          },
          {
            id: '2',
            rotulo: 'Restante Cartão',
            metodo: 'cartao',
            valor: '',
            parcelas: '3',
            taxaCartaoPercentual: '',
            status: 'pendente',
            data: new Date(),
            vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        ]);
      }
    }

    if (!isOpen) {
      currentTransacaoIdRef.current = undefined;
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, transacao?.id, pacienteId]);

  const valorBruto = parseFloat(formData.valor) || 0;
  const isCartao = formData.metodoPagamento === 'cartao';
  const isPixParcelado = formData.metodoPagamento === 'pix_parcelado';
  const permiteParcelamento = isCartao || isPixParcelado;
  const taxaPerc = isCartao ? parseFloat(formData.taxaCartaoPercentual) || 0 : 0;
  const parcelas = permiteParcelamento ? Math.max(1, parseInt(formData.parcelas) || 1) : 1;
  const taxaValor = (valorBruto * taxaPerc) / 100;
  const valorLiquido = valorBruto - taxaValor;
  const valorParcela = parcelas > 0 ? valorBruto / parcelas : valorBruto;
  const parceiro = parceiros.find((p) => p.id === formData.parceiroId);
  const valorParceiro = parseFloat(formData.valorParceiro) || 0;
  const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const orcamentosDisponiveis = (orcamentos || []).filter((o) => {
    if (!o || o.status !== 'aprovado') return false;
    if (o.id === formData.orcamentoId) return true;
    if (formData.pacienteId && o.pacienteId && o.pacienteId !== formData.pacienteId) return false;
    return calcularSaldoOrcamento(o, transacoes as any[], orcamentos as any[]).saldo > 0;
  });
  const orcamentoSelecionado = orcamentos.find((o) => o.id === formData.orcamentoId);
  const saldoSelecionado = orcamentoSelecionado
    ? calcularSaldoOrcamento(orcamentoSelecionado, transacoes as any[], orcamentos as any[])
    : { total: 0, pago: 0, saldo: 0, percentual: 0 };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !user?.id) return;
    try {
      setUploading(true);
      const newUrls: string[] = [];
      const pid = formData.pacienteId || pacienteId;

      for (const file of Array.from(files)) {
        const path = `${user.id}/comprovantes/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
        const { error } = await supabase.storage.from('documentos-pacientes').upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;
        newUrls.push(path);
        
        // Se já tivermos um paciente selecionado no form, atrelamos a ele nos documentos tbm
        if (pid) {
          try {
            await addDocumento({
              pacienteId: pid,
              nome: file.name,
              tipo: 'comprovante',
              arquivo: path,
              tamanho: file.size,
              analiseStatus: 'pendente'
            });
          } catch (docErr) {
            console.warn('Erro ao salvar comprovante no prontuário:', docErr);
          }
        }
      }
      setFormData(prev => ({
        ...prev,
        pacienteId: prev.pacienteId || pid || '',
        comprovantes: [...(prev.comprovantes || []), ...newUrls]
      }));
      toast.success(files.length > 1 ? 'Comprovantes anexados!' : 'Comprovante anexado!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao fazer upload dos arquivos');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleViewComprovante = async (url: string) => {
    if (!url) return;
    try {
      const { data, error } = await supabase.storage.from('documentos-pacientes').createSignedUrl(url, 60);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast.error('Erro ao abrir comprovante');
    }
  };

  const handleRemoveComprovante = (index: number) => {
    setFormData(prev => {
      const novas = [...(prev.comprovantes || [])];
      novas.splice(index, 1);
      return { ...prev, comprovantes: novas };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const pid = formData.pacienteId || pacienteId;
    if (!pid || !formData.descricao) {
      toast.error('Preencha os campos obrigatórios (Paciente e Descrição)');
      return;
    }

    const pacienteObj = pacientes.find(p => p.id === pid);
    const pacienteNome = pacienteObj?.nome || (transacao as any)?.pacienteNome;

    // ========================================================================
    // CASO 1: MÚLTIPLAS FORMAS DE PAGAMENTO (SPLIT DE PAGAMENTO)
    // ========================================================================
    if (modoMultiplasFormas && !isEdit) {
      const formasValidas = formasSplit.filter((f) => parseFloat(f.valor) > 0);
      if (formasValidas.length === 0) {
        toast.error('Informe o valor de pelo menos uma forma de pagamento');
        return;
      }

      try {
        let totalLancamentos = 0;
        const descBase = formData.descricao?.trim() || 'Pagamento';

        for (const forma of formasValidas) {
          const valBrutoForma = parseFloat(forma.valor) || 0;
          const fParcelas =
            (forma.metodo === 'cartao' || forma.metodo === 'pix_parcelado' || forma.metodo === 'boleto')
              ? Math.max(1, parseInt(forma.parcelas) || 1)
              : 1;
          const fTaxaPerc = forma.metodo === 'cartao' ? parseFloat(forma.taxaCartaoPercentual) || 0 : 0;
          const fTaxaValor = (valBrutoForma * fTaxaPerc) / 100;
          const fValorLiquido = valBrutoForma - fTaxaValor;
          const fValorParcela = valBrutoForma / fParcelas;

          if (fParcelas > 1) {
            for (let i = 0; i < fParcelas; i++) {
              const dataBase = forma.vencimento ? new Date(forma.vencimento) : new Date(forma.data);
              const dataVenc = somarMesesSeguro(dataBase, i);

              await addTransacao({
                pacienteId: pid,
                pacienteNome,
                tipo: formData.tipo,
                valor: fValorParcela,
                valorLiquido: fValorParcela - (fTaxaValor / fParcelas),
                status: i === 0 && forma.status === 'pago' ? 'pago' : 'pendente',
                metodoPagamento: forma.metodo,
                data: forma.data,
                vencimento: dataVenc,
                descricao: `${descBase} — ${forma.rotulo} (${i + 1}/${fParcelas})`,
                categoria: formData.tipo === 'despesa' && parceiro ? 'parceria' : undefined,
                taxaCartaoPercentual: fTaxaPerc,
                taxaCartaoValor: fTaxaValor / fParcelas,
                parcelas: 1,
                valorParcela: fValorParcela,
                orcamentoId: formData.orcamentoId || undefined,
                comprovantes: formData.comprovantes?.length ? formData.comprovantes : undefined,
              });
              totalLancamentos++;
            }
          } else {
            await addTransacao({
              pacienteId: pid,
              pacienteNome,
              tipo: formData.tipo,
              valor: valBrutoForma,
              valorLiquido: fValorLiquido,
              status: forma.status,
              metodoPagamento: forma.metodo,
              data: forma.data,
              vencimento: forma.vencimento || undefined,
              descricao: `${descBase} — ${forma.rotulo}`,
              categoria: formData.tipo === 'despesa' && parceiro ? 'parceria' : undefined,
              taxaCartaoPercentual: fTaxaPerc,
              taxaCartaoValor: fTaxaValor,
              parcelas: 1,
              valorParcela: valBrutoForma,
              orcamentoId: formData.orcamentoId || undefined,
              comprovantes: formData.comprovantes?.length ? formData.comprovantes : undefined,
            });
            totalLancamentos++;
          }
        }

        // Repasse ao parceiro entra como despesa/parceria se houver
        if (parceiro && valorParceiro > 0 && formData.tipo === 'receita') {
          await addTransacao({
            pacienteId: pid,
            tipo: 'despesa',
            status: formData.status,
            categoria: 'parceria',
            metodoPagamento: 'pix',
            data: formData.data,
            descricao: `Repasse parceiro ${parceiro.nome} — ${formData.descricao}`,
            valor: valorParceiro,
            parceiroId: parceiro.id,
            parceiroNome: parceiro.nome,
            valorParceiro,
          });
        }

        toast.success(`Pagamento combinado registrado: ${totalLancamentos} lançamentos gerados com sucesso!`);
        onSave({});
        setFormData(emptyForm);
        setModoMultiplasFormas(false);
      } catch (error) {
        console.error('Erro ao salvar transações múltiplas:', error);
        toast.error('Erro ao salvar pagamento com múltiplas formas');
      }
      return;
    }

    // ========================================================================
    // CASO 2: FORMA ÚNICA (PADRÃO / EDIÇÃO)
    // ========================================================================
    if (!formData.valor) {
      toast.error('Informe o valor da transação');
      return;
    }

    try {
      const { taxaCartaoPercentual, parcelas: _p, valorParceiro: _vp, orcamentoId: _oid, ...rest } = formData;

      const transactionData = {
        ...rest,
        pacienteId: pid,
        pacienteNome: pacienteNome || rest.pacienteNome,
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
        comprovantes: formData.comprovantes?.length ? formData.comprovantes : undefined,
      };

      if (isEdit) {
        await updateTransacao(transacao.id, transactionData);

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
        if (formData.metodoPagamento === 'pix_parcelado' && parcelas > 1) {
          for (let i = 0; i < parcelas; i++) {
            const dataBase = formData.vencimento ? new Date(formData.vencimento) : new Date(formData.data);
            const dataVencimento = somarMesesSeguro(dataBase, i);
            await addTransacao({
              ...transactionData,
              valor: valorParcela,
              valorLiquido: valorParcela,
              vencimento: dataVencimento,
              descricao: `${formData.descricao} (Parcela ${i + 1}/${parcelas})`,
              parcelas: 1,
              valorParcela: valorParcela,
              status: i === 0 ? formData.status : 'pendente'
            });
          }
        } else {
          await addTransacao(transactionData);
        }

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

          {orcamentosDisponiveis.length > 0 && (
            <div>
              <Label htmlFor="orcamento">Orçamento aprovado (opcional)</Label>
              <Select
                value={formData.orcamentoId || 'none'}
                onValueChange={(value) => {
                  if (value === 'none') {
                    setFormData((prev) => ({ ...prev, orcamentoId: '' }));
                    return;
                  }
                  const orc = orcamentosDisponiveis.find((o) => o.id === value);
                  if (!orc) return;
                  const s = calcularSaldoOrcamento(orc, transacoes as any[], orcamentos as any[]);
                  setFormData((prev) => ({
                    ...prev,
                    orcamentoId: value,
                    pacienteId: orc.pacienteId || prev.pacienteId,
                    descricao: prev.descricao || orc.titulo,
                    valor: s.saldo > 0 ? String(s.saldo.toFixed(2)) : prev.valor,
                    tipo: 'receita',
                  }));
                }}
              >
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Sem orçamento" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem orçamento</SelectItem>
                  {orcamentosDisponiveis.map((o) => {
                    const s = calcularSaldoOrcamento(o, transacoes as any[], orcamentos as any[]);
                    return (
                      <SelectItem key={o.id} value={o.id}>
                        {o.titulo}{o.pacienteNome ? ` — ${o.pacienteNome}` : ''} — resta {money(s.saldo)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {orcamentoSelecionado && (
                <div className="mt-2 rounded-lg border p-2 text-xs space-y-0.5">
                  <p>Total do orçamento: {money(saldoSelecionado.total)}</p>
                  <p>Já pago: {money(saldoSelecionado.pago)}</p>
                  <p className="font-medium">
                    Saldo em aberto após este lançamento:{' '}
                    {money(Math.max(0, saldoSelecionado.saldo - (formData.status === 'pago' ? valorBruto : 0)))}
                  </p>
                </div>
              )}
            </div>
          )}



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

          {/* Toggle de Múltiplas Formas de Pagamento */}
          {!isEdit && formData.tipo === 'receita' && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <Layers className="h-4 w-4" />
                  Múltiplas Formas de Pagamento (Entrada + Cartão/PIX)
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Permite dividir o pagamento do paciente (ex: R$ 500 no PIX e o restante no Cartão).
                </p>
              </div>
              <Switch
                checked={modoMultiplasFormas}
                onCheckedChange={(checked) => {
                  setModoMultiplasFormas(checked);
                  if (checked && valorBruto > 0) {
                    const ent = Math.round(valorBruto * 0.3);
                    const rest = Math.max(0, valorBruto - ent);
                    setFormasSplit([
                      {
                        id: '1',
                        rotulo: 'Entrada PIX',
                        metodo: 'pix',
                        valor: ent > 0 ? String(ent) : '',
                        parcelas: '1',
                        taxaCartaoPercentual: '',
                        status: 'pago',
                        data: new Date(),
                        vencimento: null,
                      },
                      {
                        id: '2',
                        rotulo: 'Restante Cartão',
                        metodo: 'cartao',
                        valor: rest > 0 ? String(rest) : '',
                        parcelas: '3',
                        taxaCartaoPercentual: '',
                        status: 'pendente',
                        data: new Date(),
                        vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                      },
                    ]);
                  }
                }}
              />
            </div>
          )}

          {/* Seção Condicional: Múltiplas Formas vs Forma Única */}
          {modoMultiplasFormas && !isEdit ? (
            <div className="space-y-3 p-3.5 rounded-lg border border-emerald-500/40 bg-emerald-950/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Wallet className="h-4 w-4" /> Detalhamento das Formas de Pagamento
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Total da Venda: <strong className="text-foreground">{money(valorBruto)}</strong>
                </span>
              </div>

              <div className="space-y-3">
                {formasSplit.map((forma, idx) => (
                  <div key={forma.id} className="p-2.5 rounded-lg border border-border bg-background/90 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <Input
                          value={forma.rotulo}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormasSplit((prev) => prev.map((f, i) => (i === idx ? { ...f, rotulo: val } : f)));
                          }}
                          placeholder="Ex: Entrada PIX, Restante Cartão..."
                          className="h-7 text-xs w-36 font-semibold"
                        />
                      </div>

                      {formasSplit.length > 1 && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => setFormasSplit((prev) => prev.filter((_, i) => i !== idx))}
                          title="Remover forma"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Método</Label>
                        <Select
                          value={forma.metodo}
                          onValueChange={(val: MetodoPagamento) =>
                            setFormasSplit((prev) => prev.map((f, i) => (i === idx ? { ...f, metodo: val } : f)))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="boleto">Boleto Bancário</SelectItem>
                            <SelectItem value="pix_parcelado">PIX Parcelado</SelectItem>
                            <SelectItem value="transferencia">Transferência</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <Label className="text-[11px] text-muted-foreground">Valor (R$)</Label>
                          {idx === formasSplit.length - 1 && valorBruto > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const somaOutras = formasSplit
                                  .filter((_, i) => i !== idx)
                                  .reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
                                const saldoFaltante = Math.max(0, valorBruto - somaOutras);
                                setFormasSplit((prev) =>
                                  prev.map((f, i) => (i === idx ? { ...f, valor: String(saldoFaltante.toFixed(2)) } : f))
                                );
                              }}
                              className="text-[10px] text-emerald-400 hover:underline"
                            >
                              Preencher saldo
                            </button>
                          )}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={forma.valor}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormasSplit((prev) => prev.map((f, i) => (i === idx ? { ...f, valor: val } : f)));
                          }}
                          className="h-8 text-xs font-semibold"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">Status</Label>
                        <Select
                          value={forma.status}
                          onValueChange={(val: StatusTransacao) =>
                            setFormasSplit((prev) => prev.map((f, i) => (i === idx ? { ...f, status: val } : f)))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pago">Pago (Recebido agora)</SelectItem>
                            <SelectItem value="pendente">Pendente (A receber)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          {forma.status === 'pago' ? 'Data Recebimento' : '1º Vencimento'}
                        </Label>
                        <Input
                          type="date"
                          className="h-8 text-xs"
                          value={forma.vencimento ? format(forma.vencimento, 'yyyy-MM-dd') : format(forma.data, 'yyyy-MM-dd')}
                          onChange={(e) => {
                            const d = e.target.value ? new Date(e.target.value + 'T12:00:00') : new Date();
                            setFormasSplit((prev) =>
                              prev.map((f, i) => (i === idx ? { ...f, vencimento: d, data: d } : f))
                            );
                          }}
                        />
                      </div>
                    </div>

                    {(forma.metodo === 'cartao' || forma.metodo === 'pix_parcelado' || forma.metodo === 'boleto') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-muted-foreground">Parcelas</Label>
                          <Select
                            value={String(forma.parcelas || '1')}
                            onValueChange={(val) =>
                              setFormasSplit((prev) => prev.map((f, i) => (i === idx ? { ...f, parcelas: val } : f)))
                            }
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}x {n > 1 && parseFloat(forma.valor) > 0 ? `(${money(parseFloat(forma.valor) / n)})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {forma.metodo === 'cartao' && (
                          <>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Máquina</Label>
                              <Select
                                defaultValue="infinitepay"
                                onValueChange={(opId) => {
                                  const op = operadoras.find((o) => o.id === opId) || operadoraPadrao;
                                  const p = parseInt(forma.parcelas) || 1;
                                  const calc = calcularTaxaCartao(op, p, 100);
                                  setFormasSplit((prev) =>
                                    prev.map((f, i) =>
                                      i === idx ? { ...f, taxaCartaoPercentual: String(calc.taxaPercentual) } : f
                                    )
                                  );
                                }}
                              >
                                <SelectTrigger className="h-8 text-xs font-semibold">
                                  <SelectValue placeholder="Máquina" />
                                </SelectTrigger>
                                <SelectContent>
                                  {operadoras
                                    .filter((o) => o.ativa !== false)
                                    .map((op) => (
                                      <SelectItem key={op.id} value={op.id}>
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className="w-2 h-2 rounded-full"
                                            style={{ backgroundColor: op.cor || '#10b981' }}
                                          />
                                          <span>{op.nome}</span>
                                        </div>
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">Taxa da Máquina (%)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Ex: 3.5"
                                value={forma.taxaCartaoPercentual}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormasSplit((prev) =>
                                    prev.map((f, i) => (i === idx ? { ...f, taxaCartaoPercentual: val } : f))
                                  );
                                }}
                                className="h-8 text-xs"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const somaAtual = formasSplit.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
                    const saldoFaltante = Math.max(0, valorBruto - somaAtual);
                    setFormasSplit((prev) => [
                      ...prev,
                      {
                        id: String(Date.now()),
                        rotulo: `Forma ${prev.length + 1}`,
                        metodo: 'cartao',
                        valor: saldoFaltante > 0 ? String(saldoFaltante.toFixed(2)) : '',
                        parcelas: '1',
                        taxaCartaoPercentual: '',
                        status: 'pendente',
                        data: new Date(),
                        vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                      },
                    ]);
                  }}
                  className="w-full h-8 text-xs gap-1 border-dashed border-emerald-500/40 text-emerald-400 hover:bg-emerald-950/30"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Outra Forma de Pagamento
                </Button>

                {/* Balanceador em tempo real */}
                {(() => {
                  const soma = formasSplit.reduce((s, f) => s + (parseFloat(f.valor) || 0), 0);
                  const totalReferencia = valorBruto > 0 ? valorBruto : soma;
                  const dif = valorBruto > 0 ? valorBruto - soma : 0;
                  const bateu = valorBruto > 0 ? Math.abs(dif) < 0.01 : soma > 0;
                  return (
                    <div className="rounded-lg bg-background/90 border border-border p-2.5 text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">
                          {valorBruto > 0 ? 'Total Previsto da Venda:' : 'Total Previsto (Soma das Formas):'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">{money(totalReferencia)}</span>
                          {valorBruto === 0 && soma > 0 && (
                            <button
                              type="button"
                              onClick={() => setFormData((prev) => ({ ...prev, valor: String(soma.toFixed(2)) }))}
                              className="text-[10px] text-emerald-400 hover:underline"
                            >
                              Fixar no Total
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Soma das Formas:</span>
                        <span className="font-semibold">{money(soma)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-border/60">
                        <span className="font-medium">Status da Distribuição:</span>
                        {bateu ? (
                          <Badge className="bg-emerald-600/90 text-white text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" /> 100% Distribuído
                          </Badge>
                        ) : dif > 0 ? (
                          <span className="text-amber-500 font-semibold text-[11px]">
                            Faltam distribuir {money(dif)}
                          </span>
                        ) : (
                          <span className="text-red-500 font-semibold text-[11px]">
                            A soma excede o total em {money(Math.abs(dif))}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="metodo" className="text-xs font-semibold">Método de Pagamento *</Label>
                    <Select
                      value={formData.metodoPagamento}
                      onValueChange={(value: MetodoPagamento) => {
                        setFormData((prev) => {
                          const ehAVista = value === 'pix' || value === 'dinheiro';
                          const novoStatus = ehAVista && prev.status === 'pendente' && !prev.vencimento ? 'pago' : prev.status;
                          return { ...prev, metodoPagamento: value, status: novoStatus };
                        });
                      }}
                    >
                      <SelectTrigger className="font-medium">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pix">💎 PIX (Imediato / Baixa na hora)</SelectItem>
                        <SelectItem value="cartao">💳 Cartão de Crédito / Débito</SelectItem>
                        <SelectItem value="dinheiro">💵 Dinheiro em Espécie</SelectItem>
                        <SelectItem value="pix_parcelado">📅 PIX Parcelado (Recorrente)</SelectItem>
                        <SelectItem value="boleto">📄 Boleto Bancário</SelectItem>
                        <SelectItem value="transferencia">🏦 Transferência / TED</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Situação Financeira *</Label>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <Button
                        type="button"
                        variant={formData.status === 'pago' ? 'default' : 'outline'}
                        size="sm"
                        className={`h-9 text-xs font-semibold gap-1 ${
                          formData.status === 'pago' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'text-muted-foreground'
                        }`}
                        onClick={() => setFormData((prev) => ({ ...prev, status: 'pago' }))}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {formData.tipo === 'receita' ? 'Recebido (Caixa)' : 'Pago (Saiu)'}
                      </Button>
                      <Button
                        type="button"
                        variant={formData.status === 'pendente' ? 'default' : 'outline'}
                        size="sm"
                        className={`h-9 text-xs font-semibold gap-1 ${
                          formData.status === 'pendente' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'text-muted-foreground'
                        }`}
                        onClick={() => setFormData((prev) => ({ ...prev, status: 'pendente' }))}
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        {formData.tipo === 'receita' ? 'A Receber' : 'A Pagar'}
                      </Button>
                    </div>
                  </div>
                </div>

                {formData.status === 'pago' ? (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 p-2 rounded-md flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Este valor <strong>entra imediatamente</strong> na Receita Caixa do mês selecionado.</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-2 rounded-md flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Ficará como <strong>A Receber</strong> até que você confirme a baixa do pagamento.</span>
                  </div>
                )}
              </div>
          )}

          {permiteParcelamento && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className={`grid ${isCartao ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
                {isCartao && (
                  <div>
                    <Label htmlFor="operadora" className="text-xs">Máquina</Label>
                    <Select
                      value={selectedOperadoraId}
                      onValueChange={(opId) => {
                        setSelectedOperadoraId(opId);
                        const op = operadoras.find(o => o.id === opId) || operadoraPadrao;
                        const p = parseInt(formData.parcelas) || 1;
                        const calc = calcularTaxaCartao(op, p, 100);
                        setFormData(prev => ({ ...prev, taxaCartaoPercentual: String(calc.taxaPercentual) }));
                      }}
                    >
                      <SelectTrigger id="operadora" className="h-9 text-xs font-semibold">
                        <SelectValue placeholder="Máquina" />
                      </SelectTrigger>
                      <SelectContent>
                        {operadoras.filter(o => o.ativa !== false).map(op => (
                          <SelectItem key={op.id} value={op.id}>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: op.cor || '#10b981' }}
                              />
                              <span>{op.nome}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {isCartao && (
                  <div>
                    <Label htmlFor="taxa" className="text-xs">Taxa da máquina (%)</Label>
                    <Input
                      id="taxa"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 3.99"
                      value={formData.taxaCartaoPercentual}
                      onChange={(e) => setFormData(prev => ({ ...prev, taxaCartaoPercentual: e.target.value }))}
                      className="h-9 text-xs"
                    />
                  </div>
                )}
                <div className={!isCartao ? "col-span-2" : ""}>
                  <Label htmlFor="parcelas" className="text-xs">Parcelas</Label>
                  <Input
                    id="parcelas"
                    type="number"
                    min="1"
                    max="24"
                    value={formData.parcelas}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => {
                        const updated = { ...prev, parcelas: val };
                        if (isCartao && selectedOperadoraId) {
                          const op = operadoras.find(o => o.id === selectedOperadoraId) || operadoraPadrao;
                          const p = parseInt(val) || 1;
                          const calc = calcularTaxaCartao(op, p, 100);
                          updated.taxaCartaoPercentual = String(calc.taxaPercentual);
                        }
                        return updated;
                      });
                    }}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor {isPixParcelado ? 'do PIX' : 'pago pelo cliente'}</span>
                  <span>{money(valorBruto)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parcelamento</span>
                  <span>{parcelas}x de {money(valorParcela)}</span>
                </div>
                {isCartao && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Desconto da taxa ({taxaPerc}%)</span>
                      <span className="text-destructive">- {money(taxaValor)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Valor líquido</span>
                      <span className="text-primary">{money(valorLiquido)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{formData.status === 'pago' ? (formData.tipo === 'receita' ? 'Data do Recebimento (Caixa) *' : 'Data do Pagamento *') : 'Data do Lançamento'}</Label>
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
              <Label>{formData.status === 'pago' ? 'Vencimento (opcional)' : 'Vencimento *'}</Label>
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
            <Label>Comprovantes (PDF/Imagem)</Label>
            <div className="mt-2 flex flex-col gap-2">
              {formData.comprovantes && formData.comprovantes.length > 0 && formData.comprovantes.map((url, index) => (
                <div key={index} className="flex items-center gap-2 bg-muted p-2 rounded-md w-full justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate max-w-[200px]">{url.split('/').pop()}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleViewComprovante(url)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveComprovante(index)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              
              <div className="flex items-center gap-2 w-full mt-1">
                <Input type="file" id="comprovantes-upload" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileUpload} />
                <Button type="button" variant="outline" onClick={() => document.getElementById('comprovantes-upload')?.click()} disabled={uploading} className="w-full">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                  Anexar Comprovantes
                </Button>
              </div>
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



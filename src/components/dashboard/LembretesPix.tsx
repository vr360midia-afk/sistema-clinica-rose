import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Bell, Copy, Check, MessageCircle } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { openWhatsApp } from '@/lib/whatsapp';

const LembretesPix = () => {
  const { transacoes, pacientes, updateTransacao } = useDentalSystem();
  const { configuracoes } = useConfiguracoes();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Filtrar apenas PIX Parcelado pendentes com vencimento entre o passado e amanhã
  const lembretes = transacoes.filter(t => {
    if (t.metodoPagamento !== 'pix_parcelado' || t.status !== 'pendente' || !t.vencimento) return false;
    
    const vencimento = new Date(t.vencimento);
    vencimento.setHours(0, 0, 0, 0);

    // Vence hoje ou amanhã ou já venceu
    return vencimento.getTime() <= tomorrow.getTime();
  });

  if (lembretes.length === 0) return null;

  const enviarMensagem = (t: any) => {
    const paciente = pacientes.find(p => p.id === t.pacienteId);
    if (!paciente || !paciente.telefone) {
      toast.error('Paciente não encontrado ou sem telefone');
      return;
    }

    const dataVenc = new Date(t.vencimento!).toLocaleDateString('pt-BR');
    const chavePix = configuracoes?.telefone || configuracoes?.cnpj || 'SUA_CHAVE_PIX';
    const valor = formatMoney(t.valor);
    const nome = paciente.nome.split(' ')[0];

    const mensagem = `Olá, ${nome}! Tudo bem?\n\nPassando para lembrar do vencimento da sua parcela do tratamento odontológico.\n\n*Valor:* ${valor}\n*Vencimento:* ${dataVenc}\n*Chave PIX:* ${chavePix}\n\nQualquer dúvida, estamos à disposição!`;
    
    openWhatsApp(paciente.telefone, mensagem);
  };

  const copiarPix = () => {
    const chavePix = configuracoes?.telefone || configuracoes?.cnpj || 'SUA_CHAVE_PIX';
    navigator.clipboard.writeText(chavePix);
    toast.success('Chave PIX copiada!');
  };

  const marcarPago = async (t: any) => {
    try {
      await updateTransacao(t.id, { status: 'pago' });
      toast.success('Parcela marcada como paga!');
    } catch (e) {
      toast.error('Erro ao atualizar o status.');
    }
  };

  return (
    <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/10 dark:border-yellow-900/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-yellow-800 dark:text-yellow-500 flex items-center gap-2">
          <Bell className="h-4 w-4" /> Lembretes de Cobrança (PIX Parcelado)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {lembretes.map(t => {
            const paciente = pacientes.find(p => p.id === t.pacienteId);
            const dataVenc = new Date(t.vencimento!).toLocaleDateString('pt-BR');
            const isToday = new Date(t.vencimento!).toDateString() === new Date().toDateString();
            const isVencido = new Date(t.vencimento!).getTime() < today.getTime();
            
            return (
              <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white dark:bg-zinc-900 rounded-lg border shadow-sm gap-3">
                <div>
                  <p className="font-medium text-sm">{paciente?.nome || 'Paciente removido'}</p>
                  <p className="text-xs text-muted-foreground">{t.descricao}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-semibold ${isVencido ? 'text-red-600' : isToday ? 'text-yellow-600' : 'text-blue-600'}`}>
                      {isVencido ? 'Venceu em' : isToday ? 'Vence hoje' : 'Vence amanhã'}: {dataVenc}
                    </span>
                    <span className="text-xs font-bold text-foreground">{formatMoney(t.valor)}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => copiarPix()} className="h-8 px-2 text-xs">
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar PIX
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => enviarMensagem(t)} className="h-8 px-2 text-xs">
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> WhatsApp
                  </Button>
                  <Button size="sm" onClick={() => marcarPago(t)} className="h-8 px-2 text-xs bg-green-600 hover:bg-green-700">
                    <Check className="h-3.5 w-3.5 mr-1" /> Pago
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LembretesPix;

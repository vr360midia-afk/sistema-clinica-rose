import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  MessageCircle,
  CheckCircle2,
  Copy,
  Search,
  Calendar,
  Clock,
  Sparkles,
  QrCode,
  Check,
  User,
  Phone,
  DollarSign,
} from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { gerarPayloadPix } from '@/utils/pixPayload';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';
import { ModalReceberPagamento } from './ModalReceberPagamento';
import { toast } from 'sonner';

const diasAtraso = (vencimento: Date) =>
  Math.floor((Date.now() - vencimento.getTime()) / (1000 * 60 * 60 * 24));

export const Inadimplencia = () => {
  const { transacoes, pacientes, updateTransacao } = useDentalSystem();
  const { configuracoes } = useConfiguracoes();
  const { configContrato } = useConfiguracoesContrato();

  const [filtroAba, setFiltroAba] = useState<'vencidas' | 'hoje' | 'proximos' | 'todas'>('vencidas');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);

  // Modal de Baixa Rápida / Recebimento
  const [modalReceberOpen, setModalReceberOpen] = useState(false);
  const [transacaoParaBaixa, setTransacaoParaBaixa] = useState<any | null>(null);

  const getPaciente = (id: string) => pacientes.find((p) => p.id === id);

  const chavePix = configContrato?.chavePix || configuracoes?.telefone || configuracoes?.cnpj || '';
  const tipoChave = configContrato?.tipoChavePix;
  const nomeClinica = configContrato?.favorecidoPix || configuracoes?.nomeClinica || 'Clínica Odontológica';
  const cidade = (configuracoes?.cidade && !configuracoes.cidade.toUpperCase().includes('SAO PAULO')) ? configuracoes.cidade : 'MACEIO';

  // Processa todas as receitas pendentes com datas
  const todasPendentes = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    return (transacoes || [])
      .filter((t) => t && t.tipo === 'receita' && (t?.status === 'pendente' || t?.status === 'vencido'))
      .map((t) => {
        const venc = new Date((t.vencimento as any) || t.data);
        const dias = diasAtraso(venc);
        const isHoje = venc.toDateString() === hoje.toDateString();
        const diffDias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        const isProximos7Dias = diffDias >= 0 && diffDias <= 7;

        return {
          t,
          venc,
          dias,
          isHoje,
          isVencida: dias > 0,
          isProximos7Dias,
        };
      })
      .filter((i) => !isNaN(i.venc.getTime()))
      .sort((a, b) => b.dias - a.dias);
  }, [transacoes]);

  // Contadores para as abas
  const countVencidas = useMemo(() => todasPendentes.filter((i) => i.isVencida), [todasPendentes]);
  const countHoje = useMemo(() => todasPendentes.filter((i) => i.isHoje), [todasPendentes]);
  const countProximos = useMemo(() => todasPendentes.filter((i) => i.isProximos7Dias), [todasPendentes]);

  const totalAtraso = countVencidas.reduce((s, i) => s + Number(i.t.valor || 0), 0);
  const totalHoje = countHoje.reduce((s, i) => s + Number(i.t.valor || 0), 0);
  const totalGeralPendentes = todasPendentes.reduce((s, i) => s + Number(i.t.valor || 0), 0);

  // Lista filtrada pela aba selecionada e busca
  const listaExibicao = useMemo(() => {
    let base = todasPendentes;
    if (filtroAba === 'vencidas') {
      base = countVencidas;
    } else if (filtroAba === 'hoje') {
      base = countHoje;
    } else if (filtroAba === 'proximos') {
      base = countProximos;
    }

    if (!buscaTexto.trim()) return base;

    const termo = buscaTexto.toLowerCase();
    return base.filter((item) => {
      const p = getPaciente(item.t.pacienteId);
      const nomeP = (p?.nome || '').toLowerCase();
      const desc = (item.t.descricao || '').toLowerCase();
      return nomeP.includes(termo) || desc.includes(termo);
    });
  }, [todasPendentes, filtroAba, buscaTexto, countVencidas, countHoje, countProximos, pacientes]);

  // Enviar Cobrança c/ PIX Copia-e-Cola pelo WhatsApp
  const cobrarWhatsApp = (item: (typeof todasPendentes)[number]) => {
    const paciente = getPaciente(item.t.pacienteId);
    if (!paciente?.telefone) {
      toast.error('Paciente não possui número de telefone/WhatsApp cadastrado.');
      return;
    }

    const valorNum = Number(item.t.valor || 0);
    const dataVenc = item.venc.toLocaleDateString('pt-BR');
    const primeiroNome = paciente.nome ? paciente.nome.trim().split(' ')[0] : 'Cliente';

    // Gerador oficial Bacen com o valor exato da parcela
    const payloadPix = chavePix
      ? gerarPayloadPix({
          chave: chavePix,
          tipoChave,
          nomeFavorecido: nomeClinica,
          cidade,
          valor: valorNum,
          descricao: item.t.descricao ? item.t.descricao.slice(0, 30) : 'Tratamento',
        })
      : '';

    const saudacao = `Olá, ${primeiroNome}! Tudo bem? Esperamos que sim.`;
    const motivo = item.isVencida
      ? `Consta em nosso sistema uma parcela em aberto com vencimento em *${dataVenc}* (${item.dias} dia(s) em atraso).`
      : item.isHoje
      ? `Lembramos que sua parcela de *${formatMoney(valorNum)}* vence *hoje (${dataVenc})*.`
      : `Lembramos do vencimento programado da sua parcela para *${dataVenc}*.`;

    const linhas = [
      saudacao,
      '',
      `Passando da equipe da *${nomeClinica}*:`,
      motivo,
      '',
      `📋 *Referente:* ${item.t.descricao || 'Tratamento Odontológico'}`,
      `💰 *Valor:* ${formatMoney(valorNum)}`,
      chavePix ? `🔑 *Chave PIX:* ${chavePix}` : null,
      '',
      payloadPix
        ? `💎 *PIX Copia e Cola (já com valor preenchido):*\n\`\`\`${payloadPix}\`\`\`\n\n📲 *Como pagar pelo seu banco:*\n1. Copie o código acima\n2. Abra o app do seu banco e escolha *Pix Copia e Cola*\n3. O valor de *${formatMoney(valorNum)}* e a clínica já virão preenchidos automaticamente!`
        : null,
      '',
      'Caso já tenha efetuado o pagamento, por favor desconsidere este aviso ou nos envie o comprovante. Qualquer dúvida, estamos à disposição!',
    ]
      .filter(Boolean)
      .join('\n');

    if (!openWhatsApp(paciente.telefone, linhas)) {
      toast.error('Não foi possível abrir o WhatsApp. Verifique o número de telefone.');
    } else {
      toast.success(`Mensagem de cobrança com PIX Copia e Cola enviada para ${primeiroNome}!`);
    }
  };

  // Copiar código PIX com o valor exato
  const copiarPixItem = (item: (typeof todasPendentes)[number]) => {
    if (!chavePix) {
      toast.error('Chave PIX não configurada nas configurações da clínica.');
      return;
    }
    const valorNum = Number(item.t.valor || 0);
    const payloadPix = gerarPayloadPix({
      chave: chavePix,
      tipoChave,
      nomeFavorecido: nomeClinica,
      cidade,
      valor: valorNum,
      descricao: item.t.descricao ? item.t.descricao.slice(0, 30) : 'Tratamento',
    });

    navigator.clipboard.writeText(payloadPix);
    setCopiadoId(item.t.id);
    setTimeout(() => setCopiadoId(null), 2500);
    toast.success(`PIX Copia e Cola com valor de ${formatMoney(valorNum)} copiado para o app do banco!`);
  };

  const abrirBaixa = (item: (typeof todasPendentes)[number]) => {
    setTransacaoParaBaixa(item.t);
    setModalReceberOpen(true);
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  Cobrança & Inadimplência
                </CardTitle>
                {countVencidas.length > 0 && (
                  <Badge variant="destructive" className="text-xs font-bold">
                    {countVencidas.length} em atraso • {formatMoney(totalAtraso)}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Envie cobranças instantâneas pelo WhatsApp já com o PIX Copia e Cola do Bacen no valor exato.
              </CardDescription>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente ou procedimento..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Abas de Filtros Rápidos */}
        <div className="pt-3">
          <Tabs value={filtroAba} onValueChange={(val: any) => setFiltroAba(val)}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 h-auto p-1 bg-muted/50">
              <TabsTrigger value="vencidas" className="text-xs font-semibold py-1.5 gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                Vencidas ({countVencidas.length})
              </TabsTrigger>
              <TabsTrigger value="hoje" className="text-xs font-semibold py-1.5 gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Vencem Hoje ({countHoje.length})
              </TabsTrigger>
              <TabsTrigger value="proximos" className="text-xs font-semibold py-1.5 gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Próximos 7 dias ({countProximos.length})
              </TabsTrigger>
              <TabsTrigger value="todas" className="text-xs font-semibold py-1.5 gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                Todas ({todasPendentes.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {listaExibicao.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-foreground text-sm">Nenhuma pendência nesta categoria!</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {buscaTexto
                ? 'Nenhum resultado encontrado para a busca informada.'
                : 'Todas as parcelas e cobranças estão em dia.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {listaExibicao.map((item) => {
              const paciente = getPaciente(item.t.pacienteId);
              const isVencido = item.isVencida;
              const isHoje = item.isHoje;
              const valorNum = Number(item.t.valor || 0);

              return (
                <div
                  key={item.t.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all ${
                    isVencido
                      ? 'bg-rose-50/40 dark:bg-rose-950/15 border-rose-500/30'
                      : isHoje
                      ? 'bg-amber-50/40 dark:bg-amber-950/15 border-amber-500/30'
                      : 'bg-card border-border'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {paciente?.nome || 'Paciente não identificado'}
                      </span>
                      {paciente?.telefone && (
                        <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {paciente.telefone}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {item.t.descricao || 'Sem descrição cadastrada'}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          isVencido
                            ? 'text-rose-600 dark:text-rose-400'
                            : isHoje
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {isVencido
                          ? `⚠️ Vencido há ${item.dias} dia(s) (${item.venc.toLocaleDateString('pt-BR')})`
                          : isHoje
                          ? `⏰ Vence Hoje (${item.venc.toLocaleDateString('pt-BR')})`
                          : `📅 Vencimento: ${item.venc.toLocaleDateString('pt-BR')}`}
                      </span>

                      <span className="text-muted-foreground">•</span>
                      <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {item.t.metodoPagamento || 'PIX'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                    <div className="text-left sm:text-right mr-1">
                      <span className="text-xs text-muted-foreground block">Valor Pendente</span>
                      <span className="text-base font-black text-foreground">
                        {formatMoney(valorNum)}
                      </span>
                    </div>

                    {/* Botão Copiar PIX com Valor */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copiarPixItem(item)}
                      className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                      title="Copiar código PIX Copia e Cola já com o valor preenchido no Bacen"
                    >
                      {copiadoId === item.t.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiadoId === item.t.id ? 'Copiado!' : 'PIX c/ Valor'}</span>
                    </Button>

                    {/* Botão Cobrança WhatsApp com Mensagem + PIX */}
                    <Button
                      size="sm"
                      onClick={() => cobrarWhatsApp(item)}
                      className="h-8 px-2.5 text-xs font-semibold gap-1.5 bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-xs"
                      title="Abrir WhatsApp com mensagem amigável e código PIX Copia e Cola com o valor"
                    >
                      <MessageCircle className="h-3.5 w-3.5 fill-white" />
                      <span>Cobrar no WhatsApp</span>
                    </Button>

                    {/* Botão Baixar / Confirmar Recebimento */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => abrirBaixa(item)}
                      className="h-8 px-2.5 text-xs font-semibold gap-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/30"
                      title="Receber e dar baixa no Caixa agora"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Dar Baixa</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Modal para Dar Baixa / Confirmar Recebimento com Emissão de Recibo */}
      <ModalReceberPagamento
        isOpen={modalReceberOpen}
        onClose={() => {
          setModalReceberOpen(false);
          setTransacaoParaBaixa(null);
        }}
        transacaoPendente={transacaoParaBaixa}
        onSuccess={() => {
          setModalReceberOpen(false);
          setTransacaoParaBaixa(null);
        }}
      />
    </Card>
  );
};

export default Inadimplencia;

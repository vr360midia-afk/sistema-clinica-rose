import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Building2,
  Wallet,
  CreditCard,
  Banknote,
  QrCode,
  CalendarDays,
  Sparkles,
  ArrowRight,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  FileSignature,
  Maximize2,
  Minimize2,
  Camera,
  Image as ImageIcon,
  ChevronRight,
  HelpCircle,
  Info,
  Phone,
  Mail,
  User,
  HeartHandshake,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/exportCsv';
import { gerarPayloadPix, gerarQrCodePixUrl } from '@/utils/pixPayload';
import {
  obterOrcamentoPublico,
  aprovarOrcamentoPublico,
  obterUrlAssinadaFoto,
  OrcamentoPublicoDados,
  FotoPlanejamento,
} from '@/utils/orcamentoEngine';
import { CondicaoPagamento } from '@/utils/orcamentoCondicoes';
import { openWhatsApp } from '@/lib/whatsapp';

export default function VisualizarOrcamento() {
  const navigate = useNavigate();
  const { pacienteSlug, identificador: paramIdentificador, token: tokenParam } = useParams<{
    pacienteSlug?: string;
    identificador?: string;
    token?: string;
  }>();

  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get('token') || searchParams.get('t') || tokenParam;
  const targetId = paramIdentificador || searchParams.get('id') || searchParams.get('orcamentoId');

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [isExpirado, setIsExpirado] = useState(false);
  const [orcamento, setOrcamento] = useState<OrcamentoPublicoDados | null>(null);

  // Seleção de condição de pagamento pelo paciente
  const [condicaoSelecionadaId, setCondicaoSelecionadaId] = useState<string>('');

  // Modal de confirmação da aprovação
  const [modalConfirmarOpen, setModalConfirmarOpen] = useState(false);
  const [aprovando, setAprovando] = useState(false);

  // Modal de foto ampliada do planejamento
  const [fotoAmpliada, setFotoAmpliada] = useState<FotoPlanejamento | null>(null);

  // Modal de PIX (se o paciente quiser copiar ou escanear)
  const [modalPixOpen, setModalPixOpen] = useState(false);
  const [copiouPix, setCopiouPix] = useState(false);

  // Carrega orçamento do backend
  useEffect(() => {
    async function carregar() {
      if (!targetId || !queryToken) {
        setErro('Link incompleto ou token de acesso ausente. Por razões de privacidade e segurança jurídica, utilize o link oficial completo fornecido pela clínica.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErro(null);

      const res = await obterOrcamentoPublico(targetId, queryToken);
      if (res.ok && res.orcamento) {
        setOrcamento(res.orcamento);

        // Se já houver condição aprovada ou previamente selecionada
        if (res.orcamento.condicaoEscolhida?.id) {
          setCondicaoSelecionadaId(res.orcamento.condicaoEscolhida.id);
        } else if (res.orcamento.condicoes.length > 0) {
          // Seleciona a primeira condição por padrão para facilitar a visualização do paciente
          const ativa = res.orcamento.condicoes.find((c) => c.selecionada) || res.orcamento.condicoes[0];
          setCondicaoSelecionadaId(ativa.id);
        }
      } else {
        setErro(res.error || 'Não foi possível carregar o orçamento.');
        if (res.isExpirado) {
          setIsExpirado(true);
        }
      }
      setLoading(false);
    }

    carregar();
  }, [targetId, queryToken]);

  // Condição atualmente selecionada
  const condicaoAtiva = useMemo(() => {
    if (!orcamento) return null;
    return orcamento.condicoes.find((c) => c.id === condicaoSelecionadaId) || orcamento.condicoes[0] || null;
  }, [orcamento, condicaoSelecionadaId]);

  // Informações de PIX da condição ativa
  const { chavePix, favorecidoPix, valorPix } = useMemo(() => {
    const defaultPix = '82987654321';
    const defaultFav = orcamento?.clinica?.nome || 'Clínica Odontológica';
    let vPix = orcamento?.total || 0;

    if (condicaoAtiva) {
      if (condicaoAtiva.tipo === 'a_vista') {
        vPix = condicaoAtiva.valorTotal || orcamento?.total || 0;
      } else if (condicaoAtiva.tipo === 'entrada_saldo' || condicaoAtiva.tipo === 'pix_parcelado') {
        vPix = condicaoAtiva.valorEntrada || (condicaoAtiva.valorTotal ? condicaoAtiva.valorTotal / (condicaoAtiva.parcelas || 1) : 0);
      }
    }

    return {
      chavePix: defaultPix,
      favorecidoPix: defaultFav,
      valorPix: vPix,
    };
  }, [orcamento, condicaoAtiva]);

  const payloadPix = useMemo(() => {
    return gerarPayloadPix({
      chave: chavePix,
      nomeRecebedor: favorecidoPix,
      cidade: 'Maceio',
      valor: valorPix,
      identificador: orcamento?.identificador || 'ORC',
    });
  }, [chavePix, favorecidoPix, valorPix, orcamento]);

  const qrCodePixUrl = useMemo(() => {
    return gerarQrCodePixUrl(payloadPix);
  }, [payloadPix]);

  const handleCopiarPix = () => {
    navigator.clipboard.writeText(payloadPix);
    setCopiouPix(true);
    toast.success('Código PIX Copia e Cola copiado com sucesso!');
    setTimeout(() => setCopiouPix(false), 2500);
  };

  // Executa a aprovação do orçamento
  const handleConfirmarAprovacao = async () => {
    if (!orcamento || !condicaoAtiva || !queryToken) return;

    try {
      setAprovando(true);
      const res = await aprovarOrcamentoPublico({
        identificador: orcamento.identificador || targetId!,
        token: queryToken,
        condicaoEscolhida: condicaoAtiva,
        evidencias: {
          userAgent: navigator.userAgent,
          dispositivo: /mobile/i.test(navigator.userAgent) ? 'Celular' : 'Computador',
        },
      });

      if (res.ok) {
        toast.success('Orçamento aprovado com sucesso!');
        setOrcamento((prev) =>
          prev
            ? {
                ...prev,
                status: 'aprovado',
                aprovadoEm: res.aprovadoEm || new Date().toISOString(),
                condicaoEscolhida: condicaoAtiva,
              }
            : null
        );
        setModalConfirmarOpen(false);
      } else {
        toast.error(res.error || 'Erro ao aprovar orçamento.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Ocorreu um erro ao processar sua aprovação. Tente novamente.');
    } finally {
      setAprovando(false);
    }
  };

  // Contato com a clínica via WhatsApp
  const handleFalarComClinica = () => {
    const tel = orcamento?.clinica?.telefone || '';
    const msg = `Olá! Estou visualizando o orçamento *${orcamento?.titulo}* (${orcamento?.identificador}) e gostaria de tirar uma dúvida.`;
    openWhatsApp(tel, msg);
  };

  // 1. Tela de Carregamento
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary animate-pulse">
            <FileText className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-base text-foreground">Carregando Proposta de Tratamento...</h3>
            <p className="text-xs text-muted-foreground">Validando credenciais de acesso criptografadas.</p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-primary/70" />
        </div>
      </div>
    );
  }

  // 2. Tela de Erro / Token Inválido / Expirado
  if (erro || !orcamento) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border-border/80 shadow-lg text-center p-6 space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto text-amber-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-lg text-foreground">
              {isExpirado ? 'Proposta Expirada' : 'Acesso Restrito'}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {erro || 'Não foi possível validar este orçamento.'}
            </p>
          </div>
          <div className="p-3 bg-muted/60 rounded-xl text-left text-xs space-y-1.5 border border-border/60">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Segurança e Privacidade do Paciente
            </div>
            <p className="text-muted-foreground text-[11px] leading-snug">
              Os orçamentos da clínica são protegidos por tokens individuais e temporários. Caso precise de uma segunda via ou de um novo link, entre em contato diretamente com a clínica.
            </p>
          </div>
          <Button onClick={() => window.history.back()} variant="outline" className="w-full text-xs">
            Voltar
          </Button>
        </Card>
      </div>
    );
  }

  const isAprovado = orcamento.status === 'aprovado';
  const fotosAutorizadas = (orcamento.fotosPlanejamento || []).filter((f) => f.autorizada !== false);

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-foreground flex flex-col items-center py-6 sm:py-10 px-3 sm:px-6">
      <div className="w-full max-w-4xl space-y-6">
        {/* Topo Oficial com Identidade da Clínica */}
        <header className="bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-center sm:text-left flex-col sm:flex-row">
            {orcamento.clinica.logoUrl ? (
              <div className="h-14 w-14 rounded-2xl bg-background border border-border/70 p-1.5 flex items-center justify-center shrink-0 shadow-xs">
                <img
                  src={orcamento.clinica.logoUrl}
                  alt={orcamento.clinica.nome}
                  className="h-full w-full object-contain rounded-xl"
                />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                <Building2 className="h-7 w-7" />
              </div>
            )}
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 inline-block">
                Proposta Odontológica Oficial
              </span>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                {orcamento.clinica.nome}
              </h1>
              {orcamento.clinica.dentistaResponsavel && (
                <p className="text-xs text-muted-foreground">
                  Responsável Técnico(a): <strong>{orcamento.clinica.dentistaResponsavel}</strong>
                  {orcamento.clinica.cro && ` • CRO ${orcamento.clinica.cro}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-xs font-semibold py-1 px-3 gap-1.5 border',
                isAprovado
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
              )}
            >
              {isAprovado ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Orçamento Aprovado
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Aguardando sua Aprovação
                </>
              )}
            </Badge>
          </div>
        </header>

        {/* Banner de Sucesso / Próximo Passo quando Já Aprovado */}
        {isAprovado && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 sm:p-6 space-y-3 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="font-bold text-base sm:text-lg text-emerald-900 dark:text-emerald-200">
                  Orçamento Aprovado com Sucesso!
                </h3>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                  {orcamento.aprovadoEm ? (
                    <>
                      Aprovação registrada formalmente em{' '}
                      <strong>{new Date(orcamento.aprovadoEm).toLocaleString('pt-BR')}</strong> com a condição:{' '}
                      <strong>{orcamento.condicaoEscolhida?.titulo || 'Condição de pagamento selecionada'}</strong>.
                    </>
                  ) : (
                    'Sua aprovação já está registrada no sistema da clínica.'
                  )}
                </p>
              </div>
            </div>

            {/* Status do Próximo Passo: Contrato Digital */}
            <div className="mt-3 pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-emerald-900 dark:text-emerald-200 text-center sm:text-left">
                {orcamento.contratoLink ? (
                  <span className="font-semibold flex items-center gap-1.5 justify-center sm:justify-start">
                    <FileSignature className="h-4 w-4 text-emerald-600" />
                    Seu contrato digital já está disponível para visualização e assinatura!
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1.5 justify-center sm:justify-start">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Próximo passo: A equipe da clínica está preparando a minuta contratual para assinatura digital.
                  </span>
                )}
              </div>

              {orcamento.contratoLink ? (
                <Button
                  onClick={() => (window.location.href = orcamento.contratoLink!)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shrink-0 shadow-sm w-full sm:w-auto"
                >
                  <FileSignature className="h-4 w-4" />
                  Visualizar e Assinar Contrato
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFalarComClinica}
                  className="text-xs border-emerald-300 dark:border-emerald-800 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 w-full sm:w-auto"
                >
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                  Falar com a Clínica no WhatsApp
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Card Principal: Dados do Paciente e Detalhes da Proposta */}
        <Card className="border-border/80 shadow-xs overflow-hidden">
          <CardHeader className="bg-card border-b border-border/70 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block">
                  Paciente Destinatário:
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  {orcamento.pacienteNome}
                </h2>
              </div>
              <div className="text-left sm:text-right text-xs text-muted-foreground space-y-0.5">
                <div>
                  Código da Proposta:{' '}
                  <strong className="font-mono text-foreground font-semibold">
                    #{orcamento.identificador}
                  </strong>
                </div>
                {orcamento.validade && (
                  <div className="flex items-center sm:justify-end gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Válido até: {orcamento.validade}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {orcamento.titulo}
              </h3>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6 space-y-6">
            {/* Galeria Opcional de Planejamento Visual (se houver fotos autorizadas) */}
            {fotosAutorizadas.length > 0 && (
              <div className="space-y-3 p-4 rounded-2xl bg-muted/40 border border-border/70">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Camera className="h-4 w-4 text-primary" />
                    Planejamento Visual & Imagens Autorizadas
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    {fotosAutorizadas.length} {fotosAutorizadas.length === 1 ? 'imagem' : 'imagens'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {fotosAutorizadas.map((foto, idx) => (
                    <div
                      key={foto.id || idx}
                      onClick={() => setFotoAmpliada(foto)}
                      className="group relative aspect-4/3 rounded-xl overflow-hidden border border-border/80 bg-background cursor-pointer hover:shadow-md transition-all"
                    >
                      <img
                        src={foto.url}
                        alt={foto.titulo || `Foto ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90 p-2.5 flex flex-col justify-end text-white">
                        <span className="text-[11px] font-bold line-clamp-1">
                          {foto.titulo || `Planejamento ${idx + 1}`}
                        </span>
                        {foto.descricao && (
                          <span className="text-[9px] text-white/80 line-clamp-1">{foto.descricao}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Observações Clínicas Autorizadas */}
            {orcamento.observacoes && (
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
                <span className="font-bold text-primary flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Info className="h-3.5 w-3.5" />
                  Observações e Orientações do Tratamento
                </span>
                <p className="text-foreground/90 whitespace-pre-line leading-relaxed">
                  {orcamento.observacoes}
                </p>
              </div>
            )}

            {/* Tabela de Procedimentos do Plano */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pb-1">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Procedimentos Inclusos no Plano
                </h4>
                <span className="text-xs text-muted-foreground">
                  {orcamento.itens.length} {orcamento.itens.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              <div className="border border-border/80 rounded-xl overflow-hidden divide-y divide-border/60">
                {orcamento.itens.map((item, index) => (
                  <div
                    key={index}
                    className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="font-semibold text-foreground truncate">{item.nome}</div>
                      <div className="text-muted-foreground text-[11px]">
                        Quantidade: {item.quantidade || 1}x • {formatMoney(item.valor)} un.
                      </div>
                    </div>
                    <div className="font-bold text-foreground text-sm shrink-0">
                      {formatMoney((item.valor || 0) * (item.quantidade || 1))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo Financeiro Oficial */}
            <div className="p-4 rounded-xl bg-card border border-border/80 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal dos Procedimentos:</span>
                <span className="font-semibold text-foreground">{formatMoney(orcamento.subtotal)}</span>
              </div>

              {orcamento.desconto > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Desconto Especial Oferecido:</span>
                  <span>- {formatMoney(orcamento.desconto)}</span>
                </div>
              )}

              <Separator className="my-1" />

              <div className="flex justify-between items-baseline pt-1">
                <div>
                  <span className="text-sm font-bold text-foreground block">
                    Valor Total do Investimento:
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Valores em Reais (BRL)
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-primary block">
                    {formatMoney(orcamento.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* SEÇÃO 4: Escolha da Forma de Pagamento */}
            <div className="space-y-3 pt-2">
              <div>
                <h4 className="font-bold text-sm sm:text-base text-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  {isAprovado
                    ? 'Condição de Pagamento Aprovada'
                    : 'Selecione sua Opção de Pagamento Preferida'}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAprovado
                    ? 'Esta foi a condição selecionada e validada formalmente na aprovação deste orçamento.'
                    : 'A clínica disponibilizou as opções de pagamento abaixo. Escolha a mais confortável para você e clique em aprovar:'}
                </p>
              </div>

              {/* Grid de Cards de Pagamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {orcamento.condicoes.map((cond, idx) => {
                  const isSelected = isAprovado
                    ? cond.id === orcamento.condicaoEscolhida?.id || cond.selecionada
                    : cond.id === condicaoSelecionadaId;

                  // Se já aprovado e não é a condição escolhida, podemos ocultar ou desabilitar
                  if (isAprovado && !isSelected && orcamento.condicaoEscolhida) {
                    return null;
                  }

                  const isAVista = cond.tipo === 'a_vista';
                  const isCartao = cond.tipo === 'cartao';
                  const isEntrada = cond.tipo === 'entrada_saldo';
                  const isPixParcelado = cond.tipo === 'pix_parcelado';

                  return (
                    <div
                      key={cond.id || idx}
                      onClick={() => !isAprovado && setCondicaoSelecionadaId(cond.id)}
                      className={cn(
                        'rounded-2xl border p-4 transition-all relative flex flex-col justify-between gap-3 text-xs',
                        !isAprovado && 'cursor-pointer hover:border-primary/60 hover:shadow-md',
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5 dark:bg-primary/10 shadow-sm'
                          : 'border-border/80 bg-card hover:bg-muted/20 opacity-80'
                      )}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isAVista && <Banknote className="h-4 w-4 text-emerald-600" />}
                            {isCartao && <CreditCard className="h-4 w-4 text-primary" />}
                            {isEntrada && <Wallet className="h-4 w-4 text-amber-600" />}
                            {isPixParcelado && <QrCode className="h-4 w-4 text-emerald-600" />}
                            <span className="font-bold text-foreground text-xs">{cond.titulo}</span>
                          </div>

                          <div
                            className={cn(
                              'h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                              isSelected
                                ? 'bg-primary border-primary text-white'
                                : 'border-border bg-background'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </div>

                        {/* Detalhe da Proposta */}
                        <div className="space-y-1">
                          <div className="text-base sm:text-lg font-black text-foreground">
                            {formatMoney(cond.valorTotal || orcamento.total)}
                          </div>

                          {cond.descricao && (
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              {cond.descricao}
                            </p>
                          )}
                        </div>

                        {/* Badges de Destaque */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {isAVista && cond.descontoPercentual ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-2 font-semibold">
                              {cond.descontoPercentual}% OFF no PIX
                            </Badge>
                          ) : null}

                          {isCartao && cond.parcelas ? (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary py-0 px-2 font-semibold">
                              {cond.parcelas}x de {formatMoney((cond.valorTotal || orcamento.total) / cond.parcelas)}
                            </Badge>
                          ) : null}

                          {isEntrada && cond.valorEntrada ? (
                            <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 py-0 px-2 font-semibold">
                              Entrada {formatMoney(cond.valorEntrada)} + {cond.parcelasRestantes || 0}x
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      {/* Botão de Ação / Seleção */}
                      {!isAprovado && (
                        <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                          <span className={isSelected ? 'font-bold text-primary' : 'text-muted-foreground'}>
                            {isSelected ? '✓ Opção Selecionada' : 'Clique para selecionar'}
                          </span>
                          {isAVista && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalPixOpen(true);
                              }}
                              className="h-6 px-2 text-[10px] text-emerald-600 hover:text-emerald-700"
                            >
                              Ver Chave PIX
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SEÇÃO 5: Botão de Aprovação Online pelo Paciente */}
            {!isAprovado && (
              <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-primary/5 via-card to-primary/10 border border-primary/20 space-y-4 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-bold text-base text-foreground flex items-center justify-center sm:justify-start gap-2">
                      <HeartHandshake className="h-5 w-5 text-primary" />
                      Pronto para iniciar seu novo sorriso?
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
                      Revise os procedimentos e a opção de pagamento selecionada. Ao aprovar, seu planejamento é formalizado e a equipe da clínica dará início às etapas de agendamento e confecção do seu contrato digital.
                    </p>
                  </div>

                  <Button
                    size="lg"
                    onClick={() => setModalConfirmarOpen(true)}
                    disabled={!condicaoAtiva}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-6 px-8 text-sm sm:text-base shadow-md shrink-0 gap-2"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Aprovar Orçamento Online
                  </Button>
                </div>

                <div className="flex items-center justify-center sm:justify-start gap-4 text-[11px] text-muted-foreground flex-wrap pt-1">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Ambiente Seguro Criptografado
                  </span>
                  <span>•</span>
                  <span>Sem cobrança imediata no cartão</span>
                  <span>•</span>
                  <span>Válido juridicamente</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rodapé de Atendimento & Contato da Clínica */}
        <footer className="text-center text-xs text-muted-foreground space-y-3 py-4">
          <p>Dúvidas sobre o plano de tratamento ou formas de pagamento?</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {orcamento.clinica.telefone && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleFalarComClinica}
                className="text-xs gap-1.5 border-border"
              >
                <Phone className="h-3.5 w-3.5 text-primary" />
                {orcamento.clinica.telefone}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleFalarComClinica}
              className="text-xs gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp da Clínica
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/80 pt-2">
            © {new Date().getFullYear()} {orcamento.clinica.nome}. Todos os direitos reservados.
          </p>
        </footer>
      </div>

      {/* MODAL 1: Resumo e Confirmação da Aprovação Online */}
      <Dialog open={modalConfirmarOpen} onOpenChange={setModalConfirmarOpen}>
        <DialogContent className="max-w-md w-full p-5 sm:p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Confirmar Aprovação do Orçamento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confira o resumo do seu plano antes de formalizar a aprovação:
            </DialogDescription>
          </DialogHeader>

          {condicaoAtiva && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/60 border border-border/80 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plano de Tratamento:</span>
                  <strong className="text-foreground">{orcamento.titulo}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Procedimentos:</span>
                  <span>{orcamento.itens.length} {orcamento.itens.length === 1 ? 'item' : 'itens'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Condição Escolhida:</span>
                  <strong className="text-primary font-bold">{condicaoAtiva.titulo}</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-border/60">
                  <span className="font-semibold text-foreground">Valor Final do Plano:</span>
                  <strong className="text-base text-emerald-600 font-black">
                    {formatMoney(condicaoAtiva.valorTotal || orcamento.total)}
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <span className="font-bold flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Termo de Aprovação Online
                </span>
                <p className="leading-snug">
                  Ao confirmar, você formaliza a concordância com o plano de tratamento proposto e a condição de pagamento acima. Em seguida, a clínica emitirá o contrato digital de prestação de serviços para assinatura digital pelo seu celular.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalConfirmarOpen(false)}
              disabled={aprovando}
              className="text-xs w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarAprovacao}
              disabled={aprovando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 shadow-sm w-full sm:w-auto"
            >
              {aprovando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gravando Aprovação...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Sim, Confirmar Aprovação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Visualizar Foto do Planejamento Ampliada */}
      <Dialog open={!!fotoAmpliada} onOpenChange={(open) => !open && setFotoAmpliada(null)}>
        <DialogContent className="max-w-2xl w-full p-2 sm:p-4 bg-background border-border">
          {fotoAmpliada && (
            <div className="space-y-3">
              <div className="aspect-4/3 sm:aspect-16/10 rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={fotoAmpliada.url}
                  alt={fotoAmpliada.titulo || 'Foto do Planejamento'}
                  className="max-h-[70vh] w-full object-contain"
                />
              </div>
              <div className="px-2 space-y-0.5">
                <h4 className="font-bold text-sm text-foreground">
                  {fotoAmpliada.titulo || 'Foto do Planejamento'}
                </h4>
                {fotoAmpliada.descricao && (
                  <p className="text-xs text-muted-foreground">{fotoAmpliada.descricao}</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Visualizar Chave e QR Code PIX */}
      <Dialog open={modalPixOpen} onOpenChange={setModalPixOpen}>
        <DialogContent className="max-w-md w-full p-5 text-center space-y-3">
          <DialogHeader className="text-center">
            <DialogTitle className="text-base font-bold text-foreground flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              Pagamento via PIX Oficial
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Aponte a câmera do aplicativo bancário ou copie o código Copia e Cola:
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-white rounded-2xl border-2 border-emerald-400 inline-block mx-auto shadow-xs">
            <img src={qrCodePixUrl} alt="QR Code PIX" className="w-48 h-48 mx-auto block rounded" />
          </div>

          <div className="p-3 bg-muted/60 rounded-xl text-left text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor:</span>
              <strong className="text-emerald-600 text-sm">{formatMoney(valorPix)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Favorecido:</span>
              <span className="font-medium text-foreground">{favorecidoPix}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Chave:</span>
              <span className="font-mono text-foreground font-semibold">{chavePix}</span>
            </div>
          </div>

          <Button
            onClick={handleCopiarPix}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 gap-2 text-xs"
          >
            {copiouPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiouPix ? 'Código Copiado!' : 'Copiar Código Copia e Cola'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}


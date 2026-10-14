import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Download,
  Copy,
  Check,
  ShieldCheck,
  MessageCircle,
  Building2,
  User,
  CreditCard,
  QrCode,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';
import {
  ContratoSnapshot,
  decodificarContratoUrl,
  gerarHtmlContrato,
} from '@/utils/contratoEngine';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';
import { openWhatsApp } from '@/lib/whatsapp';
import { supabase } from '@/integrations/supabase/client';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start py-8 px-4 sm:px-6">
    <div className="w-full max-w-3xl space-y-6">{children}</div>
  </div>
);

export default function AssinarContrato() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const encodedData = searchParams.get('c') || searchParams.get('data');

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ContratoSnapshot | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [concordouTermos, setConcordouTermos] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [copiouPix, setCopiouPix] = useState(false);

  // Carrega os dados do contrato
  useEffect(() => {
    async function carregarContrato() {
      setLoading(true);

      // 1. Tenta decodificar da URL (caso algum link legado ainda contenha o parâmetro ?c=)
      if (encodedData) {
        const decoded = decodificarContratoUrl(encodedData);
        if (decoded) {
          const localCache = localStorage.getItem(`contrato_assinado_${decoded.contratoId}`);
          if (localCache) {
            try {
              const cachedSnap = JSON.parse(localCache);
              setSnapshot(cachedSnap);
              setLoading(false);
              return;
            } catch (_) {}
          }

          setSnapshot(decoded);
          setLoading(false);
          return;
        }
      }

      // 2. Tenta recuperar do localStorage por ID imediato
      if (id) {
        const localCache = localStorage.getItem(`contrato_assinado_${id}`) || localStorage.getItem(`contrato_${id}`);
        if (localCache) {
          try {
            const cachedSnap = JSON.parse(localCache);
            if (cachedSnap) {
              setSnapshot(cachedSnap);
              // Não finaliza imediatamente se ainda puder sincronizar com a nuvem, mas já garante exibição
            }
          } catch (_) {}
        }
      }

      // 3. Tenta buscar via Edge Function pública 'contrato-publico' (funciona sem login no celular de qualquer paciente)
      if (id) {
        try {
          const { data: funcData, error: funcErr } = await supabase.functions.invoke('contrato-publico', {
            body: { action: 'get', id },
          });

          if (!funcErr && funcData?.ok && funcData?.snapshot) {
            const snap = funcData.snapshot as ContratoSnapshot;
            // Se já tem assinatura gravada no banco
            if (funcData.assinadoEm && !snap.assinaturaPaciente) {
              snap.status = 'assinado';
              snap.assinaturaPaciente = {
                assinaturaData: '',
                nome: funcData.assinanteNome || snap.paciente.nome,
                dataHora: funcData.assinadoEm,
              };
            }
            setSnapshot(snap);
            setLoading(false);
            return;
          }
        } catch (edgeErr) {
          console.warn('Edge function contrato-publico indisponível, tentando fallback direto:', edgeErr);
        }
      }

      // 4. Fallback: Tenta buscar diretamente no banco de dados Supabase
      if (id) {
        try {
          const { data, error } = await supabase
            .from('documentos_clinicos')
            .select('*')
            .eq('id', id)
            .maybeSingle();

          if (!error && data && data.itens) {
            setSnapshot(data.itens as ContratoSnapshot);
            setLoading(false);
            return;
          }
        } catch (_) {}
      }

      // Se já tinha carregado do localStorage no passo 2
      if (snapshot) {
        setLoading(false);
        return;
      }

      setLoading(false);
    }

    carregarContrato();
  }, [id, encodedData]);

  // Registra a assinatura digital do paciente
  const handleSignatureComplete = async (sigData: SignatureData) => {
    if (!snapshot) return;

    try {
      const dataHoraIso = new Date().toISOString();
      const updatedSnapshot: ContratoSnapshot = {
        ...snapshot,
        status: 'assinado',
        assinaturaPaciente: {
          assinaturaData: sigData.signature,
          nome: sigData.signerName || snapshot.paciente.nome,
          dataHora: dataHoraIso,
        },
      };

      setSnapshot(updatedSnapshot);
      setShowSignatureModal(false);

      // Salva no localStorage para persistência garantida no navegador do paciente
      localStorage.setItem(`contrato_assinado_${snapshot.contratoId}`, JSON.stringify(updatedSnapshot));
      if (id) {
        localStorage.setItem(`contrato_assinado_${id}`, JSON.stringify(updatedSnapshot));
      }

      // 1. Tenta persistir remotamente via Edge Function pública (sem exigir login)
      let persistiuRemoto = false;
      if (id) {
        try {
          const { data: signRes, error: signErr } = await supabase.functions.invoke('contrato-publico', {
            body: {
              action: 'sign',
              id,
              signature: sigData.signature,
              signerName: sigData.signerName || snapshot.paciente.nome,
            },
          });
          if (!signErr && signRes?.ok) {
            persistiuRemoto = true;
          }
        } catch (edgeErr) {
          console.warn('Erro ao assinar via Edge function:', edgeErr);
        }
      }

      // 2. Fallback: Tenta persistir direto no Supabase caso a tabela permita
      if (id && !persistiuRemoto) {
        try {
          await supabase
            .from('documentos_clinicos')
            .update({
              assinatura_data: sigData.signature,
              assinante_nome: sigData.signerName || snapshot.paciente.nome,
              assinado_em: dataHoraIso,
              itens: updatedSnapshot as any,
            })
            .eq('id', id);
        } catch (dbErr) {
          console.warn('Persistência remota direta silenciosa:', dbErr);
        }
      }

      toast.success('Contrato assinado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar assinatura: ' + (err?.message || 'Tente novamente'));
    }
  };

  // Download do PDF
  const handleBaixarPdf = async () => {
    if (!snapshot) return;
    try {
      setBaixandoPdf(true);
      const html = gerarHtmlContrato(snapshot);
      const filename = `contrato_${snapshot.paciente.nome.replace(/\s+/g, '_')}_${snapshot.contratoId}`;
      await downloadHtmlAsPdf(html, filename);
      toast.success('Download do contrato em PDF concluído!');
    } catch (err) {
      toast.error('Erro ao gerar PDF do contrato');
    } finally {
      setBaixandoPdf(false);
    }
  };

  // Notificar a clínica pelo WhatsApp
  const handleNotificarClinica = () => {
    if (!snapshot) return;
    const telefoneClinica = snapshot.clinica.telefone?.replace(/\D/g, '') || '';
    if (!telefoneClinica) {
      toast.info('Telefone da clínica não informado no contrato.');
      return;
    }

    const mensagem =
      `Olá, equipe da *${snapshot.clinica.nome}*!\n\n` +
      `Aqui é *${snapshot.paciente.nome}*.\n` +
      `Acabei de conferir e realizar a *Assinatura Digital* do meu *Contrato Odontológico* (#${snapshot.contratoId}) referente ao plano de tratamento.\n\n` +
      `• *Valor Total:* ${formatMoney(snapshot.financeiro.total)}\n` +
      `• *Data da Assinatura:* ${snapshot.assinaturaPaciente?.dataHora ? new Date(snapshot.assinaturaPaciente.dataHora).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}\n\n` +
      `Agradeço e aguardo as orientações dos próximos atendimentos!`;

    openWhatsApp(telefoneClinica, mensagem);
  };

  const handleCopiarPix = () => {
    if (!snapshot?.clinica.chavePix) return;
    navigator.clipboard.writeText(snapshot.clinica.chavePix);
    setCopiouPix(true);
    toast.success('Chave PIX copiada para a área de transferência!');
    setTimeout(() => setCopiouPix(false), 2500);
  };

  if (loading) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Carregando contrato...</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Validando os dados e preparando o documento seguro para assinatura.
          </p>
        </Card>
      </Shell>
    );
  }

  if (!snapshot) {
    return (
      <Shell>
        <Card className="p-8 text-center border-destructive/30">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Contrato Não Encontrado</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            O link de assinatura acessado pode ser inválido ou ter expirado. Por favor, solicite um novo link diretamente à equipe da clínica odontológica.
          </p>
        </Card>
      </Shell>
    );
  }

  const isAssinado = !!snapshot.assinaturaPaciente?.assinaturaData;

  return (
    <Shell>
      {/* Topo Oficial com Logo da Clínica */}
      <Card className="overflow-hidden border-border shadow-sm">
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-sm text-blue-100 mb-2">
                <ShieldCheck className="h-3.5 w-3.5" /> Documento Oficial e Válido (Art. 784, III CPC)
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Contrato de Prestação de Serviços Odontológicos
              </h1>
              <p className="text-blue-200 text-xs sm:text-sm mt-0.5">
                {snapshot.clinica.nome} • Identificador: #{snapshot.contratoId}
              </p>
            </div>
            <div>
              {isAssinado ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" /> Assinado Digitalmente
                </Badge>
              ) : (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                  <Clock className="h-4 w-4" /> Pendente de Assinatura
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Card informativo de Assinatura se já concluído */}
        {isAssinado && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-full mt-0.5 shrink-0">
                <FileCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm sm:text-base">
                  Este contrato já foi assinado digitalmente pelo paciente!
                </h3>
                <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Assinado por <strong>{snapshot.assinaturaPaciente?.nome}</strong> em{' '}
                  {snapshot.assinaturaPaciente?.dataHora
                    ? new Date(snapshot.assinaturaPaciente.dataHora).toLocaleString('pt-BR')
                    : 'data registrada'}
                  .
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBaixarPdf}
                disabled={baixandoPdf}
                className="border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
              >
                {baixandoPdf ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                Baixar PDF
              </Button>
              <Button size="sm" onClick={handleNotificarClinica} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Identificação das Partes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <User className="h-3.5 w-3.5 text-primary" /> Contratante (Paciente)
              </div>
              <p className="font-bold text-base text-slate-800 dark:text-slate-100">{snapshot.paciente.nome}</p>
              <p className="text-xs text-muted-foreground mt-1">
                CPF: <span className="font-medium text-slate-700 dark:text-slate-300">{snapshot.paciente.cpf}</span> • RG: {snapshot.paciente.rg}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Telefone: {snapshot.paciente.telefone}</p>
              {snapshot.paciente.endereco && snapshot.paciente.endereco !== 'Não informado' && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">Endereço: {snapshot.paciente.endereco}</p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Building2 className="h-3.5 w-3.5 text-primary" /> Contratada (Clínica)
              </div>
              <p className="font-bold text-base text-slate-800 dark:text-slate-100">{snapshot.clinica.nome}</p>
              <p className="text-xs text-muted-foreground mt-1">
                CNPJ: <span className="font-medium text-slate-700 dark:text-slate-300">{snapshot.clinica.cnpj}</span> • CRO: {snapshot.clinica.cro}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Resp. Técnico: {snapshot.clinica.dentistaResponsavel}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Endereço: {snapshot.clinica.endereco}</p>
            </div>
          </div>

          {/* Resumo Financeiro e Condições de Pagamento */}
          <div className="p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-200/60 pb-3">
              <div>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Valor Total do Tratamento
                </span>
                <p className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {formatMoney(snapshot.financeiro.total)}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium italic">
                  ({snapshot.financeiro.totalExtenso})
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-muted-foreground block">Forma Acordada:</span>
                <Badge variant="outline" className="bg-white dark:bg-slate-900 border-blue-300 text-blue-800 dark:text-blue-300 text-xs font-semibold mt-0.5">
                  {snapshot.financeiro.formaPagamento}
                </Badge>
              </div>
            </div>

            {/* Detalhes de Entrada e Parcelas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {snapshot.financeiro.entrada && snapshot.financeiro.entrada > 0 ? (
                <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40">
                  <span className="text-muted-foreground block">Entrada (PIX):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    {formatMoney(snapshot.financeiro.entrada)}
                  </span>
                </div>
              ) : null}

              {snapshot.financeiro.quantidadeParcelas && snapshot.financeiro.quantidadeParcelas > 1 ? (
                <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40">
                  <span className="text-muted-foreground block">Parcelamento Restante:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                    {snapshot.financeiro.quantidadeParcelas}x de {formatMoney(snapshot.financeiro.valorParcela)}
                  </span>
                </div>
              ) : null}

              <div className="p-2.5 rounded bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40">
                <span className="text-muted-foreground block">Dia de Vencimento:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  Todo dia {snapshot.orcamento.validade ? (snapshot.orcamento.validade.match(/\d+/) || [10])[0] : 10} do mês
                </span>
              </div>
            </div>

            {/* Chave PIX Oficial da Clínica */}
            {snapshot.clinica.chavePix && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide block">
                      Dados para Pagamento via PIX Oficial
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-900 dark:text-emerald-100 select-all">
                      {snapshot.clinica.chavePix}
                    </span>
                    {(snapshot.clinica.favorecidoPix || snapshot.clinica.cnpjCpfFavorecidoPix) && (
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                        Favorecido: <strong>{snapshot.clinica.favorecidoPix || snapshot.clinica.nome}</strong>
                        {snapshot.clinica.cnpjCpfFavorecidoPix && ` • ${snapshot.clinica.cnpjCpfFavorecidoPix}`}
                        {snapshot.clinica.bancoPix && ` • ${snapshot.clinica.bancoPix}`}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopiarPix}
                  className="border-emerald-300 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 self-start sm:self-center"
                >
                  {copiouPix ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                  {copiouPix ? 'Chave Copiada!' : 'Copiar Chave PIX'}
                </Button>
              </div>
            )}
          </div>

          {/* Procedimentos Inclusos */}
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Procedimentos Aprovados no Plano de Tratamento
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900 text-muted-foreground border-b font-medium text-left">
                  <tr>
                    <th className="p-2.5 sm:p-3">Procedimento</th>
                    <th className="p-2.5 sm:p-3 text-center">Qtd / Região</th>
                    <th className="p-2.5 sm:p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {snapshot.orcamento.itens.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-2.5 sm:p-3 font-medium text-slate-800 dark:text-slate-200">{item.nome}</td>
                      <td className="p-2.5 sm:p-3 text-center text-muted-foreground">
                        {item.quantidade}x {item.denteOuRegiao ? `(${item.denteOuRegiao})` : ''}
                      </td>
                      <td className="p-2.5 sm:p-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                        {formatMoney(item.valorTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {snapshot.orcamento.observacoes && snapshot.orcamento.observacoes.trim() && (
              <div className="mt-3 p-3.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide text-[11px] mb-1">
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Observações do Orçamento / Recomendações:
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {snapshot.orcamento.observacoes}
                </p>
              </div>
            )}
          </div>

          {/* Cláusulas Legais (Visualizador Retrátil / Scrollável) */}
          <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-900 text-xs space-y-3 max-h-60 overflow-y-auto">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide text-xs">
              Resumo das Cláusulas Contratuais (Art. 784, III CPC)
            </h4>
            <p className="text-slate-600 dark:text-slate-400">
              <strong>CLÁUSULA 1ª — DO OBJETO:</strong> A CONTRATADA obriga-se a prestar assistência odontológica ao CONTRATANTE conforme os procedimentos discriminados neste termo e ficha clínica.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              <strong>CLÁUSULA 2ª — DO VALOR TOTAL:</strong> Pelos serviços acordados, o CONTRATANTE pagará a quantia líquida total de {formatMoney(snapshot.financeiro.total)} ({snapshot.financeiro.totalExtenso}).
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              <strong>CLÁUSULA 3ª — DAS CONDIÇÕES E PIX:</strong> O pagamento seguirá as condições acordadas ({snapshot.financeiro.formaPagamento}), devendo os comprovantes ser encaminhados via canal oficial para quitação e baixa.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              <strong>CLÁUSULA 4ª — DO TÍTULO EXECUTIVO EXTRAJUDICIAL:</strong> O presente contrato possui força executiva extrajudicial conforme previsto no Artigo 784, inciso III do Código de Processo Civil.
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              <strong>CLÁUSULA 5ª — DO FORO:</strong> As partes elegem o foro da Comarca de {snapshot.clinica.cidade || 'domicílio da clínica'} para dirimir quaisquer dúvidas oriundas deste instrumento.
            </p>
          </div>

          {/* Área de Assinatura Interativa */}
          {!isAssinado ? (
            <div className="p-5 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 space-y-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="concordo"
                  checked={concordouTermos}
                  onCheckedChange={(c) => setConcordouTermos(!!c)}
                  className="mt-0.5"
                />
                <label
                  htmlFor="concordo"
                  className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-medium cursor-pointer select-none leading-relaxed"
                >
                  Declaro que li e estou de acordo com todos os termos, procedimentos odontológicos, valores e condições de pagamento estipulados neste Contrato de Prestação de Serviços Odontológicos.
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  disabled={!concordouTermos}
                  onClick={() => setShowSignatureModal(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-6 text-base shadow-md"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Assinar Contrato Digitalmente Agora
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-center space-y-3">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
              <div>
                <h4 className="font-bold text-emerald-900 dark:text-emerald-100 text-base">
                  Assinatura Digital Registrada com Validade Jurídica
                </h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  Assinante: {snapshot.assinaturaPaciente?.nome} • Registrado em{' '}
                  {snapshot.assinaturaPaciente?.dataHora
                    ? new Date(snapshot.assinaturaPaciente.dataHora).toLocaleString('pt-BR')
                    : 'data registrada'}
                </p>
              </div>

              {snapshot.assinaturaPaciente?.assinaturaData && (
                <div className="inline-block p-2 bg-white rounded border border-emerald-200 mt-2">
                  <img
                    src={snapshot.assinaturaPaciente.assinaturaData}
                    alt="Assinatura do Paciente"
                    className="max-h-20 object-contain mx-auto"
                  />
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button onClick={handleBaixarPdf} disabled={baixandoPdf} variant="outline" className="border-emerald-300">
                  {baixandoPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Baixar Contrato em PDF
                </Button>
                <Button onClick={handleNotificarClinica} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Confirmar pelo WhatsApp
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Assinatura Digital do Canvas */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl">
            <DigitalSignature
              title="Assinatura Digital do Contrato"
              signerName={snapshot.paciente.nome}
              signerRole="paciente"
              documentType="contrato"
              onSignatureComplete={handleSignatureComplete}
              onCancel={() => setShowSignatureModal(false)}
            />
          </div>
        </div>
      )}
    </Shell>
  );
}

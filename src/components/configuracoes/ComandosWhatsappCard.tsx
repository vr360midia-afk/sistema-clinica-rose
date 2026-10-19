import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Copy,
  Check,
  Send,
  Sparkles,
  Link as LinkIcon,
  UserPlus,
  FileCheck2,
  Phone,
  Terminal,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import { parsearComandoWhatsApp } from '@/utils/whatsappComandoParser';
import { processarComandoCriarFicha, ResultadoComandoWhatsApp } from '@/services/whatsappComandoService';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useNavigate } from 'react-router-dom';

interface ComandosWhatsappCardProps {
  onPacienteCriado?: (pacienteId: string) => void;
  compacto?: boolean;
}

const EXEMPLOS_COMANDOS = [
  {
    titulo: 'Linha Única com Vírgulas (Mais Rápido)',
    descricao: 'Ideal para digitar rápido no celular',
    comando: '#paciente Mariana Costa, (82) 99999-8888, 123.456.789-00',
  },
  {
    titulo: 'Apenas Nome e Telefone',
    descricao: 'O CPF e a queixa podem ser preenchidos depois',
    comando: '#ficha Carlos Eduardo | 82988887777',
  },
  {
    titulo: 'Com Queixa / Motivo da Consulta',
    descricao: 'Já anota a queixa na ficha e na anamnese',
    comando: '#paciente Ana Beatriz, 82991234567, 111.222.333-44, Avaliação de Lentes em Resina',
  },
  {
    titulo: 'Formato Detalhado (Chave: Valor)',
    descricao: 'Perfeito para colar formulários ou dados completos',
    comando: `#paciente
Nome: Roberto Carlos Silva
Telefone: (82) 99345-6789
CPF: 345.678.901-22
Queixa: Fechamento de diastema`,
  },
  {
    titulo: 'Linguagem Natural',
    descricao: 'Sem precisar lembrar de símbolos',
    comando: 'Cadastrar paciente: Gabriela Silveira, 82987654321',
  },
];

export const ComandosWhatsappCard: React.FC<ComandosWhatsappCardProps> = ({
  onPacienteCriado,
  compacto = false,
}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { refreshData } = useDentalSystem();

  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const [copiouWebhook, setCopiouWebhook] = useState(false);
  const [copiouResposta, setCopiouResposta] = useState(false);

  // Simulador
  const [comandoTexto, setComandoTexto] = useState(
    '#paciente Mariana Costa, (82) 99999-8888, 123.456.789-00, Avaliação de Facetas'
  );
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoComandoWhatsApp | null>(null);

  const webhookUrl =
    'https://pfdzghpmswqqvswqlnpx.supabase.co/functions/v1/whatsapp-comando-paciente';

  // Preview em tempo real da análise sintática
  const previewParsed = useMemo(() => {
    return parsearComandoWhatsApp(comandoTexto);
  }, [comandoTexto]);

  const copiarTexto = (texto: string, callback: () => void) => {
    navigator.clipboard.writeText(texto);
    callback();
    toast({
      title: 'Copiado para a área de transferência!',
      description: 'Você pode colar diretamente no WhatsApp ou em seu webhook.',
    });
  };

  const handleExecutarComando = async () => {
    if (!comandoTexto.trim()) {
      toast({
        title: 'Comando em branco',
        description: 'Digite um comando para simular a criação da ficha.',
        variant: 'destructive',
      });
      return;
    }

    setExecutando(true);
    setResultado(null);

    try {
      const res = await processarComandoCriarFicha(comandoTexto);
      setResultado(res);

      if (res.success) {
        toast({
          title: res.jaExistia ? 'Paciente Já Existia' : 'Ficha Criada com Sucesso!',
          description: `Paciente ${res.paciente?.nome} ${res.jaExistia ? 'encontrado' : 'cadastrado'} na plataforma.`,
        });

        // Atualiza a lista global de pacientes
        if (refreshData) {
          refreshData();
        }

        if (onPacienteCriado && res.paciente?.id) {
          onPacienteCriado(res.paciente.id);
        }
      } else {
        toast({
          title: 'Não foi possível criar',
          description: res.erro || 'Verifique o formato do comando.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao executar',
        description: err.message || 'Falha na comunicação com o banco.',
        variant: 'destructive',
      });
    } finally {
      setExecutando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner Principal com Identidade WhatsApp */}
      <Card className="border-emerald-200 dark:border-emerald-900/60 bg-gradient-to-br from-emerald-50/70 via-background to-teal-50/40 dark:from-emerald-950/20 dark:via-background dark:to-teal-950/10 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-emerald-100 dark:border-emerald-900/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold text-foreground">
                    Criação de Fichas via WhatsApp
                  </CardTitle>
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-[11px] font-semibold">
                    Automação Ativa
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Envie mensagens no WhatsApp e a plataforma cria o paciente, a ficha e o link da anamnese digital na hora.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs">
                ✨ Resposta Automática com Link
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-6">
          {/* Como Funciona em 3 Passos */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-background/80 border border-emerald-100 dark:border-emerald-900/40 shadow-2xs flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-sm">
                1
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Envie o Comando</p>
                <p className="text-muted-foreground mt-0.5">
                  No WhatsApp da clínica, envie <code className="text-emerald-700 dark:text-emerald-400 font-bold">#paciente Nome, Tel, CPF</code>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-background/80 border border-emerald-100 dark:border-emerald-900/40 shadow-2xs flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-sm">
                2
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Plataforma Cria a Ficha</p>
                <p className="text-muted-foreground mt-0.5">
                  O paciente é cadastrado no prontuário e uma ficha de anamnese digital é gerada com token único.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-background/80 border border-emerald-100 dark:border-emerald-900/40 shadow-2xs flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center shrink-0 text-sm">
                3
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">Confirmação Instantânea</p>
                <p className="text-muted-foreground mt-0.5">
                  Você recebe a confirmação no WhatsApp com o link direto para o paciente assinar ou preencher.
                </p>
              </div>
            </div>
          </div>

          {/* Modelos de Comandos Suportados */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                Formatos de Mensagens Reconhecidos
              </h3>
              <span className="text-[11px] text-muted-foreground">Clique para testar no simulador</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              {EXEMPLOS_COMANDOS.map((ex, idx) => (
                <div
                  key={idx}
                  onClick={() => setComandoTexto(ex.comando)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all hover:border-emerald-400 hover:shadow-xs group ${
                    comandoTexto === ex.comando
                      ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30'
                      : 'border-border bg-background'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {ex.titulo}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[11px] text-muted-foreground hover:text-emerald-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        copiarTexto(ex.comando, () => {
                          setCopiadoIdx(idx);
                          setTimeout(() => setCopiadoIdx(null), 2000);
                        });
                      }}
                    >
                      {copiadoIdx === idx ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-600 mr-1" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                  <pre className="font-mono text-[11px] bg-muted/60 dark:bg-muted/30 p-2 rounded-lg whitespace-pre-wrap break-all text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                    {ex.comando}
                  </pre>
                  <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center justify-between">
                    <span>{ex.descricao}</span>
                    <span className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-medium">
                      Usar no simulador <ChevronRight className="h-3 w-3" />
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Simulador Interativo de Comandos */}
          <div className="pt-2">
            <Card className="border-2 border-emerald-300 dark:border-emerald-800/80 bg-background shadow-xs overflow-hidden">
              <CardHeader className="py-3 px-4 bg-emerald-100/40 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Simulador de Comandos WhatsApp
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[11px] bg-background border-emerald-300 text-emerald-700 dark:text-emerald-400">
                    Cria paciente real na plataforma
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inputComando" className="text-xs font-semibold flex items-center justify-between">
                    <span>Mensagem que seria enviada pelo WhatsApp:</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Edite livremente para testar
                    </span>
                  </Label>
                  <Textarea
                    id="inputComando"
                    rows={compacto ? 2 : 3}
                    value={comandoTexto}
                    onChange={(e) => setComandoTexto(e.target.value)}
                    placeholder="Ex: #paciente Mariana Costa, (82) 99999-8888, 123.456.789-00"
                    className="font-mono text-xs resize-none border-emerald-200 focus:border-emerald-500"
                  />
                </div>

                {/* Tag de Reconhecimento em Tempo Real */}
                <div className="p-3 rounded-lg bg-muted/40 border border-border flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground font-semibold">Identificado:</span>
                  {previewParsed.nome ? (
                    <Badge variant="outline" className="bg-background text-emerald-700 dark:text-emerald-300 border-emerald-300">
                      👤 {previewParsed.nome}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[11px]">
                      ⚠️ Nome não identificado
                    </Badge>
                  )}
                  {previewParsed.telefone && (
                    <Badge variant="outline" className="bg-background text-blue-700 dark:text-blue-300 border-blue-300">
                      📱 {previewParsed.telefone}
                    </Badge>
                  )}
                  {previewParsed.cpf && (
                    <Badge variant="outline" className="bg-background text-purple-700 dark:text-purple-300 border-purple-300">
                      🆔 CPF: {previewParsed.cpf}
                    </Badge>
                  )}
                  {previewParsed.queixaPrincipal && (
                    <Badge variant="outline" className="bg-background text-amber-700 dark:text-amber-300 border-amber-300 max-w-xs truncate">
                      🩺 {previewParsed.queixaPrincipal}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    Ao clicar no botão, a ficha é salva no banco e a resposta é gerada na hora.
                  </p>
                  <Button
                    onClick={handleExecutarComando}
                    disabled={executando || !previewParsed.nome}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 px-4 gap-2 shadow-xs cursor-pointer"
                  >
                    {executando ? (
                      <>Criando Ficha...</>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Executar Comando
                      </>
                    )}
                  </Button>
                </div>

                {/* Balão de Resposta do WhatsApp */}
                {resultado && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Resposta Enviada de Volta no WhatsApp:
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-emerald-600"
                        onClick={() =>
                          copiarTexto(resultado.respostaWhatsApp || '', () => {
                            setCopiouResposta(true);
                            setTimeout(() => setCopiouResposta(false), 2000);
                          })
                        }
                      >
                        {copiouResposta ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600 mr-1" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            Copiar Resposta
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Visual de Bolha do WhatsApp */}
                    <div className="max-w-xl mx-auto p-4 rounded-2xl rounded-tl-none bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 text-xs font-sans shadow-md space-y-2">
                      <pre className="font-sans whitespace-pre-wrap leading-relaxed text-xs">
                        {resultado.respostaWhatsApp}
                      </pre>
                      <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-emerald-200 dark:border-emerald-800/80">
                        {resultado.linkAnamnese && (
                          <a
                            href={resultado.linkAnamnese}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Testar Link da Anamnese
                          </a>
                        )}
                        {resultado.paciente?.id && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => navigate(`/pacientes?id=${resultado.paciente?.id}`)}
                            className="h-6 text-[11px] bg-white dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50"
                          >
                            Abrir Prontuário na Plataforma
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Integração de Webhook Externa (Evolution API, Z-API, Meta Cloud API, Make, n8n) */}
          <div className="pt-2">
            <div className="p-4 rounded-xl bg-slate-900 text-slate-100 dark:bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Webhook Endpoint para Conexão Externa
                  </span>
                </div>
                <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                  Evolution API • Z-API • Meta API • Make • n8n
                </Badge>
              </div>

              <p className="text-xs text-slate-300">
                Se você utiliza Evolution API, Z-API ou um bot externo de WhatsApp, configure a URL abaixo como webhook de mensagens recebidas:
              </p>

              <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="bg-transparent font-mono text-xs text-emerald-400 w-full outline-none"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 shrink-0"
                  onClick={() =>
                    copiarTexto(webhookUrl, () => {
                      setCopiouWebhook(true);
                      setTimeout(() => setCopiouWebhook(false), 2000);
                    })
                  }
                >
                  {copiouWebhook ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400 mr-1" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Copiar URL
                    </>
                  )}
                </Button>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <p>• <strong>Método HTTP:</strong> POST</p>
                <p>• <strong>Payload JSON aceito:</strong> <code>{`{ "texto": "#paciente Maria, 82999998888", "from": "5582999998888" }`}</code></p>
                <p>• <strong>Retorno:</strong> JSON com <code>linkAnamnese</code> e <code>respostaWhatsApp</code> pronta para envio.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComandosWhatsappCard;

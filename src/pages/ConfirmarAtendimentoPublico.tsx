import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Stethoscope,
  PenTool,
  RotateCcw,
  Download,
  AlertTriangle,
  Building2,
  Check,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function ConfirmarAtendimentoPublico() {
  const { token: tokenParam } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = tokenParam || searchParams.get('token') || '';

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dadosSessao, setDadosSessao] = useState<any>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Form states
  const [assinanteNome, setAssinanteNome] = useState<string>('');
  const [assinanteCpf, setAssinanteCpf] = useState<string>('');
  const [observacoesPaciente, setObservacoesPaciente] = useState<string>('');
  const [concordaRealizacao, setConcordaRealizacao] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [sucessoAssinatura, setSucessoAssinatura] = useState<any>(null);

  // Canvas para assinatura eletrônica
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasDrawn, setHasDrawn] = useState<boolean>(false);
  const isDrawing = useRef<boolean>(false);

  useEffect(() => {
    async function carregarDados() {
      if (!token) {
        setErro('Token de confirmação não fornecido.');
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('obter_confirmacao_sessao_publica', {
          p_token: token,
        });

        if (error) throw error;
        if (!data || !data.valido) {
          setErro(data?.erro || 'Link de confirmação inválido ou expirado.');
        } else {
          setDadosSessao(data);
          if (data.paciente_nome) {
            setAssinanteNome(data.paciente_nome);
          }
          if (data.ja_assinado) {
            setSucessoAssinatura({
              assinado_em: data.assinado_em,
              assinante_nome: data.assinante_nome,
              observacoes_paciente: data.observacoes_paciente,
            });
          }
        }
      } catch (err: any) {
        setErro(err.message || 'Erro ao carregar link de atendimento.');
      } finally {
        setIsLoading(false);
      }
    }

    carregarDados();
  }, [token]);

  // Funções do Canvas de Assinatura
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasDrawn) {
      toast.error('Por favor, assine no campo indicado com o dedo ou mouse.');
      return;
    }
    if (!assinanteNome.trim()) {
      toast.error('Informe seu nome completo.');
      return;
    }

    const canvas = canvasRef.current;
    const assinaturaBase64 = canvas ? canvas.toDataURL('image/png') : '';

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('assinar_confirmacao_sessao_publica', {
        p_token: token,
        p_assinatura_base64: assinaturaBase64,
        p_assinante_nome: assinanteNome.trim(),
        p_assinante_cpf: assinanteCpf.trim() || null,
        p_observacoes_paciente: observacoesPaciente.trim() || null,
        p_concorda: concordaRealizacao,
        p_ip: null,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

      if (error) throw error;
      if (!data || !data.sucesso) {
        throw new Error(data?.erro || 'Falha ao registrar assinatura.');
      }

      setSucessoAssinatura(data);
      toast.success('Atendimento confirmado e assinado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao assinar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start py-6 px-3 sm:px-6">
      <div className="w-full max-w-xl space-y-4">
        {/* Cabeçalho da Clínica */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 mb-1">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Clínica Dra. Rosângela</h1>
          <p className="text-xs text-muted-foreground">Sistema de Confirmação Digital de Atendimento Odontológico</p>
        </div>

        {isLoading ? (
          <Card className="border-border shadow-xs">
            <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <Clock className="h-6 w-6 animate-spin mx-auto text-muted-foreground/60" />
              <p>Carregando dados do atendimento...</p>
            </CardContent>
          </Card>
        ) : erro ? (
          <Card className="border-destructive/30 bg-destructive/5 shadow-xs">
            <CardContent className="py-8 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground text-base">Link Não Disponível</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">{erro}</p>
              </div>
            </CardContent>
          </Card>
        ) : sucessoAssinatura ? (
          <Card className="border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-xs">
            <CardContent className="py-8 text-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">Atendimento Confirmado com Sucesso!</h2>
                <p className="text-xs text-muted-foreground">
                  Sua confirmação eletrônica foi registrada no prontuário da Clínica Rosângela com segurança e fé pública.
                </p>
              </div>

              <div className="p-3.5 bg-card border border-border rounded-lg text-left text-xs space-y-1.5 font-mono">
                <div>
                  <span className="text-muted-foreground">Assinado por: </span>
                  <span className="font-semibold text-foreground">{sucessoAssinatura.assinante_nome || assinanteNome}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data/Hora: </span>
                  <span className="text-foreground">
                    {sucessoAssinatura.assinado_em
                      ? new Date(sucessoAssinatura.assinado_em).toLocaleString('pt-BR')
                      : new Date().toLocaleString('pt-BR')}
                  </span>
                </div>
                {sucessoAssinatura.hash_integridade && (
                  <div className="truncate">
                    <span className="text-muted-foreground">Hash SHA-256: </span>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-300">{sucessoAssinatura.hash_integridade}</span>
                  </div>
                )}
                {sucessoAssinatura.observacoes_paciente && (
                  <div className="pt-1.5 border-t border-border font-sans text-amber-800 dark:text-amber-300">
                    <strong>Observações registradas:</strong> {sucessoAssinatura.observacoes_paciente}
                  </div>
                )}
              </div>

              <div className="pt-2 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 inline mr-1 text-emerald-600" />
                Documento arquivado com protocolo de integridade digital.
              </div>
            </CardContent>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Card className="border-border shadow-xs">
              <CardHeader className="p-4 sm:p-5 bg-muted/30 border-b border-border space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge className="bg-emerald-600 text-white text-[11px]">Sessão {dadosSessao.numero_sessao}</Badge>
                  <span className="text-xs text-muted-foreground font-mono">
                    📅 {dadosSessao.data_realizada ? new Date(dadosSessao.data_realizada + 'T12:00:00').toLocaleDateString('pt-BR') : ''}
                  </span>
                </div>
                <CardTitle className="text-base sm:text-lg font-bold text-foreground">
                  {dadosSessao.procedimento_nome}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  {dadosSessao.nome_objetivo}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4 text-xs">
                {/* Resumo do Atendimento */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg border border-border">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Paciente:</span>
                    <strong className="text-foreground">{dadosSessao.paciente_nome}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Profissional Responsável:</span>
                    <strong className="text-foreground">{dadosSessao.profissional_nome}</strong>
                  </div>
                </div>

                {dadosSessao.descricao_atos && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-medium text-[11px]">Atos Clínicos Praticados:</span>
                    <div className="p-3 bg-card border border-border rounded-lg text-foreground italic">
                      "{dadosSessao.descricao_atos}"
                    </div>
                  </div>
                )}

                {/* Declaração Objetiva de Comparecimento */}
                <div className="p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-300 text-xs">
                    <ShieldCheck className="h-4 w-4" />
                    Declaração de Realização do Atendimento
                  </div>
                  <p className="text-emerald-900/90 dark:text-emerald-300/80 leading-relaxed text-[11.5px]">
                    {dadosSessao.declaracao_texto}
                  </p>
                </div>

                {/* Campo para Observações ou Divergências */}
                <div className="space-y-1.5">
                  <Label htmlFor="obs-paciente" className="font-semibold text-foreground">
                    Observações ou Discordâncias do Paciente (Opcional)
                  </Label>
                  <Textarea
                    id="obs-paciente"
                    rows={3}
                    placeholder="Caso discorde de alguma informação ou deseje registrar um comentário sobre o atendimento, digite aqui antes de assinar..."
                    value={observacoesPaciente}
                    onChange={e => setObservacoesPaciente(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Você tem total liberdade para registrar ressalvas. O registro constará integralmente no comprovante.
                  </p>
                </div>

                {/* Dados de Identificação */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <Label htmlFor="nome-ass">Seu Nome Completo *</Label>
                    <Input
                      id="nome-ass"
                      value={assinanteNome}
                      onChange={e => setAssinanteNome(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="cpf-ass">Seu CPF (Opcional)</Label>
                    <Input
                      id="cpf-ass"
                      placeholder="000.000.000-00"
                      value={assinanteCpf}
                      onChange={e => setAssinanteCpf(e.target.value)}
                    />
                  </div>
                </div>

                {/* Campo de Assinatura Canvas */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1 font-semibold text-foreground">
                      <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                      Assine no quadro abaixo (com o dedo na tela ou mouse) *
                    </Label>
                    {hasDrawn && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={limparAssinatura}
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  <div className="border-2 border-dashed border-border rounded-lg bg-card p-1 text-center touch-none">
                    <canvas
                      ref={canvasRef}
                      width={500}
                      height={150}
                      className="w-full h-[140px] cursor-crosshair rounded bg-white dark:bg-slate-900"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    {!hasDrawn && (
                      <p className="text-[11px] text-muted-foreground/60 py-0.5">
                        👆 Desenhe sua assinatura acima
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="p-4 sm:p-5 bg-muted/20 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  🔒 Conexão segura criptografada com validade jurídica.
                </p>
                <Button
                  type="submit"
                  disabled={isSubmitting || !hasDrawn}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 h-10 px-6"
                >
                  <Check className="h-4 w-4" />
                  {isSubmitting ? 'Registrando Assinatura...' : 'Confirmar e Assinar Atendimento'}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}
      </div>
    </div>
  );
}

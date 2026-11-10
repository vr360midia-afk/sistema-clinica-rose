import React, { useState, useEffect, useRef, useCallback } from 'react';
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

/**
 * Validador bitmap estrito: verifica se o canvas possui traço gráfico real
 * (mínimo de 15 pixels não transparentes). Rejeita canvas limpo, transparente
 * ou toques acidentais pontuais, permitindo rubricas simples e iniciais.
 */
function isCanvasSignValid(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width === 0 || canvas.height === 0) return false;
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    let drawnPixels = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 30) {
        drawnPixels++;
        if (drawnPixels >= 15) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Converte o ImageData do canvas em uma máscara monocromática 1-bit BMP sem compressão.
 * Permite ao PostgreSQL no backend inspecionar e contar cada pixel desenhado diretamente.
 */
function generate1BitBmpMask(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx || canvas.width === 0 || canvas.height === 0) return '';
  const width = canvas.width;
  const height = canvas.height;
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  const rowBytes = Math.ceil(width / 8);
  const rowPadding = (4 - (rowBytes % 4)) % 4;
  const stride = rowBytes + rowPadding;
  const pixelArraySize = stride * height;
  const fileSize = 14 + 40 + 8 + pixelArraySize;

  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // BM magic
  buf[0] = 0x42; buf[1] = 0x4d;
  view.setUint32(2, fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, 14 + 40 + 8, true);

  // DIB Header
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true); // 1 plane
  view.setUint16(28, 1, true); // 1 bit per pixel
  view.setUint32(30, 0, true); // BI_RGB
  view.setUint32(34, pixelArraySize, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  view.setUint32(46, 2, true);
  view.setUint32(50, 0, true);

  // Color 0: White (RGB 255, 255, 255, 0)
  buf[54] = 255; buf[55] = 255; buf[56] = 255; buf[57] = 0;
  // Color 1: Black (RGB 0, 0, 0, 0)
  buf[58] = 0; buf[59] = 0; buf[60] = 0; buf[61] = 0;

  // Pixels (bottom-up BMP)
  const pixelOffset = 62;
  for (let y = 0; y < height; y++) {
    const srcY = height - 1 - y;
    const rowStart = pixelOffset + y * stride;
    for (let x = 0; x < width; x++) {
      const srcIdx = (srcY * width + x) * 4;
      const alpha = data[srcIdx + 3];
      if (alpha > 30) {
        const byteIdx = rowStart + (x >> 3);
        const bitIdx = 7 - (x & 7);
        buf[byteIdx] |= (1 << bitIdx);
      }
    }
  }

  let binary = '';
  const len = buf.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return `data:image/bmp;base64,${btoa(binary)}`;
}

interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

function computeBiometrics(strokes: StrokePoint[][]) {
  let totalPoints = 0;
  let totalLength = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let firstTime = Infinity, lastTime = -Infinity;
  let inflections = 0;

  for (const stroke of strokes) {
    totalPoints += stroke.length;
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      if (p.t < firstTime) firstTime = p.t;
      if (p.t > lastTime) lastTime = p.t;

      if (i >= 2) {
        const p0 = stroke[i - 2];
        const p1 = stroke[i - 1];
        const p2 = p;
        const dx1 = p1.x - p0.x;
        const dy1 = p1.y - p0.y;
        const dx2 = p2.x - p1.x;
        const dy2 = p2.y - p1.y;
        const cross = dx1 * dy2 - dy1 * dx2;
        if (Math.abs(cross) > 8) {
          inflections++;
        }
      }
      if (i >= 1) {
        const prev = stroke[i - 1];
        totalLength += Math.hypot(p.x - prev.x, p.y - prev.y);
      }
    }
  }

  return {
    stroke_count: strokes.length,
    point_count: totalPoints,
    total_length: Math.round(totalLength),
    bbox: {
      width: maxX >= minX ? Math.round(maxX - minX) : 0,
      height: maxY >= minY ? Math.round(maxY - minY) : 0,
    },
    duration_ms: lastTime >= firstTime ? (lastTime - firstTime) : 0,
    inflections,
  };
}

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

  // Canvas para assinatura eletrônica de alta fidelidade
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hasValidSignature, setHasValidSignature] = useState<boolean>(false);
  const isDrawing = useRef<boolean>(false);
  const activePointerId = useRef<number | null>(null);
  const strokesRef = useRef<StrokePoint[][]>([]);
  const currentStrokeRef = useRef<StrokePoint[]>([]);

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

  // Configuração e calibração de dimensões com devicePixelRatio
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (canvas.width === targetW && canvas.height === targetH) {
      return;
    }

    let savedDataUrl: string | null = null;
    if (canvas.width > 0 && canvas.height > 0 && isCanvasSignValid(canvas)) {
      savedDataUrl = canvas.toDataURL('image/png');
    }

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';

      // Redesenho síncrono e perfeito a partir dos traços vetoriais
      if (strokesRef.current.length > 0) {
        for (const stroke of strokesRef.current) {
          if (stroke.length === 0) continue;
          ctx.beginPath();
          ctx.moveTo(stroke[0].x, stroke[0].y);
          for (let i = 1; i < stroke.length; i++) {
            ctx.lineTo(stroke[i].x, stroke[i].y);
          }
          ctx.stroke();
        }
        setHasValidSignature(true);
      } else if (savedDataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          setHasValidSignature(true);
        };
        img.src = savedDataUrl;
      }
    }
  }, []);

  useEffect(() => {
    if (dadosSessao && !sucessoAssinatura) {
      const timer = setTimeout(setupCanvas, 60);
      window.addEventListener('resize', setupCanvas);
      window.addEventListener('orientationchange', setupCanvas);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', setupCanvas);
        window.removeEventListener('orientationchange', setupCanvas);
      };
    }
  }, [dadosSessao, sucessoAssinatura, setupCanvas]);

  // Manipuladores unificados com Pointer Events
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawing.current = true;
    activePointerId.current = e.pointerId;
    currentStrokeRef.current = [{ x: Math.round(x), y: Math.round(y), t: Date.now() }];

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.push({ x: Math.round(x), y: Math.round(y), t: Date.now() });

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    activePointerId.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (currentStrokeRef.current.length > 0) {
      strokesRef.current.push([...currentStrokeRef.current]);
      currentStrokeRef.current = [];
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const valid = isCanvasSignValid(canvas);
      setHasValidSignature(valid);
    }
  };

  const limparAssinatura = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    strokesRef.current = [];
    currentStrokeRef.current = [];
    setHasValidSignature(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || !isCanvasSignValid(canvas)) {
      toast.error('Por favor, assine no campo indicado com o dedo, caneta ou mouse antes de confirmar.');
      return;
    }
    if (!assinanteNome.trim()) {
      toast.error('Informe seu nome completo.');
      return;
    }

    const mascaraBmp = generate1BitBmpMask(canvas);
    const biometria = computeBiometrics(strokesRef.current);

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('assinar_confirmacao_sessao_publica', {
        p_token: token,
        p_assinatura_base64: mascaraBmp,
        p_assinante_nome: assinanteNome.trim(),
        p_assinante_cpf: assinanteCpf.trim() || null,
        p_observacoes_paciente: observacoesPaciente.trim() || null,
        p_concorda: concordaRealizacao,
        p_ip: null,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        p_mascara_alfa: mascaraBmp,
        p_metadados_biometricos: biometria,
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
                <div className="space-y-2 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <Label className="flex items-center gap-1 font-semibold text-foreground text-xs">
                        <PenTool className="h-3.5 w-3.5 text-emerald-600" />
                        Assine no quadro abaixo (dedo, caneta ou mouse) *
                      </Label>
                      {hasValidSignature ? (
                        <Badge
                          variant="outline"
                          className="text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-[10.5px] gap-1 px-2 py-0.5"
                        >
                          <Check className="h-3 w-3" /> Assinatura preenchida
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-[10.5px] gap-1 px-2 py-0.5"
                        >
                          <AlertTriangle className="h-3 w-3" /> Assinatura obrigatória
                        </Badge>
                      )}
                    </div>
                    {hasValidSignature && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={limparAssinatura}
                        className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive gap-1"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  <div className="relative border-2 border-dashed border-border rounded-lg bg-card p-1 text-center select-none overflow-hidden">
                    <canvas
                      ref={canvasRef}
                      style={{
                        touchAction: 'none',
                        width: '100%',
                        height: '140px',
                        display: 'block',
                      }}
                      className="w-full h-[140px] cursor-crosshair rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner"
                      onPointerDown={handlePointerDown}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    />
                    {!hasValidSignature && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <p className="text-[11.5px] text-muted-foreground/60 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-xs">
                          ✍️ Toque com o dedo ou clique e arraste para desenhar sua assinatura
                        </p>
                      </div>
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
                  disabled={isSubmitting || !hasValidSignature}
                  className={`w-full sm:w-auto font-semibold text-xs gap-1.5 h-10 px-6 transition-all ${
                    hasValidSignature
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                      : 'bg-muted text-muted-foreground opacity-60 cursor-not-allowed'
                  }`}
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


import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  PenTool,
  Trash2,
  Save,
  User,
  Camera,
  CheckCircle2,
  RotateCcw,
  Upload,
  ShieldCheck,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

export interface SignatureData {
  signature: string; // Base64 da rubrica desenhada
  signerName: string;
  signerRole: 'paciente' | 'dentista';
  timestamp: Date;
  documentType: string;
  selfie?: string; // Base64 da foto selfie
  signerInfo?: {
    nomeCompleto?: string;
    email?: string;
    cpf?: string;
    rg?: string;
    selfie?: string;
  };
}

interface DigitalSignatureProps {
  title?: string;
  signerName: string;
  signerRole: 'paciente' | 'dentista';
  documentType: 'anamnese' | 'orcamento' | 'contrato' | 'consentimento' | 'prescricao' | 'atestado';
  onSignatureComplete: (signatureData: SignatureData) => void;
  onCancel?: () => void;
  required?: boolean;
  requireIdentificationFields?: boolean;
  requireSelfie?: boolean;
  initialEmail?: string;
  initialCpf?: string;
  initialRg?: string;
}

const formatCpf = (v: string): string => {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

const formatRg = (v: string): string => {
  return v.replace(/[^\w.-]/g, '').slice(0, 16);
};

const DigitalSignature = ({
  title = 'Assinatura Digital',
  signerName,
  signerRole,
  documentType,
  onSignatureComplete,
  onCancel,
  required = true,
  requireIdentificationFields,
  requireSelfie,
  initialEmail = '',
  initialCpf = '',
  initialRg = '',
}: DigitalSignatureProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  // Campos de identificação
  const [nomeCompleto, setNomeCompleto] = useState(signerName || '');
  const [signerEmail, setSignerEmail] = useState(initialEmail || '');
  const [signerCpf, setSignerCpf] = useState(initialCpf ? formatCpf(initialCpf) : '');
  const [signerRg, setSignerRg] = useState(initialRg ? formatRg(initialRg) : '');

  // Selfie / Câmera
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Por padrão, contratos assinados por pacientes exigem identificação completa e selfie
  const isContratoPaciente = documentType === 'contrato' && signerRole === 'paciente';
  const shouldRequireFields = requireIdentificationFields ?? isContratoPaciente;
  const shouldRequireSelfie = requireSelfie ?? isContratoPaciente;

  // Atualiza nome inicial se prop mudar
  useEffect(() => {
    if (signerName && !nomeCompleto) {
      setNomeCompleto(signerName);
    }
  }, [signerName]);

  // Configuração do Canvas de Assinatura
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar resolução proporcional do canvas
    canvas.width = 600;
    canvas.height = 240;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  // Encerrar câmera ao desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setCameraLoading(true);
      setCameraError(null);
      stopCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera direta não suportada pelo navegador. Use o botão de captura do aparelho.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.warn('Erro ao abrir câmera:', err);
      setCameraError(
        err?.message || 'Permissão de câmera não concedida. Você pode tirar a foto direto pelo botão do dispositivo abaixo.'
      );
    } finally {
      setCameraLoading(false);
    }
  };

  const takeSelfie = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 480;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Inverte horizontalmente como um espelho para ficar natural
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setSelfiePhoto(dataUrl);
    stopCamera();
    toast.success('Foto selfie capturada com sucesso!');
  };

  const retakeSelfie = () => {
    setSelfiePhoto(null);
    startCamera();
  };

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 640;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setSelfiePhoto(dataUrl);
          stopCamera();
          toast.success('Selfie registrada com sucesso!');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Funções de desenho no Canvas
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleConfirmSignature = () => {
    // 1. Validações dos campos de identificação obrigatórios
    if (shouldRequireFields) {
      if (!nomeCompleto.trim() || nomeCompleto.trim().length < 3) {
        toast.error('Por favor, informe seu Nome Completo.');
        return;
      }

      if (!signerEmail.trim() || !/\S+@\S+\.\S+/.test(signerEmail)) {
        toast.error('Por favor, informe um E-mail válido.');
        return;
      }

      const cpfLimpo = signerCpf.replace(/\D/g, '');
      if (!cpfLimpo || cpfLimpo.length < 11) {
        toast.error('Por favor, informe um CPF válido com 11 dígitos.');
        return;
      }

      if (!signerRg.trim() || signerRg.trim().length < 4) {
        toast.error('Por favor, informe seu número de RG.');
        return;
      }
    }

    // 2. Validação da Foto Selfie obrigatória
    if (shouldRequireSelfie && !selfiePhoto) {
      toast.error('É obrigatório tirar uma foto selfie no momento da assinatura para validação jurídica.');
      return;
    }

    // 3. Validação do traço de assinatura
    if (!hasSignature && required) {
      toast.error('Por favor, faça sua assinatura na área indicada antes de confirmar.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData: SignatureData = {
      signature: canvas.toDataURL('image/png'),
      signerName: nomeCompleto.trim() || signerName,
      signerRole,
      timestamp: new Date(),
      documentType,
      selfie: selfiePhoto || undefined,
      signerInfo: {
        nomeCompleto: nomeCompleto.trim() || signerName,
        email: signerEmail.trim() || undefined,
        cpf: signerCpf.trim() || undefined,
        rg: signerRg.trim() || undefined,
        selfie: selfiePhoto || undefined,
      },
    };

    stopCamera();
    onSignatureComplete(signatureData);
  };

  const getRoleColor = () => {
    return signerRole === 'dentista' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-0 shadow-none bg-transparent">
      <CardHeader className="p-4 pb-2 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            {title}
          </CardTitle>
          <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400 w-fit">
            Autenticação Jurídica Digital
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <User className="h-3.5 w-3.5" />
          <span>Assinante:</span>
          <span className={`font-semibold ${getRoleColor()}`}>
            {nomeCompleto || signerName} ({signerRole === 'paciente' ? 'Paciente / Contratante' : 'Cirurgião-Dentista'})
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 max-h-[75vh] overflow-y-auto">
        {/* Bloco 1: Dados de Identificação Obrigatórios */}
        <div className="rounded-lg border border-border/80 bg-card p-3 space-y-3 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
            <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              1. Identificação do Assinante {shouldRequireFields && <span className="text-rose-500 text-xs">* Obrigatórios</span>}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="signerNome" className="text-xs font-medium text-foreground">
                Nome Completo {shouldRequireFields && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="signerNome"
                value={nomeCompleto}
                onChange={(e) => setNomeCompleto(e.target.value)}
                placeholder="Seu nome completo"
                className="h-8 text-xs font-medium bg-background"
                required={shouldRequireFields}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="signerEmail" className="text-xs font-medium text-foreground">
                E-mail {shouldRequireFields && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="signerEmail"
                type="email"
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder="email@exemplo.com"
                className="h-8 text-xs font-medium bg-background"
                required={shouldRequireFields}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="signerCpf" className="text-xs font-medium text-foreground">
                CPF {shouldRequireFields && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="signerCpf"
                value={signerCpf}
                onChange={(e) => setSignerCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
                className="h-8 text-xs font-medium bg-background font-mono"
                required={shouldRequireFields}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="signerRg" className="text-xs font-medium text-foreground">
                RG {shouldRequireFields && <span className="text-rose-500">*</span>}
              </Label>
              <Input
                id="signerRg"
                value={signerRg}
                onChange={(e) => setSignerRg(formatRg(e.target.value))}
                placeholder="00.000.000-0"
                maxLength={16}
                className="h-8 text-xs font-medium bg-background"
                required={shouldRequireFields}
              />
            </div>
          </div>
        </div>

        {/* Bloco 2: Foto Selfie no Momento da Assinatura (Obrigatória) */}
        {shouldRequireSelfie && (
          <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-950/15 p-3 space-y-2.5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-emerald-500/20 pb-1.5">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
                <Camera className="h-4 w-4 text-emerald-400" />
                2. Foto Selfie no Momento da Assinatura <span className="text-rose-400 text-xs">* Obrigatória</span>
              </span>
              {selfiePhoto && (
                <Badge className="bg-emerald-600 text-white text-[10px] gap-1 w-fit">
                  <CheckCircle2 className="h-3 w-3" /> Selfie Registrada
                </Badge>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground">
              Para validação jurídica e prova de autenticidade, capture uma foto do seu rosto no momento da assinatura.
            </p>

            {/* Input oculto para captura nativa como fallback */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileCapture}
            />

            {/* Estado 1: Selfie já capturada */}
            {selfiePhoto ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 p-2 bg-background/90 rounded-lg border border-emerald-500/30">
                <div className="relative">
                  <img
                    src={selfiePhoto}
                    alt="Selfie do Assinante"
                    className="w-24 h-24 object-cover rounded-lg border-2 border-emerald-500 shadow-md"
                  />
                  <span className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-600 rounded-full text-white shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </span>
                </div>
                <div className="space-y-1 text-center sm:text-left flex-1">
                  <span className="text-xs font-semibold text-foreground flex items-center justify-center sm:justify-start gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Identificação Biométrica Concluída
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Sua selfie foi registrada e será anexada ao termo de assinatura oficial.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-border text-foreground hover:bg-muted mt-1"
                    onClick={retakeSelfie}
                  >
                    <RotateCcw className="h-3 w-3" /> Tirar Outra Foto
                  </Button>
                </div>
              </div>
            ) : isCameraActive ? (
              /* Estado 2: Câmera Ativa / Capturando */
              <div className="flex flex-col items-center space-y-2 p-2 bg-black/80 rounded-lg border border-emerald-500/40">
                <div className="relative w-full max-w-xs aspect-square overflow-hidden rounded-lg border-2 border-emerald-400 bg-black flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {/* Guia oval de enquadramento de rosto */}
                  <div className="absolute inset-0 border-2 border-dashed border-white/60 rounded-full m-4 pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] text-white/90 bg-black/60 px-2 py-0.5 rounded-full font-medium shadow-xs">
                      Posicione seu rosto aqui
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={takeSelfie}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-md"
                  >
                    <Camera className="h-4 w-4" /> Capturar Foto Agora
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={stopCamera}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Fechar Câmera
                  </Button>
                </div>
              </div>
            ) : (
              /* Estado 3: Câmera fechada, convite para abrir */
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-background/80 rounded-lg border border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
                    <Camera className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground block">
                      Tirar Selfie com a Câmera
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Use a câmera frontal do celular ou webcam do computador
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    type="button"
                    size="sm"
                    onClick={startCamera}
                    disabled={cameraLoading}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 w-full sm:w-auto"
                  >
                    {cameraLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                    Abrir Câmera
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs gap-1 border-border w-full sm:w-auto"
                    title="Usar aplicativo de câmera ou arquivo do dispositivo"
                  >
                    <Upload className="h-3 w-3" /> Câmera do Aparelho
                  </Button>
                </div>
              </div>
            )}

            {cameraError && (
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-500 flex items-start gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{cameraError}</span>
              </div>
            )}
          </div>
        )}

        {/* Bloco 3: Área de Assinatura Digital (Canvas) */}
        <div className="rounded-lg border border-border/80 bg-card p-3 space-y-2 shadow-xs">
          <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
            <Label className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <PenTool className="h-3.5 w-3.5 text-primary" />
              3. Assine ou Rubrique no Quadro Abaixo {required && <span className="text-rose-500">*</span>}
            </Label>
            {hasSignature && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSignature}
                className="h-6 text-[10px] text-muted-foreground hover:text-destructive px-1.5 gap-1"
              >
                <Trash2 className="h-3 w-3" /> Limpar Traço
              </Button>
            )}
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              className="w-full h-36 sm:h-44 bg-white cursor-crosshair touch-none block"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Desenhe sua assinatura ou rubrica com o dedo na tela ou com o cursor do mouse
          </p>
        </div>

        {/* Rodapé e Botões de Ação */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-border/60">
          <div className="text-[10px] text-muted-foreground text-center sm:text-left">
            <span>Data: {new Date().toLocaleDateString('pt-BR')} • IP & Dispositivo auditados eletronicamente</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  stopCamera();
                  onCancel();
                }}
                className="h-9 text-xs border-border"
              >
                Cancelar
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleConfirmSignature}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 px-4 shadow-md w-full sm:w-auto"
            >
              <Save className="h-4 w-4" />
              Confirmar Assinatura Oficial
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DigitalSignature;

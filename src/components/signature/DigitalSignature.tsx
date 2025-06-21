
import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PenTool, Trash2, Save, User } from 'lucide-react';
import { toast } from 'sonner';

interface DigitalSignatureProps {
  title?: string;
  signerName: string;
  signerRole: 'paciente' | 'dentista';
  documentType: 'anamnese' | 'orcamento' | 'contrato' | 'consentimento';
  onSignatureComplete: (signatureData: SignatureData) => void;
  onCancel?: () => void;
  required?: boolean;
}

export interface SignatureData {
  signature: string; // Base64 da assinatura
  signerName: string;
  signerRole: 'paciente' | 'dentista';
  timestamp: Date;
  documentType: string;
  signerInfo?: {
    email?: string;
    cpf?: string;
  };
}

const DigitalSignature = ({
  title = "Assinatura Digital",
  signerName,
  signerRole,
  documentType,
  onSignatureComplete,
  onCancel,
  required = true
}: DigitalSignatureProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerEmail, setSignerEmail] = useState('');
  const [signerCpf, setSignerCpf] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar canvas
    canvas.width = 400;
    canvas.height = 200;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

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
    if (!hasSignature && required) {
      toast.error('Por favor, faça sua assinatura antes de confirmar');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData: SignatureData = {
      signature: canvas.toDataURL('image/png'),
      signerName,
      signerRole,
      timestamp: new Date(),
      documentType,
      signerInfo: {
        email: signerEmail || undefined,
        cpf: signerCpf || undefined,
      }
    };

    onSignatureComplete(signatureData);
    toast.success('Assinatura confirmada com sucesso!');
  };

  const getRoleColor = () => {
    return signerRole === 'dentista' ? 'text-blue-600' : 'text-green-600';
  };

  const getRoleIcon = () => {
    return signerRole === 'dentista' ? '👨‍⚕️' : '👤';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-blue-600" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <User className="h-4 w-4" />
          <span>Assinante: </span>
          <span className={`font-medium ${getRoleColor()}`}>
            {getRoleIcon()} {signerName} ({signerRole})
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Informações adicionais do assinante */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="signerEmail" className="text-sm font-medium">
              E-mail (opcional)
            </Label>
            <Input
              id="signerEmail"
              type="email"
              value={signerEmail}
              onChange={(e) => setSignerEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="signerCpf" className="text-sm font-medium">
              CPF (opcional)
            </Label>
            <Input
              id="signerCpf"
              value={signerCpf}
              onChange={(e) => setSignerCpf(e.target.value)}
              placeholder="000.000.000-00"
              className="mt-1"
            />
          </div>
        </div>

        {/* Área de assinatura */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Área de Assinatura {required && <span className="text-red-500">*</span>}
          </Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
            <canvas
              ref={canvasRef}
              className="border border-gray-200 rounded bg-white cursor-crosshair w-full"
              style={{ touchAction: 'none' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              Assine acima usando o mouse ou toque na tela
            </p>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={clearSignature}
            disabled={!hasSignature}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Limpar
          </Button>
          
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          
          <Button
            onClick={handleConfirmSignature}
            className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Confirmar Assinatura
          </Button>
        </div>

        {/* Informações sobre o documento */}
        <div className="text-xs text-gray-500 p-3 bg-gray-50 rounded">
          <p><strong>Documento:</strong> {documentType}</p>
          <p><strong>Data/Hora:</strong> {new Date().toLocaleString('pt-BR')}</p>
          <p><strong>Tipo de Assinatura:</strong> Digital</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default DigitalSignature;


import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const AssinarAnamnese = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const { anamneses, pacientes, signAnamnese } = useDentalSystem();
  const [anamnese, setAnamnese] = useState<any>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [isValid, setIsValid] = useState<boolean>(false);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [showSignature, setShowSignature] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (!id || !token) {
      setIsValid(false);
      return;
    }

    const foundAnamnese = anamneses.find(a => a.id === id);
    if (!foundAnamnese) {
      setIsValid(false);
      return;
    }

    const foundPaciente = pacientes.find(p => p.id === foundAnamnese.pacienteId);
    if (!foundPaciente) {
      setIsValid(false);
      return;
    }

    // Verificar se o token está correto
    if (foundAnamnese.tokenAssinatura !== token) {
      setIsValid(false);
      return;
    }

    // Verificar se não expirou
    if (foundAnamnese.dataExpiracaoLink && new Date() > new Date(foundAnamnese.dataExpiracaoLink)) {
      setIsExpired(true);
      setIsValid(false);
      return;
    }

    // Verificar se já foi assinado pelo paciente
    if (foundAnamnese.assinaturaPaciente) {
      setIsCompleted(true);
    }

    setAnamnese(foundAnamnese);
    setPaciente(foundPaciente);
    setIsValid(true);
  }, [id, token, anamneses, pacientes]);

  const handleSignature = async (signatureData: SignatureData) => {
    try {
      await signAnamnese(id!, signatureData, 'paciente');
      setIsCompleted(true);
      toast.success('Assinatura registrada com sucesso!');
    } catch (error) {
      toast.error('Erro ao registrar assinatura');
    }
  };

  if (!isValid && !isExpired) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Link Inválido</h2>
              <p className="text-muted-foreground">
                Este link de assinatura não é válido ou não existe.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Link Expirado</h2>
              <p className="text-muted-foreground">
                Este link de assinatura expirou. Entre em contato com o consultório para obter um novo link.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Assinatura Concluída</h2>
              <p className="text-muted-foreground">
                Sua assinatura já foi registrada com sucesso. Obrigado!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showSignature) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <DigitalSignature
            title="Assinatura da Anamnese"
            signerName={paciente?.nome || 'Paciente'}
            signerRole="paciente"
            documentType="anamnese"
            onSignatureComplete={handleSignature}
            onCancel={() => setShowSignature(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Assinatura de Anamnese</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Informações da Anamnese</h3>
            <div className="space-y-1 text-sm text-blue-800">
              <p><strong>Paciente:</strong> {paciente?.nome}</p>
              <p><strong>Data:</strong> {new Date(anamnese?.data).toLocaleDateString('pt-BR')}</p>
              <p><strong>Queixa Principal:</strong> {anamnese?.queixaPrincipal}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-muted-foreground mb-6">
              Por favor, clique no botão abaixo para assinar digitalmente sua anamnese.
              A assinatura confirma que as informações prestadas são verdadeiras.
            </p>
            
            <Button 
              onClick={() => setShowSignature(true)}
              size="lg"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Iniciar Assinatura Digital
            </Button>
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
            <p><strong>Importante:</strong> Esta assinatura tem validade legal e confirma sua concordância com as informações da anamnese.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AssinarAnamnese;

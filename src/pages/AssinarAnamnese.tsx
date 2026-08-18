import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'loading' | 'valid' | 'invalid' | 'expired' | 'completed';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-muted flex items-center justify-center p-4">{children}</div>
);

const AssinarAnamnese = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [anamnese, setAnamnese] = useState<any>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [showSignature, setShowSignature] = useState(false);

  const call = useCallback(
    async (action: 'get' | 'sign', extra: Record<string, unknown> = {}) => {
      const { data, error } = await supabase.functions.invoke('assinatura-publica', {
        body: { action, id, token, ...extra },
      });
      if (error) throw error;
      return data as any;
    },
    [id, token]
  );

  useEffect(() => {
    if (!id || !token) {
      setStatus('invalid');
      return;
    }
    (async () => {
      try {
        const data = await call('get');
        if (!data || data.error) {
          setStatus(data?.error === 'expired' ? 'expired' : 'invalid');
          return;
        }
        setAnamnese(data.anamnese);
        setPaciente(data.paciente);
        setStatus(data.anamnese.jaAssinado ? 'completed' : 'valid');
      } catch (err: any) {
        const msg = String(err?.message || '');
        setStatus(msg.includes('410') ? 'expired' : 'invalid');
      }
    })();
  }, [id, token, call]);

  const handleSignature = async (signatureData: SignatureData) => {
    try {
      await call('sign', {
        signature: signatureData.signature,
        signerName: signatureData.signerName,
      });
      setStatus('completed');
      toast.success('Assinatura registrada com sucesso!');
    } catch {
      toast.error('Erro ao registrar assinatura');
    }
  };

  if (status === 'loading') {
    return (
      <Shell>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Shell>
    );
  }

  if (status === 'invalid') {
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Link Inválido</h2>
            <p className="text-muted-foreground">Este link de assinatura não é válido ou não existe.</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (status === 'expired') {
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Link Expirado</h2>
            <p className="text-muted-foreground">
              Este link de assinatura expirou. Entre em contato com o consultório para obter um novo link.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (status === 'completed') {
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Assinatura Concluída</h2>
            <p className="text-muted-foreground">Sua assinatura já foi registrada com sucesso. Obrigado!</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (showSignature) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  return (
    <Shell>
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Assinatura de Anamnese</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted border border-border rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-2">Informações da Anamnese</h3>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><strong>Paciente:</strong> {paciente?.nome}</p>
              {anamnese?.data && (
                <p><strong>Data:</strong> {new Date(anamnese.data).toLocaleDateString('pt-BR')}</p>
              )}
              <p><strong>Queixa Principal:</strong> {anamnese?.queixaPrincipal}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-muted-foreground mb-6">
              Por favor, clique no botão abaixo para assinar digitalmente sua anamnese.
              A assinatura confirma que as informações prestadas são verdadeiras.
            </p>
            <Button onClick={() => setShowSignature(true)} size="lg">
              Iniciar Assinatura Digital
            </Button>
          </div>

          <div className="text-xs text-muted-foreground p-3 bg-muted rounded">
            <p><strong>Importante:</strong> Esta assinatura tem validade legal e confirma sua concordância com as informações da anamnese.</p>
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
};

export default AssinarAnamnese;

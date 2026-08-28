import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, AlertCircle, Clock, Loader2, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@/utils/exportCsv';

type Status = 'loading' | 'valid' | 'invalid' | 'expired' | 'completed';

const brl = (v: number) => `${formatMoney(Number(v || 0))}`;

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-muted flex items-center justify-center p-4">{children}</div>
);

const AssinarExtrato = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [extrato, setExtrato] = useState<any>(null);
  const [showSignature, setShowSignature] = useState(false);

  const call = useCallback(
    async (action: 'get' | 'sign', extra: Record<string, unknown> = {}) => {
      const { data, error } = await supabase.functions.invoke('extrato-publico', {
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
        setExtrato(data.extrato);
        setStatus(data.extrato.jaAssinado ? 'completed' : 'valid');
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
      toast.success('Extrato assinado com sucesso!');
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

  if (status === 'invalid' || status === 'expired') {
    const expired = status === 'expired';
    return (
      <Shell>
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-2">
            {expired ? (
              <Clock className="h-10 w-10 mx-auto text-amber-500" />
            ) : (
              <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            )}
            <h1 className="text-lg font-semibold">{expired ? 'Link expirado' : 'Link inválido'}</h1>
            <p className="text-sm text-muted-foreground">
              {expired
                ? 'Solicite um novo link para a clínica.'
                : 'Verifique o link recebido ou entre em contato com a clínica.'}
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
          <CardContent className="p-6 text-center space-y-2">
            <CheckCircle className="h-10 w-10 mx-auto text-emerald-500" />
            <h1 className="text-lg font-semibold">Extrato assinado</h1>
            <p className="text-sm text-muted-foreground">Obrigado! A clínica já recebeu sua assinatura.</p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const dados = extrato?.dados || {};
  const realizados: any[] = dados.realizados || [];
  const previstos: any[] = dados.previstos || [];
  const pagamentos: any[] = dados.pagamentos || [];

  return (
    <Shell>
      <div className="w-full max-w-2xl space-y-4">
        <Card>
          <CardHeader className="pb-3">
            {dados.logoUrl ? (
              <img src={dados.logoUrl} alt="Logo da clínica" className="max-h-16 object-contain mb-2" />
            ) : null}
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSignature className="h-5 w-5" />
              Extrato financeiro — {extrato?.pacienteNome}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="font-semibold text-emerald-500">{brl(extrato?.totalPago)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em aberto</p>
                <p className="font-semibold text-amber-500">{brl(extrato?.totalPendente)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previsto</p>
                <p className="font-semibold">{brl(extrato?.totalPrevisto)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-semibold">{brl(extrato?.total)}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <p className="font-medium">Procedimentos realizados</p>
              {realizados.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nenhum registro.</p>
              ) : (
                realizados.map((r, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs border-b py-1">
                    <span className="truncate">{r.data} · {r.nome}</span>
                    <span className="shrink-0">{brl(r.valor)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1">
              <p className="font-medium">Previstos</p>
              {previstos.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nenhum registro.</p>
              ) : (
                previstos.map((p, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs border-b py-1">
                    <span className="truncate">{p.data} · {p.nome}</span>
                    <span className="shrink-0">{brl(p.valor)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1">
              <p className="font-medium">Pagamentos</p>
              {pagamentos.length === 0 ? (
                <p className="text-muted-foreground text-xs">Nenhum registro.</p>
              ) : (
                pagamentos.map((t, i) => (
                  <div key={i} className="flex justify-between gap-2 text-xs border-b py-1">
                    <span className="truncate">{t.data} · {t.descricao} ({t.status})</span>
                    <span className="shrink-0">{brl(t.valor)}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {showSignature ? (
          <DigitalSignature
            title="Assinar extrato"
            signerName={extrato?.pacienteNome || 'Paciente'}
            signerRole="paciente"
            documentType="orcamento"
            onSignatureComplete={handleSignature}
            onCancel={() => setShowSignature(false)}
          />
        ) : (
          <Button className="w-full" onClick={() => setShowSignature(true)}>
            <FileSignature className="h-4 w-4 mr-2" />
            Concordo e quero assinar
          </Button>
        )}
      </div>
    </Shell>
  );
};

export default AssinarExtrato;

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, Trash2, Eye, EyeOff } from 'lucide-react';
import { useCertificadoDigital, CertificadoDigital } from '@/hooks/useCertificadoDigital';

const PROVEDORES = [
  { value: 'safeid', label: 'SafeID (Safeweb)' },
  { value: 'birdid', label: 'BirdID (Soluti)' },
  { value: 'vidaas', label: 'VIDaaS (Valid)' },
  { value: 'remoteid', label: 'Remote ID (Certisign)' },
  { value: 'outro', label: 'Outro provedor' },
];

const formatCpf = (v: string) =>
  v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const CertificadoDigitalManager = () => {
  const { certificado, loading, saving, salvar, remover } = useCertificadoDigital();
  const [form, setForm] = useState<CertificadoDigital>(certificado);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    setForm(certificado);
  }, [certificado]);

  const conectado = Boolean(certificado.clientId && certificado.clientSecret);

  const set = (patch: Partial<CertificadoDigital>) => setForm((p) => ({ ...p, ...patch }));

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Certificado Digital ICP-Brasil
            </CardTitle>
            <CardDescription>
              Conecte o seu certificado A3 em nuvem para assinar documentos com validade legal (CFO).
            </CardDescription>
          </div>
          <Badge variant={conectado ? 'default' : 'secondary'}>
            {conectado ? 'Conectado' : 'Não conectado'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={form.provedor} onValueChange={(v) => set({ provedor: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVEDORES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={form.ambiente} onValueChange={(v) => set({ ambiente: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="producao">Produção</SelectItem>
                <SelectItem value="homologacao">Homologação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nome do titular</Label>
            <Input
              value={form.titularNome}
              onChange={(e) => set({ titularNome: e.target.value })}
              placeholder="Nome como consta no certificado"
            />
          </div>

          <div className="space-y-2">
            <Label>CPF do titular</Label>
            <Input
              value={form.titularCpf}
              onChange={(e) => set({ titularCpf: formatCpf(e.target.value) })}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="space-y-2">
            <Label>Client ID da aplicação (opcional)</Label>
            <Input
              value={form.clientId}
              onChange={(e) => set({ clientId: e.target.value })}
              placeholder="ID gerado no portal do provedor"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label>Client Secret (opcional)</Label>
            <div className="relative">
              <Input
                type={showSecret ? 'text' : 'password'}
                value={form.clientSecret}
                onChange={(e) => set({ clientSecret: e.target.value })}
                placeholder="Chave secreta da aplicação"
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showSecret ? 'Ocultar' : 'Mostrar'}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Assinatura ICP-Brasil ativa</p>
            <p className="text-xs text-muted-foreground">
              Quando ativo, os documentos poderão ser assinados com este certificado.
            </p>
          </div>
          <Switch checked={form.ativo} onCheckedChange={(v) => set({ ativo: v })} />
        </div>

        <div className="rounded-lg border p-3 space-y-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Não encontrou o Client ID / Secret?</p>
          <p>
            Isso é normal: no app/portal do SafeID (usuário final) essas credenciais não aparecem. Elas
            não pertencem ao seu certificado — são de uma <strong>aplicação integradora</strong> criada
            pela Safeweb.
          </p>
          <p>
            Para obtê-las é preciso solicitar acesso à API à Safeweb (integracao@safeweb.com.br /
            comercial), informando que deseja assinar documentos via API SafeID. Eles liberam um
            Client ID e Client Secret de homologação e depois de produção.
          </p>
          <p>
            Enquanto isso, deixe esses campos em branco e salve apenas provedor, titular e CPF: os
            documentos continuam sendo assinados com a assinatura eletrônica simples da clínica.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => salvar(form)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar certificado
          </Button>
          {conectado && (
            <Button variant="outline" onClick={remover} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-2" />
              Desconectar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CertificadoDigitalManager;


import React, { useRef, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BloqueiosManager from '@/components/configuracoes/BloqueiosManager';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, Wifi, Bell, Shield, Database, MessageSquare, UserCog, Upload, Trash2, Image as ImageIcon, Handshake, ShieldCheck, Pill, Users } from 'lucide-react';
import DentistasManager from '@/components/configuracoes/DentistasManager';
import CertificadoDigitalManager from '@/components/configuracoes/CertificadoDigitalManager';
import ParceirosManager from '@/components/configuracoes/ParceirosManager';
import MedicamentosManager from '@/components/configuracoes/MedicamentosManager';
import EquipeManager from '@/components/configuracoes/EquipeManager';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { Loader2 } from 'lucide-react';
import { downloadBackupCompleto, lerArquivoBackup, restaurarBackup, type ProgressoBackup } from '@/utils/backup';
import BackupProgress from '@/components/common/BackupProgress';


const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
};

const Configuracoes = () => {
  const { toast } = useToast();
  const { configuracoes, setConfiguracoes, loading, saving, saveConfiguracoes } = useConfiguracoes();
  const [tokens, setTokens] = useState({ whatsappToken: '', instagramToken: '', asaasToken: '' });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [progresso, setProgresso] = useState<ProgressoBackup | null>(null);
  const [resumoRestauracao, setResumoRestauracao] = useState<string | null>(null);

  const salvarConfiguracoes = async () => {
    await saveConfiguracoes(configuracoes);
  };

  const handleBackupNow = async () => {
    setBackupLoading(true);
    setResumoRestauracao(null);
    setProgresso({ etapa: 'Iniciando backup', percentual: 0 });
    try {
      const total = await downloadBackupCompleto('backup-dental', true, setProgresso);
      toast({ title: 'Backup gerado (100%)', description: `${total} registros exportados.` });
    } catch (err) {
      toast({ title: 'Erro ao gerar backup', description: err instanceof Error ? err.message : 'Tente novamente.', variant: 'destructive' });
    } finally {
      setBackupLoading(false);
      window.setTimeout(() => setProgresso(null), 1500);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setRestoreLoading(true);
    setResumoRestauracao(null);
    setProgresso({ etapa: 'Lendo arquivo', percentual: 0 });
    try {
      const payload = await lerArquivoBackup(file);
      const resultado = await restaurarBackup(payload, setProgresso);
      const detalhes = Object.entries(resultado.porTabela)
        .map(([tabela, qtd]) => `${tabela}: ${qtd}`)
        .join(' • ');
      setResumoRestauracao(
        `${resultado.inseridos} registros e ${resultado.arquivos} arquivo(s) restaurados.${detalhes ? ` ${detalhes}` : ''}`,
      );
      if (resultado.erros.length > 0) {
        toast({
          title: 'Restauração concluída parcialmente (100%)',
          description: `${resultado.inseridos} registros e ${resultado.arquivos} arquivo(s) importados. Falha em: ${resultado.erros.map(({ tabela }) => tabela).join(', ')}.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Backup restaurado (100%)', description: `${resultado.inseridos} registros e ${resultado.arquivos} arquivo(s) importados. Atualizando a página...` });
      }
      window.setTimeout(() => window.location.reload(), 2500);
    } catch (err) {
      toast({ title: 'Erro ao restaurar backup', description: err instanceof Error ? err.message : 'Arquivo inválido.', variant: 'destructive' });
      setProgresso(null);
    } finally {
      setRestoreLoading(false);
    }
  };



  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem.', variant: 'destructive' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Use uma imagem de até 4MB.', variant: 'destructive' });
      return;
    }
    setLogoLoading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let finalUrl = dataUrl;
      if (file.type !== 'image/svg+xml') {
        finalUrl = await new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const max = 600;
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            if (!ctx) return resolve(dataUrl);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => resolve(dataUrl);
          img.src = dataUrl;
        });
      }

      const novas = { ...configuracoes, logoUrl: finalUrl };
      setConfiguracoes(novas);
      await saveConfiguracoes(novas);
    } catch {
      toast({ title: 'Erro ao carregar a logo', variant: 'destructive' });
    } finally {
      setLogoLoading(false);
    }
  };


  const testarConexao = (api: string) => {
    console.log(`Testando conexão com ${api}`);
    toast({
      title: `Testando ${api}`,
      description: "Verificando conexão...",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Configurações</h1>
          </div>
          <Button onClick={salvarConfiguracoes} disabled={saving || loading} className="bg-blue-600 hover:bg-blue-700">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </div>

        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="equipe"><Users className="h-4 w-4 mr-1" />Equipe</TabsTrigger>
            <TabsTrigger value="dentistas"><UserCog className="h-4 w-4 mr-1" />Dentistas</TabsTrigger>
            <TabsTrigger value="parceiros"><Handshake className="h-4 w-4 mr-1" />Parceiros</TabsTrigger>
            <TabsTrigger value="medicamentos"><Pill className="h-4 w-4 mr-1" />Medicamentos</TabsTrigger>
            <TabsTrigger value="certificado"><ShieldCheck className="h-4 w-4 mr-1" />Certificado</TabsTrigger>
            <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
            <TabsTrigger value="apis">APIs</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="equipe">
            <EquipeManager />
          </TabsContent>

          <TabsContent value="dentistas">
            <DentistasManager />
          </TabsContent>

          <TabsContent value="parceiros">
            <ParceirosManager />
          </TabsContent>

          <TabsContent value="medicamentos">
            <MedicamentosManager />
          </TabsContent>

          <TabsContent value="certificado">
            <CertificadoDigitalManager />
          </TabsContent>



          <TabsContent value="geral">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Clínica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nomeClinica">Nome da Clínica</Label>
                    <Input
                      id="nomeClinica"
                      value={configuracoes.nomeClinica}
                      onChange={(e) => setConfiguracoes({...configuracoes, nomeClinica: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cnpj">CNPJ ou CPF</Label>
                    <Input
                      id="cnpj"
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00 ou 000.000.000-00"
                      value={configuracoes.cnpj}
                      onChange={(e) => setConfiguracoes({ ...configuracoes, cnpj: formatCnpjCpf(e.target.value) })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Usado nos recibos e documentos gerados.
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="endereco">Endereço</Label>
                    <Input
                      id="endereco"
                      value={configuracoes.endereco}
                      onChange={(e) => setConfiguracoes({...configuracoes, endereco: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input
                      id="telefone"
                      value={configuracoes.telefone}
                      onChange={(e) => setConfiguracoes({...configuracoes, telefone: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="whatsappNumero">WhatsApp da clínica (API)</Label>
                    <Input
                      id="whatsappNumero"
                      placeholder="+55 11 99999-9999"
                      value={configuracoes.whatsappNumero}
                      onChange={(e) => setConfiguracoes({...configuracoes, whatsappNumero: e.target.value})}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Número conectado ao WhatsApp Business API, usado para enviar e receber mensagens.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={configuracoes.email}
                      onChange={(e) => setConfiguracoes({...configuracoes, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label>Logo da clínica</Label>
                  <p className="text-xs text-muted-foreground">
                    Usada em recibos, prontuários e demais documentos em PDF.
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="h-20 w-32 border rounded-md flex items-center justify-center bg-muted/30 overflow-hidden">
                      {configuracoes.logoUrl ? (
                        <img src={configuracoes.logoUrl} alt="Logo da clínica" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <Button variant="outline" onClick={() => logoInputRef.current?.click()} disabled={logoLoading}>
                      {logoLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      {configuracoes.logoUrl ? 'Trocar logo' : 'Enviar logo'}
                    </Button>
                    {configuracoes.logoUrl && (
                      <Button
                        variant="ghost"
                        onClick={() => setConfiguracoes({ ...configuracoes, logoUrl: '' })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Remover
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

          </TabsContent>

          <TabsContent value="bloqueios">
            <BloqueiosManager />
          </TabsContent>

          <TabsContent value="apis">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    WhatsApp Business API
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="whatsappToken">Token do WhatsApp</Label>
                    <div className="flex gap-2">
                      <Input
                        id="whatsappToken"
                        type="password"
                        value={tokens.whatsappToken}
                        onChange={(e) => setTokens({ ...tokens, whatsappToken: e.target.value })}
                        placeholder="Digite o token do WhatsApp Business API"
                      />
                      <Button variant="outline" onClick={() => testarConexao('WhatsApp')}>
                        <Wifi className="h-4 w-4 mr-2" />
                        Testar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Instagram API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="instagramToken">Token do Instagram</Label>
                    <div className="flex gap-2">
                      <Input
                        id="instagramToken"
                        type="password"
                        value={tokens.instagramToken}
                        onChange={(e) => setTokens({ ...tokens, instagramToken: e.target.value })}
                        placeholder="Digite o token do Instagram Graph API"
                      />
                      <Button variant="outline" onClick={() => testarConexao('Instagram')}>
                        <Wifi className="h-4 w-4 mr-2" />
                        Testar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ASAAS - Gateway de Pagamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="asaasToken">Token ASAAS</Label>
                    <div className="flex gap-2">
                      <Input
                        id="asaasToken"
                        type="password"
                        value={tokens.asaasToken}
                        onChange={(e) => setTokens({ ...tokens, asaasToken: e.target.value })}
                        placeholder="Digite o token da API do ASAAS"
                      />
                      <Button variant="outline" onClick={() => testarConexao('ASAAS')}>
                        <Wifi className="h-4 w-4 mr-2" />
                        Testar
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O ASAAS é usado para gerar boletos, cobranças via PIX e cartão de crédito.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notificacoes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Configurações de Notificações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotificacoes">Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">Receber notificações importantes por email</p>
                  </div>
                  <Switch
                    id="emailNotificacoes"
                    checked={configuracoes.emailNotificacoes}
                    onCheckedChange={(checked) => setConfiguracoes({...configuracoes, emailNotificacoes: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="whatsappLembretes">Lembretes via WhatsApp</Label>
                    <p className="text-sm text-muted-foreground">Enviar lembretes de consulta via WhatsApp</p>
                  </div>
                  <Switch
                    id="whatsappLembretes"
                    checked={configuracoes.whatsappLembretes}
                    onCheckedChange={(checked) => setConfiguracoes({...configuracoes, whatsappLembretes: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="lembrete24h">Lembrete 24 horas antes</Label>
                    <p className="text-sm text-muted-foreground">Enviar lembrete com 24 horas de antecedência</p>
                  </div>
                  <Switch
                    id="lembrete24h"
                    checked={configuracoes.lembrete24h}
                    onCheckedChange={(checked) => setConfiguracoes({...configuracoes, lembrete24h: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="lembrete2h">Lembrete 2 horas antes</Label>
                    <p className="text-sm text-muted-foreground">Enviar lembrete com 2 horas de antecedência</p>
                  </div>
                  <Switch
                    id="lembrete2h"
                    checked={configuracoes.lembrete2h}
                    onCheckedChange={(checked) => setConfiguracoes({...configuracoes, lembrete2h: checked})}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Backup e Segurança
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="backupAutomatico">Backup Automático</Label>
                    <p className="text-sm text-muted-foreground">Fazer backup automático dos dados</p>
                  </div>
                  <Switch
                    id="backupAutomatico"
                    checked={configuracoes.backupAutomatico}
                    onCheckedChange={(checked) => setConfiguracoes({...configuracoes, backupAutomatico: checked})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Frequência do Backup</Label>
                  <div className="flex gap-2">
                    {['diario', 'semanal', 'mensal'].map((freq) => (
                      <Button
                        key={freq}
                        variant={configuracoes.frequenciaBackup === freq ? 'default' : 'outline'}
                        onClick={() => setConfiguracoes({...configuracoes, frequenciaBackup: freq})}
                      >
                        {freq.charAt(0).toUpperCase() + freq.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <input
                    ref={restoreInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleRestore}
                  />
                  <Button variant="outline" className="mr-2" onClick={handleBackupNow} disabled={backupLoading || restoreLoading}>
                    {backupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                    {backupLoading && progresso ? `Fazendo backup... ${progresso.percentual}%` : 'Fazer Backup Agora'}
                  </Button>
                  <Button variant="outline" onClick={() => restoreInputRef.current?.click()} disabled={restoreLoading || backupLoading}>
                    {restoreLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                    {restoreLoading && progresso ? `Restaurando... ${progresso.percentual}%` : 'Restaurar Backup'}
                  </Button>

                  <div className="mt-4 space-y-2">
                    <BackupProgress progresso={progresso} titulo={restoreLoading ? 'Restauração' : backupLoading ? 'Backup' : undefined} />
                    {resumoRestauracao && (
                      <p className="text-sm text-muted-foreground">
                        Restauração concluída: {resumoRestauracao} Atualizando a página...
                      </p>
                    )}
                  </div>
                </div>


              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Configuracoes;


import React, { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BloqueiosManager from '@/components/configuracoes/BloqueiosManager';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, Wifi, Bell, Shield, Database, MessageSquare, UserCog, Upload, Trash2, Image as ImageIcon, Handshake, ShieldCheck, Pill, Users, Calendar, FileSignature, Bot, Sparkles, CheckCircle2, AlertCircle, Eye, EyeOff, ExternalLink, CreditCard } from 'lucide-react';
import DentistasManager from '@/components/configuracoes/DentistasManager';
import CertificadoDigitalManager from '@/components/configuracoes/CertificadoDigitalManager';
import ParceirosManager from '@/components/configuracoes/ParceirosManager';
import MedicamentosManager from '@/components/configuracoes/MedicamentosManager';
import EquipeManager from '@/components/configuracoes/EquipeManager';
import ConfiguracoesAgenda from '@/components/configuracoes/ConfiguracoesAgenda';
import ConfiguracaoContratoManager from '@/components/configuracoes/ConfiguracaoContratoManager';
import MaquinasCartaoManager from '@/components/configuracoes/MaquinasCartaoManager';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { Loader2 } from 'lucide-react';
import { downloadBackupCompleto, lerArquivoBackup, restaurarBackup, type ProgressoBackup } from '@/utils/backup';
import BackupProgress from '@/components/common/BackupProgress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { testarOpenAiKey } from '@/services/chatgptService';


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
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'geral';
  const { toast } = useToast();
  const { configuracoes, setConfiguracoes, loading, saving, saveConfiguracoes } = useConfiguracoes();
  const [tokens, setTokens] = useState({ whatsappToken: '', instagramToken: '', asaasToken: '' });
  const [mostrarOpenAiKey, setMostrarOpenAiKey] = useState(false);
  const [testandoOpenAi, setTestandoOpenAi] = useState(false);
  const [statusOpenAi, setStatusOpenAi] = useState<{ ok: boolean; msg: string } | null>(null);
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

  const handleTestarOpenAi = async () => {
    if (!configuracoes.openaiApiKey) {
      toast({
        title: 'Chave não informada',
        description: 'Digite sua chave da OpenAI (sk-...) antes de testar.',
        variant: 'destructive',
      });
      return;
    }

    setTestandoOpenAi(true);
    setStatusOpenAi(null);

    try {
      const res = await testarOpenAiKey(
        configuracoes.openaiApiKey,
        configuracoes.openaiModel || 'gpt-4o-mini'
      );

      if (res.success) {
        setStatusOpenAi({
          ok: true,
          msg: `Conexão bem-sucedida com a OpenAI (${res.model || configuracoes.openaiModel})!`,
        });
        toast({
          title: 'OpenAI ChatGPT Conectado!',
          description: `API validada com sucesso com o modelo ${res.model || configuracoes.openaiModel}.`,
        });
      } else {
        setStatusOpenAi({
          ok: false,
          msg: res.error || 'Falha ao conectar à API da OpenAI.',
        });
        toast({
          title: 'Falha no Teste OpenAI',
          description: res.error || 'Verifique se a chave é válida e possui saldo ativo.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      setStatusOpenAi({
        ok: false,
        msg: err.message || 'Erro inesperado na chamada.',
      });
    } finally {
      setTestandoOpenAi(false);
    }
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
          description: `${resultado.inseridos} registros e ${resultado.arquivos} arquivo(s) importados. Falha em: ${resultado.erros.map(({ tabela, mensagem }) => `${tabela} (${mensagem})`).join(', ')}.`,
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
      <div className="space-y-6 pb-20 lg:pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Configurações</h1>
          </div>
          <Button onClick={salvarConfiguracoes} disabled={saving || loading} className="bg-blue-600 hover:bg-blue-700 text-white">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Configurações
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="contrato">
              <FileSignature className="h-4 w-4 mr-1 text-primary" />
              Contrato & PIX
            </TabsTrigger>
            <TabsTrigger value="maquinas">
              <CreditCard className="h-4 w-4 mr-1 text-emerald-500" />
              Máquinas de Cartão
            </TabsTrigger>
            <TabsTrigger value="agenda"><Calendar className="h-4 w-4 mr-1" />Agenda (Sincronização)</TabsTrigger>
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

          <TabsContent value="contrato">
            <ConfiguracaoContratoManager />
          </TabsContent>

          <TabsContent value="maquinas">
            <MaquinasCartaoManager />
          </TabsContent>

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

          <TabsContent value="agenda">
            <ConfiguracoesAgenda />
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
              {/* Card Destaque: OpenAI ChatGPT */}
              <Card className="border-emerald-500/40 shadow-lg bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-emerald-950/20">
                <CardHeader className="border-b border-border/50 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <CardTitle className="flex items-center gap-2.5 text-base sm:text-lg text-emerald-600 dark:text-emerald-400 font-bold">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        <Bot className="h-5 w-5" />
                      </div>
                      OpenAI ChatGPT (Copiloto CRM & Inteligência Artificial)
                    </CardTitle>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1 w-fit">
                      <Sparkles className="h-3 w-3" /> GPT-4o & GPT-4o-mini
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Alimenta o copiloto de atendimento do WhatsApp no CRM, sugestões automáticas de respostas persuasivas para leads, qualificação de pacientes e análise clínica.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Chave de API OpenAI */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="openaiApiKey" className="text-xs font-semibold">
                        Chave Secreta de API da OpenAI (API Key)
                      </Label>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        Obter chave na OpenAI <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          id="openaiApiKey"
                          type={mostrarOpenAiKey ? 'text' : 'password'}
                          value={configuracoes.openaiApiKey || ''}
                          onChange={(e) =>
                            setConfiguracoes({ ...configuracoes, openaiApiKey: e.target.value })
                          }
                          placeholder="sk-proj-..."
                          className="font-mono text-xs pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarOpenAiKey(!mostrarOpenAiKey)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                          title={mostrarOpenAiKey ? 'Ocultar chave' : 'Mostrar chave'}
                        >
                          {mostrarOpenAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestarOpenAi}
                        disabled={testandoOpenAi || !configuracoes.openaiApiKey}
                        className="text-xs shrink-0 border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                      >
                        {testandoOpenAi ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin text-emerald-400" />
                            Testando...
                          </>
                        ) : (
                          <>
                            <Wifi className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
                            Testar Conexão
                          </>
                        )}
                      </Button>
                    </div>

                    {statusOpenAi && (
                      <div
                        className={`p-2.5 rounded-md text-xs flex items-center gap-2 border mt-2 ${
                          statusOpenAi.ok
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'
                        }`}
                      >
                        {statusOpenAi.ok ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                        )}
                        <span className="font-medium">{statusOpenAi.msg}</span>
                      </div>
                    )}
                  </div>

                  {/* Modelo do ChatGPT */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="openaiModel" className="text-xs font-semibold">
                        Modelo do ChatGPT
                      </Label>
                      <Select
                        value={configuracoes.openaiModel || 'gpt-4o-mini'}
                        onValueChange={(val) =>
                          setConfiguracoes({ ...configuracoes, openaiModel: val })
                        }
                      >
                        <SelectTrigger id="openaiModel" className="text-xs">
                          <SelectValue placeholder="Selecione o modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o-mini" className="text-xs">
                            <span className="font-semibold text-emerald-400">gpt-4o-mini</span>{' '}
                            (Recomendado • Rápido e Econômico)
                          </SelectItem>
                          <SelectItem value="gpt-4o" className="text-xs">
                            <span className="font-semibold text-blue-400">gpt-4o</span>{' '}
                            (Mais Inteligente • Casos Clínicos Complexos)
                          </SelectItem>
                          <SelectItem value="gpt-3.5-turbo" className="text-xs">
                            <span>gpt-3.5-turbo</span> (Legado)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        O <strong>gpt-4o-mini</strong> é o modelo oficial da OpenAI mais recomendado para velocidade em chats de WhatsApp e custo reduzido.
                      </p>
                    </div>

                    {/* Instruções do Sistema / Personalidade da Clínica */}
                    <div className="space-y-1.5">
                      <Label htmlFor="openaiPrompt" className="text-xs font-semibold">
                        Instrução do Assistente (System Prompt)
                      </Label>
                      <Textarea
                        id="openaiPrompt"
                        rows={3}
                        value={configuracoes.openaiSystemPrompt || ''}
                        onChange={(e) =>
                          setConfiguracoes({
                            ...configuracoes,
                            openaiSystemPrompt: e.target.value,
                          })
                        }
                        placeholder="Ex: Você é a assistente de atendimento da clínica Dra. Rosangela Santos. Seja cordial, acolhedora, responda dúvidas sobre tratamentos e sempre convide o paciente para uma avaliação presencial no JTR."
                        className="text-xs resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Define o tom de voz e como o ChatGPT deve responder aos pacientes.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Card Google Gemini AI */}
              <Card className="border-indigo-200 dark:border-indigo-900/40 shadow-sm">
                <CardHeader className="bg-indigo-50/50 dark:bg-indigo-950/20 py-3">
                  <CardTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 text-sm font-semibold">
                    <Sparkles className="h-4 w-4" />
                    Google Gemini AI (Importação & Scanner de Prontuários)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-3">
                  <div>
                    <Label htmlFor="geminiApiKey" className="text-xs">Chave de API (Google AI Studio)</Label>
                    <p className="text-[11px] text-muted-foreground mb-1.5">Usada alternativamente para ler prontuários em PDF/Imagens e extrair os dados automaticamente.</p>
                    <div className="flex gap-2">
                      <Input
                        id="geminiApiKey"
                        type="password"
                        value={configuracoes.geminiApiKey || ''}
                        onChange={(e) => setConfiguracoes({ ...configuracoes, geminiApiKey: e.target.value })}
                        placeholder="Ex: AIzaSy..."
                        className="text-xs font-mono"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

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


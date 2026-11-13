import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Lock,
  Sparkles,
  Calendar,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const ConfiguracoesAgenda: React.FC = () => {
  const { clinicaId, user } = useAuth();
  const effectiveId = clinicaId || user?.id || '';

  const [copiouWebcal, setCopiouWebcal] = useState(false);
  const [copiouHttps, setCopiouHttps] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://skonxcdojbkbfnfemayz.supabase.co';
  const rawUrl = `${supabaseUrl}/functions/v1/agenda-sync?token=${effectiveId}`;
  const webcalUrl = rawUrl.replace('https://', 'webcal://').replace('http://', 'webcal://');

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(
    webcalUrl
  )}`;

  const googleAgendaSubscribeUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(rawUrl)}`;

  const copiarWebcal = () => {
    navigator.clipboard.writeText(webcalUrl);
    setCopiouWebcal(true);
    setTimeout(() => setCopiouWebcal(false), 3000);
    toast.success('Link do iPhone copiado (WebCal)!');
  };

  const copiarHttps = () => {
    navigator.clipboard.writeText(rawUrl);
    setCopiouHttps(true);
    setTimeout(() => setCopiouHttps(false), 3000);
    toast.success('Link do Google Agenda copiado (HTTPS)!');
  };

  const abrirNoIPhone = () => {
    window.open(webcalUrl, '_blank');
  };

  const abrirNoGoogleAgenda = () => {
    window.open(googleAgendaSubscribeUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Card Principal de Sincronização Mobile / iPhone / Google */}
      <Card className="border-emerald-500/30 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Sincronizar no Celular e Google Agenda</h3>
                  <Badge className="bg-emerald-400/30 text-emerald-100 text-[10px] uppercase border-0 font-semibold tracking-wider">
                    Tempo Real
                  </Badge>
                </div>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Consultas e bloqueios de horários sincronizados automaticamente no app do iPhone e Google Calendar.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                onClick={abrirNoIPhone}
                className="flex-1 sm:flex-none bg-white hover:bg-emerald-50 text-emerald-800 font-semibold text-xs shadow-md shrink-0 gap-1.5"
              >
                <Smartphone className="h-3.5 w-3.5" />
                Abrir no iPhone
              </Button>
              <Button
                type="button"
                onClick={abrirNoGoogleAgenda}
                className="flex-1 sm:flex-none bg-emerald-950/40 hover:bg-emerald-950/60 text-white border border-white/20 font-semibold text-xs shadow-md shrink-0 gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" />
                Google Agenda
              </Button>
            </div>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
          <Tabs defaultValue="iphone" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="iphone" className="gap-2">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                iPhone / iPad (Apple Calendar)
              </TabsTrigger>
              <TabsTrigger value="google" className="gap-2">
                <Calendar className="h-4 w-4 text-blue-600" />
                Google Agenda / Android / Outlook
              </TabsTrigger>
            </TabsList>

            {/* ABA IPHONE */}
            <TabsContent value="iphone" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-4 bg-muted/40 rounded-xl border border-dashed border-border/80 text-center">
                  <div className="bg-white p-2 rounded-lg border shadow-xs mb-2">
                    <img src={qrCodeUrl} alt="QR Code iPhone" className="w-28 h-28 object-contain" />
                  </div>
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <QrCode className="h-3.5 w-3.5 text-emerald-600" />
                    Aponte a Câmera do iPhone
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">
                    Abra a câmera do celular no QR Code para assinar o calendário instantaneamente.
                  </p>
                </div>

                {/* Link e Ações */}
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      Link Exclusivo de Sincronização iPhone (WebCal)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={webcalUrl}
                        className="font-mono text-xs text-muted-foreground bg-muted/60 select-all"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={copiarWebcal}
                        className="shrink-0 gap-1.5 min-w-[90px]"
                      >
                        {copiouWebcal ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                        {copiouWebcal ? 'Copiado' : 'Copiar'}
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        onClick={abrirNoIPhone}
                        className="shrink-0 gap-1.5 hidden sm:inline-flex bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Abrir
                      </Button>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs space-y-1 text-foreground">
                    <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" />
                      Atualização Automática (Consultas e Bloqueios)
                    </p>
                    <p className="text-muted-foreground leading-relaxed text-[11px]">
                      Tanto as consultas marcadas quanto os horários bloqueados (almoço, reuniões, férias ou ausências) sincronizam direto no calendário nativo do iPhone e são atualizados a cada 15 minutos automaticamente.
                    </p>
                  </div>
                </div>
              </div>

              {/* Guia iPhone */}
              <div className="p-4 rounded-xl border bg-card space-y-2 mt-2">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-emerald-600" />
                  Passo a Passo Manual no iPhone / iPad (iOS)
                </h4>
                <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                  <li>No iPhone, abra <strong>Ajustes</strong>.</li>
                  <li>Toque em <strong>Apps</strong> &gt; <strong>Calendário</strong> (ou direto em <strong>Calendário</strong>) e depois em <strong>Contas do Calendário</strong>.</li>
                  <li>Toque em <strong>Adicionar Conta</strong> &gt; <strong>Outra</strong>.</li>
                  <li>Toque em <strong>Adicionar Assinatura de Calendário</strong>.</li>
                  <li>Cole o link WebCal copiado acima e toque em <strong>Seguinte</strong> e <strong>Salvar</strong>.</li>
                </ol>
              </div>
            </TabsContent>

            {/* ABA GOOGLE AGENDA */}
            <TabsContent value="google" className="space-y-4">
              <div className="p-4 rounded-xl border bg-card space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Link Direto para o Google Agenda (HTTPS)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    O Google Agenda requer links no formato padrão HTTPS para aceitar a assinatura sem rejeição.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Input
                      readOnly
                      value={rawUrl}
                      className="font-mono text-xs text-muted-foreground bg-muted/60 select-all"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copiarHttps}
                      className="shrink-0 gap-1.5 min-w-[90px]"
                    >
                      {copiouHttps ? <Check className="h-4 w-4 text-blue-600" /> : <Copy className="h-4 w-4" />}
                      {copiouHttps ? 'Copiado' : 'Copiar'}
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      onClick={abrirNoGoogleAgenda}
                      className="shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Adicionar ao Google
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs space-y-1 text-foreground">
                  <p className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    Como Adicionar no Google Agenda (Passo a Passo)
                  </p>
                  <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed pt-1">
                    <li>No computador ou navegador, acesse <strong>calendar.google.com</strong>.</li>
                    <li>Na lateral esquerda, role até a seção <strong>Outras agendas</strong> e clique no ícone <strong>+</strong>.</li>
                    <li>Escolha a opção <strong>Do URL</strong>.</li>
                    <li>Cole o link HTTPS copiado acima e marque ou deixe desmarcado tornar público.</li>
                    <li>Clique em <strong>Adicionar agenda</strong>. Em instantes suas consultas e bloqueios aparecerão no Google Agenda e no app Google Agenda do seu celular!</li>
                  </ol>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesAgenda;

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CalendarDays,
  Smartphone,
  Copy,
  Check,
  Download,
  ExternalLink,
  QrCode,
  Lock,
  Sparkles,
  Calendar,
  Globe,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ModalSincronizarCalendarioProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadICS: () => void;
  totalConsultas: number;
  totalBloqueios: number;
}

export const ModalSincronizarCalendario: React.FC<ModalSincronizarCalendarioProps> = ({
  isOpen,
  onClose,
  onDownloadICS,
  totalConsultas,
  totalBloqueios,
}) => {
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
    toast.success('Link do Google copiado (HTTPS)!');
  };

  const abrirNoIPhone = () => {
    window.open(webcalUrl, '_blank');
  };

  const abrirNoGoogleAgenda = () => {
    window.open(googleAgendaSubscribeUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border shadow-2xl">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/20 rounded-lg shrink-0">
              <Smartphone className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                Sincronizar no iPhone / Google Agenda
                <Badge className="bg-emerald-400/30 text-emerald-100 text-[10px] uppercase border-0 font-semibold">
                  Tempo Real
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-emerald-100 text-xs mt-0.5">
                Suas consultas e bloqueios aparecem direto nos aplicativos de calendário do celular.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto">
          {/* Resumo do que será sincronizado */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Sincronizando no Calendário:</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[11px] gap-1 font-semibold">
                🦷 {totalConsultas} {totalConsultas === 1 ? 'consulta' : 'consultas'}
              </Badge>
              <Badge variant="outline" className="text-[11px] gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400 font-semibold bg-amber-50/50 dark:bg-amber-950/30">
                <Lock className="h-3 w-3" />
                {totalBloqueios} {totalBloqueios === 1 ? 'bloqueio' : 'bloqueios'}
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="iphone" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-3">
              <TabsTrigger value="iphone" className="gap-1.5 text-xs">
                <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                iPhone / iPad
              </TabsTrigger>
              <TabsTrigger value="google" className="gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5 text-blue-600" />
                Google Agenda
              </TabsTrigger>
            </TabsList>

            {/* ABA IPHONE */}
            <TabsContent value="iphone" className="space-y-3">
              <div className="rounded-xl border p-3 bg-card shadow-xs space-y-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Ao assinar no iPhone, novas consultas e <strong>bloqueios de horário</strong> (almoço, reuniões, férias) sincronizam automaticamente a cada 15 minutos.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  <div className="bg-white p-1.5 rounded-lg border shadow-xs shrink-0 flex flex-col items-center">
                    <img src={qrCodeUrl} alt="QR Code iPhone" className="w-24 h-24 object-contain" />
                    <span className="text-[9px] font-bold text-muted-foreground mt-0.5 uppercase tracking-wider">
                      Câmera do iPhone
                    </span>
                  </div>

                  <div className="flex-1 space-y-2 w-full text-center sm:text-left">
                    <Button
                      type="button"
                      onClick={abrirNoIPhone}
                      className="w-full h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Abrir no Calendário do iPhone
                    </Button>

                    <div className="flex gap-1.5">
                      <Input
                        readOnly
                        value={webcalUrl}
                        className="h-7 text-[10px] font-mono bg-muted/50 select-all"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copiarWebcal}
                        className="h-7 px-2 text-xs shrink-0"
                      >
                        {copiouWebcal ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        {copiouWebcal ? 'Copiado' : 'Copiar'}
                      </Button>
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      💡 <strong>No iPhone:</strong> Ajustes &gt; Calendário &gt; Contas &gt; Adicionar Conta &gt; Outra &gt; Assinatura de Calendário.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ABA GOOGLE */}
            <TabsContent value="google" className="space-y-3">
              <div className="rounded-xl border p-3 bg-card shadow-xs space-y-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O Google Agenda exige links no formato seguro HTTPS para aceitar a assinatura sem rejeição.
                </p>

                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={abrirNoGoogleAgenda}
                    className="w-full h-8 text-xs font-semibold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Adicionar Direto ao Google Agenda
                  </Button>

                  <div className="flex gap-1.5">
                    <Input
                      readOnly
                      value={rawUrl}
                      className="h-7 text-[10px] font-mono bg-muted/50 select-all"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copiarHttps}
                      className="h-7 px-2 text-xs shrink-0"
                    >
                      {copiouHttps ? <Check className="h-3 w-3 text-blue-600" /> : <Copy className="h-3 w-3" />}
                      {copiouHttps ? 'Copiado' : 'Copiar Link'}
                    </Button>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    💡 <strong>Passo manual:</strong> No Google Agenda no PC &gt; <em>Outras agendas (+)</em> &gt; <em>Do URL</em> &gt; Cole o link HTTPS acima.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Opção 2: Download do arquivo .ics */}
          <div className="rounded-xl border p-3 bg-muted/20 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                Baixar Arquivo Completo (.ics)
              </span>
              <p className="text-[11px] text-muted-foreground">
                Arquivo estático contendo todas as consultas e bloqueios atuais.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadICS}
              className="h-8 text-xs font-medium shrink-0 gap-1"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar (.ics)
            </Button>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-4 py-2.5 border-t bg-muted/30 flex justify-end shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

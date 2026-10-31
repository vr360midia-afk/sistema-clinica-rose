import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Lock,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const ConfiguracoesAgenda: React.FC = () => {
  const { clinicaId } = useAuth();
  const [copiou, setCopiou] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sua-url-supabase.supabase.co';
  const rawUrl = `${supabaseUrl}/functions/v1/agenda-sync?token=${clinicaId}`;
  const webcalUrl = rawUrl.replace('https://', 'webcal://').replace('http://', 'webcal://');
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(
    webcalUrl
  )}`;

  const copiarLink = () => {
    navigator.clipboard.writeText(webcalUrl);
    setCopiou(true);
    setTimeout(() => setCopiou(false), 3000);
    toast.success('Link do calendário copiado com sucesso!');
  };

  const abrirNoIPhone = () => {
    window.open(webcalUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Card Principal de Sincronização Mobile / iPhone */}
      <Card className="border-emerald-500/30 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-white">Sincronizar no iPhone / Celular</h3>
                  <Badge className="bg-emerald-400/30 text-emerald-100 text-[10px] uppercase border-0 font-semibold tracking-wider">
                    Tempo Real
                  </Badge>
                </div>
                <p className="text-xs text-emerald-100 mt-0.5">
                  Suas consultas e bloqueios de agenda sincronizados automaticamente no app Calendário nativo.
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={abrirNoIPhone}
              className="w-full sm:w-auto bg-white hover:bg-emerald-50 text-emerald-800 font-semibold text-xs shadow-md shrink-0 gap-1.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Sincronizar no iPhone Agora
            </Button>
          </div>
        </div>

        <CardContent className="p-6 space-y-6">
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
                  Link Exclusivo de Sincronização (WebCal)
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
                    onClick={copiarLink}
                    className="shrink-0 gap-1.5 min-w-[90px]"
                  >
                    {copiou ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copiou ? 'Copiado' : 'Copiar'}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => window.open(webcalUrl, '_blank')}
                    className="shrink-0 gap-1.5 hidden sm:inline-flex bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Link
                  </Button>
                </div>
              </div>

              {/* Informações de sincronização */}
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs space-y-1 text-foreground">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Atualização Automática Bidirecional
                </p>
                <p className="text-muted-foreground leading-relaxed text-[11px]">
                  Sempre que uma nova consulta for agendada ou um horário for bloqueado (almoço, ausência, férias), seu aplicativo de calendário atualizará automaticamente sem necessidade de reinserir o link.
                </p>
              </div>
            </div>
          </div>

          {/* Guia Passo a Passo */}
          <div className="pt-4 border-t grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-emerald-600" />
                Passo a Passo no iPhone / iPad (iOS)
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                <li>Acesse <strong>Ajustes</strong> no seu iPhone.</li>
                <li>Toque em <strong>Calendário</strong> e depois em <strong>Contas</strong>.</li>
                <li>Escolha <strong>Adicionar Conta</strong> &gt; <strong>Outra</strong>.</li>
                <li>Toque em <strong>Adicionar Assinatura de Calendário</strong>.</li>
                <li>Cole o link copiado acima e toque em <strong>Seguinte</strong> e <strong>Salvar</strong>.</li>
              </ol>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-blue-600" />
                Passo a Passo no Google Agenda / Outlook
              </h4>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal pl-4 leading-relaxed">
                <li>No computador, acesse <strong>calendar.google.com</strong>.</li>
                <li>Na barra lateral esquerda, encontre <strong>Outras agendas</strong>.</li>
                <li>Clique no ícone <strong>+</strong> e selecione <strong>Do URL</strong>.</li>
                <li>Cole o link WebCal gerado acima e clique em <strong>Adicionar agenda</strong>.</li>
                <li>As consultas e bloqueios passarão a sincronizar no app do celular.</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfiguracoesAgenda;

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Copy, ExternalLink, CalendarDays } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const ConfiguracoesAgenda = () => {
  const { clinicaId } = useAuth();

  // Supabase edge function URL (substitute project reference in production if needed, but relative or environment variable is better)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://sua-url-supabase.supabase.co';
  
  // Generating the WebCal link
  const rawUrl = `${supabaseUrl}/functions/v1/agenda-sync?token=${clinicaId}`;
  const webcalUrl = rawUrl.replace('https://', 'webcal://').replace('http://', 'webcal://');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webcalUrl);
    toast.success('Link do calendário copiado!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5" />
          Sincronização de Agenda (WebCal)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Sincronize as consultas do sistema diretamente no calendário do seu celular (iPhone/Apple Calendar, Google Agenda, Outlook). As alterações feitas no sistema refletirão automaticamente no seu calendário pessoal.
        </p>

        <div className="space-y-2 pt-2 border-t mt-4">
          <Label>Seu Link Exclusivo de Sincronização (WebCal)</Label>
          <div className="flex gap-2">
            <Input 
              readOnly 
              value={webcalUrl} 
              className="font-mono text-xs text-muted-foreground bg-muted" 
            />
            <Button variant="outline" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-2" /> Copiar
            </Button>
            <Button variant="default" onClick={() => window.open(webcalUrl, '_blank')}>
              <ExternalLink className="h-4 w-4 mr-2" /> Testar / Abrir
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>No iPhone:</strong> Ajustes &gt; Calendário &gt; Contas &gt; Adicionar Conta &gt; Outra &gt; Adicionar Assinatura de Calendário. Cole o link acima.
            <br />
            <strong>No Google Agenda:</strong> Acesse pelo computador, vá em "Outras agendas" no canto esquerdo, clique no botão "+" &gt; "Do URL" e cole o link acima.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ConfiguracoesAgenda;

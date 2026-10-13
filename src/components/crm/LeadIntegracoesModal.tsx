import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Copy,
  Check,
  Zap,
  Globe,
  Share2,
  Sparkles,
  ExternalLink,
  Code2,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LeadIntegracoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCriado?: () => void;
}

export const LeadIntegracoesModal: React.FC<LeadIntegracoesModalProps> = ({
  isOpen,
  onClose,
  onLeadCriado,
}) => {
  const [copiouUrl, setCopiouUrl] = useState(false);
  const [simulando, setSimulando] = useState(false);

  // Obtém o project ref do Supabase a partir do cliente
  const supabaseUrl = (supabase as any)?.supabaseUrl || 'https://seu-projeto.supabase.co';
  const webhookUrl = `${supabaseUrl}/functions/v1/crm-webhook`;

  const handleCopiarUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiouUrl(true);
    toast.success('URL do Webhook copiada!');
    setTimeout(() => setCopiouUrl(false), 2500);
  };

  // Simula o disparo de um lead como se viesse do Meta Ads ou Site
  const handleSimularLeadMetaAds = async () => {
    setSimulando(true);
    try {
      const nomesExemplo = [
        'Camila Cavalcante',
        'Rodrigo Albuquerque',
        'Fernanda Vasconcelos',
        'Mariana Lins',
        'Lucas Peixoto',
      ];
      const nomeSorteado = nomesExemplo[Math.floor(Math.random() * nomesExemplo.length)];
      const telSorteado = `(82) 99${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data, error } = await supabase
        .from('crm_leads')
        .insert([
          {
            nome: nomeSorteado,
            telefone: telSorteado,
            status: 'novo',
            origem: 'Meta Ads',
            campanha: 'Campanha Resinas / Implantes - Instagram',
            valor_estimado: 2500,
            observacoes: 'Lead capturado automaticamente do formulário do Instagram Ads.',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      toast.success(`🎉 Lead de teste de "${nomeSorteado}" criado com sucesso!`, {
        description: 'Verifique a coluna "Novo Lead" no seu Kanban agora.',
      });

      if (onLeadCriado) onLeadCriado();
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao simular envio de lead');
    } finally {
      setSimulando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-base sm:text-lg">
                Puxar Leads Automaticamente no CRM
              </DialogTitle>
              <DialogDescription className="text-xs">
                Integração em tempo real com Meta Ads (Instagram/Facebook), Site e Landing Pages.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card de URL do Webhook */}
          <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-primary" />
                Sua URL do Webhook do CRM:
              </span>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300">
                <Radio className="h-2 w-2 mr-1 animate-pulse" /> Ativo & Realtime
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={webhookUrl}
                className="h-8 text-xs font-mono bg-background select-all"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCopiarUrl}
                className="h-8 shrink-0 text-xs gap-1"
              >
                {copiouUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copiouUrl ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Qualquer lead enviado para este endereço por <strong>POST</strong> entra instantaneamente no CRM sem precisar recarregar a tela.
            </p>
          </div>

          <Tabs defaultValue="meta" className="w-full">
            <TabsList className="grid grid-cols-3 h-8 text-xs">
              <TabsTrigger value="meta">Meta Ads (Instagram)</TabsTrigger>
              <TabsTrigger value="site">Site & Agendamento</TabsTrigger>
              <TabsTrigger value="json">Exemplo Payload</TabsTrigger>
            </TabsList>

            {/* Aba 1: Meta Ads */}
            <TabsContent value="meta" className="space-y-3 pt-2 text-xs">
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <p>
                  Para conectar o <strong>Meta Ads (Lead Ads do Facebook & Instagram)</strong>:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1">
                  <li>
                    <strong className="text-foreground">Via Make.com / Zapier / n8n (Mais recomendado):</strong> Crie um cenário conectando o gatilho <em>"Facebook Lead Ads (New Lead)"</em> para disparar uma requisição <em>HTTP POST</em> para a URL do Webhook acima.
                  </li>
                  <li>
                    <strong className="text-foreground">Mapeamento dos campos:</strong>
                    <div className="bg-muted p-2 rounded font-mono text-[11px] my-1 text-foreground">
                      nome: {`"{{full_name}}"`}, telefone: {`"{{phone_number}}"`}, origem: "Meta Ads"
                    </div>
                  </li>
                  <li>
                    Assim que a pessoa clicar no anúncio e preencher o formulário no Instagram, o card surge <strong>automaticamente no seu Kanban em menos de 2 segundos</strong>!
                  </li>
                </ol>
              </div>
            </TabsContent>

            {/* Aba 2: Site & Agendamento */}
            <TabsContent value="site" className="space-y-3 pt-2 text-xs">
              <div className="space-y-2 text-muted-foreground leading-relaxed">
                <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/40 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-emerald-800 dark:text-emerald-200 block">
                      Agendamento Online Já Integrado!
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Toda solicitação preenchida na página pública de agendamento (<code>/agendar</code>) já cria automaticamente um lead no CRM com o status <em>Novo Lead</em> e origem <em>Site</em>.
                    </span>
                  </div>
                </div>

                <p>
                  Se você tiver uma página externa em <strong>WordPress / Elementor / Wix</strong>, basta configurar o formulário para enviar via <em>Webhook</em> com método POST para a URL fornecida acima.
                </p>
              </div>
            </TabsContent>

            {/* Aba 3: Exemplo JSON */}
            <TabsContent value="json" className="space-y-2 pt-2 text-xs">
              <p className="text-muted-foreground">Envie uma requisição HTTP POST para a URL com este formato JSON:</p>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] overflow-x-auto">
{`{
  "nome": "Maria Silva",
  "telefone": "(82) 99888-7777",
  "email": "maria@exemplo.com",
  "origem": "Meta Ads",
  "campanha": "Implantes Dentários",
  "valor_estimado": 3500,
  "observacoes": "Interessada em avaliação nesta quinta-feira"
}`}
              </pre>
            </TabsContent>
          </Tabs>

          {/* Seção de Teste ao Vivo */}
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-blue-900 dark:text-blue-100 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Quer ver funcionando agora?
              </span>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Gere um lead simulado do Meta Ads para ver o card caindo ao vivo na tela.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              disabled={simulando}
              onClick={handleSimularLeadMetaAds}
              className="h-8 text-xs shrink-0 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Zap className="h-3.5 w-3.5" />
              {simulando ? 'Criando...' : 'Testar Lead ao Vivo'}
            </Button>
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeadIntegracoesModal;


import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Instagram, 
  MessageCircle, 
  Users,
  Bell,
  Settings,
  Plus
} from 'lucide-react';
import InstagramPostCreator from '@/components/comunicacao/InstagramPostCreator';
import WhatsAppManager from '@/components/comunicacao/WhatsAppManager';
import WhatsAppConversas from '@/components/comunicacao/WhatsAppConversas';
import PlatformLogin from '@/components/comunicacao/PlatformLogin';

const Comunicacao = () => {
  const [activeTab, setActiveTab] = useState('instagram');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Comunicação</h1>
            <p className="text-muted-foreground">Marketing digital e comunicação com pacientes</p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-pink-100">
                  <Instagram className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Instagram</p>
                  <p className="text-xl font-bold">-</p>
                  <p className="text-xs text-muted-foreground">não conectado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-100">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <p className="text-xl font-bold">-</p>
                  <p className="text-xs text-muted-foreground">não conectado</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Alcance</p>
                  <p className="text-xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">este mês</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-purple-100">
                  <Bell className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lembretes</p>
                  <p className="text-xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Principais */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
            <TabsTrigger value="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Instagram
            </TabsTrigger>
            <TabsTrigger value="conversas" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="platforms" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Plataformas
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instagram">
            <InstagramPostCreator />
          </TabsContent>

          <TabsContent value="conversas">
            <WhatsAppConversas />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppManager />
          </TabsContent>


          <TabsContent value="platforms">
            <PlatformLogin />
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Campanhas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-muted-foreground mb-4">
                    <Settings className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma campanha encontrada</h3>
                  <p className="text-muted-foreground">Crie sua primeira campanha de marketing para começar.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Comunicacao;

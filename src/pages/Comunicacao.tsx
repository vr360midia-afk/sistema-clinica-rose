
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Instagram, 
  MessageCircle, 
  Send, 
  Image, 
  Calendar,
  Users,
  Bell,
  Settings,
  Plus
} from 'lucide-react';
import InstagramPostCreator from '@/components/comunicacao/InstagramPostCreator';
import WhatsAppManager from '@/components/comunicacao/WhatsAppManager';

const mockCampaigns = [
  {
    id: 1,
    title: 'Campanha Clareamento Dental',
    platform: 'Instagram',
    status: 'active',
    reach: 1250,
    engagement: 8.5
  },
  {
    id: 2,
    title: 'Lembrete Consultas',
    platform: 'WhatsApp',
    status: 'scheduled',
    sent: 45,
    delivered: 43
  }
];

const Comunicacao = () => {
  const [activeTab, setActiveTab] = useState('instagram');

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Comunicação</h1>
            <p className="text-gray-600">Marketing digital e comunicação com pacientes</p>
          </div>
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-pink-100">
                  <Instagram className="h-5 w-5 text-pink-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Instagram</p>
                  <p className="text-xl font-bold">1.2k</p>
                  <p className="text-xs text-gray-500">seguidores</p>
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
                  <p className="text-sm text-gray-600">WhatsApp</p>
                  <p className="text-xl font-bold">98%</p>
                  <p className="text-xs text-gray-500">entrega</p>
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
                  <p className="text-sm text-gray-600">Alcance</p>
                  <p className="text-xl font-bold">3.5k</p>
                  <p className="text-xs text-gray-500">este mês</p>
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
                  <p className="text-sm text-gray-600">Lembretes</p>
                  <p className="text-xl font-bold">156</p>
                  <p className="text-xs text-gray-500">enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Principais */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="instagram" className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              Instagram
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instagram">
            <InstagramPostCreator />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppManager />
          </TabsContent>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Campanhas Ativas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockCampaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-gray-100">
                          {campaign.platform === 'Instagram' ? (
                            <Instagram className="h-5 w-5 text-pink-600" />
                          ) : (
                            <MessageCircle className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{campaign.title}</div>
                          <div className="text-sm text-gray-600">{campaign.platform}</div>
                          {campaign.reach && (
                            <div className="text-sm text-gray-500">
                              Alcance: {campaign.reach} • Engajamento: {campaign.engagement}%
                            </div>
                          )}
                          {campaign.sent && (
                            <div className="text-sm text-gray-500">
                              Enviados: {campaign.sent} • Entregues: {campaign.delivered}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge 
                        className={
                          campaign.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }
                      >
                        {campaign.status === 'active' ? 'Ativo' : 'Agendado'}
                      </Badge>
                    </div>
                  ))}
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

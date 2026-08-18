
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Settings, Wifi, Bell, Shield, Database, MessageSquare, UserCog } from 'lucide-react';
import DentistasManager from '@/components/configuracoes/DentistasManager';

const Configuracoes = () => {
  const { toast } = useToast();
  const [configuracoes, setConfiguracoes] = useState({
    // Configurações da Clínica
    nomeClinica: 'Clínica Dental IA',
    endereco: 'Rua das Flores, 123',
    telefone: '(11) 9999-9999',
    email: 'contato@dentalIA.com.br',
    cnpj: '12.345.678/0001-90',
    
    // APIs
    whatsappToken: '',
    instagramToken: '',
    asaasToken: '',
    
    // Notificações
    emailNotificacoes: true,
    whatsappLembretes: true,
    lembrete24h: true,
    lembrete2h: true,
    
    // Backup
    backupAutomatico: true,
    frequenciaBackup: 'diario',
  });

  const salvarConfiguracoes = () => {
    console.log('Salvando configurações:', configuracoes);
    toast({
      title: "Configurações salvas!",
      description: "As configurações foram atualizadas com sucesso.",
    });
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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Configurações</h1>
          </div>
          <Button onClick={salvarConfiguracoes} className="bg-blue-600 hover:bg-blue-700">
            Salvar Configurações
          </Button>
        </div>

        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="dentistas"><UserCog className="h-4 w-4 mr-1" />Dentistas</TabsTrigger>
            <TabsTrigger value="apis">APIs</TabsTrigger>
            <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
            <TabsTrigger value="backup">Backup</TabsTrigger>
          </TabsList>

          <TabsContent value="dentistas">
            <DentistasManager />
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
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={configuracoes.cnpj}
                      onChange={(e) => setConfiguracoes({...configuracoes, cnpj: e.target.value})}
                    />
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
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={configuracoes.email}
                      onChange={(e) => setConfiguracoes({...configuracoes, email: e.target.value})}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
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
                        value={configuracoes.whatsappToken}
                        onChange={(e) => setConfiguracoes({...configuracoes, whatsappToken: e.target.value})}
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
                        value={configuracoes.instagramToken}
                        onChange={(e) => setConfiguracoes({...configuracoes, instagramToken: e.target.value})}
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
                        value={configuracoes.asaasToken}
                        onChange={(e) => setConfiguracoes({...configuracoes, asaasToken: e.target.value})}
                        placeholder="Digite o token da API do ASAAS"
                      />
                      <Button variant="outline" onClick={() => testarConexao('ASAAS')}>
                        <Wifi className="h-4 w-4 mr-2" />
                        Testar
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
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
                    <p className="text-sm text-gray-500">Receber notificações importantes por email</p>
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
                    <p className="text-sm text-gray-500">Enviar lembretes de consulta via WhatsApp</p>
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
                    <p className="text-sm text-gray-500">Enviar lembrete com 24 horas de antecedência</p>
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
                    <p className="text-sm text-gray-500">Enviar lembrete com 2 horas de antecedência</p>
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
                    <p className="text-sm text-gray-500">Fazer backup automático dos dados</p>
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
                  <Button variant="outline" className="mr-2">
                    <Database className="h-4 w-4 mr-2" />
                    Fazer Backup Agora
                  </Button>
                  <Button variant="outline">
                    <Shield className="h-4 w-4 mr-2" />
                    Restaurar Backup
                  </Button>
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

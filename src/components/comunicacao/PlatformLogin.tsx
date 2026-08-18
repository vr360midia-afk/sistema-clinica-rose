
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Instagram, MessageCircle, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';

const PlatformLogin = () => {
  const [connections, setConnections] = useState({
    instagram: { connected: false, username: '', accessToken: '' },
    whatsapp: { connected: false, phoneNumber: '', businessId: '' }
  });

  const [loginData, setLoginData] = useState({
    instagramUsername: '',
    instagramToken: '',
    whatsappPhone: '',
    whatsappBusinessId: ''
  });

  const connectInstagram = () => {
    if (!loginData.instagramUsername || !loginData.instagramToken) {
      toast.error('Preencha todos os campos do Instagram');
      return;
    }

    setConnections(prev => ({
      ...prev,
      instagram: {
        connected: true,
        username: loginData.instagramUsername,
        accessToken: loginData.instagramToken
      }
    }));

    toast.success('Instagram conectado com sucesso!');
    setLoginData(prev => ({ ...prev, instagramUsername: '', instagramToken: '' }));
  };

  const connectWhatsApp = () => {
    if (!loginData.whatsappPhone || !loginData.whatsappBusinessId) {
      toast.error('Preencha todos os campos do WhatsApp');
      return;
    }

    setConnections(prev => ({
      ...prev,
      whatsapp: {
        connected: true,
        phoneNumber: loginData.whatsappPhone,
        businessId: loginData.whatsappBusinessId
      }
    }));

    toast.success('WhatsApp Business conectado com sucesso!');
    setLoginData(prev => ({ ...prev, whatsappPhone: '', whatsappBusinessId: '' }));
  };

  const disconnectPlatform = (platform: 'instagram' | 'whatsapp') => {
    setConnections(prev => ({
      ...prev,
      [platform]: { connected: false, username: '', accessToken: '', phoneNumber: '', businessId: '' }
    }));

    const platformName = platform === 'instagram' ? 'Instagram' : 'WhatsApp Business';
    toast.success(`${platformName} desconectado!`);
  };

  return (
    <div className="space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Para conectar suas redes sociais, você precisará dos tokens de acesso das respectivas APIs. 
          Consulte a documentação de cada plataforma para obter essas credenciais.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Instagram */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Instagram className="h-5 w-5 text-pink-600" />
                Instagram Business
              </div>
              <Badge 
                className={
                  connections.instagram.connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-muted text-foreground'
                }
              >
                {connections.instagram.connected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {connections.instagram.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      @{connections.instagram.username}
                    </p>
                    <p className="text-sm text-green-600">Conta conectada com sucesso</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Funcionalidades Disponíveis:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Publicação automática de posts</li>
                    <li>• Agendamento de conteúdo</li>
                    <li>• Analytics básicos</li>
                    <li>• Gestão de hashtags</li>
                  </ul>
                </div>

                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => disconnectPlatform('instagram')}
                  className="w-full"
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome de Usuário</label>
                  <Input
                    placeholder="@sua_clinica"
                    value={loginData.instagramUsername}
                    onChange={(e) => setLoginData(prev => ({ ...prev, instagramUsername: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Access Token</label>
                  <Input
                    type="password"
                    placeholder="Instagram Basic Display API Token"
                    value={loginData.instagramToken}
                    onChange={(e) => setLoginData(prev => ({ ...prev, instagramToken: e.target.value }))}
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Obtenha seu Access Token no Meta for Developers. É necessário uma conta Instagram Business conectada a uma página do Facebook.
                  </AlertDescription>
                </Alert>

                <Button 
                  onClick={connectInstagram}
                  className="w-full bg-pink-600 hover:bg-pink-700"
                >
                  Conectar Instagram
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Business */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-green-600" />
                WhatsApp Business
              </div>
              <Badge 
                className={
                  connections.whatsapp.connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-muted text-foreground'
                }
              >
                {connections.whatsapp.connected ? 'Conectado' : 'Desconectado'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {connections.whatsapp.connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">
                      {connections.whatsapp.phoneNumber}
                    </p>
                    <p className="text-sm text-green-600">Conta business conectada</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Funcionalidades Disponíveis:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Envio de mensagens em massa</li>
                    <li>• Templates personalizados</li>
                    <li>• Relatórios de entrega</li>
                    <li>• Automação de lembretes</li>
                  </ul>
                </div>

                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => disconnectPlatform('whatsapp')}
                  className="w-full"
                >
                  Desconectar
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Número de Telefone</label>
                  <Input
                    placeholder="+55 11 99999-9999"
                    value={loginData.whatsappPhone}
                    onChange={(e) => setLoginData(prev => ({ ...prev, whatsappPhone: e.target.value }))}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Business Account ID</label>
                  <Input
                    placeholder="WhatsApp Business Account ID"
                    value={loginData.whatsappBusinessId}
                    onChange={(e) => setLoginData(prev => ({ ...prev, whatsappBusinessId: e.target.value }))}
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Configure uma conta WhatsApp Business API através do Meta Business. É necessário aprovação e verificação da Meta.
                  </AlertDescription>
                </Alert>

                <Button 
                  onClick={connectWhatsApp}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Conectar WhatsApp Business
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Status das Integrações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Instagram className="h-5 w-5 text-pink-600" />
                <span>Instagram Business</span>
              </div>
              <Badge 
                className={
                  connections.instagram.connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-muted text-foreground'
                }
              >
                {connections.instagram.connected ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-green-600" />
                <span>WhatsApp Business</span>
              </div>
              <Badge 
                className={
                  connections.whatsapp.connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-muted text-foreground'
                }
              >
                {connections.whatsapp.connected ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformLogin;

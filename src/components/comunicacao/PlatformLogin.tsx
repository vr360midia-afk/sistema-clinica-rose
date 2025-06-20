
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Instagram, MessageCircle, Settings, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  connected: boolean;
  fields: Array<{
    name: string;
    label: string;
    type: string;
    placeholder: string;
  }>;
}

const platforms: Platform[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    icon: <Instagram className="h-5 w-5" />,
    connected: false,
    fields: [
      { name: 'username', label: 'Nome de Usuário', type: 'text', placeholder: '@seuconsultorio' },
      { name: 'accessToken', label: 'Token de Acesso', type: 'password', placeholder: 'Cole seu token aqui' }
    ]
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    icon: <MessageCircle className="h-5 w-5" />,
    connected: false,
    fields: [
      { name: 'phoneNumber', label: 'Número do WhatsApp', type: 'text', placeholder: '(11) 99999-9999' },
      { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'Sua chave da API'  }
    ]
  }
];

const PlatformLogin = () => {
  const [platformStates, setPlatformStates] = useState<Record<string, boolean>>(
    platforms.reduce((acc, platform) => ({ ...acc, [platform.id]: false }), {})
  );
  const [formData, setFormData] = useState<Record<string, Record<string, string>>>({});

  const handleConnect = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    if (!platform) return;

    const data = formData[platformId] || {};
    const hasAllFields = platform.fields.every(field => data[field.name]?.trim());

    if (!hasAllFields) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    // Simulate connection
    setPlatformStates(prev => ({ ...prev, [platformId]: true }));
    toast.success(`${platform.name} conectado com sucesso!`);
  };

  const handleDisconnect = (platformId: string) => {
    const platform = platforms.find(p => p.id === platformId);
    setPlatformStates(prev => ({ ...prev, [platformId]: false }));
    setFormData(prev => ({ ...prev, [platformId]: {} }));
    toast.success(`${platform?.name} desconectado`);
  };

  const updateFormData = (platformId: string, fieldName: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        [fieldName]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Conectar Plataformas</h2>
        <p className="text-gray-600">Configure suas integrações com redes sociais e sistemas de comunicação</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((platform) => (
          <Card key={platform.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {platform.icon}
                  {platform.name}
                </div>
                <Badge 
                  className={platformStates[platform.id] 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                  }
                >
                  {platformStates[platform.id] ? (
                    <>
                      <Check className="h-3 w-3 mr-1" />
                      Conectado
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3 mr-1" />
                      Desconectado
                    </>
                  )}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!platformStates[platform.id] ? (
                <>
                  {platform.fields.map((field) => (
                    <div key={field.name}>
                      <Label htmlFor={`${platform.id}-${field.name}`}>{field.label}</Label>
                      <Input
                        id={`${platform.id}-${field.name}`}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={formData[platform.id]?.[field.name] || ''}
                        onChange={(e) => updateFormData(platform.id, field.name, e.target.value)}
                      />
                    </div>
                  ))}
                  <Button 
                    onClick={() => handleConnect(platform.id)}
                    className="w-full"
                  >
                    Conectar {platform.name}
                  </Button>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <Check className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-green-700 font-medium">Conectado com sucesso!</p>
                    <p className="text-sm text-green-600 mt-1">
                      Suas postagens e mensagens serão sincronizadas automaticamente.
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={() => handleDisconnect(platform.id)}
                    className="w-full"
                  >
                    Desconectar
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Instruções de Configuração */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Como obter as credenciais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <Instagram className="h-4 w-4" />
              Instagram
            </h4>
            <ol className="text-sm text-gray-600 space-y-1 ml-4">
              <li>1. Acesse o Facebook Developers</li>
              <li>2. Crie um app do Instagram Basic Display</li>
              <li>3. Configure as permissões necessárias</li>
              <li>4. Copie o token de acesso gerado</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <MessageCircle className="h-4 w-4" />
              WhatsApp Business
            </h4>
            <ol className="text-sm text-gray-600 space-y-1 ml-4">
              <li>1. Acesse o WhatsApp Business Platform</li>
              <li>2. Configure seu número comercial</li>
              <li>3. Gere uma API Key</li>
              <li>4. Configure os webhooks necessários</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlatformLogin;

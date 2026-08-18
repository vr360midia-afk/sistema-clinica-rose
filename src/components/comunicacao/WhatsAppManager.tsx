
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageCircle, Send, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';

const WhatsAppManager = () => {
  const { pacientes } = useDentalSystem();
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);

  const messageTemplates = [
    {
      id: 'appointment_reminder',
      name: 'Lembrete de Consulta',
      message: 'Olá {nome}! 😊\n\nEste é um lembrete da sua consulta marcada para {data} às {hora}.\n\nPor favor, confirme sua presença.\n\nObrigado!\nClínica Dental'
    },
    {
      id: 'appointment_confirmation',
      name: 'Confirmação de Agendamento',
      message: 'Olá {nome}! 🦷\n\nSua consulta foi agendada com sucesso!\n\nData: {data}\nHorário: {hora}\n\nNos vemos em breve!\nClínica Dental'
    },
    {
      id: 'birthday',
      name: 'Aniversário',
      message: 'Parabéns, {nome}! 🎉🎂\n\nDesejamos um feliz aniversário e muitas alegrias!\n\nQue tal agendar sua consulta de rotina? Entre em contato conosco!\n\nClínica Dental'
    },
    {
      id: 'routine_checkup',
      name: 'Consulta de Rotina',
      message: 'Olá {nome}! 😊\n\nJá faz um tempo desde sua última consulta. Que tal agendar sua consulta de rotina?\n\nA prevenção é o melhor cuidado!\n\nClínica Dental'
    },
    {
      id: 'treatment_followup',
      name: 'Acompanhamento de Tratamento',
      message: 'Olá {nome}! 👋\n\nComo você está se sentindo após o tratamento?\n\nQualquer dúvida ou desconforto, entre em contato conosco.\n\nClínica Dental'
    }
  ];

  const recentCampaigns = [
    {
      id: 1,
      name: 'Lembretes de Consulta - Janeiro',
      sent: 45,
      delivered: 43,
      read: 41,
      replied: 38,
      status: 'completed'
    },
    {
      id: 2,
      name: 'Campanha Aniversário',
      sent: 12,
      delivered: 12,
      read: 10,
      replied: 8,
      status: 'active'
    },
    {
      id: 3,
      name: 'Consultas de Rotina',
      sent: 28,
      delivered: 27,
      read: 25,
      replied: 15,
      status: 'completed'
    }
  ];

  const handleSendMessage = () => {
    if (!selectedTemplate && !customMessage.trim()) {
      toast.error('Selecione um template ou escreva uma mensagem');
      return;
    }

    if (selectedPatients.length === 0) {
      toast.error('Selecione pelo menos um paciente');
      return;
    }

    const message = selectedTemplate 
      ? messageTemplates.find(t => t.id === selectedTemplate)?.message || ''
      : customMessage;

    toast.success(`Mensagem enviada para ${selectedPatients.length} paciente(s)!`);
    
    // Reset
    setSelectedTemplate('');
    setCustomMessage('');
    setSelectedPatients([]);
  };

  const togglePatientSelection = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  const selectAllPatients = () => {
    if (selectedPatients.length === pacientes.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(pacientes.map(p => p.id));
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="send" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="send">Enviar Mensagens</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Composer */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  Nova Mensagem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Template</label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {messageTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mensagem Personalizada</label>
                  <Textarea
                    placeholder="Ou escreva sua própria mensagem..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={6}
                  />
                </div>

                {selectedTemplate && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium mb-1">Preview do Template:</p>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {messageTemplates.find(t => t.id === selectedTemplate)?.message}
                    </p>
                  </div>
                )}

                <Button onClick={handleSendMessage} className="w-full bg-green-600 hover:bg-green-700">
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para {selectedPatients.length} paciente(s)
                </Button>
              </CardContent>
            </Card>

            {/* Seleção de Pacientes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Pacientes ({selectedPatients.length}/{pacientes.length})
                  </span>
                  <Button variant="outline" size="sm" onClick={selectAllPatients}>
                    {selectedPatients.length === pacientes.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {pacientes.map((paciente) => (
                    <div
                      key={paciente.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedPatients.includes(paciente.id)
                          ? 'bg-green-50 border-green-200'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => togglePatientSelection(paciente.id)}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedPatients.includes(paciente.id)
                          ? 'bg-green-600 border-green-600'
                          : 'border-gray-300'
                      }`}>
                        {selectedPatients.includes(paciente.id) && (
                          <CheckCircle className="h-3 w-3 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{paciente.nome}</p>
                        <p className="text-xs text-gray-500">{paciente.telefone}</p>
                      </div>
                      <Badge variant={paciente.status === 'Ativo' ? 'default' : 'secondary'}>
                        {paciente.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Mensagem</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {messageTemplates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{template.name}</h4>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedTemplate(template.id)}
                      >
                        Usar Template
                      </Button>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {template.message}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns">
          <Card>
            <CardHeader>
              <CardTitle>Campanhas Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentCampaigns.map((campaign) => (
                  <div key={campaign.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{campaign.name}</h4>
                      <Badge 
                        className={
                          campaign.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {campaign.status === 'active' ? 'Ativo' : 'Concluído'}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-lg font-semibold text-blue-600">{campaign.sent}</div>
                        <div className="text-xs text-gray-500">Enviadas</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-green-600">{campaign.delivered}</div>
                        <div className="text-xs text-gray-500">Entregues</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-purple-600">{campaign.read}</div>
                        <div className="text-xs text-gray-500">Lidas</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-orange-600">{campaign.replied}</div>
                        <div className="text-xs text-gray-500">Respondidas</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WhatsAppManager;

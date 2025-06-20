
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageCircle, 
  Send, 
  Clock, 
  Users,
  Calendar,
  Bell,
  Settings,
  Plus,
  CheckCircle
} from 'lucide-react';

const messageTemplates = [
  {
    id: 1,
    title: 'Lembrete de Consulta',
    message: 'Olá {nome}! Lembramos que você tem consulta agendada para {data} às {hora}. Confirme sua presença respondendo este WhatsApp. Dentiwise Clínica.',
    category: 'reminder'
  },
  {
    id: 2,
    title: 'Confirmação de Agendamento',
    message: 'Olá {nome}! Sua consulta foi agendada para {data} às {hora}. Endereço: Rua das Flores, 123. Em caso de dúvidas, entre em contato. Dentiwise Clínica.',
    category: 'confirmation'
  },
  {
    id: 3,
    title: 'Aniversário',
    message: 'Feliz aniversário, {nome}! 🎉 Que este novo ano seja repleto de sorrisos saudáveis! Aproveite 20% de desconto na sua próxima consulta. Dentiwise Clínica.',
    category: 'birthday'
  },
  {
    id: 4,
    title: 'Retorno',
    message: 'Olá {nome}! Como está se sentindo após o procedimento? É importante agendar seu retorno. Entre em contato conosco! Dentiwise Clínica.',
    category: 'followup'
  }
];

const scheduledMessages = [
  {
    id: 1,
    patient: 'Maria Silva',
    message: 'Lembrete de consulta para amanhã às 14:00',
    scheduledFor: '2024-01-20 08:00',
    status: 'scheduled'
  },
  {
    id: 2,
    patient: 'João Santos',
    message: 'Confirmação de agendamento',
    scheduledFor: '2024-01-19 16:30',
    status: 'sent'
  }
];

const WhatsAppManager = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'sent': return 'Enviado';
      case 'scheduled': return 'Agendado';
      case 'failed': return 'Falhou';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="send" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send">Enviar Mensagem</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Agendadas</TabsTrigger>
        </TabsList>

        <TabsContent value="send">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Formulário de Envio */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Nova Mensagem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Selecionar Pacientes</label>
                  <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                    <div className="space-y-2">
                      {['Maria Silva', 'João Santos', 'Ana Costa', 'Carlos Lima'].map((patient) => (
                        <label key={patient} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300"
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPatients([...selectedPatients, patient]);
                              } else {
                                setSelectedPatients(selectedPatients.filter(p => p !== patient));
                              }
                            }}
                          />
                          <span className="text-sm">{patient}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedPatients.length} paciente(s) selecionado(s)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mensagem</label>
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    rows={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {customMessage.length}/1000 caracteres
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Agendar Envio (opcional)</label>
                  <Input
                    type="datetime-local"
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <Button className="flex-1">
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Agora
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Clock className="h-4 w-4 mr-2" />
                    Agendar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview da Mensagem */}
            <Card>
              <CardHeader>
                <CardTitle>Preview da Mensagem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-green-100 rounded-lg p-4 max-w-xs ml-auto">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm">
                      {customMessage || 'Digite uma mensagem para ver o preview...'}
                    </p>
                    <div className="flex justify-end items-center gap-1 mt-2">
                      <span className="text-xs text-gray-500">14:30</span>
                      <CheckCircle className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Templates de Mensagem</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {messageTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : ''
                      }`}
                      onClick={() => {
                        setSelectedTemplate(template.id);
                        setCustomMessage(template.message);
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{template.title}</h4>
                        <Badge variant="secondary" className="text-xs">
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {template.message}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Editar Template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nome do Template</label>
                  <Input placeholder="Ex: Lembrete de Consulta" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mensagem</label>
                  <Textarea
                    placeholder="Use {nome}, {data}, {hora} para personalizar..."
                    rows={6}
                  />
                </div>
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  <strong>Variáveis disponíveis:</strong><br />
                  {'{nome}'} - Nome do paciente<br />
                  {'{data}'} - Data da consulta<br />
                  {'{hora}'} - Horário da consulta
                </div>
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Salvar Template
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="scheduled">
          <Card>
            <CardHeader>
              <CardTitle>Mensagens Agendadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {scheduledMessages.map((msg) => (
                  <div key={msg.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-green-100">
                        <MessageCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium">{msg.patient}</div>
                        <div className="text-sm text-gray-600">{msg.message}</div>
                        <div className="text-sm text-gray-500">
                          Agendado para: {msg.scheduledFor}
                        </div>
                      </div>
                    </div>
                    <Badge className={getStatusColor(msg.status)}>
                      {getStatusText(msg.status)}
                    </Badge>
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


import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard,
  FileText,
  Download,
  Upload,
  Heart
} from 'lucide-react';

interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  lastVisit: string;
  nextAppointment?: string | null;
  status: string;
  insurance: string;
  procedures: string[];
  totalSpent: number;
}

interface PatientDetailsProps {
  patient: Patient;
}

const mockDocuments = [
  { id: 1, name: 'RX Panorâmico.pdf', date: '15/01/2024', type: 'Exame' },
  { id: 2, name: 'Orçamento Implante.pdf', date: '10/01/2024', type: 'Orçamento' },
  { id: 3, name: 'Ficha Anamnese.pdf', date: '05/01/2024', type: 'Ficha' }
];

const mockHistory = [
  {
    id: 1,
    date: '15/01/2024',
    procedure: 'Limpeza + Flúor',
    dentist: 'Dr. João Silva',
    value: 150,
    status: 'Concluído'
  },
  {
    id: 2,
    date: '20/12/2023',
    procedure: 'Restauração Dente 16',
    dentist: 'Dr. João Silva',
    value: 350,
    status: 'Concluído'
  },
  {
    id: 3,
    date: '15/11/2023',
    procedure: 'Consulta Avaliação',
    dentist: 'Dr. Ana Costa',
    value: 100,
    status: 'Concluído'
  }
];

const PatientDetails = ({ patient }: PatientDetailsProps) => {
  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    const age = today.getFullYear() - birth.getFullYear();
    return age;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Paciente */}
      <div className="flex items-start gap-6 p-6 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-2xl font-bold text-blue-600">
            {patient.name.split(' ').map(n => n[0]).join('')}
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              {calculateAge(patient.birthDate)} anos
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4" />
              {patient.phone}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4" />
              {patient.email}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Heart className="h-4 w-4" />
              {patient.insurance}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <Badge className={patient.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
              {patient.status}
            </Badge>
            <span className="text-sm text-gray-600">
              Total gasto: <strong>R$ {patient.totalSpent.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Tabs de Detalhes */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="financial">Financeiro</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Próximas Consultas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {patient.nextAppointment ? (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="font-medium">Consulta de Retorno</div>
                    <div className="text-sm text-gray-600">{patient.nextAppointment} - 14:00</div>
                    <div className="text-sm text-gray-600">Dr. João Silva</div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma consulta agendada</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Agendar Consulta
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Procedimentos Realizados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {patient.procedures.map((procedure, index) => (
                    <Badge key={index} variant="secondary">
                      {procedure}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Procedimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.procedure}</div>
                      <div className="text-sm text-gray-600">{item.dentist}</div>
                      <div className="text-sm text-gray-500">{item.date}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">R$ {item.value}</div>
                      <Badge className="bg-green-100 text-green-800">
                        {item.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documentos
                </CardTitle>
                <Button size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 rounded">
                        <FileText className="h-4 w-4 text-red-600" />
                      </div>
                      <div>
                        <div className="font-medium">{doc.name}</div>
                        <div className="text-sm text-gray-600">{doc.type} • {doc.date}</div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Resumo Financeiro
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Total Gasto</span>
                  <span className="font-semibold">R$ {patient.totalSpent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Valor Pendente</span>
                  <span className="font-semibold text-orange-600">R$ 450</span>
                </div>
                <div className="flex justify-between">
                  <span>Desconto Total</span>
                  <span className="font-semibold text-green-600">R$ 125</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formas de Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>PIX</span>
                  <span>60%</span>
                </div>
                <div className="flex justify-between">
                  <span>Cartão de Crédito</span>
                  <span>30%</span>
                </div>
                <div className="flex justify-between">
                  <span>Dinheiro</span>
                  <span>10%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PatientDetails;

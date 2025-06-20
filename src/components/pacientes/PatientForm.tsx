
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import PatientPhotoUpload from './PatientPhotoUpload';

interface PatientFormProps {
  onClose: () => void;
  onSave: (patientData: any) => void;
  patient?: any;
}

const PatientForm = ({ onClose, onSave, patient }: PatientFormProps) => {
  const [formData, setFormData] = useState({
    nome: patient?.nome || '',
    email: patient?.email || '',
    telefone: patient?.telefone || '',
    idade: patient?.idade || '',
    endereco: patient?.endereco || '',
    cpf: patient?.cpf || '',
    rg: patient?.rg || '',
    profissao: patient?.profissao || '',
    estadoCivil: patient?.estadoCivil || '',
    convenio: patient?.convenio || '',
    foto: patient?.foto || null,
    historicoMedico: patient?.historicoMedico || '',
    alergias: patient?.alergias || '',
    medicamentos: patient?.medicamentos || '',
    ultimaConsulta: patient?.ultimaConsulta || '',
    observacoes: patient?.observacoes || ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    if (!formData.nome || !formData.email || !formData.telefone) {
      toast.error('Preencha os campos obrigatórios: Nome, Email e Telefone');
      return;
    }

    const patientData = {
      ...formData,
      id: patient?.id || Date.now(),
      status: 'Ativo',
      dataCadastro: patient?.dataCadastro || new Date().toLocaleDateString('pt-BR')
    };

    onSave(patientData);
    toast.success(patient ? 'Paciente atualizado com sucesso!' : 'Paciente cadastrado com sucesso!');
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {patient ? 'Editar Paciente' : 'Novo Paciente'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados Pessoais */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome Completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    placeholder="Nome completo do paciente"
                  />
                </div>
                <div>
                  <Label htmlFor="idade">Idade</Label>
                  <Input
                    id="idade"
                    type="number"
                    value={formData.idade}
                    onChange={(e) => handleInputChange('idade', e.target.value)}
                    placeholder="Idade"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="telefone">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => handleInputChange('telefone', e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => handleInputChange('cpf', e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="rg">RG</Label>
                  <Input
                    id="rg"
                    value={formData.rg}
                    onChange={(e) => handleInputChange('rg', e.target.value)}
                    placeholder="00.000.000-0"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="endereco">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange('endereco', e.target.value)}
                  placeholder="Endereço completo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="profissao">Profissão</Label>
                  <Input
                    id="profissao"
                    value={formData.profissao}
                    onChange={(e) => handleInputChange('profissao', e.target.value)}
                    placeholder="Profissão"
                  />
                </div>
                <div>
                  <Label htmlFor="estadoCivil">Estado Civil</Label>
                  <Select value={formData.estadoCivil} onValueChange={(value) => handleInputChange('estadoCivil', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                      <SelectItem value="casado">Casado(a)</SelectItem>
                      <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="convenio">Convênio</Label>
                <Select value={formData.convenio} onValueChange={(value) => handleInputChange('convenio', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o convênio..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">Particular</SelectItem>
                    <SelectItem value="unimed">Unimed</SelectItem>
                    <SelectItem value="bradesco">Bradesco Dental</SelectItem>
                    <SelectItem value="amil">Amil</SelectItem>
                    <SelectItem value="sulamerica">SulAmérica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Histórico Médico */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Histórico Médico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ultimaConsulta">Quando foi a última consulta?</Label>
                <Input
                  id="ultimaConsulta"
                  type="date"
                  value={formData.ultimaConsulta}
                  onChange={(e) => handleInputChange('ultimaConsulta', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="historicoMedico">Histórico Médico</Label>
                <Textarea
                  id="historicoMedico"
                  value={formData.historicoMedico}
                  onChange={(e) => handleInputChange('historicoMedico', e.target.value)}
                  placeholder="Descreva o histórico médico do paciente..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="alergias">Alergias</Label>
                <Textarea
                  id="alergias"
                  value={formData.alergias}
                  onChange={(e) => handleInputChange('alergias', e.target.value)}
                  placeholder="Liste as alergias conhecidas..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="medicamentos">Medicamentos em Uso</Label>
                <Textarea
                  id="medicamentos"
                  value={formData.medicamentos}
                  onChange={(e) => handleInputChange('medicamentos', e.target.value)}
                  placeholder="Liste os medicamentos que o paciente está tomando..."
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="observacoes">Observações Gerais</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Foto do Paciente */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Foto do Paciente</CardTitle>
            </CardHeader>
            <CardContent>
              <PatientPhotoUpload
                currentPhoto={formData.foto}
                onPhotoChange={(photo) => handleInputChange('foto', photo || '')}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
          <Save className="h-4 w-4 mr-2" />
          {patient ? 'Atualizar' : 'Salvar'} Paciente
        </Button>
      </div>
    </div>
  );
};

export default PatientForm;

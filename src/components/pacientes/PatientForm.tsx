
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientPhotoCapture from './PatientPhotoCapture';

interface PatientFormProps {
  onClose: () => void;
  patient?: any;
}

const PatientForm = ({ onClose, patient }: PatientFormProps) => {
  const { addPaciente, updatePaciente } = useDentalSystem();
  const [loading, setLoading] = useState(false);
  
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
    origemLead: patient?.origemLead || '',
    foto: patient?.foto || null,
    historicoMedico: patient?.historicoMedico || '',
    alergias: patient?.alergias || '',
    medicamentos: patient?.medicamentos || '',
    ultimaConsulta: patient?.ultimaConsulta || '',
    observacoes: patient?.observacoes || ''
  });

  console.log('PatientForm mounted:', { patient, formData });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateFormData = () => {
    const errors = [];
    
    if (!formData.nome.trim()) {
      errors.push('Nome é obrigatório');
    }
    
    if (!formData.email.trim()) {
      errors.push('Email é obrigatório');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Email deve ter um formato válido');
    }
    
    if (!formData.telefone.trim()) {
      errors.push('Telefone é obrigatório');
    }
    
    if (!formData.convenio) {
      errors.push('Convênio é obrigatório');
    }
    
    if (!formData.origemLead) {
      errors.push('Origem do lead é obrigatória');
    }
    
    return errors;
  };

  const handleSave = async () => {
    console.log('Attempting to save patient:', formData);
    
    const validationErrors = validateFormData();
    if (validationErrors.length > 0) {
      toast.error(`Corrija os seguintes campos: ${validationErrors.join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      const patientData = {
        ...formData,
        status: patient?.status || 'Ativo',
        // Garantir que ultimaConsulta seja uma string
        ultimaConsulta: formData.ultimaConsulta.trim(),
        // Converter idade para número se fornecida
        idade: formData.idade ? parseInt(formData.idade.toString()) : 0,
      };

      console.log('Patient data to save:', patientData);

      if (patient) {
        console.log('Updating existing patient with ID:', patient.id);
        await updatePaciente(patient.id, patientData);
        toast.success(`Paciente ${formData.nome} atualizado com sucesso!`);
      } else {
        console.log('Creating new patient');
        const newPatient = await addPaciente(patientData);
        console.log('New patient created:', newPatient);
        toast.success(`Paciente ${formData.nome} cadastrado com sucesso!`);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving patient:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao salvar paciente: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {patient ? 'Editar Paciente' : 'Novo Paciente'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dados Pessoais */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome" className="font-medium">Nome Completo *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    placeholder="Nome completo do paciente"
                    className="h-10 mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="idade" className="font-medium">Idade</Label>
                  <Input
                    id="idade"
                    type="number"
                    value={formData.idade}
                    onChange={(e) => handleInputChange('idade', e.target.value)}
                    placeholder="Idade"
                    className="h-10 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email" className="font-medium">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="email@exemplo.com"
                    className="h-10 mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="telefone" className="font-medium">Telefone *</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => handleInputChange('telefone', e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="h-10 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cpf" className="font-medium">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => handleInputChange('cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    className="h-10 mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="rg" className="font-medium">RG</Label>
                  <Input
                    id="rg"
                    value={formData.rg}
                    onChange={(e) => handleInputChange('rg', e.target.value)}
                    placeholder="00.000.000-0"
                    className="h-10 mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="endereco" className="font-medium">Endereço</Label>
                <Input
                  id="endereco"
                  value={formData.endereco}
                  onChange={(e) => handleInputChange('endereco', e.target.value)}
                  placeholder="Endereço completo"
                  className="h-10 mt-1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="profissao" className="font-medium">Profissão</Label>
                  <Input
                    id="profissao"
                    value={formData.profissao}
                    onChange={(e) => handleInputChange('profissao', e.target.value)}
                    placeholder="Profissão"
                    className="h-10 mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="estadoCivil" className="font-medium">Estado Civil</Label>
                  <Select value={formData.estadoCivil} onValueChange={(value) => handleInputChange('estadoCivil', value)}>
                    <SelectTrigger className="h-10 mt-1">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="convenio" className="font-medium">Convênio *</Label>
                  <Select value={formData.convenio} onValueChange={(value) => handleInputChange('convenio', value)}>
                    <SelectTrigger className="h-10 mt-1">
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
                <div>
                  <Label htmlFor="origemLead" className="font-medium">Origem do Lead *</Label>
                  <Select value={formData.origemLead} onValueChange={(value) => handleInputChange('origemLead', value)}>
                    <SelectTrigger className="h-10 mt-1">
                      <SelectValue placeholder="Como conheceu a clínica?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indicacao">Indicação</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="site">Site</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="panfleto">Panfleto</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Histórico Médico */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Histórico Médico</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="ultimaConsulta" className="font-medium">Quando foi a última consulta odontológica?</Label>
                <Input
                  id="ultimaConsulta"
                  value={formData.ultimaConsulta}
                  onChange={(e) => handleInputChange('ultimaConsulta', e.target.value)}
                  placeholder="Ex: 6 meses atrás, 1 ano, nunca fui, etc."
                  className="h-10 mt-1"
                />
              </div>

              <div>
                <Label htmlFor="historicoMedico" className="font-medium">Histórico Médico</Label>
                <Textarea
                  id="historicoMedico"
                  value={formData.historicoMedico}
                  onChange={(e) => handleInputChange('historicoMedico', e.target.value)}
                  placeholder="Descreva o histórico médico do paciente..."
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="alergias" className="font-medium">Alergias</Label>
                  <Textarea
                    id="alergias"
                    value={formData.alergias}
                    onChange={(e) => handleInputChange('alergias', e.target.value)}
                    placeholder="Liste as alergias conhecidas..."
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
                <div>
                  <Label htmlFor="medicamentos" className="font-medium">Medicamentos em Uso</Label>
                  <Textarea
                    id="medicamentos"
                    value={formData.medicamentos}
                    onChange={(e) => handleInputChange('medicamentos', e.target.value)}
                    placeholder="Liste os medicamentos que o paciente está tomando..."
                    rows={2}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes" className="font-medium">Observações Gerais</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleInputChange('observacoes', e.target.value)}
                  placeholder="Observações adicionais..."
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Foto do Paciente */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-semibold">Foto do Paciente</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <PatientPhotoCapture
                currentPhoto={formData.foto}
                onPhotoChange={(photo) => handleInputChange('foto', photo || '')}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t bg-gray-50 -mx-6 px-6 py-4">
        <Button variant="outline" onClick={onClose} disabled={loading} className="min-w-[120px]">
          Cancelar
        </Button>
        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 min-w-[140px]" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {patient ? 'Atualizar' : 'Salvar'} Paciente
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default PatientForm;

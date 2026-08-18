import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Clipboard, Save, Plus, Eye, ArrowLeft, FileSignature } from 'lucide-react';
import PatientSelector from '@/components/anamnese/PatientSelector';
import SignatureModal from '@/components/signature/SignatureModal';
import { SignatureData } from '@/components/signature/DigitalSignature';
import { useSignatures } from '@/hooks/useSignatures';
import { useDentalSystem } from '@/context/DentalSystemContext';

const Anamnese = () => {
  const { toast } = useToast();
  const { saveSignature, generateSignedPDF } = useSignatures();
  const { anamneses } = useDentalSystem();
  const [showForm, setShowForm] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentSigner, setCurrentSigner] = useState<'paciente' | 'dentista'>('paciente');
  const [patientSignature, setPatientSignature] = useState<SignatureData | null>(null);
  const [dentistSignature, setDentistSignature] = useState<SignatureData | null>(null);
  
  const [formData, setFormData] = useState({
    patientId: '',
    medicamento: '',
    medicamentoDescricao: '',
    alergia: '',
    alergiaDescricao: '',
    pressao: '',
    problemasCoracao: '',
    problemasCoracaoDescricao: '',
    faltaAr: '',
    diabetes: '',
    sangramento: '',
    cicatrizacao: '',
    cirurgia: '',
    cirurgiaDescricao: '',
    gestante: '',
    gestanteSemanas: '',
    problemasSaude: '',
    reacaoAnestesia: '',
    reacaoAnestesiaDescricao: '',
    ultimoTratamento: '',
    dorDentes: '',
    gengivaSangra: '',
    gostoRuim: '',
    escovacoes: '',
    fioDental: '',
    doresMaxilar: '',
    rangeDentes: '',
    feridaLabios: '',
    fuma: '',
    fumaQuantidade: ''
  });

  const handleSave = () => {
    if (!formData.patientId) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um paciente.",
        variant: "destructive"
      });
      return;
    }

    // Iniciar processo de assinatura com o paciente
    setCurrentSigner('paciente');
    setShowSignatureModal(true);
  };

  const handleSignatureComplete = (signatureData: SignatureData) => {
    if (currentSigner === 'paciente') {
      setPatientSignature(signatureData);
      saveSignature(signatureData, `anamnese-${Date.now()}`, formData.patientId);
      
      // Após assinatura do paciente, solicitar assinatura do dentista
      setCurrentSigner('dentista');
      setShowSignatureModal(true);
    } else {
      setDentistSignature(signatureData);
      saveSignature(signatureData, `anamnese-${Date.now()}`, formData.patientId);
      
      // Finalizar processo
      toast({
        title: "Anamnese salva com sucesso!",
        description: "Documento assinado digitalmente por ambas as partes.",
      });
      
      // Gerar PDF com assinaturas
      const documentContent = `ANAMNESE ODONTOLÓGICA\n\nPaciente: [Nome do Paciente]\nData: ${new Date().toLocaleDateString()}\n\n[Conteúdo da anamnese...]`;
      generateSignedPDF(documentContent, [patientSignature!, signatureData]);
      
      // Reset form
      setShowForm(false);
      setPatientSignature(null);
      setDentistSignature(null);
      setFormData({
        patientId: '',
        medicamento: '',
        medicamentoDescricao: '',
        alergia: '',
        alergiaDescricao: '',
        pressao: '',
        problemasCoracao: '',
        problemasCoracaoDescricao: '',
        faltaAr: '',
        diabetes: '',
        sangramento: '',
        cicatrizacao: '',
        cirurgia: '',
        cirurgiaDescricao: '',
        gestante: '',
        gestanteSemanas: '',
        problemasSaude: '',
        reacaoAnestesia: '',
        reacaoAnestesiaDescricao: '',
        ultimoTratamento: '',
        dorDentes: '',
        gengivaSangra: '',
        gostoRuim: '',
        escovacoes: '',
        fioDental: '',
        doresMaxilar: '',
        rangeDentes: '',
        feridaLabios: '',
        fuma: '',
        fumaQuantidade: ''
      });
    }
  };

  const getCurrentSignerName = () => {
    if (currentSigner === 'paciente') {
      return 'Paciente Selecionado'; // Em um caso real, você pegaria o nome do paciente
    }
    return 'Dr. Dentista'; // Em um caso real, você pegaria o nome do dentista logado
  };

  if (showForm) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Clipboard className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nova Anamnese</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                <FileSignature className="h-4 w-4 mr-2" />
                Finalizar e Assinar
              </Button>
            </div>
          </div>

          {/* Status das assinaturas */}
          {(patientSignature || dentistSignature) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Status das Assinaturas:</h3>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${patientSignature ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>Paciente: {patientSignature ? 'Assinado' : 'Pendente'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${dentistSignature ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span>Dentista: {dentistSignature ? 'Assinado' : 'Pendente'}</span>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Questionário de Anamnese</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Seletor de Paciente */}
              <PatientSelector
                value={formData.patientId}
                onChange={(value) => setFormData({...formData, patientId: value})}
              />

              {/* Seção: Medicamentos e Alergias */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Medicamentos e Alergias</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Está tomando algum medicamento?</Label>
                    <RadioGroup 
                      value={formData.medicamento} 
                      onValueChange={(value) => setFormData({...formData, medicamento: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="med-sim" />
                        <Label htmlFor="med-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="med-nao" />
                        <Label htmlFor="med-nao">Não</Label>
                      </div>
                    </RadioGroup>
                    {formData.medicamento === 'sim' && (
                      <div className="mt-3">
                        <Label className="text-sm">Quais (posologia e dose)?</Label>
                        <Input
                          placeholder="Descreva os medicamentos, posologia e dose..."
                          value={formData.medicamentoDescricao}
                          onChange={(e) => setFormData({...formData, medicamentoDescricao: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Tem algum tipo de alergia?</Label>
                    <RadioGroup 
                      value={formData.alergia} 
                      onValueChange={(value) => setFormData({...formData, alergia: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="aler-sim" />
                        <Label htmlFor="aler-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="aler-nao" />
                        <Label htmlFor="aler-nao">Não</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao-sei" id="aler-nao-sei" />
                        <Label htmlFor="aler-nao-sei">Não Sei</Label>
                      </div>
                    </RadioGroup>
                    {formData.alergia === 'sim' && (
                      <div className="mt-3">
                        <Label className="text-sm">Qual?</Label>
                        <Input
                          placeholder="Descreva as alergias..."
                          value={formData.alergiaDescricao}
                          onChange={(e) => setFormData({...formData, alergiaDescricao: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção: Condições Médicas */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Condições Médicas Gerais</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Sua pressão é:</Label>
                    <RadioGroup 
                      value={formData.pressao} 
                      onValueChange={(value) => setFormData({...formData, pressao: value})}
                      className="flex flex-col gap-2 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="normal" id="pressao-normal" />
                        <Label htmlFor="pressao-normal">Normal</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="alta" id="pressao-alta" />
                        <Label htmlFor="pressao-alta">Alta</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="baixa" id="pressao-baixa" />
                        <Label htmlFor="pressao-baixa">Baixa</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="controlada" id="pressao-controlada" />
                        <Label htmlFor="pressao-controlada">Controlada com medicamento</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Tem ou teve algum problema de coração?</Label>
                    <RadioGroup 
                      value={formData.problemasCoracao} 
                      onValueChange={(value) => setFormData({...formData, problemasCoracao: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="coracao-sim" />
                        <Label htmlFor="coracao-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="coracao-nao" />
                        <Label htmlFor="coracao-nao">Não</Label>
                      </div>
                    </RadioGroup>
                    {formData.problemasCoracao === 'sim' && (
                      <div className="mt-3">
                        <Label className="text-sm">Qual?</Label>
                        <Input
                          placeholder="Descreva o problema cardíaco..."
                          value={formData.problemasCoracaoDescricao}
                          onChange={(e) => setFormData({...formData, problemasCoracaoDescricao: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Sente falta de ar com frequência?</Label>
                    <RadioGroup 
                      value={formData.faltaAr} 
                      onValueChange={(value) => setFormData({...formData, faltaAr: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="falta-ar-sim" />
                        <Label htmlFor="falta-ar-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="falta-ar-nao" />
                        <Label htmlFor="falta-ar-nao">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Tem diabetes?</Label>
                    <RadioGroup 
                      value={formData.diabetes} 
                      onValueChange={(value) => setFormData({...formData, diabetes: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="diabetes-sim" />
                        <Label htmlFor="diabetes-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="diabetes-nao" />
                        <Label htmlFor="diabetes-nao">Não</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao-sei" id="diabetes-nao-sei" />
                        <Label htmlFor="diabetes-nao-sei">Não Sei</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Quando se corta há um sangramento:</Label>
                    <RadioGroup 
                      value={formData.sangramento} 
                      onValueChange={(value) => setFormData({...formData, sangramento: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="normal" id="sangramento-normal" />
                        <Label htmlFor="sangramento-normal">Normal</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="excessivo" id="sangramento-excessivo" />
                        <Label htmlFor="sangramento-excessivo">Excessivo</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Sua cicatrização é:</Label>
                    <RadioGroup 
                      value={formData.cicatrizacao} 
                      onValueChange={(value) => setFormData({...formData, cicatrizacao: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="normal" id="cicatrizacao-normal" />
                        <Label htmlFor="cicatrizacao-normal">Normal</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="complicada" id="cicatrizacao-complicada" />
                        <Label htmlFor="cicatrizacao-complicada">Complicada</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Já fez alguma cirurgia?</Label>
                    <RadioGroup 
                      value={formData.cirurgia} 
                      onValueChange={(value) => setFormData({...formData, cirurgia: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="cirurgia-sim" />
                        <Label htmlFor="cirurgia-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="cirurgia-nao" />
                        <Label htmlFor="cirurgia-nao">Não</Label>
                      </div>
                    </RadioGroup>
                    {formData.cirurgia === 'sim' && (
                      <div className="mt-3">
                        <Label className="text-sm">Qual?</Label>
                        <Input
                          placeholder="Descreva a cirurgia realizada..."
                          value={formData.cirurgiaDescricao}
                          onChange={(e) => setFormData({...formData, cirurgiaDescricao: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Gestante?</Label>
                    <RadioGroup 
                      value={formData.gestante} 
                      onValueChange={(value) => setFormData({...formData, gestante: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="gestante-sim" />
                        <Label htmlFor="gestante-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="gestante-nao" />
                        <Label htmlFor="gestante-nao">Não</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao-sei" id="gestante-nao-sei" />
                        <Label htmlFor="gestante-nao-sei">Não Sei</Label>
                      </div>
                    </RadioGroup>
                    {formData.gestante === 'sim' && (
                      <div className="mt-3">
                        <Label className="text-sm">Semanas:</Label>
                        <Input
                          placeholder="Número de semanas..."
                          value={formData.gestanteSemanas}
                          onChange={(e) => setFormData({...formData, gestanteSemanas: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="problemasSaude" className="text-sm font-medium">Problemas de saúde que já teve:</Label>
                  <Textarea
                    id="problemasSaude"
                    value={formData.problemasSaude}
                    onChange={(e) => setFormData({...formData, problemasSaude: e.target.value})}
                    className="mt-2"
                    rows={3}
                    placeholder="Descreva problemas de saúde anteriores..."
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Já teve alguma reação com anestesia dental?</Label>
                  <RadioGroup 
                    value={formData.reacaoAnestesia} 
                    onValueChange={(value) => setFormData({...formData, reacaoAnestesia: value})}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="anestesia-sim" />
                      <Label htmlFor="anestesia-sim">Sim</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="anestesia-nao" />
                      <Label htmlFor="anestesia-nao">Não</Label>
                    </div>
                  </RadioGroup>
                  {formData.reacaoAnestesia === 'sim' && (
                    <div className="mt-3">
                      <Label className="text-sm">Qual?</Label>
                      <Input
                        placeholder="Descreva a reação à anestesia..."
                        value={formData.reacaoAnestesiaDescricao}
                        onChange={(e) => setFormData({...formData, reacaoAnestesiaDescricao: e.target.value})}
                        className="mt-1"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label htmlFor="ultimoTratamento" className="text-sm font-medium">Quando foi seu último tratamento dentário?</Label>
                  <Input
                    id="ultimoTratamento"
                    value={formData.ultimoTratamento}
                    onChange={(e) => setFormData({...formData, ultimoTratamento: e.target.value})}
                    className="mt-2"
                    placeholder="Ex: Há 6 meses, há 1 ano, nunca fiz..."
                  />
                </div>
              </div>

              {/* Seção: Saúde Bucal */}
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Saúde Bucal</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Tem sentido alguma dor nos dentes ou na gengiva?</Label>
                    <RadioGroup 
                      value={formData.dorDentes} 
                      onValueChange={(value) => setFormData({...formData, dorDentes: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="dor-sim" />
                        <Label htmlFor="dor-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="dor-nao" />
                        <Label htmlFor="dor-nao">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Sua gengiva sangra?</Label>
                    <RadioGroup 
                      value={formData.gengivaSangra} 
                      onValueChange={(value) => setFormData({...formData, gengivaSangra: value})}
                      className="flex flex-col gap-2 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="gengiva-sim" />
                        <Label htmlFor="gengiva-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="gengiva-nao" />
                        <Label htmlFor="gengiva-nao">Não</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="durante-higiene" id="gengiva-higiene" />
                        <Label htmlFor="gengiva-higiene">Durante a higiene</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="as-vezes" id="gengiva-as-vezes" />
                        <Label htmlFor="gengiva-as-vezes">Às vezes</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Tem sentido gosto ruim na boca ou boca seca?</Label>
                    <RadioGroup 
                      value={formData.gostoRuim} 
                      onValueChange={(value) => setFormData({...formData, gostoRuim: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="gosto-sim" />
                        <Label htmlFor="gosto-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="gosto-nao" />
                        <Label htmlFor="gosto-nao">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label htmlFor="escovacoes" className="text-sm font-medium">Quantas vezes escova os dentes por dia?</Label>
                    <Input
                      id="escovacoes"
                      value={formData.escovacoes}
                      onChange={(e) => setFormData({...formData, escovacoes: e.target.value})}
                      className="mt-2"
                      placeholder="Ex: 2 vezes, 3 vezes..."
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Usa fio dental?</Label>
                    <RadioGroup 
                      value={formData.fioDental} 
                      onValueChange={(value) => setFormData({...formData, fioDental: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="diariamente" id="fio-diariamente" />
                        <Label htmlFor="fio-diariamente">Diariamente</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="as-vezes" id="fio-as-vezes" />
                        <Label htmlFor="fio-as-vezes">Às vezes</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Sente dores ou estalos no maxilar ou no ouvido?</Label>
                    <RadioGroup 
                      value={formData.doresMaxilar} 
                      onValueChange={(value) => setFormData({...formData, doresMaxilar: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="maxilar-sim" />
                        <Label htmlFor="maxilar-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="maxilar-nao" />
                        <Label htmlFor="maxilar-nao">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Range os dentes de dia ou de noite?</Label>
                    <RadioGroup 
                      value={formData.rangeDentes} 
                      onValueChange={(value) => setFormData({...formData, rangeDentes: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="range-sim" />
                        <Label htmlFor="range-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="range-nao" />
                        <Label htmlFor="range-nao">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Já teve alguma ferida ou bolha na face ou nos lábios?</Label>
                    <RadioGroup 
                      value={formData.feridaLabios} 
                      onValueChange={(value) => setFormData({...formData, feridaLabios: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="ferida-sim" />
                        <Label htmlFor="ferida-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="ferida-nao" />
                        <Label htmlFor="ferida-nao">Não</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">Fuma?</Label>
                    <RadioGroup 
                      value={formData.fuma} 
                      onValueChange={(value) => setFormData({...formData, fuma: value})}
                      className="flex gap-4 mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sim" id="fuma-sim" />
                        <Label htmlFor="fuma-sim">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nao" id="fuma-nao" />
                        <Label htmlFor="fuma-nao">Não</Label>
                      </div>
                    </RadioGroup>
                    {formData.fuma === 'sim' && (
                      <div className="mt-3">
                        <Label className="text-sm">Quantidade:</Label>
                        <Input
                          placeholder="Ex: 1 maço por dia, 5 cigarros por dia..."
                          value={formData.fumaQuantidade}
                          onChange={(e) => setFormData({...formData, fumaQuantidade: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Declaração */}
              <div className="p-4 bg-gray-50 border-l-4 border-blue-500 rounded">
                <p className="text-sm text-gray-700 italic">
                  <strong>Declaração:</strong> Declaro para fins de direito que as informações acima prestadas são verdadeiras, 
                  assumindo a responsabilidade por omissões ou informações incorretas.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Modal de Assinatura */}
          <SignatureModal
            isOpen={showSignatureModal}
            onClose={() => setShowSignatureModal(false)}
            title={`Assinatura ${currentSigner === 'paciente' ? 'do Paciente' : 'do Dentista'}`}
            signerName={getCurrentSignerName()}
            signerRole={currentSigner}
            documentType="anamnese"
            onSignatureComplete={handleSignatureComplete}
          />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clipboard className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Anamnese</h1>
          </div>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            Nova Anamnese
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anamneses Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            {anamneses.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-4">
                  <Clipboard className="h-12 w-12 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma anamnese encontrada</h3>
                <p className="text-gray-500">Crie sua primeira anamnese para começar.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {anamneses.map((anamnese) => (
                  <div key={anamnese.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div>
                      <h3 className="font-medium">{anamnese.queixaPrincipal}</h3>
                      <p className="text-sm text-gray-500">Data: {new Date(anamnese.data).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Visualizar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Anamnese;

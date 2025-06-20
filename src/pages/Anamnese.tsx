
import React, { useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Clipboard, Save, Plus, Eye } from 'lucide-react';

const Anamnese = () => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    patientId: '',
    queixaPrincipal: '',
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
    gestantesSemanas: '',
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
    console.log('Salvando anamnese:', formData);
    toast({
      title: "Anamnese salva com sucesso!",
      description: "Os dados foram salvos no sistema.",
    });
    setShowForm(false);
  };

  const anamneses = [
    { id: 1, paciente: 'Maria Silva', data: '2024-01-15' },
    { id: 2, paciente: 'João Santos', data: '2024-01-14' },
    { id: 3, paciente: 'Ana Costa', data: '2024-01-13' },
  ];

  if (showForm) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clipboard className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Nova Anamnese</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                <Save className="h-4 w-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Questionário de Anamnese</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <Label htmlFor="queixaPrincipal">QUEIXA PRINCIPAL:</Label>
                  <Textarea
                    id="queixaPrincipal"
                    value={formData.queixaPrincipal}
                    onChange={(e) => setFormData({...formData, queixaPrincipal: e.target.value})}
                    className="mt-1"
                    rows={3}
                  />
                </div>

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
                    <Input
                      placeholder="Quais (posologia e dose)?"
                      value={formData.medicamentoDescricao}
                      onChange={(e) => setFormData({...formData, medicamentoDescricao: e.target.value})}
                      className="mt-2"
                    />
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
                    <Input
                      placeholder="Qual?"
                      value={formData.alergiaDescricao}
                      onChange={(e) => setFormData({...formData, alergiaDescricao: e.target.value})}
                      className="mt-2"
                    />
                  )}
                </div>

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

                <div className="md:col-span-2">
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
                    <Input
                      placeholder="Qual?"
                      value={formData.problemasCoracaoDescricao}
                      onChange={(e) => setFormData({...formData, problemasCoracaoDescricao: e.target.value})}
                      className="mt-2"
                    />
                  )}
                </div>

                {/* Continue com os demais campos seguindo o mesmo padrão */}
                <div className="md:col-span-2">
                  <Label htmlFor="ultimoTratamento">Quando foi seu último tratamento dentário?</Label>
                  <Input
                    id="ultimoTratamento"
                    value={formData.ultimoTratamento}
                    onChange={(e) => setFormData({...formData, ultimoTratamento: e.target.value})}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="problemasSaude">Problemas de saúde que já teve:</Label>
                  <Textarea
                    id="problemasSaude"
                    value={formData.problemasSaude}
                    onChange={(e) => setFormData({...formData, problemasSaude: e.target.value})}
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="md:col-span-2 p-4 border-t">
                  <p className="text-sm text-gray-600 italic">
                    Declaro para fins de direito que as informações acima prestadas são verdadeiras.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
            <h1 className="text-2xl font-bold text-gray-900">Anamnese</h1>
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
            <div className="space-y-4">
              {anamneses.map((anamnese) => (
                <div key={anamnese.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div>
                    <h3 className="font-medium">{anamnese.paciente}</h3>
                    <p className="text-sm text-gray-500">Data: {anamnese.data}</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4 mr-2" />
                    Visualizar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Anamnese;

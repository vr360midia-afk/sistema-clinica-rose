import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, BrainCircuit, Loader2 } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { toast } from 'sonner';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const PatientIA = ({ patient }: { patient: any }) => {
  const { anamneses, consultas, prontuarios } = useDentalSystem();
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState('');

  const gerarResumoIA = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      toast.error('Chave da API do Gemini não configurada.', { 
        description: 'Adicione VITE_GEMINI_API_KEY no seu arquivo .env' 
      });
      return;
    }

    setLoading(true);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const pacienteAnamnese = anamneses.filter(a => a.pacienteId === patient.id);
      const pacienteConsultas = consultas.filter(c => c.pacienteId === patient.id);
      const pacienteProntuarios = prontuarios.filter(p => p.pacienteId === patient.id);

      const prompt = `Você é um dentista especialista avaliando o prontuário de um paciente chamado ${patient.nome}.
      Com base nos seguintes dados clínicos, gere um resumo profissional e conciso (máximo 15 linhas) sobre a saúde bucal dele e sugira os próximos passos de tratamento de forma amigável.
      
      Dados de Anamnese: ${JSON.stringify(pacienteAnamnese)}
      Histórico de Consultas: ${JSON.stringify(pacienteConsultas)}
      Anotações de Prontuário: ${JSON.stringify(pacienteProntuarios)}
      
      Se houver doenças base como Diabetes ou Hipertensão, coloque um alerta no topo do resumo!`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setResumo(response.text());
      toast.success('Resumo gerado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao gerar resumo da IA', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-md flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
            <BrainCircuit className="h-5 w-5" />
            Assistente IA de Prontuário
          </CardTitle>
          <CardDescription>Análise inteligente do histórico do paciente</CardDescription>
        </div>
        <Button 
          onClick={gerarResumoIA} 
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
          {resumo ? 'Gerar Novamente' : 'Analisar Paciente'}
        </Button>
      </CardHeader>
      <CardContent>
        {resumo ? (
          <div className="mt-4 p-4 rounded-lg bg-white/60 dark:bg-black/20 border border-indigo-100 dark:border-indigo-900/50 text-sm leading-relaxed prose prose-sm dark:prose-invert">
            {resumo.split('\n').map((line, i) => (
              <p key={i} className="mb-2">{line}</p>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              Clique no botão para usar a Inteligência Artificial e ler todo o histórico do paciente em segundos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

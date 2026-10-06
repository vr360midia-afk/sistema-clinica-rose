import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Clock, User, Phone, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const AgendamentoPublico = () => {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    data: '',
    hora: '',
    motivo: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const { error } = await supabase
        .from('agendamentos_pendentes')
        .insert([{
          nome: formData.nome,
          telefone: formData.telefone,
          data: formData.data,
          hora: formData.hora,
          motivo: formData.motivo
        }]);

      if (error) throw error;
      
      toast.success('Agendamento solicitado com sucesso!');
      setStep(2);
    } catch (error) {
      console.error('Erro ao solicitar agendamento:', error);
      toast.error('Não foi possível enviar a solicitação. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-t-4 border-t-emerald-500">
          <CardContent className="pt-10 pb-8 flex flex-col items-center text-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Tudo Certo!</h2>
            <p className="text-slate-600 mb-6">
              Sua solicitação de agendamento para <strong>{formData.data.split('-').reverse().join('/')}</strong> às <strong>{formData.hora}</strong> foi enviada.
            </p>
            <p className="text-sm text-slate-500">
              Nossa equipe entrará em contato pelo WhatsApp no número {formData.telefone} para confirmar a consulta.
            </p>
            <Button className="mt-8 w-full" variant="outline" onClick={() => setStep(1)}>
              Fazer novo agendamento
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 flex flex-col items-center justify-center p-4">
      
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-indigo-900 mb-2">Clínica Odontológica</h1>
        <p className="text-indigo-700/80">Agende sua avaliação sem sair de casa</p>
      </div>

      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="bg-white rounded-t-xl border-b pb-6">
          <CardTitle className="text-xl text-center">Solicitar Agendamento</CardTitle>
          <CardDescription className="text-center">Preencha seus dados abaixo</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div className="space-y-2">
              <Label htmlFor="nome">Nome Completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input id="nome" name="nome" placeholder="Seu nome" required className="pl-9" onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">WhatsApp</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input id="telefone" name="telefone" placeholder="(00) 00000-0000" required className="pl-9" onChange={handleChange} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data">Data de Preferência</Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input id="data" name="data" type="date" required className="pl-9" onChange={handleChange} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hora">Horário</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <select 
                    id="hora" 
                    name="hora"
                    required 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    onChange={handleChange}
                  >
                    <option value="">Selecione...</option>
                    <option value="09:00">09:00 (Manhã)</option>
                    <option value="10:00">10:00 (Manhã)</option>
                    <option value="11:00">11:00 (Manhã)</option>
                    <option value="14:00">14:00 (Tarde)</option>
                    <option value="15:00">15:00 (Tarde)</option>
                    <option value="16:00">16:00 (Tarde)</option>
                    <option value="17:00">17:00 (Tarde)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">O que você precisa?</Label>
              <select 
                id="motivo" 
                name="motivo"
                required 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={handleChange}
              >
                <option value="">Selecione o motivo...</option>
                <option value="Avaliacao">Avaliação / Orçamento</option>
                <option value="Limpeza">Limpeza de Rotina</option>
                <option value="Dor">Estou com Dor (Urgência)</option>
                <option value="Aparelho">Aparelho Ortodôntico</option>
                <option value="Clareamento">Clareamento / Estética</option>
                <option value="Outro">Outro Motivo</option>
              </select>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 h-11 text-md">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Confirmar Solicitação'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgendamentoPublico;

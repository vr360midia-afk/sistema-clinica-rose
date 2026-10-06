import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, Send, Sparkles } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { openWhatsApp } from '@/lib/whatsapp';

export const RetornosPendentes = () => {
  const { pacientes, consultas } = useDentalSystem();

  // Calcula pacientes que tiveram a última consulta há mais de 6 meses
  const seisMesesAtras = new Date();
  seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

  const retornosPendentes = pacientes.map(paciente => {
    // Pega todas as consultas realizadas deste paciente
    const consultasPaciente = consultas
      .filter(c => c.pacienteId === paciente.id && c.status === 'realizado')
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    
    const ultimaConsulta = consultasPaciente[0];
    
    return {
      ...paciente,
      ultimaConsulta
    };
  }).filter(p => {
    if (!p.ultimaConsulta) return false;
    const dataUltima = new Date(p.ultimaConsulta.data);
    return dataUltima < seisMesesAtras;
  }).slice(0, 5); // Pega apenas os 5 mais antigos

  const enviarMensagemRetorno = (paciente: any) => {
    if (!paciente.telefone) return;
    const saudacao = new Date().getHours() < 12 ? 'Bom dia' : 'Boa tarde';
    const nome = paciente.nome.split(' ')[0];
    const dataUltima = new Date(paciente.ultimaConsulta.data).toLocaleDateString('pt-BR');
    
    const msg = `${saudacao} ${nome}! Tudo bem?\n\nAqui é da clínica odontológica. Notamos que sua última visita foi em ${dataUltima}. \n\nA saúde do seu sorriso é muito importante! Que tal agendarmos uma avaliação ou limpeza de rotina para mantermos tudo em dia?\n\nComo está a sua disponibilidade essa semana?`;
    
    openWhatsApp(paciente.telefone, msg);
  };

  return (
    <Card className="border-border/50 bg-card/40 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          Máquina de Retorno (IA)
        </CardTitle>
        <CardDescription className="text-xs">
          Pacientes sem consulta há mais de 6 meses
        </CardDescription>
      </CardHeader>
      <CardContent>
        {retornosPendentes.length === 0 ? (
          <div className="text-center py-4 text-xs text-muted-foreground">
            <Sparkles className="w-6 h-6 mx-auto mb-2 text-yellow-500 opacity-50" />
            Sua base está perfeitamente em dia!
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {retornosPendentes.map((paciente) => (
              <div key={paciente.id} className="flex items-center justify-between p-2 rounded-lg bg-background/50 border border-border/50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{paciente.nome}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Última vez: {new Date(paciente.ultimaConsulta.data).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 ml-2"
                  onClick={() => enviarMensagemRetorno(paciente)}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Chamar
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Cake, MessageCircle } from 'lucide-react';
import { openWhatsApp } from '@/lib/whatsapp';

interface Props {
  pacientes: any[];
  onSelectPatient?: (paciente: any) => void;
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const AniversariantesMes = ({ pacientes, onSelectPatient }: Props) => {
  const [aberto, setAberto] = useState(true);
  const hoje = new Date();
  const mesAtual = hoje.getMonth();

  const aniversariantes = useMemo(() => {
    return pacientes
      .filter((p) => p.status !== 'Arquivado' && p.dataNascimento)
      .map((p) => {
        const nasc = new Date(p.dataNascimento);
        if (isNaN(nasc.getTime())) return null;
        return { paciente: p, dia: nasc.getDate(), mes: nasc.getMonth() };
      })
      .filter((x): x is { paciente: any; dia: number; mes: number } => !!x && x.mes === mesAtual)
      .sort((a, b) => a.dia - b.dia);
  }, [pacientes, mesAtual]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cake className="h-5 w-5 text-pink-500" />
            Aniversariantes de {MESES[mesAtual]}
            <Badge variant="secondary">{aniversariantes.length}</Badge>
          </CardTitle>
          {aniversariantes.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setAberto((v) => !v)}>
              {aberto ? 'Ocultar' : 'Mostrar'}
            </Button>
          )}
        </div>
      </CardHeader>
      {aberto && (
        <CardContent className="pt-0">
          {aniversariantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aniversariante neste mês.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {aniversariantes.map(({ paciente, dia }) => {
                const hojeEhAniversario = dia === hoje.getDate();
                return (
                  <div
                    key={paciente.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border hover:bg-muted transition-colors"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-2 min-w-0 text-left"
                      onClick={() => onSelectPatient?.(paciente)}
                    >
                      <span className="flex-shrink-0 h-9 w-9 rounded-full bg-pink-500/10 text-pink-500 flex items-center justify-center text-xs font-semibold">
                        {String(dia).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium truncate">{paciente.nome}</span>
                        <span className="block text-xs text-muted-foreground">
                          {hojeEhAniversario ? 'É hoje!' : `Dia ${dia}`}
                        </span>
                      </span>
                    </button>
                    {paciente.telefone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Enviar parabéns no WhatsApp"
                        onClick={() =>
                          openWhatsApp(
                            paciente.telefone,
                            `Olá ${paciente.nome}! Toda a equipe deseja um feliz aniversário! 🎉`
                          )
                        }
                      >
                        <MessageCircle className="h-4 w-4 text-green-600" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default AniversariantesMes;

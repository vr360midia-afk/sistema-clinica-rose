import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, DollarSign, ClipboardList, FolderOpen, History } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import EmptyState from '@/components/common/EmptyState';

interface PatientTimelineProps {
  patient: any;
}

type TimelineItem = {
  id: string;
  data: Date;
  tipo: 'consulta' | 'prontuario' | 'transacao' | 'anamnese' | 'documento';
  titulo: string;
  descricao?: string;
  badge?: string;
};

const config = {
  consulta: { icon: Calendar, label: 'Consulta', color: 'text-blue-500' },
  prontuario: { icon: FileText, label: 'Prontuário', color: 'text-emerald-500' },
  transacao: { icon: DollarSign, label: 'Financeiro', color: 'text-amber-500' },
  anamnese: { icon: ClipboardList, label: 'Anamnese', color: 'text-purple-500' },
  documento: { icon: FolderOpen, label: 'Documento', color: 'text-cyan-500' },
} as const;

const PatientTimeline = ({ patient }: PatientTimelineProps) => {
  const { consultas, prontuarios, transacoes, anamneses, documentos } = useDentalSystem();

  const items = useMemo<TimelineItem[]>(() => {
    const list: TimelineItem[] = [];

    consultas
      .filter((c) => c.pacienteId === patient.id)
      .forEach((c) =>
        list.push({
          id: `c-${c.id}`,
          data: new Date(c.data),
          tipo: 'consulta',
          titulo: c.procedimento || 'Consulta',
          descricao: [c.hora, c.dentista].filter(Boolean).join(' • '),
          badge: c.status,
        })
      );

    prontuarios
      .filter((p) => p.pacienteId === patient.id)
      .forEach((p) =>
        list.push({
          id: `p-${p.id}`,
          data: new Date(p.data),
          tipo: 'prontuario',
          titulo: p.queixaPrincipal || 'Prontuário',
          descricao: p.diagnostico || p.planoTratamento,
        })
      );

    transacoes
      .filter((t) => t.pacienteId === patient.id)
      .forEach((t) =>
        list.push({
          id: `t-${t.id}`,
          data: new Date(t.data),
          tipo: 'transacao',
          titulo: `${t.tipo === 'receita' ? 'Recebimento' : 'Despesa'} R$ ${Number(t.valor || 0).toFixed(2)}`,
          descricao: t.descricao,
          badge: t.status,
        })
      );

    anamneses
      .filter((a) => a.pacienteId === patient.id)
      .forEach((a) =>
        list.push({
          id: `a-${a.id}`,
          data: new Date(a.data || a.criadoEm),
          tipo: 'anamnese',
          titulo: 'Anamnese',
          descricao: a.queixaPrincipal,
          badge: a.statusAssinatura,
        })
      );

    documentos
      .filter((d) => d.pacienteId === patient.id)
      .forEach((d) =>
        list.push({
          id: `d-${d.id}`,
          data: new Date(d.criadoEm),
          tipo: 'documento',
          titulo: d.nome,
          descricao: d.analiseIa || d.descricao,
          badge: d.tipo,
        })
      );

    return list
      .filter((i) => !isNaN(i.data.getTime()))
      .sort((a, b) => b.data.getTime() - a.data.getTime());
  }, [consultas, prontuarios, transacoes, anamneses, documentos, patient.id]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sem histórico"
        description="Ainda não há consultas, prontuários, documentos ou lançamentos para este paciente."
      />
    );
  }

  return (
    <div className="relative pl-5 sm:pl-6">
      <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
      <div className="space-y-3">
        {items.map((item) => {
          const { icon: Icon, label, color } = config[item.tipo];
          return (
            <div key={item.id} className="relative">
              <span className="absolute -left-[18px] sm:-left-[22px] top-4 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border">
                <Icon className={`h-2.5 w-2.5 ${color}`} />
              </span>
              <Card>
                <CardContent className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{item.titulo}</p>
                      {item.descricao && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{item.descricao}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.badge && <Badge variant="secondary" className="text-[10px]">{item.badge}</Badge>}
                      <Badge variant="outline" className="text-[10px]">{label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.data.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PatientTimeline;

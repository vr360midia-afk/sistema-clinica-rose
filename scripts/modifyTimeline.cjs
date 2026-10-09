const fs = require('fs');
let c = fs.readFileSync('src/components/pacientes/PatientTimeline.tsx', 'utf-8');

c = c.split('import EmptyState').join("import EmptyState from '@/components/common/EmptyState';\nimport TransactionForm from '@/components/financeiro/TransactionForm';\nimport ConsultaModal from '@/components/agenda/ConsultaModal';\nimport ProntuarioModal from '@/components/prontuarios/ProntuarioModal';\nimport { Button } from '@/components/ui/button';\nimport { Pencil } from 'lucide-react';\nimport { useState } from 'react';");
c = c.split('const PatientTimeline = ({ patient }: PatientTimelineProps) => {').join('const PatientTimeline = ({ patient }: PatientTimelineProps) => {\n  const [editConsulta, setEditConsulta] = useState<any>(null);\n  const [editProntuario, setEditProntuario] = useState<any>(null);\n  const [editTransacao, setEditTransacao] = useState<any>(null);');

c = c.split('{item.badge && (').join("<Button size=\"icon\" variant=\"ghost\" className=\"h-6 w-6 mr-2\" onClick={(e) => { e.stopPropagation(); if (item.tipo === 'consulta') { setEditConsulta(consultas.find(x => x.id === item.originalId)); } else if (item.tipo === 'prontuario') { setEditProntuario(prontuarios.find(x => x.id === item.originalId)); } else if (item.tipo === 'transacao') { setEditTransacao(transacoes.find(x => x.id === item.originalId)); } }}><Pencil className=\"h-3 w-3\" /></Button>\n                  {item.badge && (");

c = c.split('id: `c-${c.id}`,').join('id: `c-${c.id}`,\n          originalId: c.id,');
c = c.split('id: `p-${p.id}`,').join('id: `p-${p.id}`,\n          originalId: p.id,');
c = c.split('id: `t-${t.id}`,').join('id: `t-${t.id}`,\n          originalId: t.id,');

c = c.split('export default PatientTimeline;').join("{editTransacao && <TransactionForm isOpen={!!editTransacao} onClose={() => setEditTransacao(null)} transacao={editTransacao} isEdit={true} pacienteId={patient.id} />}\n      {editConsulta && <ConsultaModal isOpen={!!editConsulta} onClose={() => setEditConsulta(null)} editingConsulta={editConsulta} />}\n      {editProntuario && <ProntuarioModal isOpen={!!editProntuario} onClose={() => setEditProntuario(null)} prontuario={editProntuario} patient={patient} />}\n    </>\n  );\n}\nexport default PatientTimeline;");
c = c.split('return (\n    <div className=\"space-y-4\">').join("return (\n    <>\n    <div className=\"space-y-4\">");
// ensure type TimelineItem has originalId
c = c.split('tipo: \'consulta\' | \'prontuario\' | \'transacao\' | \'anamnese\' | \'documento\';').join('tipo: \'consulta\' | \'prontuario\' | \'transacao\' | \'anamnese\' | \'documento\';\n  originalId?: string;');

// handle empty state import duplication if there was one
c = c.split("import EmptyState from '@/components/common/EmptyState';\nimport EmptyState from '@/components/common/EmptyState';").join("import EmptyState from '@/components/common/EmptyState';");

fs.writeFileSync('src/components/pacientes/PatientTimeline.tsx', c);

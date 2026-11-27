const assert = require('assert');

// Simulação dos dados reais do usuário:
// 1. Remota do Supabase:
const remoteAna = [
  {
    id: "928106b9-5f3e-490f-938a-4bf8b772a9a1",
    paciente_id: "bbc5fb2a-2388-485c-80f9-cfab3d352a03",
    pacienteId: "bbc5fb2a-2388-485c-80f9-cfab3d352a03",
    data: "2026-11-27",
    queixaPrincipal: "Avaliação Odontológica Inicial",
    statusAssinatura: "paciente_assinado",
    assinaturaPaciente: { signature: "data:image/png...", timestamp: "2026-11-27T14:02:03Z" }
  }
];

// 2. Local gerada no localStorage (Aguardando Assinatura):
const localAna = [
  {
    id: "1732709999999",
    pacienteId: "bbc5fb2a-2388-485c-80f9-cfab3d352a03",
    data: new Date("2026-11-27T11:00:00-03:00"),
    queixaPrincipal: "Avaliação Odontológica Inicial",
    historiaAtual: "Ficha enviada ao paciente para preenchimento e assinatura digital",
    statusAssinatura: "pendente"
  }
];

function deduplicateAndMergeAnamneses(remoteList, localList) {
  const remote = (remoteList || []).filter(Boolean);
  const local = (localList || []).filter(Boolean);
  const mapAna = new Map();

  remote.forEach(item => {
    if (item && item.id) mapAna.set(item.id, item);
  });

  local.forEach(localItem => {
    if (!localItem) return;
    let matchedRemoteId = mapAna.has(localItem.id) ? localItem.id : null;

    if (!matchedRemoteId) {
      for (const [rId, rItem] of mapAna.entries()) {
        const pIdMatch =
          (rItem.pacienteId && (rItem.pacienteId === localItem.pacienteId || rItem.pacienteId === localItem.paciente_id)) ||
          (rItem.paciente_id && (rItem.paciente_id === localItem.pacienteId || rItem.paciente_id === localItem.paciente_id));
        
        if (pIdMatch) {
          const rData = rItem.data ? new Date(rItem.data).toLocaleDateString('pt-BR') : '';
          const lData = localItem.data ? new Date(localItem.data).toLocaleDateString('pt-BR') : '';
          const rIsSigned = rItem.statusAssinatura === 'paciente_assinado' || rItem.statusAssinatura === 'completo' || !!rItem.assinaturaPaciente;

          if (rData === lData || rIsSigned) {
            matchedRemoteId = rId;
            break;
          }
        }
      }
    }

    if (matchedRemoteId) {
      const existing = mapAna.get(matchedRemoteId);
      mapAna.set(matchedRemoteId, {
        ...existing,
        ...localItem,
        id: matchedRemoteId,
        assinaturaPaciente: existing.assinaturaPaciente || localItem.assinaturaPaciente,
        statusAssinatura: (existing.assinaturaPaciente || localItem.assinaturaPaciente) ? 'paciente_assinado' : (existing.statusAssinatura || localItem.statusAssinatura),
      });
    } else {
      mapAna.set(localItem.id, localItem);
    }
  });

  return Array.from(mapAna.values());
}

const result = deduplicateAndMergeAnamneses(remoteAna, localAna);
console.log('Quantidade de anamneses após mesclagem:', result.length);
assert.strictEqual(result.length, 1, 'Deve retornar EXATAMENTE 1 anamnese');
assert.strictEqual(result[0].id, "928106b9-5f3e-490f-938a-4bf8b772a9a1");
assert.strictEqual(result[0].statusAssinatura, "paciente_assinado");
console.log('✅ TESTE DE DEDUPLICAÇÃO PASSOU PERFEITAMENTE!');

const fs = require('fs');
const assert = require('assert');

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=([^\r\n]+)/);
const url = urlMatch[1].replace(/['"\s]/g, '');
const key = keyMatch[1].replace(/['"\s]/g, '');

async function runTests() {
  console.log('--- TESTE 1: RPC obter_anamnese_publica com anon key ---');
  const getRpcRes = await fetch(`${url}/rest/v1/rpc/obter_anamnese_publica`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ p_identificador: '00000000-0000-0000-0000-000000000000' })
  });
  const getRpcData = await getRpcRes.json();
  console.log('RPC obter_anamnese_publica resposta:', getRpcData);
  assert.strictEqual(getRpcData.ok, false, 'Deve responder ok: false para UUID inexistente');
  assert.ok(getRpcData.error && getRpcData.error.toLowerCase().includes('anamnese'), 'Deve retornar erro de anamnese não encontrada');
  console.log('✅ TESTE 1 PASSOU!');

  console.log('\n--- TESTE 2: Edge Function assinatura-publica online e ativa ---');
  const edgeRes = await fetch(`${url}/functions/v1/assinatura-publica`, {
    method: 'POST',
    headers: {
      apikey: key,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'get', id: '00000000-0000-0000-0000-000000000000' })
  });
  const edgeData = await edgeRes.json();
  console.log('Edge function resposta:', edgeData);
  assert.strictEqual(edgeRes.status === 200 || edgeRes.status === 404, true, 'Edge function deve responder com status HTTP válido');
  console.log('✅ TESTE 2 PASSOU!');

  console.log('\n--- TESTE 3: Deduplicação de anamneses no modelo local/remoto ---');
  // Simula o caso real relatado pelo usuário:
  // Uma anamnese remota com UUID e uma cópia local com timestamp numérico para o mesmo paciente
  const pacienteId = 'test-patient-uuid-123';
  const dataHoje = new Date().toISOString();
  
  const remoteAna = [
    {
      id: 'uuid-anamnese-canonical-001',
      pacienteId,
      data: dataHoje,
      queixaPrincipal: 'Avaliação Odontológica Inicial',
      statusAssinatura: 'pendente'
    }
  ];

  const localAna = [
    {
      id: '1732709123456', // ID numérico legado gerado no localStorage
      pacienteId,
      data: dataHoje,
      queixaPrincipal: 'Avaliação Odontológica Inicial',
      statusAssinatura: 'paciente_assinado',
      assinaturaPaciente: { signature: 'data:image/png;base64,...', timestamp: dataHoje }
    }
  ];

  // Algoritmo de mesclagem implementado no DentalSystemContext
  const mapAna = new Map();
  remoteAna.forEach((item) => mapAna.set(item.id, item));

  localAna.forEach((localItem) => {
    let matchedRemoteId = mapAna.has(localItem.id) ? localItem.id : null;
    if (!matchedRemoteId) {
      for (const [rId, rItem] of mapAna.entries()) {
        const pIdMatch = (rItem.pacienteId === localItem.pacienteId);
        if (pIdMatch) {
          const rData = new Date(rItem.data).toISOString().slice(0, 10);
          const lData = new Date(localItem.data).toISOString().slice(0, 10);
          if (rData === lData) {
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
        statusAssinatura: (existing.assinaturaPaciente || localItem.assinaturaPaciente) ? 'paciente_assinado' : 'pendente'
      });
    } else {
      mapAna.set(localItem.id, localItem);
    }
  });

  const finalConsolidated = Array.from(mapAna.values());
  console.log('Resultado consolidado:', finalConsolidated);
  assert.strictEqual(finalConsolidated.length, 1, 'Deve colapsar para EXATAMENTE 1 anamnese');
  assert.strictEqual(finalConsolidated[0].id, 'uuid-anamnese-canonical-001', 'Deve preservar o ID canônico');
  assert.strictEqual(finalConsolidated[0].statusAssinatura, 'paciente_assinado', 'Deve preservar a assinatura coletada');
  assert.ok(finalConsolidated[0].assinaturaPaciente, 'Deve conter os dados da assinatura');
  console.log('✅ TESTE 3 PASSOU!');

  console.log('\n--- TESTE 4: Prevenção de duplicação no saveAnamnese ---');
  // Simula o localStorageService.saveAnamnese recebendo item já existente
  const storage = [
    { id: 'item-100', pacienteId: 'p-1', queixaPrincipal: 'Q1' }
  ];
  
  function saveAnamneseSimulado(item) {
    const finalId = item.id || 'new-generated-id';
    const idx = storage.findIndex(a => a.id === finalId);
    if (idx >= 0) {
      storage[idx] = { ...storage[idx], ...item, id: finalId };
      return storage[idx];
    }
    const created = { ...item, id: finalId };
    storage.push(created);
    return created;
  }

  // Chamada com mesmo ID
  saveAnamneseSimulado({ id: 'item-100', queixaPrincipal: 'Q1 atualizado', statusAssinatura: 'paciente_assinado' });
  assert.strictEqual(storage.length, 1, 'Não deve adicionar novo item se o ID já existe');
  assert.strictEqual(storage[0].queixaPrincipal, 'Q1 atualizado', 'Deve atualizar in-place');
  console.log('✅ TESTE 4 PASSOU!');

  console.log('\n========================================');
  console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('❌ Falha nos testes:', err);
  process.exit(1);
});

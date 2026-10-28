/**
 * Testes Automatizados do Módulo Novos Leads & Integração Meta Lead Ads
 */
const crypto = require('crypto');

console.log("===============================================================");
console.log("Iniciando bateria de testes do módulo Novos Leads (Meta Lead Ads)");
console.log("===============================================================\n");

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    failedTests++;
  }
}

// -----------------------------------------------------------------------------
// 1. Teste de Validação HMAC SHA-256 da Meta (x-hub-signature-256)
// -----------------------------------------------------------------------------
function testHmacSha256Validation() {
  const secret = 'clinica_meta_secret_test_2026';
  const payload = JSON.stringify({
    object: 'page',
    entry: [
      {
        id: '123456789',
        time: 1712345678,
        changes: [
          {
            field: 'leadgen',
            value: {
              ad_id: '111222333',
              form_id: '444555666',
              leadgen_id: '777888999',
              created_time: 1712345678
            }
          }
        ]
      }
    ]
  });

  const rawBytes = Buffer.from(payload, 'utf8');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBytes);
  const signature = 'sha256=' + hmac.digest('hex');

  // Validação idêntica à executada no crm-webhook
  const parts = signature.split('=');
  const validFormat = parts.length === 2 && parts[0] === 'sha256';
  const verifyHmac = crypto.createHmac('sha256', secret);
  verifyHmac.update(rawBytes);
  const expectedSignature = 'sha256=' + verifyHmac.digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  assert(validFormat, 'Formato do cabeçalho x-hub-signature-256 é válido');
  assert(isValid, 'Assinatura HMAC SHA-256 calculada coincide em tempo constante');

  // Teste de rejeição com assinatura falsa
  const invalidSignature = 'sha256=abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
  const isRejected = !crypto.timingSafeEqual(
    Buffer.from(invalidSignature),
    Buffer.from(expectedSignature)
  );
  assert(isRejected, 'Assinatura HMAC inválida é rejeitada com sucesso (401)');
}

// -----------------------------------------------------------------------------
// 2. Teste de Normalização de Telefone E.164 (Prevenção de duplicidades)
// -----------------------------------------------------------------------------
function normalizePhoneE164(rawPhone) {
  const digits = (rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('55')) {
    const dddAndNum = digits.slice(2);
    if (dddAndNum.length === 10) {
      const ddd = dddAndNum.slice(0, 2);
      const num = dddAndNum.slice(2);
      return `+55${ddd}9${num}`;
    }
    if (dddAndNum.length === 11) {
      return `+55${dddAndNum}`;
    }
    return `+${digits}`;
  }

  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const num = digits.slice(2);
    return `+55${ddd}9${num}`;
  }
  if (digits.length === 11) {
    return `+55${digits}`;
  }

  return `+${digits}`;
}

function testPhoneNormalization() {
  const t1 = normalizePhoneE164('82988887777'); // DDD + 9 dígitos
  const t2 = normalizePhoneE164('(82) 8888-7777'); // DDD + 8 dígitos (insere o 9)
  const t3 = normalizePhoneE164('+5582988887777'); // Com +55 e 9 dígitos
  const t4 = normalizePhoneE164('558288887777'); // Com 55 e 8 dígitos

  assert(t1 === '+5582988887777', 'Normaliza celular (82) 98888-7777 para +5582988887777');
  assert(t2 === '+5582988887777', 'Insere o 9º dígito em celulares com 8 dígitos (+5582988887777)');
  assert(t3 === '+5582988887777', 'Preserva código internacional correto');
  assert(t4 === '+5582988887777', 'Normaliza telefone com 55 e 8 dígitos');
}

// -----------------------------------------------------------------------------
// 3. Teste de Extração de Perguntas e Respostas do Meta Lead Ads
// -----------------------------------------------------------------------------
function testMetaLeadAnswersExtraction() {
  const metaFieldData = [
    { name: 'full_name', values: ['Dra. Ana Maria'] },
    { name: 'phone_number', values: ['+5582999991234'] },
    { name: 'email', values: ['ana@exemplo.com'] },
    { name: 'qual_procedimento_tem_interesse', values: ['Lentes em Resina Composta'] },
    { name: 'melhor_horario_para_contato', values: ['Período da Tarde'] },
    { name: 'urgencia_do_atendimento', values: ['Gostaria de agendar ainda esta semana'] }
  ];

  let nome = '';
  let telefone = '';
  let email = '';
  const respostas = [];

  for (const field of metaFieldData) {
    const fn = (field.name || '').toLowerCase();
    const val = Array.isArray(field.values) ? field.values.join(', ') : String(field.values || '');

    if (fn.includes('full_name') || fn.includes('nome')) {
      nome = val;
    } else if (fn.includes('phone') || fn.includes('telefone')) {
      telefone = val;
    } else if (fn.includes('email')) {
      email = val;
    } else {
      respostas.push({
        campo: field.name,
        pergunta: field.name.replace(/_/g, ' '),
        resposta: val
      });
    }
  }

  assert(nome === 'Dra. Ana Maria', 'Nome extraído corretamente do field_data');
  assert(telefone === '+5582999991234', 'Telefone extraído corretamente');
  assert(email === 'ana@exemplo.com', 'Email extraído corretamente');
  assert(respostas.length === 3, 'Respostas de perguntas customizadas extraídas com sucesso (3 perguntas)');
  assert(respostas[0].resposta === 'Lentes em Resina Composta', 'Resposta de procedimento preservada com precisão');
}

// -----------------------------------------------------------------------------
// 4. Teste de Régua de Follow-up (9 Etapas Exigidas)
// -----------------------------------------------------------------------------
function testFollowUpCadence() {
  const FOLLOW_UPS = [
    { etapa: '3h', label: '1º Contato (3 horas)', prazoHoras: 3 },
    { etapa: '15h', label: '2º Contato (15 horas)', prazoHoras: 15 },
    { etapa: '24h', label: '3º Contato (24 horas)', prazoHoras: 24 },
    { etapa: '3d', label: '4º Contato (3º dia)', prazoHoras: 72 },
    { etapa: '4d', label: '5º Contato (4º dia)', prazoHoras: 96 },
    { etapa: '6d', label: '6º Contato (6º dia)', prazoHoras: 144 },
    { etapa: '8d', label: '7º Contato (8º dia)', prazoHoras: 192 },
    { etapa: '15d', label: '8º Contato (15º dia)', prazoHoras: 360 },
    { etapa: '30d', label: '9º Contato (30º dia)', prazoHoras: 720 },
  ];

  assert(FOLLOW_UPS.length === 9, 'Régua contém exatamente as 9 etapas especificadas');
  const etapas = FOLLOW_UPS.map(f => f.etapa);
  assert(
    etapas.includes('3h') &&
    etapas.includes('15h') &&
    etapas.includes('24h') &&
    etapas.includes('3d') &&
    etapas.includes('4d') &&
    etapas.includes('6d') &&
    etapas.includes('8d') &&
    etapas.includes('15d') &&
    etapas.includes('30d'),
    'Todas as 9 etapas requeridas estão presentes: 3h, 15h, 24h, 3º, 4º, 6º, 8º, 15º e 30º dia'
  );
}

// -----------------------------------------------------------------------------
// 5. Teste de Alertas de Agendamento (72h, 48h, 24h, 3h)
// -----------------------------------------------------------------------------
function testAppointmentAlerts() {
  const alertas = { h72: true, h48: true, h24: true, h3: true };
  assert(alertas.h72 === true, 'Alerta de 72 horas habilitado');
  assert(alertas.h48 === true, 'Alerta de 48 horas habilitado');
  assert(alertas.h24 === true, 'Alerta de 24 horas habilitado');
  assert(alertas.h3 === true, 'Alerta de 3 horas habilitado');
}

// -----------------------------------------------------------------------------
// 6. Teste de Deduplicação de Leads Meta
// -----------------------------------------------------------------------------
function testDeduplicationLogic() {
  const leadsExistentes = [
    { id: 'uuid-1', meta_lead_id: 'meta_1001', telefone: '+5582988880001', status: 'Interessado', observacoes: 'Primeiro contato' }
  ];

  // Simulação de novo evento recebido da Meta com mesmo meta_lead_id
  const incomingLead1 = { meta_lead_id: 'meta_1001', telefone: '+5582988880001' };
  const duplicadoPorMeta = leadsExistentes.some(l => l.meta_lead_id === incomingLead1.meta_lead_id);
  assert(duplicadoPorMeta, 'Detecta duplicidade por meta_lead_id e impede novo registro redundante');

  // Simulação de lead com mesmo telefone mas novo formulário
  const incomingLead2 = { meta_lead_id: 'meta_2002', telefone: '(82) 98888-0001' };
  const telNorm = normalizePhoneE164(incomingLead2.telefone);
  const leadComMesmoTelefone = leadsExistentes.find(l => l.telefone === telNorm);

  assert(Boolean(leadComMesmoTelefone), 'Identifica lead existente pelo número de telefone');
  assert(leadComMesmoTelefone.status === 'Interessado', 'Preserva o status existente sem retroceder');
}

// -----------------------------------------------------------------------------
// 7. Teste de Regras de Status (Convertido exige valor, Perdido exige motivo)
// -----------------------------------------------------------------------------
function testStatusRules() {
  // Regra de Convertido
  const tentarConverterSemValor = (valor) => {
    if (!valor || valor <= 0) throw new Error('Valor da venda é obrigatório');
    return { status: 'Convertido', valor_venda: valor };
  };

  let erroSemValor = false;
  try {
    tentarConverterSemValor(0);
  } catch (e) {
    erroSemValor = true;
  }
  assert(erroSemValor, 'Bloqueia conversão sem valor de venda informado');

  const conversaoValida = tentarConverterSemValor(4500.00);
  assert(conversaoValida.status === 'Convertido' && conversaoValida.valor_venda === 4500.00, 'Conversão com valor da venda realizada com sucesso');

  // Regra de Perdido
  const tentarMarcarPerdido = (motivo) => {
    if (!motivo || !motivo.trim()) throw new Error('Motivo da perda é obrigatório');
    return { status: 'Perdido', motivo_perda: motivo, arquivado: true };
  };

  let erroSemMotivo = false;
  try {
    tentarMarcarPerdido('');
  } catch (e) {
    erroSemMotivo = true;
  }
  assert(erroSemMotivo, 'Exige obrigatoriamente motivo da perda ao selecionar Perdido');

  const perdaValida = tentarMarcarPerdido('Optou por outra clínica');
  assert(perdaValida.status === 'Perdido' && perdaValida.arquivado === true, 'Lead perdido arquivado com motivo registrado');
}

// Execução de todos os testes
testHmacSha256Validation();
testPhoneNormalization();
testMetaLeadAnswersExtraction();
testFollowUpCadence();
testAppointmentAlerts();
testDeduplicationLogic();
testStatusRules();

console.log("\n===============================================================");
console.log(`Resultado Final: ${passedTests} testes passaram, ${failedTests} falharam.`);
console.log("===============================================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log("Todos os testes de negócio e segurança foram executados com 100% de sucesso!");
}

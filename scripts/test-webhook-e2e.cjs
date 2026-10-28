/**
 * Teste End-to-End da lógica de recepção do webhook do Meta Lead Ads
 */
const { novosLeadsService, parseDbLeadParaNovoLead } = require('./mock-service-adapter.cjs');

async function runE2eTest() {
  console.log("=================================================");
  console.log("Simulando recepção de Lead da Meta via Webhook...");
  console.log("=================================================\n");

  const metaPayloadSimulado = {
    nome: "Juliana Medeiros (Lead Meta)",
    telefone: "+55 (82) 99123-4567",
    email: "juliana.medeiros@exemplo.com",
    origem: "Meta Lead Ads",
    campanha: "Campanha Lentes em Resina Composta - Instagram",
    prioridade: "alta",
    meta_lead_id: `meta_${Date.now()}`,
    form_id: "form_facetas_resina_2026",
    respostas: [
      {
        campo: "qual_procedimento_voce_deseja",
        pergunta: "Qual procedimento você deseja realizar?",
        resposta: "Facetas em Resina nos 6 dentes da frente"
      },
      {
        campo: "melhor_horario",
        pergunta: "Qual o melhor horário para entrarmos em contato?",
        resposta: "Manhã entre 9h e 11h"
      },
      {
        campo: "ja_fez_avaliacao",
        pergunta: "Já realizou avaliação odontológica antes?",
        resposta: "Não, é a primeira vez"
      }
    ],
    observacoes: "Lead recebido automaticamente do anúncio de Lentes em Resina no Instagram."
  };

  console.log("1. Payload do lead recebido da Meta:");
  console.log(JSON.stringify(metaPayloadSimulado, null, 2));

  console.log("\n2. Executando processamento do Lead...");
  const leadSalvo = await novosLeadsService.salvarLead(metaPayloadSimulado);

  console.log("\n3. Lead processado e pronto para o módulo Novos Leads:");
  console.log({
    id: leadSalvo.id,
    nome: leadSalvo.nome,
    telefone: leadSalvo.telefone,
    origem: leadSalvo.origem,
    status: leadSalvo.status,
    prioridade: leadSalvo.prioridade,
    revisado: leadSalvo.revisado,
    qtd_respostas: leadSalvo.respostas.length,
    qtd_followups: leadSalvo.follow_ups.length,
    alertas_ativos: Object.keys(leadSalvo.alertas_agendamento).filter(k => leadSalvo.alertas_agendamento[k])
  });

  if (
    leadSalvo.status === 'Pendente' &&
    leadSalvo.revisado === false &&
    leadSalvo.respostas.length === 3 &&
    leadSalvo.follow_ups.length === 9 &&
    leadSalvo.alertas_agendamento.h72 &&
    leadSalvo.alertas_agendamento.h48 &&
    leadSalvo.alertas_agendamento.h24 &&
    leadSalvo.alertas_agendamento.h3
  ) {
    console.log("\n🎉 TESTE CONCLUÍDO COM ÊXITO: Todos os critérios foram atendidos!");
  } else {
    console.error("\n❌ FALHA NO TESTE: Algum campo não foi configurado corretamente.");
    process.exit(1);
  }
}

runE2eTest();

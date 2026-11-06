/**
 * SUÍTE GLOBAL DE TESTES PARAMETRIZADOS DO MOTOR FINANCEIRO DOS CONTRATOS
 * Executa todos os 10 cenários obrigatórios com valores variados, pacientes fictícios distintos,
 * e validação estrita de centavos, métodos e status.
 */

import {
  mapearDadosContrato,
  gerarParcelasCronogramaFinanceiro,
  validarCronogramaFinanceiroContrato,
  emitirContratoPersistido,
  parseBrMoney,
} from '../src/utils/contratoEngine';
import { calcularDescricaoCondicao, extrairCondicaoEscolhida } from '../src/utils/orcamentoCondicoes';

const clinicaMock = {
  nome: 'Santos & Duracenski Odontologia LTDA',
  cnpj: '12.345.678/0001-90',
  cro: 'CRO-AL 06267',
  dentistaResponsavel: 'Dra. Rosângela Santos Pereira',
  endereco: 'Av. Fernandes Lima, 1000, Farol, Maceió - AL',
  telefone: '(82) 99999-8888',
  email: 'contato@santosduracenski.com.br',
  chavePix: '55394749000180',
  tipoChavePix: 'cnpj',
  favorecidoPix: 'Santos & Duracenski Odontologia LTDA',
  cidade: 'Maceió',
};

function asserir(condicao: boolean, msg: string) {
  if (!condicao) {
    throw new Error(`[FALHA NA ASSERÇÃO]: ${msg}`);
  }
}

async function executarTodosOsCenários() {
  console.log('======================================================================');
  console.log('SUÍTE DE TESTES: MOTOR GLOBAL DE CONDIÇÕES FINANCEIRAS DE CONTRATO');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------
  // CENÁRIO 1: R$ 900,00 em PIX à vista
  // -------------------------------------------------------------------
  console.log('CENÁRIO 1: R$ 900,00 em PIX à vista');
  {
    const pac = { id: 'pac-cen-1', nome: 'Alice Fictícia Santos', cpf: '111.222.333-44' };
    const cond = {
      id: 'c1',
      tipo: 'a_vista' as const,
      titulo: 'PIX à Vista com Desconto',
      descricao: 'Pagamento à vista via PIX: R$ 900,00',
      valorTotal: 900.0,
      pagamentoConfirmado: false,
    };
    const orc = {
      id: 'orc-cen-1',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      subtotal: 900.0,
      desconto: 0,
      total: 900.0,
      condicaoEscolhida: cond,
      itens: [{ id: 'i1', nome: 'Restauração Estética', valorTotal: 900, quantidade: 1 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    asserir(parcs.length === 1, 'PIX à vista deve conter exatamente 1 parcela');
    asserir(parcs[0].valor === 900.0, 'Valor da parcela deve ser 900.00');
    asserir(parcs[0].metodo === 'PIX', 'Método deve ser PIX');
    asserir(parcs[0].status === 'Pendente', 'Status sem confirmação deve ser Pendente');
    asserir(Boolean(parcs[0].payloadPix), 'Payload PIX deve ser gerado para chave válida');
    console.log('   ✓ Aprovado: 1 parcela de R$ 900,00 via PIX (Pendente, QR Code gerado)');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 2: R$ 3.150,00 em 3x PIX
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 2: R$ 3.150,00 em 3x PIX');
  {
    const pac = { id: 'pac-cen-2', nome: 'Bernardo Fictício Lima', cpf: '222.333.444-55' };
    const cond = {
      id: 'c2',
      tipo: 'pix_parcelado' as const,
      titulo: '3x no PIX Parcelado',
      descricao: 'Plano em 3x de R$ 1.050,00 via PIX Parcelado',
      valorTotal: 3150.0,
      parcelas: 3,
      diaVencimento: 15,
    };
    const orc = {
      id: 'orc-cen-2',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      subtotal: 3150.0,
      desconto: 0,
      total: 3150.0,
      condicaoEscolhida: cond,
      itens: [{ id: 'i2', nome: 'Tratamento Periodontal', valorTotal: 3150, quantidade: 1 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    asserir(parcs.length === 3, 'Deve conter 3 parcelas');
    const soma = parcs.reduce((acc, p) => acc + p.valor, 0);
    asserir(Math.abs(soma - 3150.0) < 0.001, 'Soma das parcelas deve ser 3150.00');
    for (const p of parcs) {
      asserir(p.valor === 1050.0, 'Cada parcela deve ser 1050.00');
      asserir(p.metodo === 'PIX Parcelado', 'Método não pode ser convertido para cartão');
      asserir(p.status === 'Pendente', 'Status inicial deve ser Pendente');
    }
    console.log('   ✓ Aprovado: 3 parcelas de R$ 1.050,00 (Soma R$ 3.150,00, PIX preservado)');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 3: R$ 5.500,00 com entrada + 10x PIX
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 3: R$ 5.500,00 com entrada R$ 500 + 10x PIX');
  {
    const pac = { id: 'pac-cen-3', nome: 'Carla Fictícia Silveira', cpf: '333.444.555-66' };
    const cond = {
      id: 'c3',
      tipo: 'pix_parcelado' as const,
      titulo: 'Entrada + 10x no PIX',
      descricao: 'Entrada de R$ 500,00 via PIX + 10x de R$ 500,00 via PIX Parcelado',
      valorTotal: 5500.0,
      valorEntrada: 500.0,
      parcelas: 10,
      diaVencimento: 10,
      entradaConfirmada: true,
    };
    const orc = {
      id: 'orc-cen-3',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      subtotal: 5500.0,
      desconto: 0,
      total: 5500.0,
      condicaoEscolhida: cond,
      itens: [{ id: 'i3', nome: 'Facetas em Resina (10 elementos)', valorTotal: 5500, quantidade: 10 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    asserir(parcs.length === 11, 'Deve conter 11 linhas (1 entrada + 10 saldo)');
    asserir(parcs[0].descricao.includes('Entrada') && parcs[0].valor === 500.0, 'Entrada deve ser 500.00');
    asserir(parcs[0].status === 'Quitada', 'Entrada confirmada deve ter status Quitada');
    for (let i = 1; i < 11; i++) {
      asserir(parcs[i].valor === 500.0, `Parcela ${i} do saldo deve ser 500.00`);
      asserir(parcs[i].metodo === 'PIX Parcelado', 'Método do saldo deve ser PIX Parcelado');
      asserir(parcs[i].status === 'Pendente', 'Saldo sem confirmação deve ser Pendente');
    }
    const soma = parcs.reduce((acc, p) => acc + p.valor, 0);
    asserir(Math.abs(soma - 5500.0) < 0.001, 'Soma total deve fechar exatamente em 5500.00');
    console.log('   ✓ Aprovado: Entrada R$ 500 (Quitada) + 10x de R$ 500 (Pendente) = R$ 5.500,00');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 4: R$ 4.500,00 com entrada PIX + 10x Cartão
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 4: R$ 4.500,00 com entrada PIX R$ 291 + 10x Cartão de R$ 420,90');
  {
    const pac = { id: 'pac-cen-4', nome: 'Daniel Fictício Rocha', cpf: '444.555.666-77' };
    const cond = {
      id: 'c4',
      tipo: 'entrada_saldo' as const,
      titulo: 'Entrada PIX + 10x no Cartão',
      descricao: 'Entrada de R$ 291,00 via PIX + Saldo em 10x no Cartão de Crédito',
      valorTotal: 4500.0,
      valorEntrada: 291.0,
      metodoEntrada: 'pix' as const,
      saldoMetodo: 'cartao' as const,
      saldoParcelas: 10,
      cartaoAutorizado: true,
      nsu: '1234567890',
    };
    const orc = {
      id: 'orc-cen-4',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      subtotal: 4500.0,
      desconto: 0,
      total: 4500.0,
      condicaoEscolhida: cond,
      itens: [{ id: 'i4', nome: 'Lentes Resina Composta', valorTotal: 4500, quantidade: 6 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    asserir(parcs.length === 11, 'Deve conter 11 parcelas (1 entrada + 10 cartão)');
    asserir(parcs[0].metodo === 'PIX', 'Entrada deve ser PIX');
    asserir(parcs[0].valor === 291.0, 'Entrada deve ser 291.00');
    const soma = parcs.reduce((acc, p) => acc + p.valor, 0);
    asserir(Math.abs(soma - 4500.0) < 0.001, 'Soma total deve fechar exatamente em 4500.00');
    for (let i = 1; i < 11; i++) {
      asserir(parcs[i].metodo === 'Cartão de Crédito', 'Saldo deve ser Cartão de Crédito');
      asserir(parcs[i].vencimento === 'Fatura do Cartão', 'Vencimento de cartão deve ser Fatura do Cartão');
      asserir(parcs[i].status === 'Autorizado', 'Cartão autorizado com NSU deve ter status Autorizado');
      asserir(parcs[i].valor === 420.90, `Parcela ${i} do cartão deve ser R$ 420.90`);
    }
    console.log('   ✓ Aprovado: Entrada PIX R$ 291 + 10x Cartão R$ 420,90 (Autorizado) = R$ 4.500,00 exato');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 5: R$ 7.499,96 com desconto de R$ 500,04 sobre R$ 8.000,00
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 5: R$ 7.499,96 com desconto');
  {
    const pac = { id: 'pac-cen-5', nome: 'Eduarda Fictícia Castro', cpf: '555.666.777-88' };
    const cond = {
      id: 'c5',
      tipo: 'cartao' as const,
      titulo: 'Cartão 7x com Desconto Especial',
      descricao: 'Parcelamento no Cartão de Crédito em 7x',
      valorTotal: 7499.96,
      descontoValor: 500.04,
      parcelas: 7,
    };
    const orc = {
      id: 'orc-cen-5',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      subtotal: 8000.0,
      desconto: 500.04,
      total: 7499.96,
      condicaoEscolhida: cond,
      itens: [{ id: 'i5', nome: 'Reabilitação Oral', valorTotal: 8000.0, quantidade: 1 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    asserir(snap.orcamento.subtotal === 8000.0, 'Subtotal deve ser 8000.00');
    asserir(snap.orcamento.desconto === 500.04, 'Desconto deve ser 500.04');
    asserir(snap.orcamento.total === 7499.96, 'Total líquido deve ser 7499.96');
    const parcs = snap.financeiro.parcelas;
    asserir(parcs.length === 7, 'Deve conter 7 parcelas');
    const soma = parcs.reduce((acc, p) => acc + p.valor, 0);
    asserir(Math.abs(soma - 7499.96) < 0.001, `Soma das parcelas (${soma}) deve ser 7499.96`);
    console.log(`   ✓ Aprovado: Subtotal R$ 8.000,00 - Desconto R$ 500,04 = Total R$ 7.499,96 (7 parcelas fecham em R$ ${soma.toFixed(2)})`);
  }

  // -------------------------------------------------------------------
  // CENÁRIO 6: Cartão parcelado sem entrada (6x de R$ 500,00)
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 6: Cartão parcelado sem entrada');
  {
    const pac = { id: 'pac-cen-6', nome: 'Fabio Fictício Nogueira', cpf: '666.777.888-99' };
    const cond = {
      id: 'c6',
      tipo: 'cartao' as const,
      titulo: '6x sem juros no Cartão',
      descricao: 'Parcelamento no Cartão de Crédito em 6x de R$ 500,00 sem juros',
      valorTotal: 3000.0,
      parcelas: 6,
      cartaoAutorizado: false,
    };
    const orc = {
      id: 'orc-cen-6',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      total: 3000.0,
      condicaoEscolhida: cond,
      itens: [{ id: 'i6', nome: 'Clareamento + Restaurações', valorTotal: 3000, quantidade: 1 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    asserir(parcs.length === 6, 'Deve conter 6 parcelas');
    asserir(snap.financeiro.entrada === 0, 'Entrada deve ser 0');
    for (const p of parcs) {
      asserir(p.valor === 500.0, 'Cada parcela deve ser 500.00');
      asserir(p.vencimento === 'Fatura do Cartão', 'Vencimento deve ser Fatura do Cartão');
      asserir(p.status === 'Pendente', 'Cartão não autorizado deve ter status Pendente');
    }
    console.log('   ✓ Aprovado: 6x de R$ 500,00 no Cartão (Entrada zero, Fatura do Cartão, Status Pendente)');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 7: Pagamento misto com valores quebrados (dízima periódica)
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 7: Pagamento com valor quebrado: R$ 1.234,57 em 3x');
  {
    const pac = { id: 'pac-cen-7', nome: 'Gabriela Fictícia Santos', cpf: '777.888.999-00' };
    const cond = {
      id: 'c7',
      tipo: 'cartao' as const,
      titulo: '3x no Cartão',
      descricao: 'Parcelamento em 3x',
      valorTotal: 1234.57,
      parcelas: 3,
    };
    const orc = {
      id: 'orc-cen-7',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      total: 1234.57,
      condicaoEscolhida: cond,
      itens: [{ id: 'i7', nome: 'Procedimento Geral', valorTotal: 1234.57, quantidade: 1 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    asserir(parcs.length === 3, 'Deve conter 3 parcelas');
    const soma = parcs.reduce((acc, p) => acc + p.valor, 0);
    asserir(Math.abs(soma - 1234.57) < 0.001, `Soma das parcelas (${soma}) deve ser exatamente 1234.57`);
    console.log(`   ✓ Aprovado: R$ 1.234,57 dividido em 3x: ${parcs.map(p => `R$ ${p.valor}`).join(', ')} -> Soma R$ ${soma.toFixed(2)}`);
  }

  // -------------------------------------------------------------------
  // CENÁRIO 8: Pagamento parcialmente confirmado
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 8: Pagamento parcialmente confirmado (Entrada Quitada, Saldo Pendente)');
  {
    const pac = { id: 'pac-cen-8', nome: 'Helena Fictícia Miranda', cpf: '888.999.000-11' };
    const cond = {
      id: 'c8',
      tipo: 'entrada_saldo' as const,
      titulo: 'Entrada PIX + Saldo Cartão',
      descricao: 'Entrada de R$ 1.000,00 via PIX + Saldo de R$ 2.000,00 em 2x no Cartão',
      valorTotal: 3000.0,
      valorEntrada: 1000.0,
      metodoEntrada: 'pix' as const,
      saldoMetodo: 'cartao' as const,
      saldoParcelas: 2,
      entradaConfirmada: true, // Entrada recebida e quitada
      cartaoAutorizado: false, // Saldo ainda não autorizado
    };
    const orc = {
      id: 'orc-cen-8',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      total: 3000.0,
      condicaoEscolhida: cond,
      itens: [{ id: 'i8', nome: 'Prótese Odontológica', valorTotal: 3000, quantidade: 1 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    asserir(parcs[0].status === 'Quitada', 'Entrada deve estar Quitada');
    asserir(parcs[1].status === 'Pendente', 'Parcela 1 do saldo deve estar Pendente');
    asserir(parcs[2].status === 'Pendente', 'Parcela 2 do saldo deve estar Pendente');
    console.log('   ✓ Aprovado: Parcela 1 Entrada = Quitada; Parcelas 2 e 3 Saldo = Pendente');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 9: Contrato sem pagamento confirmado
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 9: Contrato comercialmente aprovado SEM pagamento financeiro confirmado');
  {
    const pac = { id: 'pac-cen-9', nome: 'Igor Fictício Ramos', cpf: '999.000.111-22' };
    const cond = {
      id: 'c9',
      tipo: 'pix_parcelado' as const,
      titulo: '4x no PIX',
      descricao: 'Parcelamento em 4x de R$ 500,00',
      valorTotal: 2000.0,
      parcelas: 4,
      pagamentoConfirmado: false,
      comprovado: false,
    };
    const orc = {
      id: 'orc-cen-9',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      total: 2000.0,
      condicaoEscolhida: cond,
      itens: [{ id: 'i9', nome: 'Endodontia Molar', valorTotal: 2000, quantidade: 1 }],
    };

    const snap = mapearDadosContrato({ patient: pac, orcamento: orc, configuracoes: clinicaMock, configContrato: clinicaMock });
    const parcs = snap.financeiro.parcelas;
    for (const p of parcs) {
      asserir(p.status === 'Pendente', 'Nenhuma parcela pode ser marcada como Quitada sem baixa real');
    }
    console.log('   ✓ Aprovado: Todas as 4 parcelas mantidas como Pendente (Diferenciação Vendas vs Caixa)');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 10: Dois orçamentos diferentes para o mesmo paciente
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 10: Dois orçamentos diferentes para o mesmo paciente (Isolamento Total)');
  {
    const pac = { id: 'pac-cen-10', nome: 'Juliana Fictícia Mesquita', cpf: '123.987.456-00' };

    // Orçamento A: R$ 2.500 em 5x Cartão
    const orcA = {
      id: 'orc-cen-10-A',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      total: 2500.0,
      condicaoEscolhida: {
        id: 'cA',
        tipo: 'cartao' as const,
        titulo: '5x Cartão Orçamento A',
        descricao: '5x de R$ 500,00 no Cartão',
        valorTotal: 2500.0,
        parcelas: 5,
      },
      itens: [{ id: 'iA', nome: 'Lentes Elementos Anteriores', valorTotal: 2500, quantidade: 4 }],
    };

    // Orçamento B: R$ 1.800 em PIX à Vista
    const orcB = {
      id: 'orc-cen-10-B',
      pacienteId: pac.id,
      pacienteNome: pac.nome,
      total: 1800.0,
      condicaoEscolhida: {
        id: 'cB',
        tipo: 'a_vista' as const,
        titulo: 'PIX à Vista Orçamento B',
        descricao: 'Pagamento à vista via PIX',
        valorTotal: 1800.0,
      },
      itens: [{ id: 'iB', nome: 'Endodontia Elemento 21', valorTotal: 1800, quantidade: 1 }],
    };

    const snapA = mapearDadosContrato({ patient: pac, orcamento: orcA, configuracoes: clinicaMock, configContrato: clinicaMock });
    const snapB = mapearDadosContrato({ patient: pac, orcamento: orcB, configuracoes: clinicaMock, configContrato: clinicaMock });

    asserir(snapA.financeiro.total === 2500.0, 'Total de A deve ser 2500');
    asserir(snapA.financeiro.parcelas.length === 5, 'A deve ter 5 parcelas de cartão');
    asserir(snapA.financeiro.parcelas[0].metodo === 'Cartão de Crédito', 'Método de A deve ser Cartão');

    asserir(snapB.financeiro.total === 1800.0, 'Total de B deve ser 1800');
    asserir(snapB.financeiro.parcelas.length === 1, 'B deve ter 1 parcela de PIX');
    asserir(snapB.financeiro.parcelas[0].metodo === 'PIX', 'Método de B deve ser PIX');

    console.log('   ✓ Aprovado: Orçamento A (5x Cartão R$ 2.500) e Orçamento B (PIX à vista R$ 1.800) 100% isolados');
  }

  // -------------------------------------------------------------------
  // CENÁRIO 11: Bloqueio estrito de emissão para dados incompletos
  // -------------------------------------------------------------------
  console.log('\nCENÁRIO 11: Bloqueio de emissão quando o cronograma financeiro está incompleto');
  {
    const pac = { id: 'pac-cen-11', nome: 'Paciente Dados Incompletos', cpf: '000.000.000-00' };
    const orcIncompleto = {
      id: 'orc-incompleto',
      pacienteId: pac.id,
      total: 5000,
      formasPagamento: 'A combinar',
    };

    const snapIncompleto = mapearDadosContrato({ patient: pac, orcamento: orcIncompleto, configuracoes: clinicaMock, configContrato: clinicaMock });
    const validacao = validarCronogramaFinanceiroContrato(snapIncompleto);
    asserir(!validacao.valido, 'Contrato sem parcelas estruturadas deve falhar validação');
    asserir(validacao.erros.length > 0, 'Deve listar motivos de recusa');

    const resEmissao = await emitirContratoPersistido(snapIncompleto);
    asserir(!resEmissao.ok, 'Emissão persistida deve ser rejeitada');
    console.log('   ✓ Aprovado: Tentativa de emitir contrato com cronograma incompleto/a combinar foi bloqueada com segurança');
  }

  console.log('\n======================================================================');
  console.log('TODOS OS CENÁRIOS FORAM EXECUTADOS E APROVADOS COM 100% DE SUCESSO!');
  console.log('======================================================================\n');
}

executarTodosOsCenários().catch((err) => {
  console.error('\n❌ ERRO NA SUÍTE DE TESTES:', err);
  process.exit(1);
});

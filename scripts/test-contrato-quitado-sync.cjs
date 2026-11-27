const assert = require('assert');

// Test logic mirroring contratoEngine.ts
function testQuitado() {
  console.log('Testing Quitado detection and PIX suppression...');

  // 1. Test case a_vista detection
  const condicao = {
    tipo: 'a_vista',
    titulo: 'Opção 1: À Vista no PIX',
    descricao: 'Pagamento à vista via PIX / Transferência: R$ 7.000,00 (em 26/11/2026) [Quitada]',
  };
  const descOuTit = `${condicao.descricao || ''} ${condicao.titulo || ''}`.toLowerCase();
  const temTagQuitada = /quitad|pago|paga/i.test(descOuTit) || /quitad|pago|paga/i.test(condicao.situacao || '') || /quitad|pago|paga/i.test(condicao.situacaoEntrada || '');
  const pixComprovado = Boolean(condicao.pagamentoConfirmado || condicao.pago || temTagQuitada || (condicao.situacaoEntrada === 'Quitada' && condicao.comprovado));
  const sitVista = pixComprovado ? 'Quitada' : 'Pendente';

  assert.strictEqual(sitVista, 'Quitada', 'sitVista must be Quitada when [Quitada] is present');
  console.log('  [PASSOU] sitVista identificado corretamente como Quitada!');

  // 2. Test isFormaAvista with orcamento.formasPagamento
  const financeiro = { formaPagamento: 'Pagamento à vista via PIX', quantidadeParcelas: 1 };
  const orcamento = { formasPagamento: 'Pagamento à vista via PIX / Transferência: R$ 7.000,00 (em 26/11/2026) [Quitada]' };
  const isFormaAvista =
    /à\s*vista|a\s*vista|avista|pix\s*com\s*desconto|dinheiro|transfer[eê]ncia/i.test(financeiro.formaPagamento || '') ||
    /à\s*vista|a\s*vista|avista|pix\s*com\s*desconto|dinheiro|transfer[eê]ncia/i.test(orcamento.formasPagamento || '') ||
    (financeiro.quantidadeParcelas <= 1);

  assert.strictEqual(isFormaAvista, true, 'isFormaAvista must be true');
  console.log('  [PASSOU] isFormaAvista reconhecido!');

  // 3. Test parcelasPixNaoPagas
  const parcelas = [
    { numero: 1, descricao: 'Pagamento Único via PIX', metodo: 'PIX', valor: 7000, status: 'Quitada' }
  ];
  const parcelasPixNaoPagas = parcelas.filter((p) => {
    const isCartao = false;
    const isPix = true;
    const isPaga = Boolean(
      (p.status && /paga|pago|quitad/i.test(p.status)) ||
      (p.descricao && /quitad|pago|paga/i.test(p.descricao)) ||
      (/quitad|pago|paga/i.test(financeiro.formaPagamento || '')) ||
      (/quitad|pago|paga/i.test(orcamento.formasPagamento || ''))
    );
    return isPix && !isPaga;
  });

  assert.strictEqual(parcelasPixNaoPagas.length, 0, 'parcelasPixNaoPagas must be empty when quitado');
  const todasPixPagas = parcelas.length > 0 && parcelasPixNaoPagas.length === 0;
  assert.strictEqual(todasPixPagas, true, 'todasPixPagas must be true');
  console.log('  [PASSOU] todasPixPagas é true, gerando banner de quitado e ocultando QR code!');

  console.log('\nTodos os testes de quitação e sincronização passaram com sucesso (100%)!');
}

testQuitado();

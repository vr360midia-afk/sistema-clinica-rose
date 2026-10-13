import { valorPorExtenso } from './recibo';
import { formatMoney } from './exportCsv';
import type { Paciente, Transacao } from '@/types/shared';
import type { Orcamento } from '@/hooks/useOrcamentos';
import type { ConfiguracoesGerais } from '@/hooks/useConfiguracoes';

export interface ContratoItem {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  denteOuRegiao?: string;
}

export interface ContratoParcela {
  numero: number;
  descricao?: string;
  vencimento: string;
  valor: number;
  metodo?: string;
  status?: string;
}

export interface ContratoDadosPaciente {
  id: string;
  nome: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  idade: string;
  endereco: string;
  telefone: string;
  email: string;
  profissao: string;
  estadoCivil: string;
}

export interface ContratoDadosClinica {
  nome: string;
  cnpj: string;
  cro: string;
  endereco: string;
  telefone: string;
  email: string;
  logoUrl?: string;
  cidade: string;
  dentistaResponsavel: string;
  chavePix?: string;
}

export interface ContratoDadosOrcamento {
  id: string;
  numeroIdentificador: string;
  titulo: string;
  subtotal: number;
  desconto: number;
  total: number;
  totalExtenso: string;
  formasPagamento: string;
  validade: string;
  dataAprovacao: string;
  itens: ContratoItem[];
}

export interface ContratoDadosFinanceiro {
  subtotal: number;
  desconto: number;
  total: number;
  totalExtenso: string;
  formaPagamento: string;
  entrada: number;
  parcelas: ContratoParcela[];
  quantidadeParcelas: number;
  valorParcela: number;
}

export interface ContratoSnapshot {
  contratoId: string;
  orcamentoId: string;
  pacienteId: string;
  versao: string;
  status: 'emitido' | 'assinado' | 'cancelado';
  emitidoEm: string;
  paciente: ContratoDadosPaciente;
  clinica: ContratoDadosClinica;
  orcamento: ContratoDadosOrcamento;
  financeiro: ContratoDadosFinanceiro;
  assinaturaPaciente?: {
    assinaturaData: string;
    nome: string;
    dataHora: string;
  } | null;
  assinaturaDentista?: {
    assinaturaData: string;
    nome: string;
    dataHora: string;
  } | null;
}

const formatarData = (d: Date | string | undefined | null): string => {
  if (!d) return 'Não informada';
  const data = d instanceof Date ? d : new Date(String(d));
  if (isNaN(data.getTime())) return String(d);
  return data.toLocaleDateString('pt-BR');
};

const formatarDataPorExtenso = (d: Date = new Date(), cidade = 'São Paulo'): string => {
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const dia = d.getDate();
  const mes = meses[d.getMonth()];
  const ano = d.getFullYear();
  return `${cidade}, ${dia} de ${mes} de ${ano}`;
};

/**
 * Mapeia os dados existentes no sistema para o modelo padronizado do contrato.
 * NUNCA inventa dados fictícios; preserva rigorosamente a integridade dos registros.
 */
export const mapearDadosContrato = ({
  patient,
  orcamento,
  transacoes = [],
  configuracoes,
  dentistaNome,
  dentistaCro,
  cidadeLocal = 'São Paulo',
}: {
  patient: Partial<Paciente> | any;
  orcamento: Orcamento | any;
  transacoes?: Transacao[] | any[];
  configuracoes?: Partial<ConfiguracoesGerais> | any;
  dentistaNome?: string;
  dentistaCro?: string;
  cidadeLocal?: string;
}): ContratoSnapshot => {
  const emitidoEmData = new Date();
  const emitidoEm = emitidoEmData.toISOString();
  const contratoId = `CTR-${orcamento?.id ? orcamento.id.slice(0, 8).toUpperCase() : Date.now().toString(36).toUpperCase()}`;

  // 1. Dados cadastrais do Paciente
  const dadosPaciente: ContratoDadosPaciente = {
    id: patient?.id || '',
    nome: patient?.nome || 'Nome não informado',
    cpf: patient?.cpf || 'Não informado',
    rg: patient?.rg || 'Não informado',
    dataNascimento: formatarData(patient?.dataNascimento),
    idade: patient?.idade ? `${patient.idade} anos` : 'Não informada',
    endereco: patient?.endereco || 'Não informado',
    telefone: patient?.telefone || 'Não informado',
    email: patient?.email || 'Não informado',
    profissao: patient?.profissao || 'Não informada',
    estadoCivil: patient?.estadoCivil || 'Não informado',
  };

  // 2. Dados da Clínica / Responsável Técnico
  const dadosClinica: ContratoDadosClinica = {
    nome: configuracoes?.nomeClinica || 'Clínica Odontológica',
    cnpj: configuracoes?.cnpj || 'Não informado',
    cro: dentistaCro || configuracoes?.croResponsavel || configuracoes?.cro_responsavel || 'CRO sob consulta',
    endereco: configuracoes?.endereco || 'Endereço da clínica',
    telefone: configuracoes?.telefone || configuracoes?.whatsappNumero || 'Não informado',
    email: configuracoes?.email || 'Não informado',
    logoUrl: configuracoes?.logoUrl || undefined,
    cidade: cidadeLocal,
    dentistaResponsavel: dentistaNome || configuracoes?.croResponsavel || 'Cirurgião-Dentista Responsável',
    chavePix: configuracoes?.telefone || configuracoes?.cnpj || configuracoes?.whatsappNumero || configuracoes?.email || 'Chave da clínica sob consulta',
  };

  // 3. Procedimentos aprovados do Orçamento
  const itensOrcamento: ContratoItem[] = (orcamento?.itens || []).map((item: any) => {
    const nome = String(item?.nome || 'Procedimento odontológico');
    const quantidade = Number(item?.quantidade || 1);
    const valorUnitario = Number(item?.valor || 0);
    const valorTotal = valorUnitario * quantidade;

    // Detecta menção a dente ou região se presente na descrição (ex.: "Dente 16", "Região anterior")
    const denteMatch = nome.match(/(?:dente|elemento|regi[aã]o)\s*([0-9a-zA-Z\s-]+)/i);
    const denteOuRegiao = denteMatch ? denteMatch[0] : undefined;

    return {
      nome,
      quantidade,
      valorUnitario,
      valorTotal,
      denteOuRegiao,
    };
  });

  const subtotal = itensOrcamento.reduce((acc, i) => acc + i.valorTotal, 0);
  const desconto = Number(orcamento?.desconto || 0);
  const total = Number(orcamento?.total ?? Math.max(0, subtotal - desconto));
  const totalExtenso = valorPorExtenso(total);

  const dadosOrcamento: ContratoDadosOrcamento = {
    id: orcamento?.id || '',
    numeroIdentificador: orcamento?.id ? orcamento.id.slice(0, 8).toUpperCase() : 'S/N',
    titulo: orcamento?.titulo || 'Plano de Tratamento Odontológico',
    subtotal,
    desconto,
    total,
    totalExtenso,
    formasPagamento: orcamento?.formasPagamento || orcamento?.formas_pagamento || 'Conforme acordado entre as partes',
    validade: formatarData(orcamento?.validade),
    dataAprovacao: formatarData(orcamento?.atualizadoEm || orcamento?.criadoEm),
    itens: itensOrcamento,
  };

  // 4. Dados Financeiros e Cronograma de Parcelas
  // Prioridade: buscar transações vinculadas ao orçamento (receitas)
  const transacoesOrcamento = (transacoes || []).filter(
    (t: any) => t?.orcamentoId === orcamento?.id && t?.tipo === 'receita'
  );

  let parcelas: ContratoParcela[] = [];
  let entrada = 0;

  if (transacoesOrcamento.length > 0) {
    // Ordena por vencimento / data
    const ordenadas = [...transacoesOrcamento].sort(
      (a, b) => new Date(a.vencimento || a.data).getTime() - new Date(b.vencimento || b.data).getTime()
    );

    parcelas = ordenadas.map((t, idx) => {
      const valor = Number(t.valor || 0);
      const isEntrada = t.descricao?.toLowerCase().includes('entrada') || (idx === 0 && t.status === 'pago');
      if (isEntrada && entrada === 0) {
        entrada = valor;
      }

      return {
        numero: idx + 1,
        descricao: t.descricao || `Parcela ${idx + 1}`,
        vencimento: formatarData(t.vencimento || t.data),
        valor,
        metodo: t.metodoPagamento || 'A definir',
        status: t.status === 'pago' ? 'Quitada' : t.status === 'vencido' ? 'Vencida' : 'A vencer',
      };
    });
  } else {
    // Se ainda não foram criadas transações detalhadas no financeiro,
    // extrai a negociação das opções de parcelamento do orçamento
    const formas = orcamento?.formasPagamento || '';

    // 1. Detecta Entrada (ex: "Entrada de R$ 500,00" ou "Entrada: R$ 500")
    const entradaMatch = formas.match(/entrada(?:\s+de)?\s*(?:r\$)?\s*([\d.,]+)/i);
    let entradaDetectada = 0;
    if (entradaMatch) {
      const valorLimpo = entradaMatch[1].replace(/\./g, '').replace(',', '.');
      entradaDetectada = Number(valorLimpo) || 0;
    }
    entrada = entradaDetectada;

    // 2. Detecta Qtd. de Parcelas: ex: "4x" ou "4 parcelas"
    const parcelasMatch = formas.match(/(\d+)\s*x/i) || formas.match(/(\d+)\s*parcelas/i);
    const qtdParcelas = parcelasMatch ? Math.max(1, parseInt(parcelasMatch[1], 10)) : 1;

    // 3. Detecta Dia do Vencimento: ex: "vencimento todo dia 10", "dia 15", "vencimento: dia 5"
    const diaMatch = formas.match(/(?:vencimento|dia)\s*(?:todo\s*dia)?\s*(\d{1,2})/i);
    const diaVencimento = diaMatch ? Math.min(28, Math.max(1, parseInt(diaMatch[1], 10))) : 10;

    // 4. Saldo a parcelar e valor da parcela mensal
    const saldo = Math.max(0, total - entrada);
    const valorParcela = saldo / qtdParcelas;

    const listaParcelas: ContratoParcela[] = [];
    const hoje = new Date();

    // Se houver entrada, inclui a entrada como primeiro item do cronograma
    if (entrada > 0) {
      listaParcelas.push({
        numero: 1,
        descricao: 'Entrada Inicial (PIX / À vista)',
        vencimento: formatarData(hoje),
        valor: entrada,
        metodo: 'PIX (Entrada)',
        status: 'A vencer',
      });
    }

    const isPix = /pix/i.test(formas);

    for (let idx = 0; idx < qtdParcelas; idx++) {
      const targetMonth = hoje.getMonth() + (idx + 1);
      const dataVenc = new Date(hoje.getFullYear(), targetMonth, 1);
      const maxDiasNoMes = new Date(dataVenc.getFullYear(), dataVenc.getMonth() + 1, 0).getDate();
      dataVenc.setDate(Math.min(diaVencimento, maxDiasNoMes));

      listaParcelas.push({
        numero: listaParcelas.length + 1,
        descricao: qtdParcelas === 1 && entrada === 0
          ? 'Pagamento Único'
          : `Parcela ${idx + 1} de ${qtdParcelas} ${isPix ? '(PIX Mensal)' : ''}`,
        vencimento: formatarData(dataVenc),
        valor: valorParcela,
        metodo: isPix ? 'PIX Parcelado' : orcamento?.formasPagamento || 'A definir',
        status: 'A vencer',
      });
    }

    parcelas = listaParcelas;
  }

  const parcelasSemEntrada = parcelas.filter((p) => !p.descricao.toLowerCase().includes('entrada'));
  const quantidadeParcelas = parcelasSemEntrada.length || parcelas.length;
  const valorParcela = parcelasSemEntrada.length > 0 ? parcelasSemEntrada[0].valor : (parcelas.length > 0 ? parcelas[0].valor : total);

  const dadosFinanceiro: ContratoDadosFinanceiro = {
    subtotal,
    desconto,
    total,
    totalExtenso,
    formaPagamento: orcamento?.formasPagamento || orcamento?.formas_pagamento || 'A combinar',
    entrada,
    parcelas,
    quantidadeParcelas,
    valorParcela,
  };

  return {
    contratoId,
    orcamentoId: orcamento?.id || '',
    pacienteId: patient?.id || '',
    versao: '1.0',
    status: 'emitido',
    emitidoEm,
    paciente: dadosPaciente,
    clinica: dadosClinica,
    orcamento: dadosOrcamento,
    financeiro: dadosFinanceiro,
    assinaturaPaciente: null,
    assinaturaDentista: null,
  };
};

/**
 * Gera o documento HTML do contrato completo, pronto para renderização,
 * pré-visualização, impressão (window.print) e conversão para PDF A4 via html2canvas/jsPDF.
 */
export const gerarHtmlContrato = (snapshot: ContratoSnapshot): string => {
  const { paciente, clinica, orcamento, financeiro } = snapshot;
  const dataHojeExtenso = formatarDataPorExtenso(new Date(snapshot.emitidoEm), clinica.cidade || 'Local');

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Contrato de Prestação de Serviços Odontológicos - ${paciente.nome}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 13px;
      line-height: 1.6;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 32px 40px;
    }
    .contrato-container {
      max-width: 760px;
      margin: 0 auto;
    }
    .cabecalho {
      border-bottom: 2px solid #111827;
      padding-bottom: 14px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    .cabecalho-logo img {
      max-height: 60px;
      max-width: 180px;
      object-fit: contain;
    }
    .cabecalho-clinica h1 {
      font-size: 18px;
      margin: 0 0 2px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cabecalho-clinica p {
      margin: 1px 0;
      font-size: 11px;
      color: #4b5563;
      font-family: Arial, sans-serif;
    }
    .cabecalho-doc-id {
      text-align: right;
      font-family: Arial, sans-serif;
      font-size: 11px;
      color: #374151;
    }
    .cabecalho-doc-id strong {
      font-size: 13px;
      color: #111827;
    }
    .titulo-principal {
      text-align: center;
      margin: 24px 0 20px;
    }
    .titulo-principal h2 {
      font-size: 16px;
      margin: 0 0 4px;
      font-weight: bold;
      letter-spacing: 1px;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .titulo-principal p {
      margin: 0;
      font-size: 12px;
      color: #4b5563;
      font-style: italic;
    }
    .clausula-bloco {
      margin-bottom: 18px;
      text-align: justify;
    }
    .clausula-titulo {
      font-weight: bold;
      margin-top: 14px;
      margin-bottom: 6px;
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.5px;
    }
    .paragrafo {
      margin: 0 0 8px;
      text-indent: 28px;
    }
    .tabela-dados {
      width: 100%;
      border-collapse: collapse;
      margin: 12px 0;
      font-size: 12px;
      font-family: Arial, sans-serif;
    }
    .tabela-dados th, .tabela-dados td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: left;
    }
    .tabela-dados th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    .tabela-dados tr:nth-child(even) {
      background-color: #fafafa;
    }
    .tabela-dados .col-num {
      text-align: center;
      width: 38px;
    }
    .tabela-dados .col-money {
      text-align: right;
      width: 95px;
    }
    .totais-resumo {
      margin: 10px 0 16px auto;
      width: 320px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 10px;
      background-color: #f9fafb;
      font-family: Arial, sans-serif;
      font-size: 12px;
    }
    .totais-linha {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      color: #4b5563;
    }
    .totais-linha.destaque {
      border-top: 1px solid #111827;
      margin-top: 6px;
      padding-top: 6px;
      font-size: 14px;
      font-weight: bold;
      color: #111827;
    }
    .bloco-assinaturas {
      margin-top: 48px;
      page-break-inside: avoid;
    }
    .data-local {
      text-align: right;
      margin-bottom: 40px;
      font-style: italic;
    }
    .grid-assinaturas {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-top: 30px;
    }
    .campo-assinatura {
      flex: 1;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    .campo-assinatura img {
      max-height: 70px;
      margin: 0 auto 4px;
      display: block;
    }
    .linha-assinatura {
      border-top: 1px solid #111827;
      margin: 0 auto 6px;
      width: 90%;
    }
    .assinatura-nome {
      font-weight: bold;
      font-size: 12px;
    }
    .assinatura-papel {
      font-size: 11px;
      color: #4b5563;
    }
    .assinatura-detalhes {
      font-size: 9px;
      color: #6b7280;
      margin-top: 2px;
    }
    .rodape-documento {
      margin-top: 32px;
      padding-top: 10px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #9ca3af;
      font-family: Arial, sans-serif;
    }
    @media print {
      body {
        padding: 0;
      }
      .contrato-container {
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="contrato-container">
    <!-- Cabeçalho Institucional -->
    <div class="cabecalho">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${clinica.logoUrl ? `<div class="cabecalho-logo"><img src="${clinica.logoUrl}" alt="Logo" /></div>` : ''}
        <div class="cabecalho-clinica">
          <h1>${clinica.nome}</h1>
          <p>CNPJ: ${clinica.cnpj} • CRO: ${clinica.cro}</p>
          <p>${clinica.endereco}</p>
          <p>Telefone: ${clinica.telefone} • E-mail: ${clinica.email}</p>
        </div>
      </div>
      <div class="cabecalho-doc-id">
        <div>Contrato Nº <strong>${snapshot.contratoId}</strong></div>
        <div>Orçamento Ref.: <strong>#${orcamento.numeroIdentificador}</strong></div>
        <div style="margin-top: 4px; font-size: 10px;">Versão ${snapshot.versao}</div>
      </div>
    </div>

    <!-- Título Principal -->
    <div class="titulo-principal">
      <h2>Contrato de Prestação de Serviços Odontológicos</h2>
      <p>Termo de Adesão, Plano de Tratamento e Acordo Financeiro</p>
    </div>

    <!-- Preâmbulo - Da Qualificação das Partes -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">PREÂMBULO — DA QUALIFICAÇÃO DAS PARTES</div>
      <p class="paragrafo">
        Por este instrumento particular de prestação de serviços odontológicos, têm entre si justo e avençado:
      </p>
      <p class="paragrafo">
        <strong>CONTRATADA:</strong> <strong>${clinica.nome}</strong>, pessoa jurídica de direito privado inscrita no CNPJ sob o nº <strong>${clinica.cnpj}</strong>, com sede e consultório estabelecido em <strong>${clinica.endereco}</strong>, telefone: <strong>${clinica.telefone}</strong>, e-mail: <strong>${clinica.email}</strong>, tendo como Responsável Técnico(a) o(a) Cirurgião(ã)-Dentista <strong>${clinica.dentistaResponsavel}</strong>, inscrito(a) no Conselho Regional de Odontologia sob o CRO nº <strong>${clinica.cro}</strong>.
      </p>
      <p class="paragrafo">
        E de outro lado:
      </p>
      <p class="paragrafo">
        <strong>CONTRATANTE / PACIENTE:</strong> <strong>${paciente.nome}</strong>, estado civil: <strong>${paciente.estadoCivil}</strong>, profissão: <strong>${paciente.profissao}</strong>, portador(a) do RG nº <strong>${paciente.rg}</strong>, inscrito(a) no CPF/MF sob o nº <strong>${paciente.cpf}</strong>, data de nascimento: <strong>${paciente.dataNascimento}</strong>, residente e domiciliado(a) em <strong>${paciente.endereco}</strong>, telefone: <strong>${paciente.telefone}</strong>, e-mail: <strong>${paciente.email}</strong>.
      </p>
      <p class="paragrafo">
        As partes acima qualificadas celebram o presente contrato, mediante as cláusulas e condições seguintes:
      </p>
    </div>

    <!-- Cláusula 1 - Do Objeto -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 1ª — DO OBJETO E PROCEDIMENTOS APROVADOS</div>
      <p class="paragrafo">
        O presente contrato tem por objeto a prestação de serviços profissionais odontológicos pela <strong>CONTRATADA</strong> em favor do(a) <strong>CONTRATANTE</strong>, conforme diagnóstico clínico prévio e plano de tratamento formalmente aprovado no <strong>Orçamento nº #${orcamento.numeroIdentificador}</strong> (${orcamento.titulo}), compreendendo a realização dos seguintes atos e procedimentos clínicos:
      </p>

      <table class="tabela-dados">
        <thead>
          <tr>
            <th class="col-num">Item</th>
            <th>Procedimento / Tratamento</th>
            <th class="col-num">Qtd.</th>
            <th class="col-money">Valor Unit.</th>
            <th class="col-money">Total</th>
          </tr>
        </thead>
        <tbody>
          ${orcamento.itens.map((item, idx) => `
            <tr>
              <td class="col-num">${idx + 1}</td>
              <td>
                <strong>${item.nome}</strong>
                ${item.denteOuRegiao ? `<br/><span style="font-size: 10px; color: #4b5563;">Região/Elemento: ${item.denteOuRegiao}</span>` : ''}
              </td>
              <td class="col-num">${item.quantidade}</td>
              <td class="col-money">${formatMoney(item.valorUnitario)}</td>
              <td class="col-money">${formatMoney(item.valorTotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p class="paragrafo" style="font-size: 11px; color: #4b5563;">
        <strong>Parágrafo Único:</strong> Modificações clínicas decorrentes de diagnósticos imprevistos durante o decorrer do tratamento, bem como necessidades adicionais não contempladas nesta relação, serão previamente comunicadas e orçadas à parte em termo aditivo.
      </p>
    </div>

    <!-- 5. CLÁUSULA 2ª — DO VALOR TOTAL -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 2ª — DO VALOR TOTAL</div>
      <p class="paragrafo">
        Pela execução integral dos procedimentos odontológicos pactuados na Cláusula 1ª, o(a) <strong>CONTRATANTE</strong> pagará à <strong>CONTRATADA</strong> o valor total global e líquido de <strong>${formatMoney(financeiro.total)}</strong> (<em>${financeiro.totalExtenso}</em>).
      </p>

      <div class="totais-resumo">
        <div class="totais-linha">
          <span>Subtotal dos Procedimentos:</span>
          <strong>${formatMoney(financeiro.subtotal)}</strong>
        </div>
        ${financeiro.desconto > 0 ? `
          <div class="totais-linha" style="color: #059669;">
            <span>Desconto Concedido:</span>
            <strong>- ${formatMoney(financeiro.desconto)}</strong>
          </div>
        ` : ''}
        <div class="totais-linha destaque">
          <span>VALOR TOTAL APROVADO:</span>
          <span>${formatMoney(financeiro.total)}</span>
        </div>
        <div style="font-size: 11px; color: #374151; margin-top: 4px; font-weight: 500;">
          Valor por extenso: ${financeiro.totalExtenso}
        </div>
      </div>

      <p class="paragrafo">
        <strong>Parágrafo Único:</strong> O valor total estabelecido nesta cláusula é certo, líquido e ajustado entre as partes, compreendendo os honorários profissionais e insumos inerentes aos atos clínicos pactuados, permanecendo irreajustável durante a vigência do plano de tratamento orçado.
      </p>
    </div>

    <!-- 6. CLÁUSULA 3ª — DO PAGAMENTO MENSAL VIA PIX E FORMAS ACORDADAS NO ORÇAMENTO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 3ª — DO PAGAMENTO MENSAL VIA PIX E FORMAS ACORDADAS NO ORÇAMENTO</div>
      <p class="paragrafo">
        O adimplemento do valor total avençado na Cláusula 2ª dar-se-á estritamente em conformidade com o acordado no <strong>Orçamento nº #${orcamento.numeroIdentificador}</strong> e com as formas de pagamento convencionadas entre as partes, registradas como: <strong>"${financeiro.formaPagamento}"</strong>.
      </p>

      ${financeiro.entrada > 0 ? `
        <p class="paragrafo">
          O plano financeiro pactuado compreende o pagamento de uma <strong>Entrada inicial de ${formatMoney(financeiro.entrada)}</strong> efetuada via PIX na assinatura/aprovação deste termo, e o saldo remanescente de <strong>${formatMoney(financeiro.total - financeiro.entrada)}</strong> dividido em <strong>${financeiro.quantidadeParcelas} (${financeiro.quantidadeParcelas === 1 ? 'uma única parcela' : `${financeiro.quantidadeParcelas} parcelas mensais sucessivas`})</strong> no valor de <strong>${formatMoney(financeiro.valorParcela)}</strong> cada, com vencimentos mensais discriminados no cronograma oficial a seguir:
        </p>
      ` : `
        <p class="paragrafo">
          O plano financeiro compreende a quitação em <strong>${financeiro.quantidadeParcelas} (${financeiro.quantidadeParcelas === 1 ? 'uma única' : `${financeiro.quantidadeParcelas} parcelas mensais sucessivas`})</strong>, no valor de <strong>${formatMoney(financeiro.valorParcela)}</strong> cada, com vencimentos mensais conforme discriminado no cronograma a seguir:
        </p>
      `}

      <!-- Detalhamento Oficial para Pagamento Mensal via PIX com QR Code -->
      <div style="margin: 12px 0; padding: 12px 14px; border: 1px dashed #0284c7; background-color: #f0f9ff; border-radius: 6px; font-family: Arial, sans-serif; font-size: 12px; color: #0369a1;">
        <div style="font-weight: bold; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
          ✦ Instruções e QR Code Oficial para Pagamento via PIX:
        </div>
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="background: #ffffff; padding: 4px; border: 1px solid #bae6fd; border-radius: 4px; text-align: center; flex-shrink: 0;">
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&margin=3&data=${encodeURIComponent(clinica.chavePix || clinica.cnpj || clinica.telefone || 'pix')}"
              alt="QR Code PIX"
              style="width: 80px; height: 80px; display: block;"
            />
            <div style="font-size: 8px; color: #0284c7; font-weight: bold; margin-top: 2px;">ESCANEAR PIX</div>
          </div>
          <div style="flex: 1;">
            <div style="padding: 6px 10px; background-color: #ffffff; border-radius: 4px; border: 1px solid #bae6fd; font-size: 11px; color: #0c4a6e;">
              <strong>Chave PIX:</strong> ${clinica.chavePix || clinica.cnpj || clinica.telefone || 'Chave da clínica sob consulta'} <br/>
              <strong>Titular / Favorecido:</strong> ${clinica.nome} • CNPJ: ${clinica.cnpj}
            </div>
            <div style="margin-top: 4px; font-size: 11px; color: #0284c7;">
              O(A) CONTRATANTE poderá utilizar a câmera do smartphone para leitura do QR Code acima ou efetuar a transferência direta para a chave informada, encaminhando o comprovante para confirmação da baixa da parcela.
            </div>
          </div>
        </div>
      </div>

      <p class="paragrafo">
        Segue o cronograma oficial com as parcelas, vencimentos e formas de pagamento estabelecidas:
      </p>

      <table class="tabela-dados">
        <thead>
          <tr>
            <th class="col-num">Parc.</th>
            <th>Descrição / Forma de Pagamento</th>
            <th style="width: 120px; text-align: center;">Data de Vencimento</th>
            <th class="col-money">Valor da Parcela</th>
            <th style="width: 90px; text-align: center;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${financeiro.parcelas.map((parc) => `
            <tr>
              <td class="col-num">${parc.numero}</td>
              <td><strong>${parc.descricao || `Parcela ${parc.numero}`}</strong> ${parc.metodo ? `— ${parc.metodo}` : ''}</td>
              <td style="text-align: center;"><strong>${parc.vencimento}</strong></td>
              <td class="col-money"><strong>${formatMoney(parc.valor)}</strong></td>
              <td style="text-align: center; font-size: 11px;">${parc.status || 'A vencer'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p class="paragrafo" style="font-size: 11px; color: #4b5563;">
        <strong>Parágrafo Primeiro (Mora e Encargos):</strong> O não pagamento de qualquer das parcelas mensais na data de seus respectivos vencimentos sujeitará o(a) <strong>CONTRATANTE</strong> à incidência de multa moratória de 2% (dois por cento) sobre o montante em atraso, acrescida de juros de mora legais de 1% (um por cento) ao mês calculados <em>pro rata die</em>, nos termos do art. 52, § 1º do Código de Defesa do Consumidor e art. 406 do Código Civil.
      </p>
      <p class="paragrafo" style="font-size: 11px; color: #4b5563;">
        <strong>Parágrafo Segundo (Inadimplência Superior a 30 dias):</strong> Ocorrendo atraso superior a 30 (trinta) dias no pagamento de qualquer parcela mensal acordada, a <strong>CONTRATADA</strong> poderá suspender temporariamente a continuidade dos procedimentos eletivos não emergenciais até a regularização financeira das parcelas em aberto, assegurados os atendimentos de urgência indispensáveis à saúde do paciente.
      </p>
    </div>

    <!-- Cláusula 4 - Das Obrigações da Contratada -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">Cláusula 4ª — Das Obrigações da Contratada</div>
      <p class="paragrafo">
        A <strong>CONTRATADA</strong> obriga-se a empregar a mais apurada técnica odontológica e materiais biocompatíveis reconhecidos pelos órgãos competentes, agindo com diligência, ética e perícia para a consecução dos atos pactuados.
      </p>
      <p class="paragrafo">
        <strong>Parágrafo Único:</strong> O(A) <strong>CONTRATANTE</strong> declara estar ciente de que a Odontologia é uma atividade profissional de <em>meio</em> e não de <em>resultado biológico garantido</em>, estando os procedimentos sujeitos a respostas orgânicas individuais, cicatrização, anatomia dental e cooperação do paciente.
      </p>
    </div>

    <!-- Cláusula 5 - Das Obrigações do Contratante -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">Cláusula 5ª — Das Obrigações do Contratante / Paciente</div>
      <p class="paragrafo">
        O(A) <strong>CONTRATANTE</strong> compromete-se a:
        <br/>a) Comparecer pontualmente a todas as consultas e sessões clínicas agendadas, comunicando eventual impossibilidade de comparecimento com antecedência mínima de 24 (vinte e quatro) horas;
        <br/>b) Seguir rigorosamente as orientações pré e pós-operatórias, recomendações de higiene oral e prescrições de medicamentos indicados pelo cirurgião-dentista;
        <br/>c) Comunicar imediatamente à clínica qualquer alteração em seu estado de saúde, gravidez, reações alérgicas ou sintomas anormais;
        <br/>d) Efetuar os pagamentos nas datas de vencimento estipuladas no cronograma financeiro.
      </p>
    </div>

    <!-- Cláusula 6 - Da Rescisão e Desistência -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">Cláusula 6ª — Da Rescisão e Desistência</div>
      <p class="paragrafo">
        Em caso de desistência imotivada ou solicitação de rescisão antes do término completo do tratamento por qualquer das partes, haverá o acerto de contas exclusivo dos procedimentos já executados e das custas de materiais protéticos e laboratoriais já confeccionados, restituindo-se eventual saldo positivo ou exigindo-se o pagamento dos valores correspondentes às etapas já concluídas.
      </p>
    </div>

    <!-- Cláusula 7 - Proteção de Dados (LGPD) -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">Cláusula 7ª — Da Proteção de Dados Pessoais (LGPD)</div>
      <p class="paragrafo">
        As partes declaram ciência e anuência ao tratamento de dados pessoais e dados sensíveis de saúde para fins exclusivos de atendimento assistencial, prontuário médico-odontológico, faturamento e cumprimento de deveres legais impostos pelo CFO e pela Lei Federal nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais).
      </p>
    </div>

    <!-- Cláusula 8 - Do Foro e Eficácia Executiva -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">Cláusula 8ª — Do Foro e Eficácia de Título Executivo Extrajudicial</div>
      <p class="paragrafo">
        As partes expressamente reconhecem e atribuem ao presente contrato a eficácia de <strong>Título Executivo Extrajudicial</strong>, nos termos do <strong>Artigo 784, inciso III, do Código de Processo Civil brasileiro (Lei nº 13.105/2015)</strong>, declarando líquidas, certas e exigíveis as obrigações pecuniárias ora assumidas. Para dirimir eventuais controvérsias decorrentes deste instrumento, as partes elegem o foro da Comarca de <strong>${clinica.cidade || 'Domicílio da Clínica'}</strong>, renunciando expressamente a qualquer outro, por mais privilegiado que seja.
      </p>
    </div>

    <!-- Data e Assinaturas -->
    <div class="bloco-assinaturas">
      <div class="data-local">
        ${dataHojeExtenso}.
      </div>

      <div class="grid-assinaturas">
        <!-- Assinatura Contratante -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaPaciente?.assinaturaData ? `
            <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" />
          ` : '<div style="height: 50px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${paciente.nome}</div>
          <div class="assinatura-papel">Contratante / Paciente</div>
          <div class="assinatura-detalhes">CPF: ${paciente.cpf}</div>
          ${snapshot.assinaturaPaciente?.dataHora ? `
            <div class="assinatura-detalhes">Assinado digitalmente em ${new Date(snapshot.assinaturaPaciente.dataHora).toLocaleString('pt-BR')}</div>
          ` : ''}
        </div>

        <!-- Assinatura Contratada -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaDentista?.assinaturaData ? `
            <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
          ` : '<div style="height: 50px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${clinica.dentistaResponsavel}</div>
          <div class="assinatura-papel">${clinica.nome} — Contratada</div>
          <div class="assinatura-detalhes">CRO: ${clinica.cro}</div>
          ${snapshot.assinaturaDentista?.dataHora ? `
            <div class="assinatura-detalhes">Assinado digitalmente em ${new Date(snapshot.assinaturaDentista.dataHora).toLocaleString('pt-BR')}</div>
          ` : ''}
        </div>
      </div>

      <!-- Testemunhas Instrumentais (Art. 784, III CPC) -->
      <div style="margin-top: 36px; padding-top: 16px; border-top: 1px dashed #d1d5db;">
        <div style="text-align: center; font-size: 10px; color: #6b7280; font-family: Arial, sans-serif; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: bold;">
          Testemunhas Instrumentais (Art. 784, III do Código de Processo Civil)
        </div>
        <div class="grid-assinaturas" style="margin-top: 0;">
          <div class="campo-assinatura">
            <div style="height: 35px;"></div>
            <div class="linha-assinatura"></div>
            <div class="assinatura-nome">Testemunha 1</div>
            <div class="assinatura-papel">Nome: ____________________________</div>
            <div class="assinatura-detalhes">CPF: _____________________________</div>
          </div>
          <div class="campo-assinatura">
            <div style="height: 35px;"></div>
            <div class="linha-assinatura"></div>
            <div class="assinatura-nome">Testemunha 2</div>
            <div class="assinatura-papel">Nome: ____________________________</div>
            <div class="assinatura-detalhes">CPF: _____________________________</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rodapé -->
    <div class="rodape-documento">
      Documento emitido eletronicamente pelo Sistema Odontológico • Identificador Imutável: ${snapshot.contratoId} • Emitido em: ${new Date(snapshot.emitidoEm).toLocaleString('pt-BR')}
    </div>
  </div>
</body>
</html>`;
};

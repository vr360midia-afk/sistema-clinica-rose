/**
 * Gerador de Documentos Oficiais em folha A4 (Padrão Contrato/Cartório/Receita Federal)
 * para Declaração Fiscal de Serviços Odontológicos (por Paciente e Consolidado Mensal).
 */

import { DadosNotaFiscalPaciente, ResumoNotaFiscalMes, formatarCpf, formatarCnpjCpf } from '@/utils/notaFiscalExport';
import { formatMoney } from '@/utils/exportCsv';
import { valorPorExtenso } from '@/utils/recibo';
import { formatarDataPorExtenso } from '@/utils/contratoEngine';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';

export interface ClinicaDadosOficiais {
  nome: string;
  razaoSocial?: string;
  cnpj: string;
  cro: string;
  dentistaResponsavel: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep?: string;
  telefone: string;
  email: string;
  logoUrl?: string;
}

export const obterDadosClinicaPadrao = (configuracoes?: any): ClinicaDadosOficiais => {
  return {
    nome: configuracoes?.nomeClinica || 'Dra. Rosângela Santos Pereira - Odontologia Especializada',
    razaoSocial: configuracoes?.razaoSocial || 'Rosangela Santos Pereira Odontologia ME',
    cnpj: configuracoes?.cnpj || '69.890.045/0001-85',
    cro: configuracoes?.cro || 'CRO-AL 06267',
    dentistaResponsavel: configuracoes?.dentistaResponsavel || 'Dra. Rosângela Santos Pereira',
    endereco:
      configuracoes?.endereco ||
      'JTR - Edifício Espanha - R. Comerc. José Pontes de Magalhães, 70 - Sl 405 - Jatiúca, Maceió - AL, 57036-250',
    cidade: configuracoes?.cidade || 'Maceió',
    estado: configuracoes?.estado || 'AL',
    telefone: configuracoes?.telefone || configuracoes?.whatsappNumero || '(82) 99999-9999',
    email: configuracoes?.email || 'contato@drarosangela.com.br',
    logoUrl: configuracoes?.logoUrl || '',
  };
};

/**
 * Gera documento HTML A4 oficial e formal para Declaração Fiscal de cada Paciente
 */
export const gerarHtmlDeclaracaoFiscalPaciente = (
  dados: DadosNotaFiscalPaciente,
  configuracoes?: any
): string => {
  const clinica = obterDadosClinicaPadrao(configuracoes);
  const dataHoje = new Date();
  const dataExtenso = formatarDataPorExtenso(dataHoje, clinica.cidade);
  const valorRecebidoExtenso = valorPorExtenso(dados.valorRecebidoNoMes);
  const valorTotalExtenso = valorPorExtenso(dados.valorTotalTratamento);
  const codigoAutenticidade = `NF-${(dados.orcamentoId || dados.pacienteId || 'DOC').slice(0, 8).toUpperCase()}-${dataHoje.getFullYear()}`;
  const temPagadorDiferente = Boolean(dados.pagador?.diferenteDoPaciente && dados.pagador.nomeRazaoSocial?.trim());

  const linhasProcedimentos =
    dados.procedimentos.length > 0
      ? dados.procedimentos
          .map(
            (p, idx) => `
          <tr>
            <td style="text-align: center; width: 35px;">${idx + 1}</td>
            <td style="font-weight: 600;">${p.nome}</td>
            <td style="text-align: center; width: 50px;">${p.quantidade || 1}</td>
            <td style="text-align: right; width: 110px;">${formatMoney(p.valorUnitario)}</td>
            <td style="text-align: right; width: 110px; font-weight: bold;">${formatMoney(p.valorTotal)}</td>
          </tr>`
          )
          .join('')
      : `
        <tr>
          <td style="text-align: center;">1</td>
          <td style="font-weight: 600;">${dados.tratamentoDescricao || 'Procedimentos Odontológicos Especializados'}</td>
          <td style="text-align: center;">1</td>
          <td style="text-align: right;">${formatMoney(dados.valorTotalTratamento)}</td>
          <td style="text-align: right; font-weight: bold;">${formatMoney(dados.valorTotalTratamento)}</td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Declaração Fiscal de Serviços Odontológicos - ${dados.pacienteNome}</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 16mm 14mm 16mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      background-color: #ffffff !important;
      color: #111827 !important;
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 11pt;
      line-height: 1.4;
      margin: 0;
      padding: 0;
    }
    .documento-folha {
      width: 100%;
      max-width: 794px;
      margin: 0 auto;
      background: #ffffff;
      padding: 4px 6px;
    }
    /* CABEÇALHO OFICIAL */
    .cabecalho-oficial {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .cabecalho-texto {
      flex: 1;
    }
    .cabecalho-nome-clinica {
      font-size: 15pt;
      font-weight: bold;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .cabecalho-sub {
      font-size: 9pt;
      color: #334155;
      line-height: 1.35;
    }
    .cabecalho-sub strong {
      color: #0f172a;
    }
    .cabecalho-logo {
      max-width: 130px;
      max-height: 70px;
      object-fit: contain;
    }

    /* TÍTULO DO DOCUMENTO */
    .titulo-bloco {
      text-align: center;
      margin: 16px 0 14px 0;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 10px 14px;
      border-radius: 4px;
    }
    .titulo-doc {
      font-size: 12.5pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.4px;
      margin: 0 0 4px 0;
    }
    .subtitulo-doc {
      font-size: 8.5pt;
      color: #475569;
      font-style: italic;
      margin: 0;
      line-height: 1.3;
    }
    .codigo-controle {
      font-size: 8pt;
      font-family: 'Courier New', Courier, monospace;
      color: #64748b;
      margin-top: 4px;
      font-weight: bold;
    }

    /* SEÇÕES FORMAIS */
    .secao-box {
      margin-bottom: 12px;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
    }
    .secao-titulo {
      background: #f1f5f9;
      border-bottom: 1px solid #cbd5e1;
      padding: 5px 10px;
      font-size: 9.5pt;
      font-weight: bold;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .secao-conteudo {
      padding: 8px 10px;
      font-size: 9.5pt;
      line-height: 1.45;
    }
    .grid-dados {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 14px;
    }
    .item-dado {
      display: flex;
      flex-direction: column;
    }
    .item-dado-full {
      grid-column: span 2;
    }
    .rotulo-dado {
      font-size: 8pt;
      text-transform: uppercase;
      color: #64748b;
      font-weight: bold;
    }
    .valor-dado {
      font-size: 9.5pt;
      color: #0f172a;
      font-weight: 500;
    }
    .valor-destaque {
      font-size: 10.5pt;
      font-weight: bold;
      color: #047857;
    }

    /* TABELA DE PROCEDIMENTOS */
    .tabela-procedimentos {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-top: 2px;
    }
    .tabela-procedimentos th {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      font-size: 8.5pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #1e293b;
    }
    .tabela-procedimentos td {
      border: 1px solid #e2e8f0;
      padding: 5px 8px;
      color: #1e293b;
    }
    .tabela-procedimentos tr:nth-child(even) {
      background: #fbfcfd;
    }

    /* QUADRO FINANCEIRO */
    .tabela-totais {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 9.5pt;
    }
    .tabela-totais td {
      padding: 4px 8px;
    }
    .tabela-totais .linha-total {
      border-top: 1.5px solid #0f172a;
      font-size: 10.5pt;
      font-weight: bold;
    }

    /* TEXTO DE DECLARAÇÃO LEGAL */
    .declaracao-legal {
      font-size: 9pt;
      color: #334155;
      text-align: justify;
      line-height: 1.5;
      margin: 12px 0 16px 0;
      padding: 8px 12px;
      background: #fafafa;
      border-left: 3px solid #0f172a;
    }

    /* DATAÇÃO E ASSINATURAS */
    .datacao-local {
      text-align: right;
      font-size: 10pt;
      color: #1e293b;
      margin: 14px 0 28px 0;
    }
    .grid-assinaturas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 25px;
      page-break-inside: avoid;
    }
    .grid-assinaturas.tres-colunas {
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
    }
    .bloco-assinatura {
      text-align: center;
    }
    .linha-assinatura {
      border-top: 1px solid #0f172a;
      margin-bottom: 5px;
      width: 85%;
      margin-left: auto;
      margin-right: auto;
    }
    .assinatura-nome {
      font-size: 9.5pt;
      font-weight: bold;
      color: #0f172a;
    }
    .assinatura-cargo {
      font-size: 8.5pt;
      color: #475569;
    }

    /* RODAPÉ OFICIAL */
    .rodape-oficial {
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #94a3b8;
    }

    @media print {
      body {
        padding: 0 !important;
        margin: 0 !important;
      }
      .documento-folha {
        max-width: 100% !important;
        padding: 0 !important;
      }
    }
  </style>
</head>
<body>
  <div class="documento-folha">
    <!-- CABEÇALHO OFICIAL COM IDENTIFICAÇÃO DA CLÍNICA -->
    <div class="cabecalho-oficial">
      <div class="cabecalho-texto">
        <div class="cabecalho-nome-clinica">${clinica.nome}</div>
        <div class="cabecalho-sub">
          <strong>Responsável Técnica:</strong> ${clinica.dentistaResponsavel} • <strong>${clinica.cro}</strong><br/>
          <strong>CNPJ/CPF:</strong> ${clinica.cnpj} • <strong>Endereço:</strong> ${clinica.endereco}<br/>
          <strong>Contato:</strong> ${clinica.telefone} • <strong>E-mail:</strong> ${clinica.email}
        </div>
      </div>
      ${
        clinica.logoUrl
          ? `<img src="${clinica.logoUrl}" alt="Logo Clínica" class="cabecalho-logo" />`
          : `<div style="width: 55px; height: 55px; border: 1.5px solid #0f172a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20pt; color: #0f172a;">⚕</div>`
      }
    </div>

    <!-- TÍTULO FORMAL DO DOCUMENTO -->
    <div class="titulo-bloco">
      <h1 class="titulo-doc">Declaração e Demonstrativo Fiscal de Serviços Odontológicos</h1>
      <p class="subtitulo-doc">
        Documento comprobatório emitido para fins de instrução de Nota Fiscal de Serviços Eletrônica (NFS-e), escrituração contábil e comprovação de despesas de saúde perante a Receita Federal do Brasil (Lei nº 9.250/1995).
      </p>
      <div class="codigo-controle">AUTENTICIDADE FISCAL: ${codigoAutenticidade} • EMISSÃO: ${dataHoje.toLocaleDateString('pt-BR')}</div>
    </div>

    <!-- 1. IDENTIFICAÇÃO DO PRESTADOR -->
    <div class="secao-box">
      <div class="secao-titulo">1. Prestador de Serviços Odontológicos</div>
      <div class="secao-conteudo">
        <div class="grid-dados">
          <div class="item-dado">
            <span class="rotulo-dado">Profissional / Clínica:</span>
            <span class="valor-dado">${clinica.dentistaResponsavel} (${clinica.nome})</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">Inscrição Profissional:</span>
            <span class="valor-dado">${clinica.cro}</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">CNPJ / CPF:</span>
            <span class="valor-dado">${clinica.cnpj}</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">Município de Prestação / UF:</span>
            <span class="valor-dado">${clinica.cidade} - ${clinica.estado}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- IDENTIFICAÇÃO DO TOMADOR / PAGADOR E DO BENEFICIÁRIO / PACIENTE -->
    ${
      temPagadorDiferente && dados.pagador
        ? `
    <!-- 2. TOMADOR / PAGADOR (PESSOA JURÍDICA OU TERCEIRO) -->
    <div class="secao-box">
      <div class="secao-titulo">2. Tomador / Pagador dos Serviços (${dados.pagador.tipo === 'cnpj' ? 'Pessoa Jurídica / Empresa' : 'Pessoa Física / Terceiro'})</div>
      <div class="secao-conteudo">
        <div class="grid-dados">
          <div class="item-dado item-dado-full">
            <span class="rotulo-dado">Razão Social / Nome do Pagador:</span>
            <span class="valor-dado" style="font-size: 11pt; font-weight: bold; color: #1e3a8a;">${dados.pagador.nomeRazaoSocial}</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">${dados.pagador.tipo === 'cnpj' ? 'CNPJ do Pagador:' : 'CPF do Pagador:'}</span>
            <span class="valor-dado" style="font-family: monospace; font-weight: bold; font-size: 10pt;">
              ${formatarCnpjCpf(dados.pagador.documento)}
            </span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">Enquadramento Fiscal:</span>
            <span class="valor-dado">${dados.pagador.tipo === 'cnpj' ? 'Pessoa Jurídica (Emissão de NFS-e PJ)' : 'Pessoa Física (Responsável Financeiro)'}</span>
          </div>
          ${
            dados.pagador.endereco
              ? `
          <div class="item-dado item-dado-full">
            <span class="rotulo-dado">Endereço Fiscal do Pagador:</span>
            <span class="valor-dado">${dados.pagador.endereco}</span>
          </div>`
              : ''
          }
          ${
            dados.pagador.telefone
              ? `
          <div class="item-dado">
            <span class="rotulo-dado">Telefone do Pagador:</span>
            <span class="valor-dado">${dados.pagador.telefone}</span>
          </div>`
              : ''
          }
        </div>
      </div>
    </div>

    <!-- 3. BENEFICIÁRIO / FAVORECIDO (PACIENTE QUE UTILIZOU O SERVIÇO) -->
    <div class="secao-box">
      <div class="secao-titulo">3. Beneficiário / Favorecido do Tratamento Odontológico (Paciente)</div>
      <div class="secao-conteudo">
        <div class="grid-dados">
          <div class="item-dado item-dado-full">
            <span class="rotulo-dado">Nome Completo do Paciente (Beneficiário):</span>
            <span class="valor-dado" style="font-size: 11pt; font-weight: bold;">${dados.pacienteNome}</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">CPF do Paciente:</span>
            <span class="valor-dado" style="font-family: monospace; font-weight: bold; font-size: 10pt;">
              ${dados.cpf ? formatarCpf(dados.cpf) : 'NÃO INFORMADO NO CADASTRO'}
            </span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">RG / Doc. Identidade:</span>
            <span class="valor-dado">${dados.rg || 'Não informado'}</span>
          </div>
          <div class="item-dado item-dado-full">
            <span class="rotulo-dado">Endereço Residencial:</span>
            <span class="valor-dado">${dados.endereco || 'Endereço não informado'}</span>
          </div>
        </div>
      </div>
    </div>
    `
        : `
    <!-- 2. TOMADOR E BENEFICIÁRIO (PACIENTE) -->
    <div class="secao-box">
      <div class="secao-titulo">2. Tomador dos Serviços e Beneficiário (Paciente)</div>
      <div class="secao-conteudo">
        <div class="grid-dados">
          <div class="item-dado item-dado-full">
            <span class="rotulo-dado">Nome Completo do Paciente:</span>
            <span class="valor-dado" style="font-size: 11pt; font-weight: bold;">${dados.pacienteNome}</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">CPF do Paciente:</span>
            <span class="valor-dado" style="font-family: monospace; font-weight: bold; font-size: 10pt;">
              ${dados.cpf ? formatarCpf(dados.cpf) : 'NÃO INFORMADO NO CADASTRO'}
            </span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">RG / Doc. Identidade:</span>
            <span class="valor-dado">${dados.rg || 'Não informado'}</span>
          </div>
          <div class="item-dado item-dado-full">
            <span class="rotulo-dado">Endereço Residencial:</span>
            <span class="valor-dado">${dados.endereco || 'Endereço não informado'}</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">Telefone / Contato:</span>
            <span class="valor-dado">${dados.telefone || 'Não informado'}</span>
          </div>
          <div class="item-dado">
            <span class="rotulo-dado">E-mail:</span>
            <span class="valor-dado">${dados.email || 'Não informado'}</span>
          </div>
        </div>
      </div>
    </div>
    `
    }

    <!-- DISCRIMINAÇÃO DOS PROCEDIMENTOS E TRATAMENTOS -->
    <div class="secao-box">
      <div class="secao-titulo">${temPagadorDiferente ? '4' : '3'}. Discriminação dos Procedimentos e Serviços Odontológicos</div>
      <div class="secao-conteudo" style="padding: 6px;">
        <div style="font-size: 9.5pt; font-weight: bold; margin-bottom: 6px; color: #0f172a;">
          Plano de Tratamento: ${dados.tratamentoDescricao}
          ${dados.orcamentoId ? `<span style="font-size: 8pt; font-weight: normal; color: #64748b;">(Ref. Orçamento #${dados.orcamentoId.slice(0, 8).toUpperCase()})</span>` : ''}
        </div>
        <table class="tabela-procedimentos">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: left;">Descrição do Procedimento Odontológico</th>
              <th>Qtd</th>
              <th style="text-align: right;">Valor Unit.</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linhasProcedimentos}
          </tbody>
        </table>
      </div>
    </div>

    <!-- DEMONSTRATIVO FINANCEIRO E DE QUITAÇÃO -->
    <div class="secao-box">
      <div class="secao-titulo">${temPagadorDiferente ? '5' : '4'}. Demonstrativo Financeiro de Pagamento e Quitação</div>
      <div class="secao-conteudo">
        <table class="tabela-totais">
          <tr>
            <td style="color: #64748b;">Valor Total Contratado do Tratamento:</td>
            <td style="text-align: right; font-weight: bold; color: #0f172a; width: 140px;">${formatMoney(dados.valorTotalTratamento)}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Total Quitado no Histórico:</td>
            <td style="text-align: right; color: #0f172a;">${formatMoney(dados.valorTotalPagoHistorico)}</td>
          </tr>
          ${
            dados.saldoRestante > 0
              ? `<tr>
            <td style="color: #64748b;">Saldo Vincendo / A Quitar:</td>
            <td style="text-align: right; color: #b91c1c;">${formatMoney(dados.saldoRestante)}</td>
          </tr>`
              : ''
          }
          <tr class="linha-total">
            <td style="color: #047857; padding-top: 6px;">VALOR EFETIVAMENTE PAGO / QUITADO NO PERÍODO (BASE NFS-e):</td>
            <td style="text-align: right; color: #047857; font-size: 12pt; padding-top: 6px;">${formatMoney(dados.valorRecebidoNoMes)}</td>
          </tr>
          <tr>
            <td colspan="2" style="font-size: 8.5pt; color: #475569; font-style: italic; padding-top: 2px;">
              Valor por extenso: <strong>${valorRecebidoExtenso}</strong>.
            </td>
          </tr>
          <tr>
            <td colspan="2" style="font-size: 8.5pt; color: #334155; padding-top: 4px;">
              <strong>Forma(s) de Pagamento:</strong> ${dados.metodosPagamento.join(', ') || 'PIX'} • 
              <strong>Conta / Destino:</strong> ${dados.contasEntrada.join(', ') || 'Caixa da Clínica'} • 
              <strong>Data(s) de Liquidação:</strong> ${dados.datasPagamentoMes.join(', ') || 'No período'}
            </td>
          </tr>
        </table>
      </div>
    </div>

    <!-- DECLARAÇÃO LEGAL -->
    <div class="declaracao-legal">
      ${
        temPagadorDiferente && dados.pagador
          ? `<strong>DECLARAÇÃO CONJUNTA DE PRESTAÇÃO DE SERVIÇOS E PAGAMENTO:</strong> Declaro para os devidos fins de direito, em especial perante a Secretaria da Receita Federal do Brasil (RFB) e para emissão da respectiva Nota Fiscal de Serviços Eletrônica (NFS-e), que os procedimentos odontológicos acima discriminados foram executados para o(a) Beneficiário(a) <strong>${dados.pacienteNome}</strong>, tendo sido o respectivo valor pago e faturado em favor do Tomador <strong>${dados.pagador.nomeRazaoSocial}</strong> (${dados.pagador.tipo === 'cnpj' ? 'CNPJ' : 'CPF'}: ${formatarCnpjCpf(dados.pagador.documento)}), conferindo-se plena e irrevogável quitação sobre a importância recebida.`
          : `<strong>DECLARAÇÃO:</strong> Declaro para os devidos fins de direito, em especial perante a Secretaria da Receita Federal do Brasil (RFB) e para emissão da respectiva Nota Fiscal de Serviços Eletrônica (NFS-e), que os procedimentos odontológicos acima discriminados foram executados para o(a) paciente qualificado(a), tendo sido recebido o montante especificado, conferindo-lhe quitação irrevogável e formal sobre o valor pago.`
      }
    </div>

    <!-- DATAÇÃO -->
    <div class="datacao-local">
      ${clinica.cidade} - ${clinica.estado}, ${dataExtenso}.
    </div>

    <!-- ASSINATURAS FORMAIS -->
    ${
      temPagadorDiferente && dados.pagador
        ? `<div class="grid-assinaturas tres-colunas">
      <div class="bloco-assinatura">
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${clinica.dentistaResponsavel}</div>
        <div class="assinatura-cargo">${clinica.cro} • Cirurgiã-Dentista</div>
        <div style="font-size: 7.5pt; color: #64748b;">Prestador dos Serviços</div>
      </div>

      <div class="bloco-assinatura">
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${dados.pagador.nomeRazaoSocial}</div>
        <div class="assinatura-cargo">${dados.pagador.tipo === 'cnpj' ? 'CNPJ' : 'CPF'}: ${formatarCnpjCpf(dados.pagador.documento)}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Tomador / Pagador (${dados.pagador.tipo === 'cnpj' ? 'Empresa' : 'Responsável'})</div>
      </div>

      <div class="bloco-assinatura">
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${dados.pacienteNome}</div>
        <div class="assinatura-cargo">CPF: ${dados.cpf ? formatarCpf(dados.cpf) : 'Beneficiário'}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Favorecido / Paciente</div>
      </div>
    </div>`
        : `<div class="grid-assinaturas">
      <div class="bloco-assinatura">
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${clinica.dentistaResponsavel}</div>
        <div class="assinatura-cargo">${clinica.cro} • Cirurgiã-Dentista</div>
        <div style="font-size: 7.5pt; color: #64748b;">Prestador dos Serviços</div>
      </div>

      <div class="bloco-assinatura">
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${dados.pacienteNome}</div>
        <div class="assinatura-cargo">CPF: ${dados.cpf ? formatarCpf(dados.cpf) : 'Doc. Tomador'}</div>
        <div style="font-size: 7.5pt; color: #64748b;">Tomador dos Serviços (Paciente)</div>
      </div>
    </div>`
    }

    <!-- RODAPÉ -->
    <div class="rodape-oficial">
      <span>${clinica.nome} • CNPJ: ${clinica.cnpj}</span>
      <span>Documento emitido eletronicamente via Sistema Clínico Integrado</span>
      <span>Página 1 de 1</span>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Gera documento HTML A4 oficial do Relatório Fiscal Consolidado Mensal (para a Contabilidade)
 */
export const gerarHtmlRelatorioFiscalMensal = (
  resumo: ResumoNotaFiscalMes,
  configuracoes?: any
): string => {
  const clinica = obterDadosClinicaPadrao(configuracoes);
  const dataHoje = new Date();
  const dataExtenso = formatarDataPorExtenso(dataHoje, clinica.cidade);
  const totalRecebidoExtenso = valorPorExtenso(resumo.totalRecebidoMes);

  const linhasPacientes = resumo.itens
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align: center; width: 30px;">${idx + 1}</td>
      <td style="font-weight: bold; width: 180px;">
        ${item.pacienteNome}
        ${
          item.pagador?.diferenteDoPaciente && item.pagador.nomeRazaoSocial
            ? `<div style="font-size: 7.5pt; color: #1d4ed8; font-weight: normal; margin-top: 2px;">
                🏢 Tomador: <strong>${item.pagador.nomeRazaoSocial}</strong> (${item.pagador.tipo === 'cnpj' ? 'CNPJ' : 'CPF'}: ${formatarCnpjCpf(item.pagador.documento)})
              </div>`
            : ''
        }
      </td>
      <td style="font-family: monospace; font-size: 8.5pt; width: 110px;">
        ${item.cpf ? formatarCpf(item.cpf) : '<span style="color: #b91c1c; font-weight: bold;">SEM CPF</span>'}
      </td>
      <td>
        <div style="font-weight: 600;">${item.tratamentoDescricao}</div>
        ${
          item.procedimentos.length > 0
            ? `<div style="font-size: 7.5pt; color: #64748b;">${item.procedimentos.map((p) => `${p.nome} (${p.quantidade}x)`).join(' · ')}</div>`
            : ''
        }
      </td>
      <td style="text-align: center; font-size: 8pt; width: 90px;">${item.metodosPagamento.join(', ') || 'PIX'}</td>
      <td style="text-align: center; font-size: 8pt; width: 75px;">${item.datasPagamentoMes[0] || 'No mês'}</td>
      <td style="text-align: right; font-weight: bold; color: #047857; width: 110px;">${formatMoney(item.valorRecebidoNoMes)}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Demonstrativo Fiscal Consolidado de Receitas - ${resumo.mesFormatado}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 14mm 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      background-color: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 10pt;
      line-height: 1.35;
      margin: 0;
      padding: 0;
    }
    .documento-folha {
      width: 100%;
      max-width: 794px;
      margin: 0 auto;
      background: #ffffff;
    }
    .cabecalho-oficial {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .cabecalho-nome {
      font-size: 14pt;
      font-weight: bold;
      color: #0f172a;
      text-transform: uppercase;
    }
    .cabecalho-sub {
      font-size: 8.5pt;
      color: #334155;
    }
    .titulo-relatorio {
      text-align: center;
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .titulo-relatorio h1 {
      font-size: 12pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #0f172a;
      margin: 0 0 2px 0;
    }
    .titulo-relatorio p {
      font-size: 8.5pt;
      color: #475569;
      margin: 0;
    }

    /* QUADROS RESUMO */
    .grid-kpi {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .card-kpi {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      padding: 6px 10px;
      border-radius: 4px;
      text-align: center;
    }
    .kpi-rotulo {
      font-size: 7.5pt;
      text-transform: uppercase;
      color: #64748b;
      font-weight: bold;
    }
    .kpi-valor {
      font-size: 12pt;
      font-weight: bold;
      color: #0f172a;
      margin-top: 2px;
    }

    /* TABELA DE RECEITAS */
    .tabela-relatorio {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 12px;
    }
    .tabela-relatorio th {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 5px 6px;
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #0f172a;
    }
    .tabela-relatorio td {
      border: 1px solid #e2e8f0;
      padding: 4px 6px;
      color: #1e293b;
    }
    .tabela-relatorio tr:nth-child(even) {
      background: #fafbfd;
    }

    .linha-total-tabela {
      background: #f1f5f9 !important;
      border-top: 2px solid #0f172a;
      font-size: 9.5pt;
      font-weight: bold;
    }

    .termo-encerramento {
      font-size: 8.5pt;
      color: #334155;
      line-height: 1.4;
      border-left: 3px solid #0f172a;
      padding: 6px 10px;
      background: #fafafa;
      margin-bottom: 16px;
      text-align: justify;
    }

    .grid-assinaturas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 24px;
      page-break-inside: avoid;
    }
    .bloco-assinatura {
      text-align: center;
    }
    .linha-assinatura {
      border-top: 1px solid #0f172a;
      margin-bottom: 4px;
      width: 80%;
      margin-left: auto;
      margin-right: auto;
    }
    .rodape-oficial {
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0 !important; }
      .documento-folha { max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="documento-folha">
    <div class="cabecalho-oficial">
      <div>
        <div class="cabecalho-nome">${clinica.nome}</div>
        <div class="cabecalho-sub">
          <strong>CNPJ:</strong> ${clinica.cnpj} • <strong>Resp. Técnica:</strong> ${clinica.dentistaResponsavel} (${clinica.cro})<br/>
          <strong>Endereço:</strong> ${clinica.endereco}
        </div>
      </div>
      <div style="font-size: 18pt; color: #0f172a;">⚕</div>
    </div>

    <div class="titulo-relatorio">
      <h1>Demonstrativo Fiscal Consolidado de Receitas Odontológicas</h1>
      <p>Competência Mensal: <strong>${resumo.mesFormatado.toUpperCase()}</strong> • Base Contábil para Emissão de Notas Fiscais (NFS-e)</p>
    </div>

    <div class="grid-kpi">
      <div class="card-kpi">
        <div class="kpi-rotulo">Faturamento Base NFS-e</div>
        <div class="kpi-valor" style="color: #047857;">${formatMoney(resumo.totalRecebidoMes)}</div>
      </div>
      <div class="card-kpi">
        <div class="kpi-rotulo">Total de Pacientes</div>
        <div class="kpi-valor">${resumo.totalPacientes}</div>
      </div>
      <div class="card-kpi">
        <div class="kpi-rotulo">${resumo.totalComPagadorEmpresa > 0 ? 'Tomador Empresa (PJ)' : 'Com CPF Válido'}</div>
        <div class="kpi-valor" style="color: ${resumo.totalComPagadorEmpresa > 0 ? '#1d4ed8' : '#047857'};">${resumo.totalComPagadorEmpresa > 0 ? resumo.totalComPagadorEmpresa : resumo.totalComCpf}</div>
      </div>
      <div class="card-kpi">
        <div class="kpi-rotulo">Sem CPF (Atenção)</div>
        <div class="kpi-valor" style="${resumo.totalSemCpf > 0 ? 'color: #b91c1c;' : ''}">${resumo.totalSemCpf}</div>
      </div>
    </div>

    <table class="tabela-relatorio">
      <thead>
        <tr>
          <th>#</th>
          <th style="text-align: left;">Paciente (Tomador)</th>
          <th style="text-align: left;">CPF</th>
          <th style="text-align: left;">Tratamento / Procedimentos</th>
          <th>Forma</th>
          <th>Data</th>
          <th style="text-align: right;">Valor Quitado</th>
        </tr>
      </thead>
      <tbody>
        ${linhasPacientes}
        <tr class="linha-total-tabela">
          <td colspan="6" style="text-align: right; text-transform: uppercase;">Total Geral das Receitas Faturadas no Mês:</td>
          <td style="text-align: right; color: #047857;">${formatMoney(resumo.totalRecebidoMes)}</td>
        </tr>
      </tbody>
    </table>

    <div class="termo-encerramento">
      <strong>ENCERRAMENTO CONTÁBIL:</strong> Atestamos que o presente demonstrativo reflete com exatidão as receitas recebidas na competência de ${resumo.mesFormatado}, totalizando <strong>${formatMoney(resumo.totalRecebidoMes)}</strong> (<em>${totalRecebidoExtenso}</em>), destinando-se à escrituração fiscal e emissão tempestiva das Notas Fiscais de Serviços correspondentes.
    </div>

    <div style="text-align: right; font-size: 9.5pt; margin-bottom: 20px;">
      ${clinica.cidade} - ${clinica.estado}, ${dataExtenso}.
    </div>

    <div class="grid-assinaturas">
      <div class="bloco-assinatura">
        <div class="linha-assinatura"></div>
        <div style="font-weight: bold; font-size: 9pt;">${clinica.dentistaResponsavel}</div>
        <div style="font-size: 8pt; color: #64748b;">${clinica.cro} • Responsável Técnica</div>
      </div>
      <div class="bloco-assinatura">
        <div class="linha-assinatura"></div>
        <div style="font-weight: bold; font-size: 9pt;">Responsável Contábil / Fiscal</div>
        <div style="font-size: 8pt; color: #64748b;">Conferência e Escrituração da NFS-e</div>
      </div>
    </div>

    <div class="rodape-oficial">
      <span>${clinica.nome} • CNPJ: ${clinica.cnpj}</span>
      <span>Relatório Contábil Oficial emitido eletronicamente</span>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Dispara a impressão de documento oficial no padrão A4 branco limpo usando iframe oculto,
 * sem exibir o modal escuro ou a tela do sistema.
 */
export const imprimirDocumentoOficial = (html: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const idoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!idoc) {
        document.body.removeChild(iframe);
        resolve(false);
        return;
      }

      idoc.open();
      idoc.write(html);
      idoc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.error('Erro ao chamar print no iframe oficial:', e);
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch (_) {}
          resolve(true);
        }, 1500);
      }, 450);
    } catch (err) {
      console.error('Erro ao imprimir documento oficial:', err);
      resolve(false);
    }
  });
};

/**
 * Baixa o documento oficial diretamente como arquivo PDF (A4)
 */
export const baixarDocumentoOficialPdf = async (
  html: string,
  nomeArquivo: string
): Promise<boolean> => {
  return downloadHtmlAsPdf(html, nomeArquivo);
};

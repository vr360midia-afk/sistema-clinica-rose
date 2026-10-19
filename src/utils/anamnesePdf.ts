import { downloadHtmlAsPdf } from './pdfDownload';

export interface AnamnesePdfData {
  paciente: {
    nome: string;
    cpf?: string;
    telefone?: string;
    email?: string;
  };
  clinica?: {
    nome?: string;
    cro?: string;
    dentista?: string;
    endereco?: string;
    telefone?: string;
    cnpj?: string;
    logoUrl?: string;
  };
  dados: {
    data?: string;
    queixaPrincipal?: string;
    historiaAtual?: string;
    alergias?: string;
    medicamentos?: string;
    historiaMedica?: string;
    historiaFamiliar?: string;
    habitosViciosPositivos?: string;
    habitosViciosNegativos?: string;
    observacoes?: string;
    respostas?: Record<string, 'sim' | 'nao'>;
  };
  assinatura?: {
    signature?: string;
    signerName?: string;
    timestamp?: string;
  };
}

export const ITENS_TRIAGEM_PADRAO = [
  { id: 'hipertensao', titulo: 'Possui Hipertensão (Pressão Alta)?' },
  { id: 'diabetes', titulo: 'Possui Diabetes?' },
  { id: 'cardiopatia', titulo: 'Problemas Cardíacos (Coração / Infarto / Cirurgia)?' },
  { id: 'coagulacao', titulo: 'Distúrbio de Coagulação ou Sangramento Excessivo?' },
  { id: 'alergia_anestesia', titulo: 'Reação ou Alergia a Anestesia Odontológica?' },
  { id: 'bisfosfonatos', titulo: 'Uso de Remédios para Ossos / Osteoporose (Bisfosfonatos)?' },
  { id: 'bruxismo_atm', titulo: 'Aperta/Range os Dentes (Bruxismo) ou Dores na Mandíbula?' },
  { id: 'gestante_lactante', titulo: 'Está Grávida ou Amamentando?' },
];

export const gerarHtmlAnamnese = (info: AnamnesePdfData): string => {
  const clinicaNome = info.clinica?.nome || 'DRA. ROSANGELA SANTOS';
  const dentista = info.clinica?.dentista || 'Dra. Rosangela Santos';
  const cro = info.clinica?.cro || 'CRO-AL 6267';
  const endereco =
    info.clinica?.endereco ||
    'JTR - Edifício Espanha, Sl 405 - Jatiúca, Maceió - AL, 57036-250';
  const telefone = info.clinica?.telefone || '(82) 97400-2213';
  const cnpj = info.clinica?.cnpj || '032.663.962-43';
  const logo = info.clinica?.logoUrl || '/logo.png';

  const dataPreenchimento = info.dados.data
    ? new Date(info.dados.data).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  const dataHoraAssinatura = info.assinatura?.timestamp
    ? new Date(info.assinatura.timestamp).toLocaleString('pt-BR')
    : dataPreenchimento;

  const respostas = info.dados.respostas || {};

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ficha de Anamnese - ${info.paciente.nome}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 14mm 12mm 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 16px 20px;
      color: #0f172a;
      background: #ffffff;
      font-size: 11pt;
      line-height: 1.48;
    }
    .doc-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .topo-timbrado {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      page-break-inside: avoid;
    }
    .clinica-info h1 {
      font-size: 16pt;
      font-weight: bold;
      margin: 0 0 2px 0;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .clinica-info p {
      margin: 1px 0;
      font-size: 8.5pt;
      color: #334155;
    }
    .doc-titulo {
      text-align: center;
      margin: 14px 0 16px 0;
      page-break-inside: avoid;
    }
    .doc-titulo h2 {
      margin: 0;
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #0f172a;
    }
    .doc-titulo p {
      margin: 2px 0 0 0;
      font-size: 8.5pt;
      color: #64748b;
    }
    .box-paciente {
      border: 1px solid #cbd5e1;
      background-color: #f8fafc;
      padding: 10px 14px;
      margin-bottom: 16px;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .grid-duas-colunas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      font-size: 9.5pt;
    }
    .linha-info strong {
      color: #0f172a;
    }
    .secao {
      margin-bottom: 12px;
      page-break-inside: avoid;
    }
    .secao-titulo {
      font-size: 10pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 3px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .secao-conteudo {
      font-size: 9.5pt;
      color: #1e293b;
      margin: 0;
      padding-left: 2px;
      text-align: justify;
    }
    table.tabela-triagem {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 8px;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    table.tabela-triagem th, table.tabela-triagem td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
    }
    table.tabela-triagem th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: bold;
      text-align: left;
    }
    table.tabela-triagem td.resposta {
      text-align: center;
      font-weight: bold;
      width: 80px;
    }
    table.tabela-triagem tr.destaque {
      background-color: #fefce8;
    }
    .declaracao-box {
      border: 1px solid #cbd5e1;
      background-color: #f8fafc;
      padding: 10px 12px;
      margin-top: 14px;
      margin-bottom: 20px;
      font-size: 8.5pt;
      color: #334155;
      text-align: justify;
      line-height: 1.4;
      border-radius: 4px;
      page-break-inside: avoid;
    }
    .bloco-assinatura {
      margin-top: 24px;
      text-align: center;
      page-break-inside: avoid;
    }
    .assinatura-img-container {
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }
    .assinatura-img {
      max-height: 60px;
      max-width: 240px;
      object-fit: contain;
    }
    .linha-assinatura {
      width: 280px;
      margin: 0 auto 4px auto;
      border-top: 1.5px solid #0f172a;
    }
    .nome-assinante {
      font-weight: bold;
      font-size: 10pt;
      color: #0f172a;
    }
    .doc-assinante {
      font-size: 8.5pt;
      color: #475569;
    }
    .carimbo-digital {
      font-size: 7.5pt;
      color: #64748b;
      margin-top: 4px;
    }
    .rodape-documento {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 6px;
      text-align: center;
      font-size: 7.5pt;
      color: #94a3b8;
    }
    @media print {
      body {
        padding: 0;
        background: #ffffff !important;
        color: #000000 !important;
      }
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <!-- Topo Timbrado Oficial -->
    <div class="topo-timbrado">
      <div class="clinica-info">
        <h1>${clinicaNome}</h1>
        <p><strong>${dentista}</strong> • ${cro}</p>
        <p>Odontologia Especializada • Reabilitação Oral e Estética</p>
        <p>${endereco}</p>
        <p>Tel / WhatsApp: ${telefone}${cnpj ? ` • CNPJ/CPF: ${cnpj}` : ''}</p>
      </div>
      <div style="text-align: right; font-size: 8.5pt; color: #475569;">
        <p style="margin: 0;">Prontuário Odontológico</p>
        <p style="margin: 2px 0 0 0; font-weight: bold; color: #0f172a;">Data: ${dataPreenchimento}</p>
      </div>
    </div>

    <!-- Título do Documento -->
    <div class="doc-titulo">
      <h2>Ficha de Anamnese Odontológica</h2>
      <p>Declaração de Saúde e Histórico Clínico do Paciente</p>
    </div>

    <!-- Dados do Paciente -->
    <div class="box-paciente">
      <div class="grid-duas-colunas">
        <div class="linha-info"><strong>Paciente:</strong> ${info.paciente.nome || 'Paciente'}</div>
        <div class="linha-info"><strong>CPF:</strong> ${info.paciente.cpf || 'Não informado'}</div>
        <div class="linha-info"><strong>Telefone:</strong> ${info.paciente.telefone || 'Não informado'}</div>
        <div class="linha-info"><strong>E-mail:</strong> ${info.paciente.email || 'Não informado'}</div>
      </div>
    </div>

    <!-- 1. Queixa Principal -->
    <div class="secao">
      <div class="secao-titulo">1. Queixa Principal / Motivo da Consulta</div>
      <p class="secao-conteudo">
        ${info.dados.queixaPrincipal || 'Avaliação clínica odontológica.'}
      </p>
    </div>

    <!-- 2. História da Doença Atual -->
    ${
      info.dados.historiaAtual
        ? `<div class="secao">
            <div class="secao-titulo">2. História da Doença / Queixa Atual</div>
            <p class="secao-conteudo">${info.dados.historiaAtual}</p>
          </div>`
        : ''
    }

    <!-- 3. Triagem de Saúde Odontológica -->
    <div class="secao">
      <div class="secao-titulo">3. Triagem e Questionário de Saúde</div>
      <table class="tabela-triagem">
        <thead>
          <tr>
            <th>Item / Condição Médica Avaliada</th>
            <th style="text-align: center; width: 80px;">Resposta</th>
          </tr>
        </thead>
        <tbody>
          ${ITENS_TRIAGEM_PADRAO.map((item) => {
            const resp = respostas[item.id];
            const isSim = resp === 'sim';
            const textoResp = isSim ? 'SIM' : 'NÃO';
            return `
              <tr class="${isSim ? 'destaque' : ''}">
                <td>${item.titulo}</td>
                <td class="resposta" style="color: ${isSim ? '#b45309' : '#0f172a'};">${textoResp}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- 4. Alergias e Medicamentos em Uso -->
    <div class="secao">
      <div class="secao-titulo">4. Alergias e Intolerâncias</div>
      <p class="secao-conteudo">
        ${info.dados.alergias || 'Nenhuma alergia ou reação medicamentosa informada.'}
      </p>
    </div>

    <div class="secao">
      <div class="secao-titulo">5. Medicamentos em Uso Contínuo</div>
      <p class="secao-conteudo">
        ${info.dados.medicamentos || 'Nenhum medicamento de uso contínuo informado.'}
      </p>
    </div>

    <!-- 6. Histórico Médico e Familiar -->
    ${
      info.dados.historiaMedica
        ? `<div class="secao">
            <div class="secao-titulo">6. Histórico Médico Pregresso</div>
            <p class="secao-conteudo">${info.dados.historiaMedica}</p>
          </div>`
        : ''
    }

    ${
      info.dados.historiaFamiliar
        ? `<div class="secao">
            <div class="secao-titulo">7. Histórico Médico Familiar</div>
            <p class="secao-conteudo">${info.dados.historiaFamiliar}</p>
          </div>`
        : ''
    }

    <!-- 8. Hábitos de Higiene e Estilo de Vida -->
    ${
      info.dados.habitosViciosPositivos || info.dados.habitosViciosNegativos
        ? `<div class="secao">
            <div class="secao-titulo">8. Hábitos e Estilo de Vida</div>
            <p class="secao-conteudo">
              ${[
                info.dados.habitosViciosPositivos ? `<strong>Higiene Bucal:</strong> ${info.dados.habitosViciosPositivos}` : null,
                info.dados.habitosViciosNegativos ? `<strong>Hábitos Nocivos:</strong> ${info.dados.habitosViciosNegativos}` : null,
              ]
                .filter(Boolean)
                .join('<br/>')}
            </p>
          </div>`
        : ''
    }

    <!-- 9. Observações Adicionais -->
    ${
      info.dados.observacoes
        ? `<div class="secao">
            <div class="secao-titulo">9. Observações Adicionais</div>
            <p class="secao-conteudo">${info.dados.observacoes}</p>
          </div>`
        : ''
    }

    <!-- Declaração de Veracidade -->
    <div class="declaracao-box">
      <strong>Declaração de Veracidade das Informações:</strong> Declaro, sob as penas da lei, que todas as respostas e dados informados nesta Ficha de Anamnese são estritamente verdadeiros e completos. Não omiti nenhum fato referente ao meu estado de saúde atual ou passado. Comprometo-me a informar imediatamente ao profissional qualquer alteração futura no meu estado de saúde ou uso de novos medicamentos.
    </div>

    <!-- Bloco de Assinatura no Final -->
    <div class="bloco-assinatura">
      <div class="assinatura-img-container">
        ${
          info.assinatura?.signature
            ? `<img src="${info.assinatura.signature}" alt="Assinatura do Paciente" class="assinatura-img" />`
            : ''
        }
      </div>
      <div class="linha-assinatura"></div>
      <div class="nome-assinante">${info.assinatura?.signerName || info.paciente.nome || 'Paciente'}</div>
      <div class="doc-assinante">Assinatura do(a) Paciente / Responsável Legal • CPF: ${info.paciente.cpf || 'Não informado'}</div>
      <div class="carimbo-digital">
        Assinado eletronicamente em ${dataHoraAssinatura} • Registro Digital Odontológico (MP 2.200-2/2001)
      </div>
    </div>

    <!-- Rodapé -->
    <div class="rodape-documento">
      Documento clínico arquivado eletronicamente conforme a LGPD e normas do Conselho Federal de Odontologia (CFO).
    </div>
  </div>
</body>
</html>`;
};

export const downloadAnamnesePdf = async (info: AnamnesePdfData): Promise<boolean> => {
  const html = gerarHtmlAnamnese(info);
  const nomeSanitizado = (info.paciente.nome || 'paciente')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_');
  const filename = `anamnese_${nomeSanitizado}`;
  return downloadHtmlAsPdf(html, filename);
};

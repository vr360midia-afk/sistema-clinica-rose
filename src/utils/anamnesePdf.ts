import { downloadHtmlAsPdf } from './pdfDownload';

export interface AnamnesePdfData {
  paciente: {
    nome: string;
    cpf?: string;
    telefone?: string;
    email?: string;
    dataNascimento?: string;
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
  const clinicaNome = info.clinica?.nome || 'DRA. ROSÂNGELA SANTOS';
  const dentista = info.clinica?.dentista || 'Dra. Rosângela Santos Pereira';
  const cro = info.clinica?.cro || 'CRO-AL 06267';
  const endereco =
    info.clinica?.endereco ||
    'JTR — Edifício Espanha, Sl 405 - Jatiúca, Maceió/AL, CEP 57036-250';
  const telefone = info.clinica?.telefone || '(82) 97400-2213';
  const cnpj = info.clinica?.cnpj || '032.663.962-43';
  const logo = info.clinica?.logoUrl || '';

  const dataPreenchimento = info.dados.data
    ? new Date(info.dados.data).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');

  const dataHoraAssinatura = info.assinatura?.timestamp
    ? new Date(info.assinatura.timestamp).toLocaleString('pt-BR')
    : dataPreenchimento;

  const respostas = info.dados.respostas || {};

  const temAlergia = Boolean(
    info.dados.alergias &&
    !/nenhum|não|nao informad|negativ/i.test(info.dados.alergias.trim())
  );

  const temMedicamento = Boolean(
    info.dados.medicamentos &&
    !/nenhum|não|nao informad|negativ/i.test(info.dados.medicamentos.trim())
  );

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
      font-family: 'Times New Roman', Times, Georgia, serif;
      margin: 0;
      padding: 16px 20px;
      color: #111827;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.48;
    }
    .doc-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .topo-timbrado {
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .topo-logo img {
      max-height: 52px;
      max-width: 160px;
      object-fit: contain;
    }
    .clinica-info h1 {
      font-size: 15px;
      font-weight: bold;
      margin: 0 0 2px 0;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .clinica-info p {
      margin: 1px 0;
      font-size: 10px;
      color: #4b5563;
      font-family: Arial, sans-serif;
    }
    .topo-meta {
      text-align: right;
      font-size: 10px;
      color: #4b5563;
      font-family: Arial, sans-serif;
      line-height: 1.4;
      white-space: nowrap;
    }
    .doc-titulo {
      text-align: center;
      margin: 10px 0 12px 0;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .doc-titulo h2 {
      margin: 0;
      font-size: 14px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #111827;
      text-decoration: underline;
    }
    .doc-titulo p {
      margin: 2px 0 0 0;
      font-size: 11px;
      color: #4b5563;
      font-style: italic;
    }
    .box-paciente {
      border: 1px solid #d1d5db;
      background-color: #f9fafb;
      padding: 8px 12px;
      margin-bottom: 12px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .grid-duas-colunas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 16px;
      font-size: 11px;
    }
    .linha-info strong {
      color: #111827;
    }
    .secao {
      margin-bottom: 10px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .secao-titulo {
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #111827;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 2px;
      margin-bottom: 4px;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .secao-conteudo {
      font-size: 11.5px;
      color: #1f2937;
      margin: 0;
      text-align: justify;
      line-height: 1.45;
    }
    table.tabela-triagem {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      margin-bottom: 6px;
      font-size: 10.5px;
      font-family: Arial, sans-serif;
    }
    table.tabela-triagem th, table.tabela-triagem td {
      border: 1px solid #d1d5db;
      padding: 4px 6px;
    }
    table.tabela-triagem th {
      background-color: #f3f4f6;
      color: #111827;
      font-weight: bold;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.5px;
      text-align: left;
    }
    table.tabela-triagem tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table.tabela-triagem td.resposta {
      text-align: center;
      font-weight: bold;
      width: 75px;
    }
    table.tabela-triagem tr.destaque {
      background-color: #fefce8;
    }
    .card-alerta {
      padding: 6px 10px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      margin-top: 2px;
    }
    .card-alergia-positiva {
      background-color: #fefce8;
      border: 1px solid #fde047;
      border-left: 3.5px solid #ca8a04;
      color: #854d0e;
    }
    .card-alergia-neutra {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
    }
    .card-medicamento-positivo {
      background-color: #f0f9ff;
      border: 1px solid #bae6fd;
      border-left: 3.5px solid #0284c7;
      color: #0369a1;
    }
    .card-medicamento-neutra {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #475569;
    }
    .declaracao-box {
      border: 1px solid #d1d5db;
      background-color: #f9fafb;
      padding: 8px 12px;
      margin-top: 10px;
      margin-bottom: 14px;
      font-size: 10px;
      color: #374151;
      text-align: justify;
      line-height: 1.4;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .grid-assinaturas {
      display: flex;
      justify-content: space-between;
      gap: 28px;
      margin-top: 18px;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .campo-assinatura {
      flex: 1;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    .assinatura-img-container {
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 3px;
    }
    .assinatura-img {
      max-height: 52px;
      max-width: 200px;
      object-fit: contain;
    }
    .linha-assinatura {
      width: 90%;
      margin: 0 auto 4px auto;
      border-top: 1px solid #111827;
    }
    .nome-assinante {
      font-weight: bold;
      font-size: 11px;
      color: #111827;
    }
    .doc-assinante {
      font-size: 9.5px;
      color: #4b5563;
      margin-top: 1px;
    }
    .carimbo-digital {
      font-size: 8.5px;
      color: #059669;
      font-weight: 500;
      margin-top: 2px;
    }
    .rodape-documento {
      margin-top: 16px;
      border-top: 1px solid #e5e7eb;
      padding-top: 6px;
      text-align: center;
      font-size: 9px;
      color: #9ca3af;
      font-family: Arial, sans-serif;
    }
    @media print {
      body {
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
      }
      .secao,
      .box-paciente,
      .declaracao-box,
      .grid-assinaturas,
      table.tabela-triagem tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="doc-container">
    <!-- Topo Timbrado Oficial -->
    <div class="topo-timbrado">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${logo ? `<div class="topo-logo"><img src="${logo}" alt="Logo" /></div>` : ''}
        <div class="clinica-info">
          <h1>${clinicaNome}</h1>
          <p><strong>${dentista}</strong> • ${cro}</p>
          <p>Odontologia Especializada • Reabilitação Oral e Estética</p>
          <p>${endereco}</p>
          <p>Tel / WhatsApp: ${telefone}${cnpj ? ` • CNPJ/CPF: ${cnpj}` : ''}</p>
        </div>
      </div>
      <div class="topo-meta">
        <div><strong>Prontuário Odontológico</strong></div>
        <div>Data: <strong>${dataPreenchimento}</strong></div>
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
        ${info.paciente.dataNascimento ? `<div class="linha-info"><strong>Data de Nasc.:</strong> ${info.paciente.dataNascimento}</div>` : ''}
      </div>
    </div>

    <!-- 1. Queixa Principal -->
    <div class="secao">
      <div class="secao-titulo">1. Queixa Principal / Motivo da Consulta</div>
      <p class="secao-conteudo">
        ${info.dados.queixaPrincipal || 'Avaliação clínica odontológica e planejamento preventivo/estético.'}
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
            <th style="text-align: center; width: 75px;">Resposta</th>
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
                <td class="resposta" style="color: ${isSim ? '#b45309' : '#111827'}; font-weight: bold;">
                  ${isSim ? '⚠ SIM' : 'NÃO'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>

    <!-- 4. Alergias -->
    <div class="secao">
      <div class="secao-titulo">4. Alergias e Intolerâncias Medicamentosas</div>
      <div class="card-alerta ${temAlergia ? 'card-alergia-positiva' : 'card-alergia-neutra'}">
        ${
          temAlergia
            ? `<strong>⚠ ATENÇÃO / ALERGIAS RELATADAS:</strong> ${info.dados.alergias}`
            : (info.dados.alergias || 'Nenhuma alergia ou reação medicamentosa informada.')
        }
      </div>
    </div>

    <!-- 5. Medicamentos -->
    <div class="secao">
      <div class="secao-titulo">5. Medicamentos em Uso Contínuo</div>
      <div class="card-alerta ${temMedicamento ? 'card-medicamento-positivo' : 'card-medicamento-neutra'}">
        ${
          temMedicamento
            ? `<strong>Medicamentos em uso:</strong> ${info.dados.medicamentos}`
            : (info.dados.medicamentos || 'Nenhum medicamento de uso contínuo informado.')
        }
      </div>
    </div>

    <!-- 6. Histórico Médico Pregresso -->
    ${
      info.dados.historiaMedica
        ? `<div class="secao">
            <div class="secao-titulo">6. Histórico Médico Pregresso</div>
            <p class="secao-conteudo">${info.dados.historiaMedica}</p>
          </div>`
        : ''
    }

    <!-- 7. Histórico Médico Familiar -->
    ${
      info.dados.historiaFamiliar
        ? `<div class="secao">
            <div class="secao-titulo">7. Histórico Médico Familiar</div>
            <p class="secao-conteudo">${info.dados.historiaFamiliar}</p>
          </div>`
        : ''
    }

    <!-- 8. Hábitos e Estilo de Vida -->
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
      <strong>Declaração de Veracidade das Informações:</strong> Declaro, sob as penas da lei, que todas as respostas e dados informados nesta Ficha de Anamnese são estritamente verdadeiros e completos. Não omiti nenhum fato referente ao meu estado de saúde atual ou passado. Comprometo-me a informar imediatamente à profissional assistente qualquer alteração futura no meu estado de saúde ou uso de novos medicamentos.
    </div>

    <!-- Bloco de Assinaturas Formal -->
    <div class="grid-assinaturas">
      <!-- Assinatura do Paciente -->
      <div class="campo-assinatura">
        <div class="assinatura-img-container">
          ${
            info.assinatura?.signature
              ? `<img src="${info.assinatura.signature}" alt="Assinatura Paciente" class="assinatura-img" />`
              : '<div style="height: 48px;"></div>'
          }
        </div>
        <div class="linha-assinatura"></div>
        <div class="nome-assinante">${info.assinatura?.signerName || info.paciente.nome || 'Paciente'}</div>
        <div class="doc-assinante">Paciente / Responsável Legal • CPF: ${info.paciente.cpf || 'Não informado'}</div>
        ${
          info.assinatura?.timestamp
            ? `<div class="carimbo-digital">✓ Assinado digitalmente em ${dataHoraAssinatura}</div>`
            : ''
        }
      </div>

      <!-- Assinatura do Dentista Responsável -->
      <div class="campo-assinatura">
        <div class="assinatura-img-container">
          <div style="height: 48px;"></div>
        </div>
        <div class="linha-assinatura"></div>
        <div class="nome-assinante">${dentista}</div>
        <div class="doc-assinante">Cirurgiã-Dentista • ${cro}</div>
        <div class="doc-assinante">${clinicaNome}</div>
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

/**
 * Imprime a anamnese diretamente no padrão oficial de folha A4 limpa
 * utilizando um iframe oculto, evitando imprimir a tela do sistema ou modais escuros.
 */
export const imprimirAnamneseHtml = (info: AnamnesePdfData): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const html = gerarHtmlAnamnese(info);
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
          console.error('Erro ao chamar print no iframe de anamnese:', e);
        }
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch (_) {}
          resolve(true);
        }, 1200);
      }, 400);
    } catch (err) {
      console.error('Erro ao imprimir anamnese:', err);
      resolve(false);
    }
  });
};

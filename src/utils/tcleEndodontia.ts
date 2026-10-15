import { ContratoSnapshot, formatarDataPorExtenso } from './contratoEngine';
import { identificarTipoDocumento, temValorValido } from './documentoFormat';
import { downloadHtmlAsPdf } from './pdfDownload';

/**
 * Gera o documento HTML do Termo de Consentimento Livre e Esclarecido (TCLE)
 * específico para Tratamento e Retratamento Endodôntico (Tratamento de Canal),
 * em total conformidade com as diretrizes do Conselho Federal de Odontologia (CFO),
 * Código Civil e Código de Defesa do Consumidor.
 */
export const gerarHtmlTcleEndodontia = (snapshot?: ContratoSnapshot | null): string => {
  if (!snapshot) return '';
  const paciente = snapshot.paciente || ({} as any);
  const clinica = snapshot.clinica || ({} as any);
  const orcamento = snapshot.orcamento || ({} as any);
  const dadosEndo = snapshot.dadosEndodontia || ({} as any);

  const cidade = clinica.cidade || 'Maceió';
  const dataHojeExtenso = formatarDataPorExtenso(new Date(snapshot.emitidoEm || new Date()), cidade);
  const tipoDocClinica = identificarTipoDocumento(clinica.cnpj);
  const labelDocClinica = tipoDocClinica === 'cpf' ? 'CPF' : 'CNPJ';
  const labelDocPaciente = identificarTipoDocumento(paciente.cpf) === 'cnpj' ? 'CNPJ' : 'CPF';

  // Dados da Dra. Rosângela Santos Pereira (Responsável Técnica / Contratada)
  const dentistaNomeContratada = clinica.dentistaResponsavel || 'Dra. Rosângela Santos Pereira';
  const dentistaCroContratada = clinica.cro || 'CRO-AL 06267';
  const dentistaCpfContratada = clinica.cnpj || '032.663.962-43';
  const enderecoProfissional = clinica.endereco && clinica.endereco !== 'Endereço da clínica'
    ? clinica.endereco
    : 'JTR — Edifício Espanha, Rua Comerciante José Pontes de Magalhães, nº 70, Sala 405, Jatiúca, Maceió/AL, CEP 57036-250';

  // Parceiro Executor quando aplicável
  const temParceiro = dadosEndo.executorTipo === 'parceiro' && !!dadosEndo.parceiro?.nome;
  const parceiro = dadosEndo.parceiro || ({} as any);

  // Dentes envolvidos
  const dentesDetectados = orcamento.itens
    ?.map((i: any) => i.denteOuRegiao)
    .filter(Boolean)
    .join(', ');
  const dentesTexto = dadosEndo.dentes || dentesDetectados || 'Elemento(s) dentário(s) indicado(s) no plano de tratamento clínico';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TCLE - Tratamento de Canal (Endodontia) - ${paciente.nome}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm 12mm 15mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 12px;
      line-height: 1.5;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 16px 24px;
    }
    .tcle-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .cabecalho {
      border-bottom: 2px solid #111827;
      padding-bottom: 10px;
      margin-bottom: 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .cabecalho-logo img {
      max-height: 52px;
      max-width: 160px;
      object-fit: contain;
    }
    .cabecalho-clinica h1 {
      font-size: 16px;
      margin: 0 0 2px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cabecalho-clinica p {
      margin: 1px 0;
      font-size: 10.5px;
      color: #4b5563;
      font-family: Arial, sans-serif;
    }
    .titulo-principal {
      text-align: center;
      margin: 12px 0 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .titulo-principal h2 {
      font-size: 14.5px;
      margin: 0 0 3px;
      font-weight: bold;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .titulo-principal h3 {
      font-size: 12.5px;
      margin: 0 0 3px;
      font-weight: bold;
      color: #6b21a8;
      text-transform: uppercase;
    }
    .titulo-principal p {
      margin: 0;
      font-size: 10px;
      color: #4b5563;
      font-style: italic;
    }
    .secao-bloco {
      margin-bottom: 12px;
      text-align: justify;
    }
    .secao-titulo {
      font-weight: bold;
      margin-top: 10px;
      margin-bottom: 5px;
      font-size: 12px;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 2px;
      page-break-after: avoid;
      break-after: avoid;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .paragrafo {
      margin: 4px 0 6px;
      text-indent: 20px;
      line-height: 1.5;
      text-align: justify;
    }
    .paragrafo-simples {
      margin: 4px 0;
      text-align: justify;
      line-height: 1.5;
    }
    .box-info {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 10.5px;
      line-height: 1.45;
      margin: 5px 0 8px;
    }
    .lista-itens {
      margin: 4px 0 6px 16px;
      padding-left: 8px;
      font-size: 11.5px;
      line-height: 1.45;
    }
    .lista-itens li {
      margin-bottom: 5px;
      text-align: justify;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .alerta-restauracao {
      margin: 10px 0 8px;
      padding: 10px 14px;
      background-color: #fef2f2;
      border: 1.5px solid #ef4444;
      border-left: 5px solid #b91c1c;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #7f1d1d;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .alerta-restauracao strong.alerta-titulo {
      display: block;
      font-size: 12px;
      font-weight: bold;
      color: #991b1b;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .page-break {
      page-break-after: always;
      break-after: page;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
    }
    .paginacao-rodape {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 10px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
      font-family: Arial, sans-serif;
      font-size: 9px;
      color: #64748b;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .grid-assinaturas {
      display: grid;
      grid-template-columns: ${temParceiro ? '1fr 1fr 1fr' : '1fr 1fr'};
      gap: 16px;
      margin-top: 26px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .campo-assinatura {
      text-align: center;
      font-family: Arial, sans-serif;
    }
    .campo-assinatura img {
      max-height: 48px;
      max-width: 170px;
      margin: 0 auto 3px;
      display: block;
    }
    .linha-assinatura {
      border-top: 1px solid #111827;
      margin: 0 auto 5px;
      width: 90%;
    }
    .assinatura-nome {
      font-weight: bold;
      font-size: 10.5px;
      color: #111827;
    }
    .assinatura-papel {
      font-size: 9.5px;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .assinatura-detalhes {
      font-size: 9px;
      color: #6b7280;
      margin-top: 1px;
    }
    @media print {
      body { padding: 0; }
      .tcle-container { max-width: 100%; }
      .page-break { page-break-after: always; break-after: page; }
      .secao-bloco { page-break-inside: avoid; break-inside: avoid; }
      .alerta-restauracao { page-break-inside: avoid; break-inside: avoid; }
      .grid-assinaturas { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="tcle-container">
    <!-- ========================================== -->
    <!-- PÁGINA 1 DE 2                              -->
    <!-- ========================================== -->
    <div class="cabecalho">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${clinica.logoUrl ? `<div class="cabecalho-logo"><img src="${clinica.logoUrl}" alt="Logo" /></div>` : ''}
        <div class="cabecalho-clinica">
          <h1>${clinica.nome || dentistaNomeContratada}</h1>
          <p>${labelDocClinica}: ${clinica.cnpj || dentistaCpfContratada} • CRO: ${clinica.cro || dentistaCroContratada}</p>
          <p>${enderecoProfissional}</p>
          <p>Telefone: ${clinica.telefone || 'Consultório'} • E-mail: ${clinica.email || 'Não informado'}</p>
        </div>
      </div>
      <div style="text-align: right; font-family: Arial, sans-serif; font-size: 9.5px; color: #4b5563; min-width: 130px;">
        <div><strong>TCLE ESPECÍFICO</strong></div>
        <div>Ref. Contrato: <strong>#${snapshot.contratoId}</strong></div>
        <div>Orçamento: <strong>#${orcamento.numeroIdentificador || snapshot.contratoId}</strong></div>
      </div>
    </div>

    <!-- Título Principal -->
    <div class="titulo-principal">
      <h2>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)</h2>
      <h3>TRATAMENTO ENDODÔNTICO — TRATAMENTO DE CANAL</h3>
      <p>(Em conformidade com as diretrizes do Conselho Federal de Odontologia - CFO, Código Civil e Código de Defesa do Consumidor)</p>
    </div>

    <!-- 1. IDENTIFICAÇÃO DO PACIENTE E PROFISSIONAL -->
    <div class="secao-bloco">
      <div class="secao-titulo">1. IDENTIFICAÇÃO DO(A) PACIENTE, CIRURGIÃO-DENTISTA E ELEMENTO(S)</div>
      <div class="box-info">
        <div><strong>PACIENTE:</strong> ${paciente.nome} • <strong>${labelDocPaciente}:</strong> ${paciente.cpf}${temValorValido(paciente.rg) ? ` • <strong>RG:</strong> ${paciente.rg}` : ''}</div>
        <div><strong>Endereço:</strong> ${paciente.endereco || 'Não informado'} • <strong>Telefone:</strong> ${paciente.telefone || 'Não informado'}</div>
        <div style="margin-top: 3px;"><strong>CIRURGIÃ-DENTISTA RESPONSÁVEL:</strong> ${dentistaNomeContratada} — ${dentistaCroContratada} (CPF: ${dentistaCpfContratada})</div>
        ${temParceiro ? `
          <div style="margin-top: 3px; color: #166534;">
            <strong>CIRURGIÃO-DENTISTA PARCEIRO EXECUTOR:</strong> ${parceiro.nome} — CRO: ${parceiro.croUf || 'Inscrito no CRO'} ${parceiro.especialidade ? `(${parceiro.especialidade})` : ''}
          </div>
        ` : ''}
        <div style="margin-top: 3px; font-weight: bold; color: #0f172a;">
          <strong>DENTE(S) INDICADO(S) PARA O PROCEDIMENTO:</strong> ${dentesTexto}
        </div>
      </div>
    </div>

    <!-- 2. ESCLARECIMENTOS SOBRE O PROCEDIMENTO -->
    <div class="secao-bloco">
      <div class="secao-titulo">2. ESCLARECIMENTOS SOBRE O PROCEDIMENTO</div>
      <p class="paragrafo">
        O Tratamento ou Retratamento Endodôntico (conhecido popularmente como "tratamento de canal") consiste na remoção da polpa dentária (nervoso/vasos sanguíneos) lesionada, inflamada ou infectada, ou na remoção do material obturador antigo nos casos de retratamento. Após a limpeza, modelagem e desinfecção dos canais radiculares, estes são preenchidos e selados com material biocompatível adequado. O objetivo do tratamento é eliminar a dor, a infecção e controlar a inflamação, permitindo a conservação do dente na cavidade bucal e evitando a sua extração.
      </p>
    </div>

    <!-- 3. POSSÍVEIS RISCOS, COMPLICAÇÕES E INTERCORRÊNCIAS -->
    <div class="secao-bloco">
      <div class="secao-titulo">3. POSSÍVEIS RISCOS, COMPLICAÇÕES E INTERCORRÊNCIAS</div>
      <p class="paragrafo-simples">
        Fui devidamente informado(a) de que a Endodontia é uma especialidade complexa e que, apesar de todo o rigor técnico e científico do profissional, existem riscos e complicações inerentes ao procedimento, tais como:
      </p>
      <ul class="lista-itens">
        <li>
          <strong>Dor, inchaço ou desconforto pós-operatório:</strong> Podem ocorrer nos dias subsequentes ao tratamento e exigirão o uso de medicações analgésicas, anti-inflamatórias ou antibióticas prescritas pelo cirurgião-dentista.
        </li>
        <li>
          <strong>Anatomia atípica ou canais calcificados/curvos:</strong> Podem dificultar ou impedir o alcance total do ápice radicular.
        </li>
        <li>
          <strong>Fratura de instrumentos:</strong> Pela extrema delicadeza das limas endodônticas, pode ocorrer fratura de instrumento no interior do canal. Nestes casos, o profissional avaliará a possibilidade de remoção, ultrapassagem ou sepultamento do fragmento sem prejuízo à saúde do dente.
        </li>
        <li>
          <strong>Perfuração radicular ou furcal:</strong> Ocorrência acidental que pode necessitar de selamento com materiais especiais (ex: MTA) ou procedimentos adicionais.
        </li>
        <li>
          <strong>Perfuração/Extravasamento acidental de soluções irrigadoras ou material obturador:</strong> Pode gerar desconforto ou queimor temporário nos tecidos periapicais.
        </li>
        <li>
          <strong>Abertura ou reabsorção apical prévia:</strong> Pode dificultar a delimitação do comprimento de trabalho correto.
        </li>
        <li>
          <strong>Necessidade de complementação cirúrgica ou extração:</strong> Caso o organismo não responda satisfatoriamente ao tratamento e persista a infecção/lesão, pode ser necessária a realização de cirurgia parendodôntica ou, em último caso, a exodontia (extração) do dente.
        </li>
      </ul>
    </div>

    <!-- ALERTA EXTREMAMENTE IMPORTANTE: RESTAURAÇÃO DEFINITIVA PÓS-TRATAMENTO -->
    <div class="alerta-restauracao">
      <strong class="alerta-titulo">⚠ ALERTA EXTREMAMENTE IMPORTANTE: RESTAURAÇÃO DEFINITIVA PÓS-TRATAMENTO</strong>
      O tratamento de canal <strong>NÃO</strong> deixa o dente pronto e protegido definitivamente. Após a conclusão do canal, o dente torna-se mais frágil e <strong>DEVE</strong> receber uma restauração definitiva ou prótese (coroa/pino) no prazo máximo recomendado pelo dentista (idealmente até 15 a 30 dias). A não realização da restauração final pode acarretar infiltração bacteriana, reinfecção do canal, fratura dental e perda do dente.
    </div>

    <!-- Indicador de Fim da Página 1 -->
    <div class="paginacao-rodape">
      <span>TCLE Endodontia — ${clinica.nome || dentistaNomeContratada}</span>
      <span><strong>Página 1 de 2</strong></span>
      <span>Identificador: ${snapshot.contratoId}</span>
    </div>

    <!-- Quebra de Página Oficial para A4 -->
    <div class="page-break"></div>

    <!-- ========================================== -->
    <!-- PÁGINA 2 DE 2                              -->
    <!-- ========================================== -->
    <div class="cabecalho" style="padding-bottom: 8px; margin-bottom: 12px;">
      <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: bold; color: #475569; text-transform: uppercase;">
        TCLE — Tratamento Endodôntico (Continuação) • Paciente: ${paciente.nome}
      </div>
      <div style="text-align: right; font-family: Arial, sans-serif; font-size: 9.5px; color: #64748b;">
        Ref. Contrato: <strong>#${snapshot.contratoId}</strong>
      </div>
    </div>

    <!-- 4. DEVERES E COMPROMISSOS DO PACIENTE -->
    <div class="secao-bloco">
      <div class="secao-titulo">4. DEVERES E COMPROMISSOS DO PACIENTE</div>
      <p class="paragrafo-simples">
        Para o adequado prognóstico clínico e preservação do elemento dentário tratado, o(a) paciente compromete-se expressamente a:
      </p>
      <ul class="lista-itens">
        <li>Comparecer a todas as consultas agendadas até a conclusão do tratamento;</li>
        <li>Informar com precisão todo o seu histórico de saúde, alergias, medicações em uso e condições de gravidez;</li>
        <li>Seguir rigorosamente as orientações pós-operatórias e tomar as medicações prescritas nos horários corretos;</li>
        <li>Procurar o dentista imediatamente caso perceba inchaço acentuado, dor persistente ou soltura do curativo temporário;</li>
        <li>Realizar a restauração definitiva ou prótese no prazo recomendado pelo profissional.</li>
      </ul>
    </div>

    <!-- 5. DECLARAÇÃO DE CONSENTIMENTO E AUTORIZAÇÃO -->
    <div class="secao-bloco">
      <div class="secao-titulo">5. DECLARAÇÃO DE CONSENTIMENTO E AUTORIZAÇÃO</div>
      <p class="paragrafo">
        Declaro que li (ou foi lido para mim) e compreendi perfeitamente todas as informações contidas neste termo. Tive a oportunidade de fazer perguntas, esclarecer todas as minhas dúvidas com o cirurgião-dentista e fui informado(a) sobre as alternativas de tratamento (incluindo a extração do dente). Compreendo que na odontologia não é possível garantir 100% de sucesso em tratamentos biológicos, mas que o profissional empregará os melhores recursos e técnicas disponíveis. Assim, de livre e esclarecida vontade, AUTORIZO a realização do tratamento endodôntico no(s) dente(s) indicado(s), bem como a aplicação de anestesia local e a tomada de radiografias/exames necessários.
      </p>
    </div>

    <!-- Local, Data e Assinaturas -->
    <div style="margin-top: 24px; page-break-inside: avoid; break-inside: avoid;">
      <div style="text-align: right; font-style: italic; margin-bottom: 22px; font-size: 11.5px;">
        ${cidade}/AL, ${dataHojeExtenso}.
      </div>

      <div class="grid-assinaturas">
        <!-- PACIENTE / RESPONSÁVEL -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaPaciente?.assinaturaData ? `
            <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" />
          ` : '<div style="height: 48px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${snapshot.assinaturaPaciente?.nome || paciente.nome}</div>
          <div class="assinatura-papel">Paciente / Responsável Legal</div>
          <div class="assinatura-detalhes">${labelDocPaciente}: ${snapshot.assinaturaPaciente?.cpf || paciente.cpf}${temValorValido(snapshot.assinaturaPaciente?.rg) ? ` • RG: ${snapshot.assinaturaPaciente.rg}` : (temValorValido(paciente.rg) ? ` • RG: ${paciente.rg}` : '')}</div>
        </div>

        <!-- CIRURGIÃ-DENTISTA CONTRATADA -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaDentista?.assinaturaData ? `
            <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
          ` : '<div style="height: 48px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${dentistaNomeContratada}</div>
          <div class="assinatura-papel">Cirurgiã-Dentista Responsável</div>
          <div class="assinatura-detalhes">${dentistaCroContratada} • CPF: ${dentistaCpfContratada}</div>
        </div>

        <!-- PARCEIRO EXECUTOR (QUANDO HOUVER) -->
        ${temParceiro ? `
          <div class="campo-assinatura">
            <div style="height: 48px;"></div>
            <div class="linha-assinatura"></div>
            <div class="assinatura-nome">${parceiro.nome}</div>
            <div class="assinatura-papel">Cirurgião-Dentista Executor Parceiro</div>
            <div class="assinatura-detalhes">${parceiro.croUf ? `CRO: ${parceiro.croUf}` : 'Registro CRO ativo'}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Indicador de Fim da Página 2 -->
    <div class="paginacao-rodape" style="margin-top: 36px;">
      <span>Documento integrante do prontuário odontológico • CFO / Código de Defesa do Consumidor</span>
      <span><strong>Página 2 de 2</strong></span>
      <span>Emitido em: ${new Date(snapshot.emitidoEm || new Date()).toLocaleString('pt-BR')}</span>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Realiza o download direto do TCLE de Tratamento de Canal (Endodontia) como arquivo PDF A4 avulso de 2 páginas.
 */
export const downloadTcleEndodontiaPdf = async (snapshot?: ContratoSnapshot | null): Promise<boolean> => {
  if (!snapshot) return false;
  const html = gerarHtmlTcleEndodontia(snapshot);
  const nomePaciente = (snapshot.paciente?.nome || 'paciente').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `tcle_endodontia_${nomePaciente}_${snapshot.contratoId || 'doc'}.pdf`;
  return downloadHtmlAsPdf(html, filename);
};

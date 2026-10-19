import { ContratoSnapshot, formatarData, formatarDataPorExtenso } from './contratoEngine';
import { identificarTipoDocumento, temValorValido } from './documentoFormat';
import { downloadHtmlAsPdf } from './pdfDownload';

/**
 * Gera o documento HTML do Termo de Consentimento Livre e Esclarecido (TCLE)
 * específico para Lentes em Resina Composta e Facetas Estéticas,
 * em total conformidade com as diretrizes do Conselho Federal de Odontologia (CFO)
 * e Código de Defesa do Consumidor.
 */
export const gerarHtmlTcleLentesResina = (snapshot?: ContratoSnapshot | null): string => {
  if (!snapshot) return '';
  const paciente = snapshot.paciente || ({} as any);
  const clinica = snapshot.clinica || ({} as any);
  const orcamento = snapshot.orcamento || ({} as any);
  const dataHojeExtenso = formatarDataPorExtenso(new Date(snapshot.emitidoEm || new Date()), clinica.cidade || 'Local');
  const tipoDocClinica = identificarTipoDocumento(clinica.cnpj);
  const labelDocClinica = tipoDocClinica === 'cpf' ? 'CPF' : 'CNPJ';
  const labelDocPaciente = identificarTipoDocumento(paciente.cpf) === 'cnpj' ? 'CNPJ' : 'CPF';

  const dentesDescricao = snapshot.dadosRestauracoesPreexistentes?.dentesEnvolvidos ||
    orcamento?.itens?.map((i: any) => `${i?.nome || ''} ${i?.denteOuRegiao || ''}`).filter(Boolean).join(', ') ||
    'Dentes indicados no plano de tratamento odontológico';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TCLE - Lentes em Resina Composta - ${paciente.nome}</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 16mm 14mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 13px;
      line-height: 1.55;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 24px 32px;
    }
    .tcle-container {
      max-width: 100%;
      margin: 0 auto;
    }
    .cabecalho {
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
      margin-bottom: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .cabecalho-logo img {
      max-height: 55px;
      max-width: 170px;
      object-fit: contain;
    }
    .cabecalho-clinica h1 {
      font-size: 17px;
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
    .titulo-principal {
      text-align: center;
      margin: 16px 0 16px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .titulo-principal h2 {
      font-size: 15px;
      margin: 0 0 4px;
      font-weight: bold;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .titulo-principal p {
      margin: 0;
      font-size: 11px;
      color: #4b5563;
      font-style: italic;
    }
    .secao-bloco {
      margin-bottom: 14px;
      text-align: justify;
    }
    .secao-titulo {
      font-weight: bold;
      margin-top: 14px;
      margin-bottom: 6px;
      font-size: 13px;
      text-transform: uppercase;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
      page-break-after: avoid;
      break-after: avoid;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .paragrafo {
      margin: 6px 0;
      text-indent: 24px;
      line-height: 1.55;
      orphans: 3;
      widows: 3;
    }
    .lista-riscos {
      margin: 6px 0 10px 20px;
      padding-left: 10px;
    }
    .lista-riscos li {
      margin-bottom: 5px;
      line-height: 1.5;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .alerta-box {
      margin: 12px 0;
      padding: 12px 16px;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #0284c7;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.55;
      color: #334155;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .grid-assinaturas {
      display: flex;
      justify-content: space-between;
      gap: 32px;
      margin-top: 30px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .campo-assinatura {
      flex: 1;
      text-align: center;
      font-family: Arial, sans-serif;
    }
    .campo-assinatura img {
      max-height: 60px;
      margin: 0 auto 4px;
      display: block;
    }
    .linha-assinatura {
      border-top: 1px solid #111827;
      margin: 0 auto 6px;
      width: 85%;
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
      font-size: 10px;
      color: #6b7280;
      margin-top: 2px;
    }
    @media print {
      body { padding: 0; }
      .tcle-container { max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="tcle-container">
    <!-- Cabeçalho Institucional -->
    <div class="cabecalho">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${clinica.logoUrl ? `<div class="cabecalho-logo"><img src="${clinica.logoUrl}" alt="Logo" /></div>` : ''}
        <div class="cabecalho-clinica">
          <h1>${clinica.nome}</h1>
          <p>${labelDocClinica}: ${clinica.cnpj} • CRO: ${clinica.cro}</p>
          <p>${clinica.endereco}</p>
          <p>Telefone: ${clinica.telefone} • E-mail: ${clinica.email}</p>
        </div>
      </div>
      <div style="text-align: right; font-family: Arial, sans-serif; font-size: 10px; color: #4b5563;">
        <div>Documento Complementar</div>
        <div>Ref. Contrato: <strong>#${snapshot.contratoId}</strong></div>
        <div>Orçamento: <strong>#${orcamento.numeroIdentificador}</strong></div>
      </div>
    </div>

    <!-- Título Principal -->
    <div class="titulo-principal">
      <h2>TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO (TCLE)</h2>
      <p>Procedimento de Lentes em Resina Composta e Facetas Estéticas Diretas/Indiretas</p>
      <p style="font-size: 9px; margin-top: 2px; color: #64748b;">(Em conformidade com as diretrizes do Conselho Federal de Odontologia - CFO e Código de Defesa do Consumidor)</p>
    </div>

    <!-- Identificação das Partes -->
    <div class="secao-bloco">
      <div class="secao-titulo">1. IDENTIFICAÇÃO DO(A) PACIENTE E DO(A) PROFISSIONAL</div>
      <p class="paragrafo">
        <strong>PACIENTE:</strong> <strong>${paciente.nome}</strong>${temValorValido(paciente.rg) ? `, portador(a) do RG nº <strong>${paciente.rg}</strong>` : ''}, inscrito(a) no ${labelDocPaciente} sob o nº <strong>${paciente.cpf}</strong>, residente e domiciliado(a) em <strong>${paciente.endereco || 'Não informado'}</strong>.
      </p>
      <p class="paragrafo">
        <strong>CIRURGIÃ(O)-DENTISTA RESPONSÁVEL:</strong> <strong>${clinica.dentistaResponsavel || clinica.nome}</strong>, inscrita(o) no CRO sob o nº <strong>${clinica.cro}</strong>.
      </p>
    </div>

    <!-- 2. Natureza e Finalidade do Tratamento -->
    <div class="secao-bloco">
      <div class="secao-titulo">2. NATUREZA, INDICAÇÃO E FINALIDADE DO TRATAMENTO</div>
      <p class="paragrafo">
        O tratamento odontológico proposto consiste na confecção de <strong>lentes de contato dentais / facetas em resina composta</strong> sobre os elementos dentários indicados no planejamento clínico (<strong>${dentesDescricao}</strong>), visando à harmonização anatômica, fechamento de diastemas, melhora estética do formato, alinhamento visual e luminosidade do sorriso.
      </p>
      <p class="paragrafo">
        Declaro ter sido informado(a) de que o procedimento pode envolver condicionamento ácido, preparo e texturização superficial da estrutura dental, aplicação de sistemas adesivos e estratificação de compósitos odontológicos de alta tecnologia, com posterior acabamento, escultura marginal, oclusal e polimento óptico.
      </p>
    </div>

    <!-- 3. Riscos, Limitações e Fatores Biológicos -->
    <div class="secao-bloco">
      <div class="secao-titulo">3. RISCOS INERENTES, LIMITAÇÕES TÉCNICAS E INTERCORRÊNCIAS PREVISTAS</div>
      <p class="paragrafo">
        Declaro ter recebido explicações detalhadas da profissional e compreendido que, a despeito do emprego da mais apurada técnica e materiais certificados, os tratamentos estéticos restauradores apresentam os seguintes riscos e limitações naturais:
      </p>
      <ul class="lista-riscos">
        <li><strong>Risco de Fratura, Lascamento (Chipping) ou Descolamento:</strong> A resina composta é um polímero odontológico de alta estética, porém suscetível a sobrecargas mastigatórias excessivas, mastigação de alimentos muito duros, hábitos parafuncionais (bruxismo, briquismo, apertamento dental, onicofagia/roer unhas, morder canetas) ou impactos mecânicos acidentais.</li>
        <li><strong>Manchamento e Pigmentação Superficial:</strong> Devido às características de absorção dos compósitos, as restaurações em resina podem sofrer pigmentação ao longo do tempo por contato frequente com corantes alimentares intensos (café, vinho tinto, chás escuros, refrigerantes à base de cola, molho de tomate, açaí) e produtos do tabaco, exigindo manutenções e repolimentos periódicos.</li>
        <li><strong>Desgaste Fisiológico e Perda Gradual de Brilho:</strong> O atrito mastigatório fisiológico e a escovação dental promovem desgaste microscópico contínuo na superfície da resina, sendo necessária a realização de polimento preventivo regular para restaurar a lisura e o brilho superficial.</li>
        <li><strong>Sensibilidade Dentinária Transitória:</strong> Poderá ocorrer sensibilidade térmica pós-operatória ao frio ou ao calor nos primeiros dias ou semanas após o procedimento, de caráter transitório, decorrente da resposta pulpar aos estímulos adesivos e térmicos.</li>
        <li><strong>Dependência do Substrato Dentário de Fundo:</strong> A translucidez e espessura milimétrica das lentes de resina interagem diretamente com a cor natural do dente original. Dentes com descolorações severas ou tratamentos de canal prévios podem demandar opacificadores ou apresentar sutis variações de reflexão óptica.</li>
        <li><strong>Saúde Periodontal e Adaptação Marginal:</strong> A união da resina com o dente próxima à margem gengival exige rigorosa higienização do(a) paciente com escovação correta e fio dental diário para evitar inflamação gengival e sangramentos.</li>
      </ul>
    </div>

    <!-- 4. Deveres do Paciente e Manutenção Semestral -->
    <div class="secao-bloco">
      <div class="secao-titulo">4. DEVERES DE COOPERAÇÃO E MANUTENÇÃO PREVENTIVA SEMESTRAL</div>
      <p class="paragrafo">
        O(A) <strong>PACIENTE</strong> compromete-se a cumprir integralmente as seguintes recomendações profissionais:
      </p>
      <div class="alerta-box">
        <strong>✦ DIRETRIZES FUNDAMENTAIS PARA CONSERVAÇÃO DAS LENTES:</strong><br/>
        1. <strong>Comparecimento Semestral Obrigatório:</strong> Retornar a cada <strong>6 (seis) meses</strong> para consulta de revisão, avaliação oclusal, controle biológico gengival, polimento e profilaxia especializada.<br/>
        2. <strong>Hábitos Parafuncionais:</strong> Caso diagnosticado bruxismo ou apertamento, utilizar a placa miorrelaxante noturna prescrita pela dentista.<br/>
        3. <strong>Cuidados Mastigatórios:</strong> Evitar morder diretamente ossos, castanhas duras, gelo ou utilizar os dentes como ferramenta (abrir garrafas ou embalagens).<br/>
        4. <strong>Comunicação Imediata:</strong> Notificar imediatamente o consultório diante de qualquer fratura, desadaptação ou desconforto para avaliação em consulta extraordinária.
      </div>
    </div>

    <!-- 5. Declaração de Consentimento Livre e Esclarecido -->
    <div class="secao-bloco">
      <div class="secao-titulo">5. DECLARAÇÃO FORMAL DE CONSENTIMENTO</div>
      <p class="paragrafo">
        Declaro que li atentamente o presente Termo de Consentimento Livre e Esclarecido, tive todas as minhas dúvidas esclarecidas de forma clara e compreensível pela cirurgiã-dentista responsável, e que me sinto perfeitamente informado(a) quanto aos benefícios, limitações e riscos inerentes às lentes em resina composta.
      </p>
      <p class="paragrafo">
        Assim, de livre e espontânea vontade, manifesto meu pleno <strong>CONSENTIMENTO</strong> para a realização do tratamento proposto.
      </p>
    </div>

    <!-- Data e Assinaturas -->
    <div style="margin-top: 30px;">
      <div style="text-align: right; font-style: italic; margin-bottom: 30px;">
        ${dataHojeExtenso}.
      </div>

      <div class="grid-assinaturas">
        <!-- Assinatura Paciente -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaPaciente?.assinaturaData ? `
            <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${snapshot.assinaturaPaciente?.nome || paciente.nome}</div>
          <div class="assinatura-papel">Paciente / Consentinte</div>
          <div class="assinatura-detalhes">${labelDocPaciente}: ${snapshot.assinaturaPaciente?.cpf || paciente.cpf}${temValorValido(snapshot.assinaturaPaciente?.rg) ? ` • RG: ${snapshot.assinaturaPaciente.rg}` : (temValorValido(paciente.rg) ? ` • RG: ${paciente.rg}` : '')}</div>
        </div>

        <!-- Assinatura Dentista -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaDentista?.assinaturaData ? `
            <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${clinica.dentistaResponsavel || clinica.nome}</div>
          <div class="assinatura-papel">Cirurgiã(o)-Dentista Responsável</div>
          <div class="assinatura-detalhes">CRO: ${clinica.cro}</div>
          ${snapshot.assinaturaDentista?.dataHora ? `
            <div class="assinatura-detalhes" style="color: #059669; font-weight: 500;">✓ Assinado digitalmente em ${new Date(snapshot.assinaturaDentista.dataHora).toLocaleString('pt-BR')}</div>
          ` : ''}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Realiza o download direto do TCLE de Lentes em Resina Composta como arquivo PDF A4 avulso.
 */
export const downloadTcleLentesResinaPdf = async (snapshot?: ContratoSnapshot | null): Promise<boolean> => {
  if (!snapshot) return false;
  const html = gerarHtmlTcleLentesResina(snapshot);
  const nomePaciente = (snapshot.paciente?.nome || 'paciente').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `tcle_lentes_resina_${nomePaciente}_${snapshot.contratoId || 'doc'}.pdf`;
  return downloadHtmlAsPdf(html, filename);
};

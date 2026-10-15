import { ContratoSnapshot, ContratoTermoUsoImagem, formatarData, formatarDataPorExtenso } from './contratoEngine';
import { identificarTipoDocumento, temValorValido } from './documentoFormat';
import { downloadHtmlAsPdf } from './pdfDownload';

/**
 * Gera o documento HTML independente do Termo de Autorização de Uso de Imagem,
 * Voz e Registros Odontológicos (Consentimento Livre, Informado e Específico),
 * em estrita conformidade com a LGPD (Lei nº 13.709/2018) e Código de Ética Odontológica (CFO).
 */
export const gerarHtmlTermoUsoImagem = (snapshot?: ContratoSnapshot | null): string => {
  if (!snapshot) return '';
  const paciente = snapshot.paciente || ({} as any);
  const clinica = snapshot.clinica || ({} as any);
  const termo = snapshot.termoUsoImagem || ({} as ContratoTermoUsoImagem);

  const cidade = clinica.cidade || 'Maceió';
  const dataHojeExtenso = formatarDataPorExtenso(new Date(snapshot.emitidoEm || new Date()), cidade);
  const tipoDocClinica = identificarTipoDocumento(clinica.cnpj);
  const labelDocClinica = tipoDocClinica === 'cpf' ? 'CPF' : 'CNPJ';
  const labelDocPaciente = identificarTipoDocumento(paciente.cpf) === 'cnpj' ? 'CNPJ' : 'CPF';

  const dentistaNome = clinica.dentistaResponsavel || 'Dra. Rosângela Santos Pereira';
  const dentistaCro = clinica.cro || 'CRO-AL 06267';
  const dentistaCpfCnpj = clinica.cnpj || '032.663.962-43';
  const enderecoProfissional = clinica.endereco && clinica.endereco !== 'Endereço da clínica'
    ? clinica.endereco
    : 'JTR — Edifício Espanha, Rua Comerciante José Pontes de Magalhães, nº 70, Sala 405, Jatiúca, Maceió/AL, CEP 57036-250';

  const canalLgpd = termo.canalContatoLgpd || clinica.email || clinica.telefone || 'contato@clinica.com';

  // Opções selecionadas pelo paciente (defaults amigáveis e seguros)
  const optDidatico = termo.usoDidaticoCientifico !== false;
  const optPublicitario = termo.usoPublicitarioRedesSociais !== false;
  const optIdentificacao = termo.identificacaoFacialVoz || 'rosto_e_voz';
  const optDepoimentos = termo.depoimentos !== false;

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Termo de Uso de Imagem e Voz - ${paciente.nome || 'Paciente'}</title>
  <style>
    @page {
      size: A4;
      margin: 14mm 16mm 14mm 16mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, Georgia, serif;
      font-size: 12.5px;
      line-height: 1.55;
      color: #111827;
      background: #ffffff;
      margin: 0;
      padding: 24px 32px;
    }
    .termo-container {
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
      font-size: 16px;
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
      letter-spacing: 0.6px;
      text-transform: uppercase;
      text-decoration: underline;
    }
    .titulo-principal p {
      margin: 0;
      font-size: 11.5px;
      color: #4b5563;
      font-style: italic;
    }
    .secao-bloco {
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .secao-titulo {
      font-size: 13px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 6px;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 3px;
      color: #0f172a;
    }
    .paragrafo {
      margin: 0 0 6px;
      text-align: justify;
      text-indent: 18px;
    }
    .paragrafo-simples {
      margin: 0 0 5px;
      text-align: justify;
    }
    .grid-dados {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 16px;
      background-color: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 10px 14px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      margin-bottom: 10px;
    }
    .grid-dados div strong {
      color: #374151;
    }
    .item-escolha {
      margin: 6px 0 10px 12px;
      font-family: Arial, sans-serif;
      font-size: 11px;
    }
    .check-opcao {
      display: inline-flex;
      align-items: center;
      margin-right: 18px;
      font-weight: 600;
    }
    .check-box-simulado {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 1.5px solid #111827;
      text-align: center;
      line-height: 11px;
      font-size: 10px;
      font-weight: bold;
      margin-right: 5px;
      border-radius: 2px;
      background: #ffffff;
    }
    .check-box-simulado.marcado {
      background: #111827;
      color: #ffffff;
    }
    .bloco-destaque {
      background-color: #f8fafc;
      border-left: 4px solid #0284c7;
      border: 1px solid #e2e8f0;
      border-left-width: 4px;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 11px;
      font-family: Arial, sans-serif;
      border-radius: 3px;
    }
    .grid-assinaturas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 24px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .campo-assinatura {
      text-align: center;
      font-family: Arial, sans-serif;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .campo-assinatura img {
      max-height: 55px;
      max-width: 190px;
      margin: 0 auto 4px;
      display: block;
    }
    .linha-assinatura {
      border-top: 1px solid #111827;
      margin: 6px 12px 4px;
    }
    .assinatura-nome {
      font-weight: bold;
      font-size: 11px;
      color: #111827;
    }
    .assinatura-papel {
      font-size: 10px;
      color: #4b5563;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .assinatura-detalhes {
      font-size: 9.5px;
      color: #6b7280;
      margin-top: 1px;
    }
    @media print {
      body { padding: 0; }
      .secao-bloco { page-break-inside: avoid; break-inside: avoid; }
      .grid-assinaturas { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="termo-container">
    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div class="cabecalho-clinica">
        <h1>${clinica.nome || 'Dra. Rosângela Santos Pereira'}</h1>
        <p>${labelDocClinica}: ${clinica.cnpj || dentistaCpfCnpj} • CRO: ${clinica.cro || dentistaCro}</p>
        <p>${enderecoProfissional}</p>
      </div>
      ${clinica.logoUrl ? `
        <div class="cabecalho-logo">
          <img src="${clinica.logoUrl}" alt="Logo" />
        </div>
      ` : ''}
    </div>

    <!-- Título Oficial -->
    <div class="titulo-principal">
      <h2>TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM, VOZ E REGISTROS ODONTOLÓGICOS</h2>
      <p>Consentimento Livre, Informado e Específico • Lei nº 13.709/2018 (LGPD) e Normas Éticas do CFO</p>
    </div>

    <!-- 1. IDENTIFICAÇÃO DA PROFISSIONAL RESPONSÁVEL -->
    <div class="secao-bloco">
      <div class="secao-titulo">1. IDENTIFICAÇÃO DA PROFISSIONAL RESPONSÁVEL</div>
      <div class="grid-dados">
        <div><strong>Profissional:</strong> ${dentistaNome}</div>
        <div><strong>Qualificação:</strong> Cirurgiã-Dentista — ${dentistaCro}</div>
        <div><strong>CPF/CNPJ:</strong> ${dentistaCpfCnpj}</div>
        <div><strong>Telefone/WhatsApp:</strong> ${clinica.telefone || 'Não informado'}</div>
        <div style="grid-column: 1 / -1;"><strong>Endereço Profissional:</strong> ${enderecoProfissional}</div>
      </div>
    </div>

    <!-- 2. IDENTIFICAÇÃO DO PACIENTE -->
    <div class="secao-bloco">
      <div class="secao-titulo">2. IDENTIFICAÇÃO DO PACIENTE</div>
      <div class="grid-dados">
        <div><strong>Nome completo:</strong> ${paciente.nome || 'Não informado'}</div>
        <div><strong>${labelDocPaciente}:</strong> ${paciente.cpf || 'Não informado'}</div>
        ${temValorValido(paciente.rg) ? `<div><strong>RG:</strong> ${paciente.rg}</div>` : ''}
        <div><strong>Data de nascimento:</strong> ${paciente.dataNascimento || 'Não informada'}</div>
        <div><strong>Telefone/WhatsApp:</strong> ${paciente.telefone || 'Não informado'}</div>
        <div><strong>E-mail:</strong> ${paciente.email || 'Não informado'}</div>
        <div style="grid-column: 1 / -1;"><strong>Endereço completo:</strong> ${paciente.endereco || 'Não informado'}</div>
      </div>
    </div>

    <!-- 3. OBJETO DA AUTORIZAÇÃO -->
    <div class="secao-bloco">
      <div class="secao-titulo">3. OBJETO DA AUTORIZAÇÃO</div>
      <p class="paragrafo">
        Eu, paciente acima identificado(a), declaro que fui informado(a) sobre a possibilidade de captação e utilização de fotografias, vídeos, gravações de voz, imagens odontológicas e demais registros relacionados ao meu atendimento.
      </p>
      <p class="paragrafo">
        Esses registros poderão incluir fotografias do rosto, sorriso, dentes e cavidade bucal, imagens do tratamento, registros de antes e depois, além de exames odontológicos.
      </p>
      <p class="paragrafo">
        Reconheço que as autorizações para utilização didática, científica e publicitária são <strong>facultativas e independentes</strong> da contratação do tratamento odontológico. Minha manifestação de vontade será registrada individualmente para cada finalidade descrita neste documento.
      </p>
    </div>

    <!-- 4. DAS FINALIDADES E AUTORIZAÇÕES -->
    <div class="secao-bloco">
      <div class="secao-titulo">4. DAS FINALIDADES E AUTORIZAÇÕES</div>
      
      <p class="paragrafo-simples"><strong>A — REGISTROS CLÍNICOS E PRONTUÁRIO ODONTOLÓGICO</strong></p>
      <p class="paragrafo">
        Declaro estar ciente de que registros fotográficos e exames clinicamente indicados poderão ser realizados para diagnóstico, planejamento, documentação e acompanhamento do tratamento odontológico, respeitadas as bases legais pertinentes. A documentação clínica <strong>não constitui autorização</strong> para divulgação pública das imagens.
      </p>

      <p class="paragrafo-simples" style="margin-top: 8px;"><strong>B — UTILIZAÇÃO DIDÁTICA E CIENTÍFICA</strong></p>
      <p class="paragrafo">
        Autorizo a utilização de imagens e registros do meu caso clínico em atividades de ensino, aulas, palestras, cursos, congressos, conferências, artigos científicos e publicações técnicas, observadas as normas éticas e legais aplicáveis. Sempre que possível, os materiais deverão ser apresentados de modo a reduzir minha identificação.
      </p>
      <div class="item-escolha">
        <span class="check-opcao"><span class="check-box-simulado ${optDidatico ? 'marcado' : ''}">${optDidatico ? 'X' : ''}</span> ( ) AUTORIZO</span>
        <span class="check-opcao"><span class="check-box-simulado ${!optDidatico ? 'marcado' : ''}">${!optDidatico ? 'X' : ''}</span> ( ) NÃO AUTORIZO</span>
      </div>

      <p class="paragrafo-simples" style="margin-top: 8px;"><strong>C — DIVULGAÇÃO PUBLICITÁRIA E REDES SOCIAIS</strong></p>
      <p class="paragrafo">
        Autorizo a utilização de imagens relacionadas ao meu tratamento em publicações profissionais da ${dentistaNome}, incluindo redes sociais, site profissional, portfólio e materiais institucionais, exclusivamente quando a divulgação estiver de acordo com as normas éticas odontológicas vigentes. A autorização não permite publicidade enganosa, divulgação de informações confidenciais desnecessárias ou utilização de imagens para finalidades distintas das aqui estabelecidas.
      </p>
      <div class="item-escolha">
        <span class="check-opcao"><span class="check-box-simulado ${optPublicitario ? 'marcado' : ''}">${optPublicitario ? 'X' : ''}</span> ( ) AUTORIZO</span>
        <span class="check-opcao"><span class="check-box-simulado ${!optPublicitario ? 'marcado' : ''}">${!optPublicitario ? 'X' : ''}</span> ( ) NÃO AUTORIZO</span>
      </div>

      <p class="paragrafo-simples" style="margin-top: 8px;"><strong>D — IDENTIFICAÇÃO FACIAL E UTILIZAÇÃO DA VOZ</strong></p>
      <p class="paragrafo">
        Quanto à identificação pessoal nas imagens e gravações, declaro:
      </p>
      <div class="item-escolha" style="display: flex; flex-direction: column; gap: 4px;">
        <span class="check-opcao"><span class="check-box-simulado ${optIdentificacao === 'rosto_e_voz' ? 'marcado' : ''}">${optIdentificacao === 'rosto_e_voz' ? 'X' : ''}</span> AUTORIZO a divulgação de imagens em que meu rosto possa ser reconhecido.</span>
        <span class="check-opcao"><span class="check-box-simulado ${optIdentificacao === 'apenas_voz' ? 'marcado' : ''}">${optIdentificacao === 'apenas_voz' ? 'X' : ''}</span> AUTORIZO a divulgação de gravações contendo minha voz.</span>
        <span class="check-opcao"><span class="check-box-simulado ${optIdentificacao === 'apenas_bucal' ? 'marcado' : ''}">${optIdentificacao === 'apenas_bucal' ? 'X' : ''}</span> AUTORIZO apenas imagens da região bucal sem identificação facial direta.</span>
        <span class="check-opcao"><span class="check-box-simulado ${optIdentificacao === 'nao_autoriza_identificacao' ? 'marcado' : ''}">${optIdentificacao === 'nao_autoriza_identificacao' ? 'X' : ''}</span> NÃO AUTORIZO a divulgação de imagens ou gravações que permitam minha identificação.</span>
      </div>
      <p style="font-size: 11px; color: #4b5563; font-style: italic; margin-left: 12px;">
        As opções deverão ser interpretadas em conjunto com as finalidades autorizadas, não permitindo usos incompatíveis com minhas escolhas.
      </p>

      <p class="paragrafo-simples" style="margin-top: 8px;"><strong>E — DEPOIMENTOS SOBRE O TRATAMENTO</strong></p>
      <p class="paragrafo">
        Autorizo a captação e eventual divulgação de depoimentos voluntários relacionados à minha experiência de atendimento, exclusivamente quando sua utilização for permitida pelas normas profissionais e legais aplicáveis.
      </p>
      <div class="item-escolha">
        <span class="check-opcao"><span class="check-box-simulado ${optDepoimentos ? 'marcado' : ''}">${optDepoimentos ? 'X' : ''}</span> ( ) AUTORIZO</span>
        <span class="check-opcao"><span class="check-box-simulado ${!optDepoimentos ? 'marcado' : ''}">${!optDepoimentos ? 'X' : ''}</span> ( ) NÃO AUTORIZO</span>
      </div>
    </div>

    <!-- 5. DAS CONDIÇÕES DE UTILIZAÇÃO -->
    <div class="secao-bloco">
      <div class="secao-titulo">5. DAS CONDIÇÕES DE UTILIZAÇÃO</div>
      <p class="paragrafo-simples"><strong>5.1.</strong> As imagens e gravações poderão ser utilizadas somente para as finalidades expressamente autorizadas pelo paciente.</p>
      <p class="paragrafo-simples"><strong>5.2.</strong> A captação e o tratamento dos materiais poderão ser realizados pela profissional responsável e por integrantes autorizados de sua equipe, observadas as obrigações de sigilo e segurança.</p>
      <p class="paragrafo-simples"><strong>5.3.</strong> A autorização não permite a comercialização independente das imagens, nem sua utilização por terceiros para finalidades não informadas.</p>
      <p class="paragrafo-simples"><strong>5.4.</strong> Eventuais ajustes de enquadramento, iluminação ou edição não poderão alterar de maneira enganosa a representação do caso clínico ou do resultado do tratamento.</p>
      <p class="paragrafo-simples"><strong>5.5.</strong> A divulgação deverá observar as normas éticas do Conselho Federal de Odontologia e demais regras legais aplicáveis, independentemente da autorização concedida pelo paciente.</p>
    </div>

    <!-- 6. DA GRATUIDADE E DA LIBERDADE DE ESCOLHA -->
    <div class="secao-bloco">
      <div class="secao-titulo">6. DA GRATUIDADE E DA LIBERDADE DE ESCOLHA</div>
      <p class="paragrafo-simples"><strong>6.1.</strong> A presente autorização, quando concedida, será gratuita, não gerando obrigação de remuneração ao paciente pelo uso autorizado de suas imagens ou voz.</p>
      <p class="paragrafo-simples"><strong>6.2.</strong> A recusa em autorizar a divulgação de imagens <strong>não acarretará prejuízo</strong> ao tratamento odontológico, alteração das condições contratuais ou restrição ao atendimento profissional.</p>
      <p class="paragrafo-simples"><strong>6.3.</strong> O paciente não será obrigado a participar de gravações publicitárias, fornecer depoimentos ou permitir a divulgação de sua identidade.</p>
      <p class="paragrafo-simples"><strong>6.4.</strong> Nenhuma autorização será presumida em razão do pagamento ou contratação do tratamento.</p>
    </div>

    <!-- 7. DA REVOGAÇÃO DO CONSENTIMENTO -->
    <div class="secao-bloco">
      <div class="secao-titulo">7. DA REVOGAÇÃO DO CONSENTIMENTO</div>
      <p class="paragrafo-simples"><strong>7.1.</strong> O paciente poderá revogar as autorizações facultativas a qualquer momento, mediante solicitação à profissional responsável.</p>
      <p class="paragrafo-simples"><strong>7.2.</strong> A revogação não comprometerá a licitude dos tratamentos de dados realizados anteriormente com fundamento em consentimento válido.</p>
      <p class="paragrafo-simples"><strong>7.3.</strong> Recebida a solicitação, deverão ser interrompidas novas utilizações fundamentadas na autorização revogada e avaliadas as providências cabíveis quanto às publicações sob controle da profissional.</p>
      <p class="paragrafo-simples"><strong>7.4.</strong> Materiais já compartilhados por terceiros poderão apresentar limitações práticas de remoção, sem prejuízo dos direitos legalmente assegurados ao paciente.</p>
      <p class="paragrafo-simples"><strong>7.5.</strong> A revogação de autorização publicitária não implica eliminação automática de registros que devam ser conservados no prontuário odontológico.</p>
    </div>

    <!-- 8. DA PROTEÇÃO DOS DADOS PESSOAIS -->
    <div class="secao-bloco">
      <div class="secao-titulo">8. DA PROTEÇÃO DOS DADOS PESSOAIS</div>
      <p class="paragrafo-simples"><strong>8.1.</strong> As imagens, gravações e informações clínicas serão tratadas em conformidade com a Lei nº 13.709/2018 — Lei Geral de Proteção de Dados Pessoais (LGPD) — e demais normas aplicáveis.</p>
      <p class="paragrafo-simples"><strong>8.2.</strong> A profissional responsável deverá adotar medidas adequadas de proteção, segurança e confidencialidade.</p>
      <p class="paragrafo-simples"><strong>8.3.</strong> O compartilhamento de informações ficará limitado às finalidades autorizadas ou a outras hipóteses legalmente admitidas.</p>
      <p class="paragrafo-simples"><strong>8.4.</strong> O paciente poderá exercer os direitos previstos na legislação de proteção de dados pessoais.</p>
      <div class="bloco-destaque">
        <strong>Canal para solicitações relacionadas ao uso de imagens e dados pessoais (LGPD):</strong><br/>
        E-mail/Contato: <strong>${canalLgpd}</strong>
      </div>
    </div>

    <!-- 9. DA VIGÊNCIA -->
    <div class="secao-bloco">
      <div class="secao-titulo">9. DA VIGÊNCIA</div>
      <p class="paragrafo-simples"><strong>9.1.</strong> As autorizações facultativas permanecerão válidas até sua revogação, respeitados os princípios de necessidade, finalidade e demais requisitos legais aplicáveis.</p>
      <p class="paragrafo-simples"><strong>9.2.</strong> A existência de autorização não permite utilização indefinida quando não houver mais finalidade legítima ou fundamento legal para o tratamento dos dados.</p>
      <p class="paragrafo-simples"><strong>9.3.</strong> Qualquer nova finalidade não prevista neste termo dependerá de nova autorização específica, quando legalmente exigida.</p>
    </div>

    <!-- 10. DECLARAÇÃO FINAL DE CONSENTIMENTO -->
    <div class="secao-bloco">
      <div class="secao-titulo">10. DECLARAÇÃO FINAL DE CONSENTIMENTO</div>
      <p class="paragrafo-simples">Declaro que:</p>
      <ul style="margin: 4px 0 10px 18px; padding-left: 10px; font-size: 11.5px; line-height: 1.5;">
        <li>Recebi informações claras sobre a captação e o uso de minhas imagens e registros.</li>
        <li>Compreendi que as autorizações para ensino, ciência e publicidade são facultativas.</li>
        <li>Tive oportunidade de escolher separadamente as finalidades que autorizo.</li>
        <li>Sei que posso recusar todas as autorizações de divulgação sem prejuízo ao meu atendimento odontológico.</li>
        <li>Estou ciente das condições de revogação do consentimento.</li>
        <li>Compreendo que nenhuma publicação poderá contrariar as normas éticas e legais aplicáveis.</li>
        <li>Minha manifestação de vontade é livre, informada e específica.</li>
      </ul>
    </div>

    <!-- Data e Assinaturas -->
    <div style="margin-top: 26px; page-break-inside: avoid; break-inside: avoid;">
      <div style="text-align: right; font-style: italic; margin-bottom: 24px;">
        ${cidade}/AL, ${dataHojeExtenso}.
      </div>

      <div class="grid-assinaturas">
        <!-- PACIENTE / TITULAR DA IMAGEM -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaPaciente?.assinaturaData ? `
            <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${snapshot.assinaturaPaciente?.nome || paciente.nome}</div>
          <div class="assinatura-papel">Paciente / Titular da Imagem</div>
          <div class="assinatura-detalhes">${labelDocPaciente}: ${snapshot.assinaturaPaciente?.cpf || paciente.cpf}${temValorValido(snapshot.assinaturaPaciente?.rg) ? ` • RG: ${snapshot.assinaturaPaciente.rg}` : (temValorValido(paciente.rg) ? ` • RG: ${paciente.rg}` : '')}</div>
        </div>

        <!-- PROFISSIONAL RESPONSÁVEL -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaDentista?.assinaturaData ? `
            <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${dentistaNome}</div>
          <div class="assinatura-papel">Cirurgiã-Dentista — ${dentistaCro}</div>
          <div class="assinatura-detalhes">${labelDocClinica}: ${dentistaCpfCnpj}</div>
        </div>
      </div>

      ${termo.responsavelLegal?.nome ? `
        <!-- RESPONSÁVEL LEGAL — QUANDO APLICÁVEL -->
        <div class="campo-assinatura" style="margin-top: 24px; max-width: 320px; margin-left: auto; margin-right: auto;">
          <div style="height: 35px;"></div>
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${termo.responsavelLegal.nome}</div>
          <div class="assinatura-papel">Responsável Legal (${termo.responsavelLegal.vinculo || 'Grau de Parentesco'})</div>
          <div class="assinatura-detalhes">CPF: ${termo.responsavelLegal.cpf || 'Não informado'}</div>
        </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`;
};

/**
 * Gera o fragmento HTML do Termo de Uso de Imagem formatado especialmente
 * para ser anexado como seção/anexo oficial ao final do Contrato Odontológico.
 */
export const gerarFragmentoHtmlTermoUsoImagem = (snapshot: ContratoSnapshot, numeroAnexo = 'ANEXO'): string => {
  const paciente = snapshot.paciente || ({} as any);
  const clinica = snapshot.clinica || ({} as any);
  const termo = snapshot.termoUsoImagem || ({} as ContratoTermoUsoImagem);

  const cidade = clinica.cidade || 'Maceió';
  const dataHojeExtenso = formatarDataPorExtenso(new Date(snapshot.emitidoEm || new Date()), cidade);
  const tipoDocClinica = identificarTipoDocumento(clinica.cnpj);
  const labelDocClinica = tipoDocClinica === 'cpf' ? 'CPF' : 'CNPJ';
  const labelDocPaciente = identificarTipoDocumento(paciente.cpf) === 'cnpj' ? 'CNPJ' : 'CPF';

  const dentistaNome = clinica.dentistaResponsavel || 'Dra. Rosângela Santos Pereira';
  const dentistaCro = clinica.cro || 'CRO-AL 06267';
  const dentistaCpfCnpj = clinica.cnpj || '032.663.962-43';
  const enderecoProfissional = clinica.endereco && clinica.endereco !== 'Endereço da clínica'
    ? clinica.endereco
    : 'JTR — Edifício Espanha, Rua Comerciante José Pontes de Magalhães, nº 70, Sala 405, Jatiúca, Maceió/AL, CEP 57036-250';

  const canalLgpd = termo.canalContatoLgpd || clinica.email || clinica.telefone || 'contato@clinica.com';

  const optDidatico = termo.usoDidaticoCientifico !== false;
  const optPublicitario = termo.usoPublicitarioRedesSociais !== false;
  const optIdentificacao = termo.identificacaoFacialVoz || 'rosto_e_voz';
  const optDepoimentos = termo.depoimentos !== false;

  return `
  <!-- ANEXO: TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM, VOZ E REGISTROS ODONTOLÓGICOS -->
  <div style="page-break-before: always; margin-top: 36px; padding-top: 24px; border-top: 2px solid #059669;">
    <div style="background-color: #059669; color: #ffffff; padding: 5px 12px; font-weight: bold; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-radius: 3px; display: inline-block; margin-bottom: 12px;">
      Documento Integrante • ${numeroAnexo} (Autorização de Imagem e Voz)
    </div>
    
    <div class="titulo-principal" style="margin: 10px 0 16px;">
      <h2>TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM, VOZ E REGISTROS ODONTOLÓGICOS</h2>
      <p>Consentimento Livre, Informado e Específico • Lei nº 13.709/2018 (LGPD) e Normas Éticas do CFO</p>
    </div>

    <!-- 1. IDENTIFICAÇÃO DA PROFISSIONAL RESPONSÁVEL -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">1. IDENTIFICAÇÃO DA PROFISSIONAL RESPONSÁVEL</div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; border-radius: 4px; margin-bottom: 8px;">
        <strong>${dentistaNome}</strong> — Cirurgiã-Dentista, ${dentistaCro} • ${labelDocClinica}: ${dentistaCpfCnpj}<br/>
        <strong>Endereço profissional:</strong> ${enderecoProfissional}
      </div>
    </div>

    <!-- 2. IDENTIFICAÇÃO DO PACIENTE -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">2. IDENTIFICAÇÃO DO PACIENTE</div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; border-radius: 4px; margin-bottom: 8px;">
        <strong>Nome:</strong> ${paciente.nome} • <strong>${labelDocPaciente}:</strong> ${paciente.cpf}${temValorValido(paciente.rg) ? ` • <strong>RG:</strong> ${paciente.rg}` : ''}<br/>
        <strong>Data de Nasc.:</strong> ${paciente.dataNascimento || 'Não informada'} • <strong>Telefone:</strong> ${paciente.telefone || 'Não informado'} • <strong>E-mail:</strong> ${paciente.email || 'Não informado'}<br/>
        <strong>Endereço:</strong> ${paciente.endereco || 'Não informado'}
      </div>
    </div>

    <!-- 3. OBJETO DA AUTORIZAÇÃO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">3. OBJETO DA AUTORIZAÇÃO</div>
      <p class="paragrafo">
        Eu, paciente acima identificado(a), declaro que fui informado(a) sobre a possibilidade de captação e utilização de fotografias, vídeos, gravações de voz, imagens odontológicas e demais registros relacionados ao meu atendimento. Esses registros poderão incluir fotografias do rosto, sorriso, dentes e cavidade bucal, imagens do tratamento, registros de antes e depois, além de exames odontológicos.
      </p>
      <p class="paragrafo">
        Reconheço que as autorizações para utilização didática, científica e publicitária são <strong>facultativas e independentes</strong> da contratação do tratamento odontológico. Minha manifestação de vontade será registrada individualmente para cada finalidade descrita neste documento.
      </p>
    </div>

    <!-- 4. DAS FINALIDADES E AUTORIZAÇÕES -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">4. DAS FINALIDADES E AUTORIZAÇÕES</div>
      
      <p style="margin: 4px 0 2px; font-weight: bold; font-size: 11.5px;">A — REGISTROS CLÍNICOS E PRONTUÁRIO ODONTOLÓGICO</p>
      <p class="paragrafo">
        Declaro estar ciente de que registros fotográficos e exames clinicamente indicados poderão ser realizados para diagnóstico, planejamento, documentação e acompanhamento do tratamento odontológico, respeitadas as bases legais pertinentes. A documentação clínica <strong>não constitui autorização</strong> para divulgação pública das imagens.
      </p>

      <p style="margin: 6px 0 2px; font-weight: bold; font-size: 11.5px;">B — UTILIZAÇÃO DIDÁTICA E CIENTÍFICA</p>
      <p class="paragrafo">
        Autorizo a utilização de imagens e registros do meu caso clínico em atividades de ensino, aulas, palestras, cursos, congressos, conferências, artigos científicos e publicações técnicas, observadas as normas éticas e legais aplicáveis. Sempre que possível, os materiais deverão ser apresentados de modo a reduzir minha identificação.
      </p>
      <div style="margin: 4px 0 8px 10px; font-family: Arial, sans-serif; font-size: 11px;">
        <span style="font-weight: bold; margin-right: 14px;">(${optDidatico ? 'X' : '&nbsp;&nbsp;'}) AUTORIZO</span>
        <span style="font-weight: bold;">(${!optDidatico ? 'X' : '&nbsp;&nbsp;'}) NÃO AUTORIZO</span>
      </div>

      <p style="margin: 6px 0 2px; font-weight: bold; font-size: 11.5px;">C — DIVULGAÇÃO PUBLICITÁRIA E REDES SOCIAIS</p>
      <p class="paragrafo">
        Autorizo a utilização de imagens relacionadas ao meu tratamento em publicações profissionais da ${dentistaNome}, incluindo redes sociais, site profissional, portfólio e materiais institucionais, exclusivamente quando a divulgação estiver de acordo com as normas éticas odontológicas vigentes. A autorização não permite publicidade enganosa, divulgação de informações confidenciais desnecessárias ou utilização de imagens para finalidades distintas das aqui estabelecidas.
      </p>
      <div style="margin: 4px 0 8px 10px; font-family: Arial, sans-serif; font-size: 11px;">
        <span style="font-weight: bold; margin-right: 14px;">(${optPublicitario ? 'X' : '&nbsp;&nbsp;'}) AUTORIZO</span>
        <span style="font-weight: bold;">(${!optPublicitario ? 'X' : '&nbsp;&nbsp;'}) NÃO AUTORIZO</span>
      </div>

      <p style="margin: 6px 0 2px; font-weight: bold; font-size: 11.5px;">D — IDENTIFICAÇÃO FACIAL E UTILIZAÇÃO DA VOZ</p>
      <p class="paragrafo">Quanto à identificação pessoal nas imagens e gravações, declaro:</p>
      <div style="margin: 4px 0 8px 10px; font-family: Arial, sans-serif; font-size: 10.5px; line-height: 1.5;">
        <div>(${optIdentificacao === 'rosto_e_voz' ? 'X' : '&nbsp;&nbsp;'}) AUTORIZO a divulgação de imagens em que meu rosto possa ser reconhecido.</div>
        <div>(${optIdentificacao === 'apenas_voz' ? 'X' : '&nbsp;&nbsp;'}) AUTORIZO a divulgação de gravações contendo minha voz.</div>
        <div>(${optIdentificacao === 'apenas_bucal' ? 'X' : '&nbsp;&nbsp;'}) AUTORIZO apenas imagens da região bucal sem identificação facial direta.</div>
        <div>(${optIdentificacao === 'nao_autoriza_identificacao' ? 'X' : '&nbsp;&nbsp;'}) NÃO AUTORIZO a divulgação de imagens ou gravações que permitam minha identificação.</div>
      </div>

      <p style="margin: 6px 0 2px; font-weight: bold; font-size: 11.5px;">E — DEPOIMENTOS SOBRE O TRATAMENTO</p>
      <p class="paragrafo">
        Autorizo a captação e eventual divulgação de depoimentos voluntários relacionados à minha experiência de atendimento, exclusivamente quando sua utilização for permitida pelas normas profissionais e legais aplicáveis.
      </p>
      <div style="margin: 4px 0 8px 10px; font-family: Arial, sans-serif; font-size: 11px;">
        <span style="font-weight: bold; margin-right: 14px;">(${optDepoimentos ? 'X' : '&nbsp;&nbsp;'}) AUTORIZO</span>
        <span style="font-weight: bold;">(${!optDepoimentos ? 'X' : '&nbsp;&nbsp;'}) NÃO AUTORIZO</span>
      </div>
    </div>

    <!-- 5. DAS CONDIÇÕES DE UTILIZAÇÃO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">5. DAS CONDIÇÕES DE UTILIZAÇÃO</div>
      <p class="paragrafo">
        5.1. As imagens e gravações poderão ser utilizadas somente para as finalidades expressamente autorizadas pelo paciente.<br/>
        5.2. A captação e o tratamento dos materiais poderão ser realizados pela profissional responsável e por integrantes autorizados de sua equipe, observadas as obrigações de sigilo e segurança.<br/>
        5.3. A autorização não permite a comercialização independente das imagens, nem sua utilização por terceiros para finalidades não informadas.<br/>
        5.4. Eventuais ajustes de enquadramento, iluminação ou edição não poderão alterar de maneira enganosa a representação do caso clínico ou do resultado do tratamento.<br/>
        5.5. A divulgação deverá observar as normas éticas do Conselho Federal de Odontologia e demais regras legais aplicáveis, independentemente da autorização concedida pelo paciente.
      </p>
    </div>

    <!-- 6. DA GRATUIDADE E DA LIBERDADE DE ESCOLHA -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">6. DA GRATUIDADE E DA LIBERDADE DE ESCOLHA</div>
      <p class="paragrafo">
        6.1. A presente autorização, quando concedida, será gratuita, não gerando obrigação de remuneração ao paciente pelo uso autorizado de suas imagens ou voz.<br/>
        6.2. A recusa em autorizar a divulgação de imagens não acarretará prejuízo ao tratamento odontológico, alteração das condições contratuais ou restrição ao atendimento profissional.<br/>
        6.3. O paciente não será obrigado a participar de gravações publicitárias, fornecer depoimentos ou permitir a divulgação de sua identidade.<br/>
        6.4. Nenhuma autorização será presumida em razão do pagamento ou contratação do tratamento.
      </p>
    </div>

    <!-- 7. DA REVOGAÇÃO DO CONSENTIMENTO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">7. DA REVOGAÇÃO DO CONSENTIMENTO</div>
      <p class="paragrafo">
        7.1. O paciente poderá revogar as autorizações facultativas a qualquer momento, mediante solicitação à profissional responsável.<br/>
        7.2. A revogação não comprometerá a licitude dos tratamentos de dados realizados anteriormente com fundamento em consentimento válido.<br/>
        7.3. Recebida a solicitação, deverão ser interrompidas novas utilizações fundamentadas na autorização revogada e avaliadas as providências cabíveis quanto às publicações sob controle da profissional.<br/>
        7.4. Materiais já compartilhados por terceiros poderão apresentar limitações práticas de remoção, sem prejuízo dos direitos legalmente assegurados ao paciente.<br/>
        7.5. A revogação de autorização publicitária não implica eliminação automática de registros que devam ser conservados no prontuário odontológico.
      </p>
    </div>

    <!-- 8. DA PROTEÇÃO DOS DADOS PESSOAIS -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">8. DA PROTEÇÃO DOS DADOS PESSOAIS</div>
      <p class="paragrafo">
        8.1. As imagens, gravações e informações clínicas serão tratadas em conformidade com a Lei nº 13.709/2018 (LGPD) e demais normas aplicáveis.<br/>
        8.2. A profissional responsável deverá adotar medidas adequadas de proteção, segurança e confidencialidade.<br/>
        8.3. O compartilhamento de informações ficará limitado às finalidades autorizadas ou a outras hipóteses legalmente admitidas.<br/>
        8.4. O paciente poderá exercer os direitos previstos na legislação de proteção de dados pessoais.<br/>
        <strong>Canal para solicitações relacionadas ao uso de imagens e dados pessoais (LGPD):</strong> E-mail/Contato: <strong>${canalLgpd}</strong>
      </p>
    </div>

    <!-- 9. DA VIGÊNCIA -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">9. DA VIGÊNCIA</div>
      <p class="paragrafo">
        9.1. As autorizações facultativas permanecerão válidas até sua revogação, respeitados os princípios de necessidade, finalidade e demais requisitos legais aplicáveis.<br/>
        9.2. A existência de autorização não permite utilização indefinida quando não houver mais finalidade legítima ou fundamento legal para o tratamento dos dados.<br/>
        9.3. Qualquer nova finalidade não prevista neste termo dependerá de nova autorização específica, quando legalmente exigida.
      </p>
    </div>

    <!-- 10. DECLARAÇÃO FINAL DE CONSENTIMENTO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">10. DECLARAÇÃO FINAL DE CONSENTIMENTO</div>
      <p class="paragrafo">
        Declaro que recebi informações claras sobre a captação e o uso de minhas imagens e registros; compreendi que as autorizações para ensino, ciência e publicidade são facultativas; tive oportunidade de escolher separadamente as finalidades que autorizo; sei que posso recusar todas as autorizações de divulgação sem prejuízo ao meu atendimento; estou ciente das condições de revogação; compreendo que nenhuma publicação poderá contrariar as normas éticas e legais; e manifesto minha vontade de forma livre, informada e específica.
      </p>
    </div>

    <div style="margin-top: 20px; text-align: right; font-style: italic; font-size: 11.5px;">
      ${cidade}/AL, ${dataHojeExtenso}.
    </div>

    <div class="grid-assinaturas" style="margin-top: 20px;">
      <div class="campo-assinatura">
        ${snapshot.assinaturaPaciente?.assinaturaData ? `
          <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" />
        ` : '<div style="height: 45px;"></div>'}
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${snapshot.assinaturaPaciente?.nome || paciente.nome}</div>
        <div class="assinatura-papel">Paciente / Titular da Imagem</div>
        <div class="assinatura-detalhes">${labelDocPaciente}: ${snapshot.assinaturaPaciente?.cpf || paciente.cpf}${temValorValido(snapshot.assinaturaPaciente?.rg) ? ` • RG: ${snapshot.assinaturaPaciente.rg}` : (temValorValido(paciente.rg) ? ` • RG: ${paciente.rg}` : '')}</div>
      </div>
      <div class="campo-assinatura">
        ${snapshot.assinaturaDentista?.assinaturaData ? `
          <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
        ` : '<div style="height: 45px;"></div>'}
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${dentistaNome}</div>
        <div class="assinatura-papel">Cirurgiã-Dentista — ${dentistaCro}</div>
        <div class="assinatura-detalhes">${labelDocClinica}: ${dentistaCpfCnpj}</div>
      </div>
    </div>

    ${termo.responsavelLegal?.nome ? `
      <div class="campo-assinatura" style="margin-top: 20px; max-width: 320px; margin-left: auto; margin-right: auto;">
        <div style="height: 35px;"></div>
        <div class="linha-assinatura"></div>
        <div class="assinatura-nome">${termo.responsavelLegal.nome}</div>
        <div class="assinatura-papel">Responsável Legal (${termo.responsavelLegal.vinculo || 'Grau de Parentesco'})</div>
        <div class="assinatura-detalhes">CPF: ${termo.responsavelLegal.cpf || 'Não informado'}</div>
      </div>
    ` : ''}
  </div>
  `;
};

/**
 * Realiza o download direto do Termo de Uso de Imagem e Voz como arquivo PDF A4 avulso.
 */
export const downloadTermoUsoImagemPdf = async (snapshot?: ContratoSnapshot | null): Promise<boolean> => {
  if (!snapshot) return false;
  const html = gerarHtmlTermoUsoImagem(snapshot);
  const nomePaciente = (snapshot.paciente?.nome || 'paciente').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `termo_uso_imagem_${nomePaciente}_${snapshot.contratoId || 'doc'}.pdf`;
  return downloadHtmlAsPdf(html, filename);
};

import {
  ContratoSnapshot,
  formatarDataPorExtenso,
  isMetodoCartao,
  limparFormaPagamentoParaContrato,
} from './contratoEngine';
import { identificarTipoDocumento, temValorValido } from './documentoFormat';
import { formatMoney } from './exportCsv';
import { downloadHtmlAsPdf } from './pdfDownload';
import { gerarFragmentoHtmlTermoUsoImagem } from './termoUsoImagem';

/**
 * Gera o documento HTML oficial do Contrato Particular de Prestação de Serviços
 * Odontológicos para Tratamento Endodôntico (Tratamento de Canal), personalizado
 * para a Dra. Rosângela Santos Pereira, com suporte à identificação de cirurgião-dentista
 * parceiro executor e conformidade com o Código Civil, CDC, LGPD e normas do CFO.
 */
export const gerarHtmlContratoEndodontia = (snapshot: ContratoSnapshot): string => {
  const { paciente, clinica, orcamento, financeiro } = snapshot;
  const dadosEndo = snapshot.dadosEndodontia || ({} as any);

  const cidade = clinica.cidade || 'Maceió';
  const dataHojeExtenso = formatarDataPorExtenso(new Date(snapshot.emitidoEm || new Date()), cidade);
  const labelDocPaciente = identificarTipoDocumento(paciente.cpf) === 'cnpj' ? 'CNPJ' : 'CPF';

  // Dados da Dra. Rosângela Santos Pereira (Contratada Principal)
  const dentistaNomeContratada = 'Dra. Rosângela Santos Pereira';
  const dentistaCroContratada = 'CRO-AL 06267';
  const dentistaCpfContratada = '032.663.962-43';
  const enderecoProfissional = clinica?.endereco && clinica?.endereco !== 'Endereço da clínica'
    ? clinica.endereco
    : 'JTR — Edifício Espanha, Rua Comerciante José Pontes de Magalhães, nº 70, Sala 405, Jatiúca, Maceió/AL, CEP 57036-250';

  // Chave PIX oficial da Dra. Rosângela Santos Pereira
  const chavePixOficial = (clinica?.chavePix && typeof clinica.chavePix === 'string' && clinica.chavePix.includes('@'))
    ? clinica.chavePix
    : 'drarosesantosexpert@gmail.com';
  const titularPixOficial = 'Rosangela Santos Pereira';

  // Parceiro Executor: se houver parceiro selecionado e ativo
  const temParceiro = dadosEndo.executorTipo === 'parceiro' && !!dadosEndo.parceiro?.nome;
  const parceiro = dadosEndo.parceiro || ({} as any);

  // Dente(s) e procedimentos envolvidos
  const dentesDetectados = orcamento.itens
    ?.map((i) => i.denteOuRegiao)
    .filter(Boolean)
    .join(', ');
  const dentesTexto = dadosEndo.dentes || dentesDetectados || 'Elemento(s) dentário(s) indicado(s) no plano de tratamento';
  const procedimentosAprovadosTexto = dadosEndo.procedimentosAprovados ||
    orcamento.itens?.map((i) => `${i.nome} ${i.denteOuRegiao ? `(${i.denteOuRegiao})` : ''}`).join(', ') ||
    orcamento.titulo;

  const diagnosticoTexto = dadosEndo.diagnostico ||
    'Avaliação clínica e radiográfica inicial compatível com indicação de intervenção endodôntica (necrose pulpar / pulpite / lesão periapical)';
  const etapasTexto = dadosEndo.etapasPrevistas ||
    'Abertura coronária, localização e esvaziamento dos canais, instrumentação biomecânica, desinfecção, medicação intracanal quando indicada e obturação radicular hermética';
  const incluidosTexto = dadosEndo.procedimentosIncluidos ||
    'Anestesia local, odontometria, instrumentação química e mecânica dos canais radiculares, medicação intracanal curativa e obturação endodôntica';
  const naoIncluidosTexto = dadosEndo.procedimentosNaoIncluidos ||
    'Restauração definitiva em resina/inlay/onlay, coroa protética, núcleo/pino de fibra de vidro, clareamento dental e cirurgias parendodônticas não descritas no orçamento';

  // Tratamento de parcelas e datas de vencimento
  const parcelasSemEntrada = financeiro.parcelas.filter(
    (p) => !p.descricao?.toLowerCase().includes('entrada')
  );
  const temParcelas = parcelasSemEntrada.length > 0;
  const primeiroVencimento = temParcelas
    ? (isMetodoCartao(parcelasSemEntrada[0].metodo, parcelasSemEntrada[0].descricao)
        ? 'Fatura do Cartão'
        : parcelasSemEntrada[0].vencimento)
    : 'Na data da contratação / A combinar';
  const ultimoVencimento = temParcelas
    ? (isMetodoCartao(parcelasSemEntrada[parcelasSemEntrada.length - 1].metodo, parcelasSemEntrada[parcelasSemEntrada.length - 1].descricao)
        ? 'Fatura do Cartão'
        : parcelasSemEntrada[parcelasSemEntrada.length - 1].vencimento)
    : 'Na conclusão do tratamento / A combinar';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Contrato de Prestação de Serviços - Tratamento Endodôntico - ${paciente.nome}</title>
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
    .contrato-container {
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
    .titulo-principal h3 {
      font-size: 13px;
      margin: 0 0 4px;
      font-weight: bold;
      color: #0369a1;
      text-transform: uppercase;
    }
    .titulo-principal p {
      margin: 0;
      font-size: 11px;
      color: #4b5563;
      font-style: italic;
    }
    .clausula-bloco {
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .clausula-titulo {
      font-size: 12.5px;
      font-weight: bold;
      text-transform: uppercase;
      margin-bottom: 5px;
      color: #0f172a;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 2px;
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
    .grid-partes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .bloco-parte {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
    }
    .bloco-parte strong {
      color: #0f172a;
    }
    .bloco-executor {
      background-color: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid #16a34a;
      padding: 10px 14px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .tabela-financeira {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0 10px;
      font-family: Arial, sans-serif;
      font-size: 11px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .tabela-financeira th {
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      font-weight: bold;
      color: #334155;
    }
    .tabela-financeira td {
      border: 1px solid #cbd5e1;
      padding: 5px 8px;
    }
    .grid-assinaturas {
      display: grid;
      grid-template-columns: ${temParceiro ? '1fr 1fr 1fr' : '1fr 1fr'};
      gap: 16px;
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
      max-height: 50px;
      max-width: 180px;
      margin: 0 auto 3px;
      display: block;
    }
    .linha-assinatura {
      border-top: 1px solid #111827;
      margin: 6px 10px 4px;
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
      letter-spacing: 0.5px;
    }
    .assinatura-detalhes {
      font-size: 9px;
      color: #6b7280;
      margin-top: 1px;
    }
    .grid-testemunhas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 22px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .rodape-documento {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-family: Arial, sans-serif;
      font-size: 9.5px;
      color: #64748b;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    @media print {
      body { padding: 0; }
      .clausula-bloco { page-break-inside: avoid; break-inside: avoid; }
      .grid-assinaturas { page-break-inside: avoid; break-inside: avoid; }
      .grid-testemunhas { page-break-inside: avoid; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="contrato-container">
    <!-- Cabeçalho -->
    <div class="cabecalho">
      <div class="cabecalho-clinica">
        <h1>${clinica.nome || 'Dra. Rosângela Santos Pereira'}</h1>
        <p>Cirurgiã-Dentista • CRO: ${clinica.cro || dentistaCroContratada} • CPF: ${dentistaCpfContratada}</p>
        <p>${enderecoProfissional}</p>
      </div>
      ${clinica.logoUrl ? `
        <div class="cabecalho-logo">
          <img src="${clinica.logoUrl}" alt="Logo Clínica" />
        </div>
      ` : ''}
    </div>

    <!-- Título Oficial -->
    <div class="titulo-principal">
      <h2>CONTRATO PARTICULAR DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS</h2>
      <h3>TRATAMENTO ENDODÔNTICO — TRATAMENTO DE CANAL</h3>
      <p>Com possibilidade de execução por cirurgião-dentista parceiro cadastrado</p>
    </div>

    <!-- IDENTIFICAÇÃO DAS PARTES -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">IDENTIFICAÇÃO DAS PARTES</div>
      <div class="grid-partes">
        <!-- CONTRATADA -->
        <div class="bloco-parte">
          <strong style="text-transform: uppercase; color: #0369a1; display: block; margin-bottom: 3px;">CONTRATADA</strong>
          <strong>${dentistaNomeContratada}</strong><br/>
          Cirurgiã-Dentista — ${dentistaCroContratada}<br/>
          CPF: ${dentistaCpfContratada}<br/>
          Telefone/WhatsApp: ${clinica.telefone || 'Não informado'}<br/>
          Endereço profissional: ${enderecoProfissional}
        </div>

        <!-- CONTRATANTE - PACIENTE -->
        <div class="bloco-parte">
          <strong style="text-transform: uppercase; color: #0369a1; display: block; margin-bottom: 3px;">CONTRATANTE — PACIENTE</strong>
          <strong>Nome completo:</strong> ${paciente.nome}<br/>
          <strong>${labelDocPaciente}:</strong> ${paciente.cpf}${temValorValido(paciente.rg) ? ` • <strong>RG:</strong> ${paciente.rg}` : ''}<br/>
          ${temValorValido(paciente.estadoCivil) ? `<strong>Estado civil:</strong> ${paciente.estadoCivil}<br/>` : ''}
          ${temValorValido(paciente.profissao) ? `<strong>Profissão:</strong> ${paciente.profissao}<br/>` : ''}
          ${temValorValido(paciente.dataNascimento) ? `<strong>Data de nascimento:</strong> ${paciente.dataNascimento}<br/>` : ''}
          ${temValorValido(paciente.telefone) ? `<strong>Telefone/WhatsApp:</strong> ${paciente.telefone}<br/>` : ''}
          ${temValorValido(paciente.email) ? `<strong>E-mail:</strong> ${paciente.email}<br/>` : ''}
          <strong>Endereço completo:</strong> ${paciente.endereco || 'Não informado'}
        </div>
      </div>

      <!-- PROFISSIONAL EXECUTOR DO TRATAMENTO -->
      <div class="bloco-executor">
        <strong style="text-transform: uppercase; color: #15803d; display: block; margin-bottom: 3px;">
          PROFISSIONAL EXECUTOR DO TRATAMENTO
        </strong>
        ${temParceiro ? `
          <div>( ) Dra. Rosângela Santos Pereira — CRO-AL 06267</div>
          <div style="font-weight: bold; margin-top: 2px;">(X) Cirurgião-dentista parceiro cadastrado</div>
          <div style="margin-top: 4px; padding-left: 10px; border-left: 2px solid #16a34a;">
            <strong>Nome do parceiro executor:</strong> ${parceiro.nome}<br/>
            <strong>CRO/UF:</strong> ${parceiro.croUf || 'Inscrito no Conselho Regional de Odontologia'}<br/>
            ${parceiro.documento ? `<strong>CPF/CNPJ:</strong> ${parceiro.documento}<br/>` : ''}
            ${parceiro.especialidade ? `<strong>Especialidade:</strong> ${parceiro.especialidade}<br/>` : ''}
          </div>
        ` : `
          <div style="font-weight: bold;">(X) Dra. Rosângela Santos Pereira — CRO-AL 06267 (Cirurgiã-Dentista Responsável)</div>
          <div style="font-size: 10.5px; color: #4b5563; margin-top: 2px;">
            Tratamento com execução clínica direta realizada pela profissional responsável contratada.
          </div>
        `}
      </div>

      <p class="paragrafo-simples" style="font-style: italic; color: #374151;">
        As partes celebram o presente contrato, regido pelo Código Civil, pelo Código de Defesa do Consumidor e pelas normas éticas e profissionais aplicáveis.
      </p>
    </div>

    <!-- CLÁUSULA 1ª — DO OBJETO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 1ª — DO OBJETO</div>
      <p class="paragrafo">
        1.1. O presente contrato tem como objeto a prestação de serviços odontológicos destinados à realização de tratamento endodôntico, conhecido como tratamento de canal, conforme avaliação clínica, diagnóstico e orçamento aprovado nº <strong>${orcamento.numeroIdentificador || snapshot.contratoId}</strong>.
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; border-radius: 4px; margin: 6px 0 8px;">
        <div>• <strong>Dente(s):</strong> ${dentesTexto}</div>
        <div>• <strong>Procedimento(s) aprovado(s):</strong> ${procedimentosAprovadosTexto}</div>
        <div>• <strong>Diagnóstico:</strong> ${diagnosticoTexto}</div>
        <div>• <strong>Etapas previstas:</strong> ${etapasTexto}</div>
        <div>• <strong>Procedimentos incluídos:</strong> ${incluidosTexto}</div>
        <div>• <strong>Procedimentos não incluídos:</strong> ${naoIncluidosTexto}</div>
      </div>
      <p class="paragrafo">
        1.2. <strong>Esclarecimentos sobre o Procedimento:</strong> O Tratamento ou Retratamento Endodôntico (conhecido popularmente como "tratamento de canal") consiste na remoção da polpa dentária (nervoso/vasos sanguíneos) lesionada, inflamada ou infectada, ou na remoção do material obturador antigo nos casos de retratamento. Após a limpeza, modelagem e desinfecção dos canais radiculares, estes são preenchidos e selados com material biocompatível adequado. O objetivo do tratamento é eliminar a dor, a infecção e controlar a inflamação, permitindo a conservação do dente na cavidade bucal e evitando a sua extração.
      </p>
      <p class="paragrafo">
        1.3. O tratamento poderá envolver anestesia, abertura coronária, localização dos canais, limpeza, instrumentação, desinfecção, medicação intracanal quando indicada e obturação dos canais radiculares.
      </p>
      <p class="paragrafo">
        1.4. A quantidade de sessões dependerá da avaliação clínica, da complexidade anatômica, da presença de infecção e da evolução do caso.
      </p>
      <p class="paragrafo">
        1.5. A realização de procedimentos adicionais não previstos no orçamento dependerá de informação e autorização prévias do paciente, ressalvadas as hipóteses legalmente admitidas.
      </p>
    </div>

    <!-- CLÁUSULA 2ª — DO PROFISSIONAL PARCEIRO EXECUTOR -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 2ª — DO PROFISSIONAL PARCEIRO EXECUTOR</div>
      <p class="paragrafo">
        2.1. Quando houver seleção de cirurgião-dentista parceiro, o(a) <strong>CONTRATANTE</strong> será informado(a) sobre sua identificação e seu registro profissional antes da realização do procedimento.
      </p>
      <p class="paragrafo">
        2.2. O profissional parceiro identificado neste contrato ficará responsável pela execução dos atos clínicos que efetivamente praticar, observadas as normas técnicas, éticas e legais pertinentes.
      </p>
      <p class="paragrafo">
        2.3. A participação de profissional parceiro não implica exclusão automática das responsabilidades legais da <strong>CONTRATADA</strong>, que serão determinadas conforme a relação contratual e as circunstâncias da prestação do serviço.
      </p>
      <p class="paragrafo">
        2.4. A eventual substituição do profissional executor deverá ser comunicada ao paciente antes do atendimento e registrada na documentação clínica, com atualização do consentimento quando necessária.
      </p>
      <p class="paragrafo">
        2.5. A designação do parceiro não autoriza alterações unilaterais no preço, no tratamento ou nas condições financeiras aprovadas.
      </p>
      <p class="paragrafo">
        2.6. Caso a contratação e o recebimento dos honorários sejam realizados diretamente pelo parceiro, deverá ser utilizado instrumento contratual compatível com essa relação, devidamente identificado e aceito pelo paciente.
      </p>
      ${!temParceiro ? `
        <p class="paragrafo" style="font-style: italic; color: #4b5563;">
          Parágrafo Único: Não havendo designação de parceiro externo para o presente plano, a execução técnica do tratamento endodôntico será conduzida diretamente pela Cirurgiã-Dentista CONTRATADA, Dra. Rosângela Santos Pereira.
        </p>
      ` : ''}
    </div>

    <!-- CLÁUSULA 3ª — DO VALOR TOTAL -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 3ª — DO VALOR TOTAL</div>
      <p class="paragrafo">
        3.1. O valor total do tratamento será aquele constante do orçamento aprovado e da negociação financeira aceita pelo(a) <strong>CONTRATANTE</strong>:
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 11px; border-radius: 4px; margin: 4px 0 6px;">
        <strong>Valor total contratado:</strong> ${formatMoney(financeiro.total)} (<em>${financeiro.totalExtenso}</em>)
      </div>
      <p class="paragrafo">
        3.2. O valor compreenderá somente os procedimentos expressamente incluídos no orçamento.
      </p>
      <p class="paragrafo">
        3.3. Restaurações definitivas, coroas, pinos, reconstruções ou outros procedimentos complementares deverão estar discriminados no orçamento para serem considerados incluídos.
      </p>
      <p class="paragrafo">
        3.4. Eventuais custos adicionais dependerão de orçamento e aprovação prévios, quando aplicáveis.
      </p>
    </div>

    <!-- CLÁUSULA 4ª — DA FORMA DE PAGAMENTO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 4ª — DA FORMA DE PAGAMENTO</div>
      <p class="paragrafo">
        4.1. O pagamento será realizado conforme a negociação financeira aprovada pelo paciente:
      </p>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; border-radius: 4px; margin: 4px 0 6px;">
        • <strong>Modalidade acordada:</strong> ${limparFormaPagamentoParaContrato(financeiro.formaPagamento)}<br/>
        • <strong>Valor total:</strong> ${formatMoney(financeiro.total)}<br/>
        • <strong>Entrada, quando aplicável:</strong> ${financeiro.entrada > 0 ? formatMoney(financeiro.entrada) : 'Não aplicável (sem entrada)'}<br/>
        • <strong>Quantidade de parcelas:</strong> ${financeiro.quantidadeParcelas}x<br/>
        • <strong>Valor das parcelas:</strong> ${formatMoney(financeiro.valorParcela)}<br/>
        • <strong>Primeiro vencimento:</strong> ${primeiroVencimento}<br/>
        • <strong>Último vencimento:</strong> ${ultimoVencimento}
      </div>
      <p class="paragrafo">
        4.2. Quando o pagamento for realizado via PIX, serão utilizados os seguintes dados oficiais da clínica:
      </p>
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px 12px; font-family: Arial, sans-serif; font-size: 11px; border-radius: 4px; margin: 4px 0 6px;">
        Chave PIX: <strong>${chavePixOficial}</strong><br/>
        Titular: <strong>${titularPixOficial}</strong>
      </div>
      <p class="paragrafo">
        4.3. O pagamento via PIX será considerado efetuado após confirmação do crédito na conta indicada.
      </p>
      <p class="paragrafo">
        4.4. O sistema deverá apresentar somente as condições financeiras efetivamente negociadas e aprovadas, sem presumir parcelamento em dez meses quando a negociação for diferente.
      </p>
      <p class="paragrafo">
        4.5. O orçamento aprovado e o cronograma de pagamentos integrarão este contrato.
      </p>
    </div>

    <!-- CLÁUSULA 5ª — DO CRONOGRAMA FINANCEIRO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 5ª — DO CRONOGRAMA FINANCEIRO</div>
      <p class="paragrafo">
        O pagamento observará o seguinte cronograma discriminado:
      </p>
      <table class="tabela-financeira">
        <thead>
          <tr>
            <th style="width: 12%;">Parcela</th>
            <th style="width: 32%;">Descrição / Forma</th>
            <th style="width: 22%;">Vencimento</th>
            <th style="width: 18%;">Valor</th>
            <th style="width: 16%;">Situação</th>
          </tr>
        </thead>
        <tbody>
          ${financeiro.parcelas && financeiro.parcelas.length > 0 ? financeiro.parcelas.map((p) => `
            <tr>
              <td><strong>${p.numero === 0 ? 'Entrada' : `${p.numero}ª`}</strong></td>
              <td>${limparFormaPagamentoParaContrato(p.descricao || (p.numero === 0 ? 'Entrada' : `Parcela ${p.numero}`))}</td>
              <td>${isMetodoCartao(p.metodo, p.descricao) ? 'Fatura do Cartão' : p.vencimento}</td>
              <td><strong>${formatMoney(p.valor)}</strong></td>
              <td><span style="font-size: 10px; color: ${p.status === 'Quitada' ? '#15803d' : '#334155'};">${p.status || 'A vencer'}</span></td>
            </tr>
          `).join('') : `
            <tr>
              <td><strong>Única</strong></td>
              <td>${limparFormaPagamentoParaContrato(financeiro.formaPagamento)}</td>
              <td>À vista / Na contratação</td>
              <td><strong>${formatMoney(financeiro.total)}</strong></td>
              <td>A vencer</td>
            </tr>
          `}
        </tbody>
      </table>
      <p class="paragrafo">
        5.1. O cronograma discrimina todas as parcelas, valores e vencimentos efetivamente aprovados.
      </p>
      <p class="paragrafo">
        5.2. A soma da entrada e das parcelas corresponde rigorosamente ao valor total negociado.
      </p>
      <p class="paragrafo">
        5.3. A <strong>CONTRATADA</strong> fornecerá recibos ou comprovantes dos pagamentos realizados, conforme cabível.
      </p>
    </div>

    <!-- CLÁUSULA 6ª — DO INÍCIO E DA EXECUÇÃO DO TRATAMENTO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 6ª — DO INÍCIO E DA EXECUÇÃO DO TRATAMENTO</div>
      <p class="paragrafo">
        6.1. O tratamento endodôntico será realizado conforme a indicação clínica e o agendamento acordado entre as partes.
      </p>
      <p class="paragrafo">
        6.2. O início do procedimento dependerá de avaliação clínica, consentimento informado e condições adequadas de atendimento.
      </p>
      <p class="paragrafo">
        6.3. As condições de pagamento ou eventual exigência de quitação prévia deverão estar expressamente identificadas no orçamento e na negociação aprovada.
      </p>
      <p class="paragrafo" style="background-color: #fefce8; border-left: 3px solid #ca8a04; padding: 4px 8px; font-family: Arial, sans-serif; font-size: 11px;">
        <strong>6.4.</strong> Em razão da natureza do tratamento endodôntico, situações de dor, infecção ou urgência deverão ser avaliadas segundo critérios clínicos e obrigações éticas e legais, sem imposição de adiamento que comprometa indevidamente a saúde do paciente.
      </p>
      <p class="paragrafo">
        6.5. A <strong>CONTRATADA</strong> ou o profissional executor deverá informar ao paciente a necessidade de etapas adicionais, retornos e acompanhamento.
      </p>
    </div>

    <!-- CLÁUSULA 7ª — DOS RISCOS, LIMITAÇÕES E INTERCORRÊNCIAS -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 7ª — DOS RISCOS, LIMITAÇÕES E INTERCORRÊNCIAS</div>
      <p class="paragrafo">
        7.1. O(A) <strong>CONTRATANTE / PACIENTE</strong> declara que foi devidamente informado(a) de que a Endodontia é uma especialidade complexa e que, apesar de todo o rigor técnico e científico do profissional, existem riscos e complicações inerentes ao procedimento, tais como:
      </p>
      <ul style="margin: 4px 0 8px 18px; padding-left: 10px; font-size: 11.5px; line-height: 1.5;">
        <li><strong>Dor, inchaço ou desconforto pós-operatório:</strong> Podem ocorrer nos dias subsequentes ao tratamento e exigirão o uso de medicações analgésicas, anti-inflamatórias ou antibióticas prescritas pelo cirurgião-dentista;</li>
        <li><strong>Anatomia atípica ou canais calcificados/curvos:</strong> Podem dificultar ou impedir o alcance total do ápice radicular;</li>
        <li><strong>Fratura de instrumentos:</strong> Pela extrema delicadeza das limas endodônticas, pode ocorrer fratura de instrumento no interior do canal. Nestes casos, o profissional avaliará a possibilidade de remoção, ultrapassagem ou sepultamento do fragmento sem prejuízo à saúde do dente;</li>
        <li><strong>Perfuração radicular ou furcal:</strong> Ocorrência acidental que pode necessitar de selamento com materiais especiais (ex: MTA) ou procedimentos adicionais;</li>
        <li><strong>Perfuração/Extravasamento acidental de soluções irrigadoras ou material obturador:</strong> Pode gerar desconforto ou queimor temporário nos tecidos periapicais;</li>
        <li><strong>Abertura ou reabsorção apical prévia:</strong> Pode dificultar a delimitação do comprimento de trabalho correto;</li>
        <li><strong>Necessidade de complementação cirúrgica ou extração:</strong> Caso o organismo não responda satisfatoriamente ao tratamento e persista a infecção/lesão, pode ser necessária a realização de cirurgia parendodôntica ou, em último caso, a exodontia (extração) do dente.</li>
      </ul>
      <p class="paragrafo">
        7.2. A ocorrência de intercorrência não caracteriza automaticamente falha profissional, devendo cada situação ser avaliada segundo as circunstâncias e os cuidados efetivamente prestados.
      </p>
      <p class="paragrafo">
        7.3. O profissional compromete-se a atuar com diligência e observância das normas técnicas aplicáveis, permanecendo preservados os direitos legais do paciente.
      </p>
      <p class="paragrafo">
        7.4. O detalhamento individualizado dos riscos, alternativas e prognóstico integra também o Termo de Consentimento Livre e Esclarecido (TCLE) específico para Endodontia.
      </p>
    </div>

    <!-- CLÁUSULA 8ª — DA RESTAURAÇÃO DEFINITIVA -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 8ª — DA RESTAURAÇÃO DEFINITIVA</div>
      <p class="paragrafo">
        8.1. O paciente é expressamente informado de que, após a conclusão do tratamento de canal, é <strong>imprescindível</strong> a realização de restauração definitiva, reconstrução, coroa protética ou outro procedimento reabilitador para vedamento coronário hermético.
      </p>
      <div style="background-color: #fef2f2; border: 1.5px solid #ef4444; border-left: 5px solid #b91c1c; padding: 10px 14px; margin: 8px 0 10px; border-radius: 4px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #7f1d1d;">
        <strong style="display: block; font-size: 11.5px; color: #991b1b; margin-bottom: 4px; text-transform: uppercase;">
          ⚠ ALERTA EXTREMAMENTE IMPORTANTE: RESTAURAÇÃO DEFINITIVA PÓS-TRATAMENTO
        </strong>
        O tratamento de canal <strong>NÃO</strong> deixa o dente pronto e protegido definitivamente. Após a conclusão do canal, o dente torna-se mais frágil e <strong>DEVE</strong> receber uma restauração definitiva ou prótese (coroa/pino) no prazo máximo recomendado pelo dentista (idealmente até 15 a 30 dias). A não realização da restauração final pode acarretar infiltração bacteriana, reinfecção do canal, fratura dental e perda do dente.
      </div>
      <p class="paragrafo">
        8.2. A ausência de restauração definitiva adequada no prazo de 15 a 30 dias compromete irreversivelmente a proteção do dente tratado e eleva expressivamente os riscos de recontaminação bacteriana por infiltração coronária ou fratura da raiz.
      </p>
      <p class="paragrafo">
        8.3. A restauração definitiva somente será considerada incluída no preço do tratamento endodôntico quando expressamente prevista e discriminada no orçamento aprovado.
      </p>
      <p class="paragrafo">
        8.4. Caso não esteja incluída, a <strong>CONTRATADA</strong> orientará o paciente sobre a necessidade de continuidade do tratamento e apresentará orçamento separado correspondente.
      </p>
    </div>

    <!-- CLÁUSULA 9ª — DAS OBRIGAÇÕES DA CONTRATADA E DO EXECUTOR -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 9ª — DAS OBRIGAÇÕES DA CONTRATADA E DO EXECUTOR</div>
      <p class="paragrafo">9.1. Prestar assistência odontológica conforme as normas técnicas, éticas e legais aplicáveis.</p>
      <p class="paragrafo">9.2. Informar o paciente sobre o diagnóstico, a proposta terapêutica, os riscos relevantes e as alternativas disponíveis.</p>
      <p class="paragrafo">9.3. Manter os registros clínicos dos procedimentos efetivamente realizados e identificar os profissionais responsáveis por cada atendimento.</p>
      <p class="paragrafo">9.4. Comunicar intercorrências relevantes e orientar o paciente quanto aos cuidados necessários pós-operatórios.</p>
      <p class="paragrafo">9.5. Observar as normas de proteção de dados pessoais (LGPD) e de sigilo profissional odontológico.</p>
      <p class="paragrafo">9.6. A participação do profissional parceiro deverá ser devidamente registrada no prontuário, sem afastar responsabilidades legais que possam caber às partes envolvidas.</p>
    </div>

    <!-- CLÁUSULA 10ª — DOS DEVERES E COMPROMISSOS DO PACIENTE -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 10ª — DOS DEVERES E COMPROMISSOS DO PACIENTE</div>
      <p class="paragrafo">Para a segurança, êxito do tratamento e preservação do elemento dentário tratado, o(a) <strong>CONTRATANTE / PACIENTE</strong> compromete-se expressamente a:</p>
      <ul style="margin: 4px 0 8px 18px; padding-left: 10px; font-size: 11.5px; line-height: 1.5;">
        <li>Comparecer a todas as consultas agendadas até a conclusão do tratamento;</li>
        <li>Informar com precisão todo o seu histórico de saúde, alergias, medicações em uso e condições de gravidez;</li>
        <li>Seguir rigorosamente as orientações pós-operatórias e tomar as medicações prescritas nos horários corretos;</li>
        <li>Procurar o dentista imediatamente caso perceba inchaço acentuado, dor persistente ou soltura do curativo temporário;</li>
        <li>Realizar a restauração definitiva ou prótese no prazo recomendado pelo profissional (idealmente em até 15 a 30 dias);</li>
        <li>Cumprir pontualmente as obrigações financeiras validamente pactuadas neste instrumento.</li>
      </ul>
    </div>

    <!-- CLÁUSULA 11ª — DA INADIMPLÊNCIA -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 11ª — DA INADIMPLÊNCIA</div>
      <p class="paragrafo">
        11.1. O atraso no pagamento de parcelas poderá gerar multa moratória de 2% (dois por cento) sobre a parcela vencida, além de juros convencionais de 1% (um por cento) ao mês, calculados proporcionalmente aos dias de atraso, observados os limites legais aplicáveis.
      </p>
      <p class="paragrafo">
        11.2. A <strong>CONTRATADA</strong> poderá realizar cobrança extrajudicial ou judicial de obrigações legítimas, vencidas e exigíveis.
      </p>
      <p class="paragrafo">
        11.3. Quando cumpridos os requisitos legais, poderá haver encaminhamento de débito legítimo aos órgãos de proteção ao crédito, observadas as regras de comunicação prévia e proteção de dados.
      </p>
      <p class="paragrafo">
        11.4. A cobrança não poderá expor o paciente a constrangimento, ameaça ou divulgação indevida de informações clínicas.
      </p>
      <p class="paragrafo">
        11.5. A inadimplência não autoriza a interrupção insegura de tratamento clínico já iniciado, devendo ser respeitadas as obrigações éticas profissionais e a continuidade assistencial cabível.
      </p>
    </div>

    <!-- CLÁUSULA 12ª — DA DESISTÊNCIA E DA RESCISÃO CONTRATUAL -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 12ª — DA DESISTÊNCIA E DA RESCISÃO CONTRATUAL</div>
      <p class="paragrafo">
        12.1. O paciente poderá solicitar o cancelamento mediante comunicação formal à <strong>CONTRATADA</strong>.
      </p>
      <p class="paragrafo">
        12.2. Em caso de desistência voluntária e injustificada, poderá ser aplicada multa compensatória contratualmente prevista de 25% (vinte e cinco por cento) sobre o valor total contratado, limitada ao montante efetivamente pago, desde que sua aplicação seja legalmente admissível e proporcional às circunstâncias do caso.
      </p>
      <p class="paragrafo">
        12.3. A multa não será aplicada automaticamente nem poderá produzir resultado abusivo ou manifestamente excessivo.
      </p>
      <p class="paragrafo">
        12.4. Serviços efetivamente realizados e despesas específicas comprovadas poderão ser considerados no acerto financeiro, vedada cobrança em duplicidade pelos mesmos fatos.
      </p>
      <p class="paragrafo">
        12.5. A <strong>CONTRATADA</strong> deverá fornecer demonstrativo discriminado dos valores pagos, serviços realizados e eventuais quantias a restituir.
      </p>
      <p class="paragrafo">
        12.6. Serão respeitados o direito de arrependimento, quando aplicável, e os demais direitos previstos no Código de Defesa do Consumidor.
      </p>
      <p class="paragrafo">
        12.7. A desistência ou rescisão durante um tratamento já iniciado deverá considerar a segurança do paciente, as orientações necessárias e as responsabilidades profissionais aplicáveis.
      </p>
    </div>

    <!-- CLÁUSULA 13ª — DO CONSENTIMENTO LIVRE E ESCLARECIDO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 13ª — DO CONSENTIMENTO LIVRE E ESCLARECIDO</div>
      <p class="paragrafo">
        13.1. Antes da execução do tratamento de canal, deverá ser apresentado ao paciente Termo de Consentimento Livre e Esclarecido específico para o procedimento.
      </p>
      <p class="paragrafo">
        13.2. O termo deverá identificar o profissional executor, o dente a ser tratado, as informações clínicas relevantes, os riscos, as alternativas e as limitações do tratamento.
      </p>
      <p class="paragrafo">
        13.3. A assinatura deste contrato não substitui o consentimento clínico informado.
      </p>
      <p class="paragrafo">
        13.4. A alteração relevante do planejamento ou do profissional executor deverá ser comunicada ao paciente e documentada conforme necessário.
      </p>
    </div>

    <!-- CLÁUSULA 14ª — DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 14ª — DA CONFIDENCIALIDADE E PROTEÇÃO DE DADOS</div>
      <p class="paragrafo">
        14.1. Os dados pessoais e clínicos serão tratados conforme a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018) e as demais normas aplicáveis.
      </p>
      <p class="paragrafo">
        14.2. A <strong>CONTRATADA</strong> e os profissionais envolvidos deverão observar o sigilo profissional e utilizar as informações para finalidades legítimas relacionadas ao atendimento e à gestão contratual.
      </p>
      <p class="paragrafo">
        14.3. A divulgação publicitária de imagens do paciente dependerá de autorização específica e cumprimento das regras éticas odontológicas.
      </p>
    </div>

    <!-- CLÁUSULA 15ª — DA DOCUMENTAÇÃO E DOS ANEXOS -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 15ª — DA DOCUMENTAÇÃO E DOS ANEXOS</div>
      <p class="paragrafo">
        15.1. Poderão integrar este contrato:
      </p>
      <div style="margin: 4px 0 6px 18px; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5;">
        • Anexo I — Orçamento odontológico aprovado.<br/>
        • Anexo II — Cronograma financeiro negociado.<br/>
        • Anexo III — Termo de Consentimento Livre e Esclarecido para Tratamento de Canal (TCLE).<br/>
        • Anexo IV — Planejamento clínico e identificação dos dentes.<br/>
        • Anexo V — Eventuais aditivos, renegociações ou acertos financeiros.<br/>
        ${snapshot.termoUsoImagem?.autorizado ? '• Anexo VI — Termo de Autorização de Uso de Imagem e Voz.<br/>' : ''}
      </div>
      <p class="paragrafo">
        15.2. Cada documento deverá ser vinculado ao paciente e ao respectivo tratamento, preservando-se as versões emitidas e assinadas.
      </p>
    </div>

    <!-- CLÁUSULA 16ª — DAS DISPOSIÇÕES GERAIS -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 16ª — DAS DISPOSIÇÕES GERAIS</div>
      <p class="paragrafo">16.1. O contrato será interpretado segundo os princípios da boa-fé, transparência e equilíbrio contratual.</p>
      <p class="paragrafo">16.2. Alterações de valores, procedimentos, condições financeiras ou profissional executor deverão ser documentadas quando relevantes.</p>
      <p class="paragrafo">16.3. Nenhuma cláusula poderá ser interpretada como exclusão dos direitos legalmente assegurados ao consumidor.</p>
      <p class="paragrafo">16.4. Eventuais controvérsias poderão ser tratadas administrativamente ou pelos meios judiciais cabíveis.</p>
    </div>

    <!-- CLÁUSULA 17ª — DO FORO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">CLÁUSULA 17ª — DO FORO</div>
      <p class="paragrafo">
        17.1. Fica indicado o Foro da Comarca de <strong>Maceió, Estado de Alagoas</strong>, ressalvado o direito do consumidor de utilizar outro foro legalmente competente.
      </p>
    </div>

    <!-- DECLARAÇÃO DE CONSENTIMENTO E AUTORIZAÇÃO -->
    <div class="clausula-bloco">
      <div class="clausula-titulo">DECLARAÇÃO DE CONSENTIMENTO E AUTORIZAÇÃO</div>
      <p class="paragrafo">
        Declaro que li (ou foi lido para mim) e compreendi perfeitamente todas as informações contidas neste termo. Tive a oportunidade de fazer perguntas, esclarecer todas as minhas dúvidas com o cirurgião-dentista e fui informado(a) sobre as alternativas de tratamento (incluindo a extração do dente). Compreendo que na odontologia não é possível garantir 100% de sucesso em tratamentos biológicos, mas que o profissional empregará os melhores recursos e técnicas disponíveis. Assim, de livre e esclarecida vontade, AUTORIZO a realização do tratamento endodôntico no(s) dente(s) indicado(s), bem como a aplicação de anestesia local e a tomada de radiografias/exames necessários.
      </p>
      <p class="paragrafo-simples" style="font-size: 11px; color: #475569; margin-top: 6px;">
        Declaro ainda estar ciente de que o tratamento de canal poderá ser realizado pela Dra. Rosângela Santos Pereira ou pelo profissional parceiro identificado neste instrumento, conforme avaliação técnica, e que as condições financeiras pactuadas seguirão rigorosamente o orçamento aprovado.
      </p>
    </div>

    <!-- Data e Assinaturas -->
    <div style="margin-top: 24px; page-break-inside: avoid; break-inside: avoid;">
      <div style="text-align: right; font-style: italic; margin-bottom: 20px;">
        Maceió/AL, ${dataHojeExtenso}.
      </div>

      <div class="grid-assinaturas">
        <!-- PACIENTE -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaPaciente?.assinaturaData ? `
            <img src="${snapshot.assinaturaPaciente.assinaturaData}" alt="Assinatura Paciente" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${snapshot.assinaturaPaciente?.nome || paciente.nome}</div>
          <div class="assinatura-papel">Contratante / Paciente</div>
          <div class="assinatura-detalhes">${labelDocPaciente}: ${snapshot.assinaturaPaciente?.cpf || paciente.cpf}${temValorValido(snapshot.assinaturaPaciente?.rg) ? ` • RG: ${snapshot.assinaturaPaciente.rg}` : (temValorValido(paciente.rg) ? ` • RG: ${paciente.rg}` : '')}</div>
        </div>

        <!-- CONTRATADA (DRA. ROSÂNGELA) -->
        <div class="campo-assinatura">
          ${snapshot.assinaturaDentista?.assinaturaData ? `
            <img src="${snapshot.assinaturaDentista.assinaturaData}" alt="Assinatura Dentista" />
          ` : '<div style="height: 45px;"></div>'}
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">${dentistaNomeContratada}</div>
          <div class="assinatura-papel">Contratada — Cirurgiã-Dentista</div>
          <div class="assinatura-detalhes">${dentistaCroContratada} • CPF: ${dentistaCpfContratada}</div>
          ${snapshot.assinaturaDentista?.dataHora ? `
            <div class="assinatura-detalhes" style="color: #059669; font-weight: 500;">✓ Assinado digitalmente em ${new Date(snapshot.assinaturaDentista.dataHora).toLocaleString('pt-BR')}</div>
          ` : ''}
        </div>

        <!-- PROFISSIONAL PARCEIRO EXECUTOR (QUANDO APLICÁVEL) -->
        ${temParceiro ? `
          <div class="campo-assinatura">
            <div style="height: 45px;"></div>
            <div class="linha-assinatura"></div>
            <div class="assinatura-nome">${parceiro.nome}</div>
            <div class="assinatura-papel">Cirurgião-Dentista Executor Parceiro</div>
            <div class="assinatura-detalhes">${parceiro.croUf ? `CRO: ${parceiro.croUf}` : 'Registro CRO ativo'}</div>
          </div>
        ` : ''}
      </div>

      <!-- Testemunhas -->
      <div class="grid-testemunhas">
        <div class="campo-assinatura">
          <div style="height: 35px;"></div>
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">Testemunha 1</div>
          <div class="assinatura-detalhes">Nome: ________________________ • CPF: _______________</div>
        </div>
        <div class="campo-assinatura">
          <div style="height: 35px;"></div>
          <div class="linha-assinatura"></div>
          <div class="assinatura-nome">Testemunha 2</div>
          <div class="assinatura-detalhes">Nome: ________________________ • CPF: _______________</div>
        </div>
      </div>
    </div>

    ${snapshot.termoUsoImagem?.autorizado === true ? `
      ${gerarFragmentoHtmlTermoUsoImagem(snapshot, 'ANEXO (Uso de Imagem e Voz)')}
    ` : ''}

    <!-- Rodapé -->
    <div class="rodape-documento">
      Documento emitido eletronicamente pelo Sistema Odontológico • Identificador Imutável: ${snapshot.contratoId} • Emitido em: ${new Date(snapshot.emitidoEm).toLocaleString('pt-BR')}
    </div>
  </div>
</body>
</html>`;
};

/**
 * Realiza o download direto do Contrato de Endodontia como arquivo PDF A4 avulso.
 */
export const downloadContratoEndodontiaPdf = async (snapshot?: ContratoSnapshot | null): Promise<boolean> => {
  if (!snapshot) return false;
  const html = gerarHtmlContratoEndodontia(snapshot);
  const nomePaciente = (snapshot.paciente?.nome || 'paciente').toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `contrato_endodontia_${nomePaciente}_${snapshot.contratoId || 'doc'}.pdf`;
  return downloadHtmlAsPdf(html, filename);
};

export { gerarHtmlTcleEndodontia, downloadTcleEndodontiaPdf } from './tcleEndodontia';


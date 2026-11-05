import fs from 'node:fs';
import path from 'node:path';

// 1. Atualizar useConfiguracoesContrato.ts
const pathHook = path.join(process.cwd(), 'src', 'hooks', 'useConfiguracoesContrato.ts');
let contentHook = fs.readFileSync(pathHook, 'utf-8');

const oldDefault = `export const getDefaultConfigContrato = (configGerais?: any): ConfiguracoesContrato => {
  return {
    chavePix: configGerais?.telefone || '82974002213',
    tipoChavePix: 'telefone',
    favorecidoPix: configGerais?.nomeClinica || 'Dra. Rosangela Santos',
    cnpjCpfFavorecidoPix: configGerais?.cnpj || '032.663.962-43',
    bancoPix: '',
    instrucoesPix:
      'O(A) CONTRATANTE poderá utilizar a câmera do smartphone para leitura do QR Code acima ou efetuar a transferência direta para a chave informada, encaminhando o comprovante para confirmação da baixa da parcela.',

    nomeClinicaContrato: configGerais?.nomeClinica || 'DRA. ROSANGELA SANTOS',
    cnpjClinicaContrato: configGerais?.cnpj || '032.663.962-43',
    croResponsavelContrato: configGerais?.croResponsavel || '06267-AL',
    dentistaResponsavelContrato: configGerais?.dentistaResponsavel || 'Dra. Rosangela Santos',
    enderecoContrato:
      configGerais?.endereco ||
      'JTR - Edificio Espanha - R. Comerc. José Pontes de Magalhães, 70 - Sl 405 - Jatiúca, Maceió - AL, 57036-250',
    telefoneContrato: configGerais?.telefone || '82974002213',
    emailContrato: configGerais?.email || 'drarosesantosexpert@gmail.com',
    cidadeForoContrato: 'Maceió - AL',

    multaAtrasoPercentual: 2,
    jurosMoraPercentual: 1,
    clausulaEspecialPadrao: '',

    assinaturaPadraoDentista: '',
    autoAssinarContrato: true,
  };
};`;

const newDefault = `export const getDefaultConfigContrato = (configGerais?: any): ConfiguracoesContrato => {
  return {
    chavePix: configGerais?.cnpj || '12345678000190',
    tipoChavePix: 'cnpj',
    favorecidoPix: configGerais?.nomeClinica || 'Santos & Duracenski Odontologia LTDA',
    cnpjCpfFavorecidoPix: configGerais?.cnpj || '12.345.678/0001-90',
    bancoPix: 'Nu Pagamentos S.A. (260)',
    instrucoesPix:
      'O(A) CONTRATANTE poderá utilizar a câmera do smartphone para leitura do QR Code acima ou efetuar a transferência direta para a chave informada, encaminhando o comprovante para confirmação da baixa da parcela.',

    nomeClinicaContrato: configGerais?.nomeClinica || 'Santos & Duracenski Odontologia LTDA',
    cnpjClinicaContrato: configGerais?.cnpj || '12.345.678/0001-90',
    croResponsavelContrato: configGerais?.croResponsavel || 'CRO-AL 06267',
    dentistaResponsavelContrato: configGerais?.dentistaResponsavel || 'Dra. Rosângela Santos Pereira',
    enderecoContrato:
      configGerais?.endereco ||
      'Av. Fernandes Lima, 1000, Sala 401, Farol, Maceió - AL, CEP 57055-000',
    telefoneContrato: configGerais?.telefone || '(82) 99999-8888',
    emailContrato: configGerais?.email || 'contato@santosduracenski.com.br',
    cidadeForoContrato: 'Maceió - AL',

    multaAtrasoPercentual: 2,
    jurosMoraPercentual: 1,
    clausulaEspecialPadrao: '',

    assinaturaPadraoDentista: '',
    autoAssinarContrato: true,
  };
};`;

// Normalizar CRLF para busca
contentHook = contentHook.replace(/\r\n/g, '\n');
const normalizedOld = oldDefault.replace(/\r\n/g, '\n');

if (contentHook.includes(normalizedOld)) {
  contentHook = contentHook.replace(normalizedOld, newDefault.replace(/\r\n/g, '\n'));
  fs.writeFileSync(pathHook, contentHook.replace(/\n/g, '\r\n'), 'utf-8');
  console.log('✓ useConfiguracoesContrato.ts atualizado com sucesso!');
} else {
  console.error('✗ Não foi possível encontrar o trecho em useConfiguracoesContrato.ts');
}

// 2. Atualizar orcamentoEngine.ts
const pathOrcEngine = path.join(process.cwd(), 'src', 'utils', 'orcamentoEngine.ts');
let contentOrc = fs.readFileSync(pathOrcEngine, 'utf-8').replace(/\r\n/g, '\n');

// Repassar condicaoEscolhida e condicoes no orcamentoAprovadoParaContrato
const targetOrcObj = `  const orcamentoAprovadoParaContrato: Orcamento = {
    id: orcamento.id,
    titulo: orcamento.titulo,
    pacienteId: orcamento.pacienteId || patient?.id,
    pacienteNome: orcamento.pacienteNome || patient?.nome,
    itens: orcamento.itens || [],
    desconto: orcamento.desconto || 0,
    total: typeof condicaoEscolhida?.valorTotal === 'number' && condicaoEscolhida.valorTotal > 0
      ? condicaoEscolhida.valorTotal
      : orcamento.total,
    status: 'aprovado',
    validade: orcamento.validade,
    observacoes: orcamento.observacoes,
    formasPagamento: formasPagamentoFinal,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
  };`;

const replOrcObj = `  const orcamentoAprovadoParaContrato: Orcamento = {
    id: orcamento.id,
    titulo: orcamento.titulo,
    pacienteId: orcamento.pacienteId || patient?.id,
    pacienteNome: orcamento.pacienteNome || patient?.nome,
    itens: orcamento.itens || [],
    desconto: orcamento.desconto || 0,
    total: typeof condicaoEscolhida?.valorTotal === 'number' && condicaoEscolhida.valorTotal > 0
      ? condicaoEscolhida.valorTotal
      : orcamento.total,
    status: 'aprovado',
    validade: orcamento.validade,
    observacoes: orcamento.observacoes,
    formasPagamento: formasPagamentoFinal,
    criadoEm: new Date(),
    atualizadoEm: new Date(),
    condicoes,
    condicaoEscolhida,
  } as any;`;

if (contentOrc.includes(targetOrcObj)) {
  contentOrc = contentOrc.replace(targetOrcObj, replOrcObj);
}

// Corrigir passagem de configContrato como configuracoesContrato
const targetCallMap = `  const snapshotContrato = mapearDadosContrato({
    patient: pacienteCompleto,
    orcamento: orcamentoAprovadoParaContrato,
    configuracoes,
    configContrato,
    tipoModeloContrato: modeloId,`;

const replCallMap = `  const snapshotContrato = mapearDadosContrato({
    patient: pacienteCompleto,
    orcamento: orcamentoAprovadoParaContrato,
    configuracoes,
    configuracoesContrato: configContrato,
    configContrato,
    tipoModeloContrato: modeloId,`;

if (contentOrc.includes(targetCallMap)) {
  contentOrc = contentOrc.replace(targetCallMap, replCallMap);
  fs.writeFileSync(pathOrcEngine, contentOrc.replace(/\n/g, '\r\n'), 'utf-8');
  console.log('✓ orcamentoEngine.ts atualizado com sucesso!');
} else {
  console.error('✗ Não foi possível encontrar targetCallMap em orcamentoEngine.ts');
}

// 3. Atualizar contratoEngine.ts para aceitar configContrato como alias em mapearDadosContrato
const pathContratoEngine = path.join(process.cwd(), 'src', 'utils', 'contratoEngine.ts');
let contentEngine = fs.readFileSync(pathContratoEngine, 'utf-8').replace(/\r\n/g, '\n');

const targetCfgContrato = `  const cfgContrato = (configuracoesContrato && Object.keys(configuracoesContrato).length > 0)
    ? configuracoesContrato
    : carregarConfiguracoesContratoSync(null, configuracoes);`;

const replCfgContrato = `  const cfgParam = configuracoesContrato || (arguments[0] as any)?.configContrato;
  const cfgContrato = (cfgParam && Object.keys(cfgParam).length > 0)
    ? cfgParam
    : carregarConfiguracoesContratoSync(null, configuracoes);`;

if (contentEngine.includes(targetCfgContrato)) {
  contentEngine = contentEngine.replace(targetCfgContrato, replCfgContrato);
  fs.writeFileSync(pathContratoEngine, contentEngine.replace(/\n/g, '\r\n'), 'utf-8');
  console.log('✓ contratoEngine.ts atualizado com sucesso!');
} else {
  console.error('✗ Não foi possível encontrar targetCfgContrato em contratoEngine.ts');
}

// 4. Atualizar ContratoModal.tsx adicionando configContrato nas dependências
const pathModal = path.join(process.cwd(), 'src', 'components', 'contratos', 'ContratoModal.tsx');
let contentModal = fs.readFileSync(pathModal, 'utf-8').replace(/\r\n/g, '\n');

const targetDeps = `  }, [
    isManuallyEdited,
    patient,
    orcamentoAtual,
    transacoesOrcamento,
    configuracoes,
    selectedDentistaNome,
    dentistaAtual,
    cidadeLocal,
  ]);`;

const replDeps = `  }, [
    isManuallyEdited,
    patient,
    orcamentoAtual,
    transacoesOrcamento,
    configuracoes,
    configContrato,
    selectedDentistaNome,
    dentistaAtual,
    cidadeLocal,
  ]);`;

if (contentModal.includes(targetDeps)) {
  contentModal = contentModal.replace(targetDeps, replDeps);
  fs.writeFileSync(pathModal, contentModal.replace(/\n/g, '\r\n'), 'utf-8');
  console.log('✓ ContratoModal.tsx atualizado com sucesso!');
} else {
  console.error('✗ Não foi possível encontrar targetDeps em ContratoModal.tsx');
}

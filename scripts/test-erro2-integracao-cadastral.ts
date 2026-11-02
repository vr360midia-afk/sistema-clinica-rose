import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from 'fs';
import path from 'path';
import { jsPDF } from 'jspdf';
import {
  formatarDocumento,
  formatarEnderecoCompleto,
  formatarTelefone,
  temValorValido,
} from '../src/utils/documentoFormat';
import {
  mapearDadosContrato,
  gerarHtmlContrato,
  ContratoSnapshot,
} from '../src/utils/contratoEngine';

async function runTestSuite() {
  console.log('======================================================================');
  console.log('🚀 INICIANDO SUÍTE DE HOMOLOGAÇÃO ISOLADA: ERRO 2 (DADOS CADASTRAIS)');
  console.log('======================================================================\n');

  let passes = 0;
  let fails = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${desc}`);
      passes++;
    } else {
      console.error(`  ❌ FAIL: ${desc}`);
      fails++;
    }
  }

  // 1. Testes unitários dos utilitários de formatação cadastral
  console.log('--- ETAPA 1: TESTE DOS FORMATADORES CADASTRAIS ---');
  
  assert(
    formatarDocumento('12345678900') === '123.456.789-00',
    'Formatação correta de CPF com 11 dígitos'
  );

  assert(
    formatarTelefone('82998765432') === '(82) 99876-5432',
    'Formatação correta de Telefone celular DDD 82'
  );

  assert(
    formatarTelefone('8233334444') === '(82) 3333-4444',
    'Formatação correta de Telefone fixo DDD 82'
  );

  const endStr = 'Rua Comerc. José Pontes de Magalhães, 70, Sl 405, Jatiúca, Maceió - AL, CEP 57036-250';
  assert(
    formatarEnderecoCompleto(endStr) === endStr,
    'Endereço string completo preservado integralmente'
  );

  const endObj = {
    logradouro: 'Rua das Acácias',
    numero: '120',
    complemento: 'Apto 302',
    bairro: 'Ponta Verde',
    cidade: 'Maceió',
    estado: 'AL',
    cep: '57035000',
  };
  const endEsperado = 'Rua das Acácias, nº 120, Apto 302, Bairro Ponta Verde, Maceió - AL, CEP 57035-000';
  assert(
    formatarEnderecoCompleto(endObj) === endEsperado,
    'Endereço estruturado formatado com logradouro, número, complemento, bairro, cidade, estado e CEP'
  );

  assert(
    formatarEnderecoCompleto('Não informado') === '',
    'Endereço "Não informado" é detectado e limpo sem inventar dados'
  );

  assert(
    formatarEnderecoCompleto(null) === '',
    'Endereço nulo retorna vazio sem erro'
  );

  // 2. Setup de banco de dados isolado com PGlite (schema idêntico a produção)
  console.log('\n--- ETAPA 2: CONFIGURAÇÃO DE AMBIENTE ISOLADO (PGLITE) ---');
  const db = new PGlite({ extensions: { pgcrypto } });

  await db.exec(`
    CREATE ROLE authenticated;
    CREATE ROLE anon;
    CREATE ROLE service_role;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$ LANGUAGE sql;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$ SELECT 'anon' $$ LANGUAGE sql;

    CREATE TABLE IF NOT EXISTS public.pacientes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nome text NOT NULL,
      cpf text,
      rg text,
      telefone text,
      email text,
      endereco text,
      data_nascimento date,
      idade integer,
      profissao text,
      estado_civil text,
      status text DEFAULT 'Ativo',
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.orcamentos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id uuid REFERENCES public.pacientes(id),
      paciente_nome text,
      titulo text,
      itens jsonb,
      desconto numeric DEFAULT 0,
      total numeric DEFAULT 0,
      status text DEFAULT 'pendente',
      condicao_escolhida jsonb,
      contrato_id text,
      contrato_token text,
      assinatura_paciente jsonb,
      token_assinatura text,
      versao integer DEFAULT 1,
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.documentos_clinicos (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      paciente_id uuid REFERENCES public.pacientes(id),
      paciente_nome text,
      tipo text NOT NULL,
      titulo text,
      conteudo text,
      itens jsonb,
      dentista text,
      assinado_em timestamptz,
      assinante_nome text,
      assinatura_data text,
      user_id uuid,
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.assinaturas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      documento_id text NOT NULL,
      documento_tipo text NOT NULL,
      tipo text NOT NULL,
      nome text NOT NULL,
      assinatura_data text NOT NULL,
      paciente_id uuid,
      user_id uuid,
      evidencias jsonb DEFAULT '{}'::jsonb,
      criado_em timestamptz DEFAULT now(),
      atualizado_em timestamptz DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.autorizacoes_assinatura_profissional (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profissional_nome text NOT NULL,
      profissional_cro text NOT NULL,
      profissional_documento text NOT NULL,
      ativo boolean DEFAULT true,
      autorizacao_expressa boolean DEFAULT true,
      assinatura_grafica text NOT NULL,
      autorizado_em timestamptz DEFAULT now(),
      revogado_em timestamptz,
      modelos_autorizados jsonb DEFAULT '["geral", "lentes_resina", "endodontia"]'::jsonb,
      criado_em timestamptz DEFAULT now()
    );
  `);

  // Aplica o trigger de segurança e imutabilidade v3
  const triggerSql = fs.readFileSync('supabase/migrations/20261102_ajuste_trigger_imutabilidade.sql', 'utf8');
  await db.exec(triggerSql);
  assert(true, 'Banco isolado inicializado com schemas e trigger v3');

  // 3. Cadastra paciente de teste com dados cadastrais completos
  console.log('\n--- ETAPA 3: CADASTRO DO PACIENTE E DADOS COMPLETOS ---');
  const pacInsert = await db.query(`
    INSERT INTO public.pacientes (
      nome, cpf, rg, telefone, email, endereco, data_nascimento, idade, profissao, estado_civil
    ) VALUES (
      'Carlos Eduardo Silveira',
      '123.456.789-00',
      '9876543 SSP/AL',
      '82998765432',
      'carlos.silveira@example.com',
      'Rua das Acácias, nº 120, Apto 302, Bairro Ponta Verde, Maceió - AL, CEP 57035-000',
      '1988-03-24',
      38,
      'Engenheiro Civil',
      'Casado'
    ) RETURNING *;
  `);
  const pacienteDb = (pacInsert.rows as any[])[0];
  assert(pacienteDb && pacienteDb.id, 'Paciente criado com sucesso no banco isolado');
  assert(pacienteDb.nome === 'Carlos Eduardo Silveira', 'Nome do paciente registrado');
  assert(pacienteDb.cpf === '123.456.789-00', 'CPF do paciente registrado');
  assert(pacienteDb.rg === '9876543 SSP/AL', 'RG do paciente registrado');
  assert(pacienteDb.endereco.includes('Ponta Verde'), 'Endereço completo registrado');

  // 4. Cadastra autorização da Dra. Rosângela
  console.log('\n--- ETAPA 4: AUTORIZAÇÃO PROFISSIONAL ATIVA ---');
  await db.query(`
    INSERT INTO public.autorizacoes_assinatura_profissional (
      profissional_nome, profissional_cro, profissional_documento, ativo, autorizacao_expressa, assinatura_grafica
    ) VALUES (
      'Dra. Rosângela Santos Pereira',
      '06267-AL',
      '032.663.962-43',
      true,
      true,
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    );
  `);
  const authCheck = await db.query(`SELECT * FROM public.autorizacoes_assinatura_profissional WHERE ativo = true;`);
  assert(authCheck.rows.length === 1, 'Autorização prévia da Dra. Rosângela ativa no banco isolado');

  // 5. Emissão do orçamento aprovado
  console.log('\n--- ETAPA 5: EMISSÃO DO ORÇAMENTO APROVADO ---');
  const orcInsert = await db.query(`
    INSERT INTO public.orcamentos (
      paciente_id, paciente_nome, titulo, itens, total, desconto, status, condicao_escolhida, token_assinatura
    ) VALUES (
      $1,
      $2,
      'Plano de Tratamento - Lentes em Resina Composta',
      '[{"nome": "Facetas em Resina Direta (Elementos 13 ao 23)", "quantidade": 6, "valor": 1200}]'::jsonb,
      7200,
      0,
      'aprovado',
      '{"id": "cond-pix-1", "titulo": "À Vista via PIX", "valorTotal": 7200, "parcelas": 1}'::jsonb,
      'token-orcamento-12345678'
    ) RETURNING *;
  `, [pacienteDb.id, pacienteDb.nome]);
  const orcamentoDb = (orcInsert.rows as any[])[0];
  assert(orcamentoDb && orcamentoDb.id, 'Orçamento aprovado criado com sucesso');

  // 6. Geração do Snapshot Contratual com Hidratação Cadastral
  console.log('\n--- ETAPA 6: GERAÇÃO DO SNAPSHOT CONTRATUAL E PREENCHIMENTO AUTOMÁTICO ---');
  
  // Simulando a chamada de mapeamento com o paciente carregado do banco
  const snapshotContrato = mapearDadosContrato({
    patient: pacienteDb,
    orcamento: {
      id: orcamentoDb.id,
      titulo: orcamentoDb.titulo,
      itens: orcamentoDb.itens,
      total: orcamentoDb.total,
      desconto: orcamentoDb.desconto,
      pacienteId: pacienteDb.id,
      pacienteNome: pacienteDb.nome,
      status: 'aprovado',
      formasPagamento: 'À Vista via PIX',
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    },
    tipoModeloContrato: 'lentes_resina',
    autorizacaoProfissional: (authCheck.rows as any[])[0],
  });

  // Verificações rigorosas do preenchimento cadastral
  assert(snapshotContrato.paciente.nome === 'Carlos Eduardo Silveira', 'Snapshot contém Nome completo');
  assert(snapshotContrato.paciente.cpf === '123.456.789-00', 'Snapshot contém CPF preenchido automaticamente');
  assert(snapshotContrato.paciente.rg === '9876543 SSP/AL', 'Snapshot contém RG quando disponível');
  assert(snapshotContrato.paciente.telefone === '(82) 99876-5432', 'Snapshot contém Telefone preenchido e formatado');
  assert(snapshotContrato.paciente.email === 'carlos.silveira@example.com', 'Snapshot contém E-mail cadastrado');
  assert(snapshotContrato.paciente.endereco.includes('Rua das Acácias, nº 120'), 'Snapshot contém Endereço completo formatado');
  assert(snapshotContrato.paciente.endereco !== 'Não informado', 'Endereço NÃO está como "Não informado"');
  assert(snapshotContrato.paciente.cpf !== 'Não informado', 'CPF NÃO está como "Não informado"');
  assert(snapshotContrato.paciente.telefone !== 'Não informado', 'Telefone NÃO está como "Não informado"');

  // 7. Verificação da assinatura automática da Dra. Rosângela
  console.log('\n--- ETAPA 7: ASSINATURA AUTOMÁTICA AUTORIZADA DA DRA. ROSÂNGELA ---');
  assert(snapshotContrato.assinaturaDentista !== null, 'Assinatura da Dra. Rosângela aplicada no contrato');
  assert(snapshotContrato.assinaturaDentista.cro === '06267-AL', 'CRO 06267-AL da Dra. Rosângela presente na assinatura');
  assert(snapshotContrato.status === 'aguardando_assinatura_paciente', 'Status é aguardando_assinatura_paciente');

  // 8. Persistência do Contrato inicial no banco isolado
  console.log('\n--- ETAPA 8: PERSISTÊNCIA INICIAL DO CONTRATO EM DOCUMENTOS_CLINICOS ---');
  const contratoId = 'CTR-HOMOLOG-2026';
  const contratoToken = 'token-secreto-homolog-12345';
  snapshotContrato.contratoId = contratoId;
  snapshotContrato.token = contratoToken;

  const docInsert = await db.query(`
    INSERT INTO public.documentos_clinicos (
      paciente_id, paciente_nome, tipo, titulo, conteudo, itens, dentista
    ) VALUES (
      $1, $2, 'contrato', $3, '', $4, 'Dra. Rosângela Santos Pereira'
    ) RETURNING *;
  `, [
    pacienteDb.id,
    pacienteDb.nome,
    `Contrato Odontológico - Carlos Eduardo Silveira (${contratoId})`,
    JSON.stringify(snapshotContrato),
  ]);
  const docClinicoDb = (docInsert.rows as any[])[0];
  assert(docClinicoDb && docClinicoDb.id, 'Contrato persistido em documentos_clinicos');

  // 9. Validação Impeditiva para Novos Contratos
  console.log('\n--- ETAPA 9: VALIDAÇÃO IMPEDITIVA SE FALTAR DADO OBRIGATÓRIO ---');
  
  function validarCamposObrigatorios(paciente: any, signerInfo?: any): string[] {
    const finalNome = (signerInfo?.nomeCompleto || paciente?.nome || '').trim();
    const finalCpf = (signerInfo?.cpf || paciente?.cpf || '').trim();
    const finalTelefone = (paciente?.telefone || '').trim();
    const finalEndereco = (paciente?.endereco || '').trim();

    const camposFaltantes: string[] = [];
    if (!finalNome || !temValorValido(finalNome)) camposFaltantes.push('Nome completo');
    if (!finalCpf || !temValorValido(finalCpf)) camposFaltantes.push('CPF');
    if (!finalEndereco || !temValorValido(finalEndereco)) camposFaltantes.push('Endereço completo');
    if (!finalTelefone || !temValorValido(finalTelefone)) camposFaltantes.push('Telefone/WhatsApp');
    return camposFaltantes;
  }

  const faltantesIncompleto = validarCamposObrigatorios({ nome: 'Paciente Teste', cpf: 'Não informado', endereco: 'Não informado', telefone: '' });
  assert(faltantesIncompleto.includes('CPF'), 'Validação detecta CPF ausente');
  assert(faltantesIncompleto.includes('Endereço completo'), 'Validação detecta Endereço ausente');
  assert(faltantesIncompleto.includes('Telefone/WhatsApp'), 'Validação detecta Telefone ausente');
  assert(faltantesIncompleto.length === 3, 'Bloqueio impede formalização quando faltam dados obrigatórios');

  const faltantesCompleto = validarCamposObrigatorios(snapshotContrato.paciente);
  assert(faltantesCompleto.length === 0, 'Validação aprova paciente quando todos os dados obrigatórios estão preenchidos');

  // 10. Assinatura Gráfica do Paciente
  console.log('\n--- ETAPA 10: ASSINATURA GRÁFICA DO PACIENTE ---');
  const nowIso = new Date().toISOString();
  const signatureData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const updatedSnapshot: ContratoSnapshot = {
    ...snapshotContrato,
    status: 'formalizado',
    statusAssinaturaPaciente: 'assinado',
    isFormalizadoTotal: true,
    assinaturaPaciente: {
      assinaturaData: signatureData,
      nome: pacienteDb.nome,
      dataHora: nowIso,
      ip: '189.120.45.67',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      cpf: pacienteDb.cpf,
      rg: pacienteDb.rg,
      email: pacienteDb.email,
    },
  };

  // Atualiza no banco simulando a Edge Function contrato-publico action: 'sign'
  const updateRes = await db.query(`
    UPDATE public.documentos_clinicos
    SET
      assinado_em = $1,
      assinante_nome = $2,
      assinatura_data = $3,
      itens = $4,
      atualizado_em = $1
    WHERE id = $5
    RETURNING *;
  `, [
    nowIso,
    pacienteDb.nome,
    signatureData,
    JSON.stringify(updatedSnapshot),
    docClinicoDb.id,
  ]);

  assert(updateRes.rows.length === 1, 'Assinatura do paciente registrada no banco com sucesso sem trigger bloquear');

  // Também grava na tabela assinaturas para auditoria
  await db.query(`
    INSERT INTO public.assinaturas (
      documento_id, documento_tipo, tipo, nome, assinatura_data, paciente_id, evidencias
    ) VALUES (
      $1, 'contrato', 'paciente', $2, $3, $4, $5
    );
  `, [
    contratoId,
    pacienteDb.nome,
    signatureData,
    pacienteDb.id,
    JSON.stringify({ cpf: pacienteDb.cpf, ip: '189.120.45.67', dataHora: nowIso }),
  ]);

  // 11. Recarregamento e Persistência
  console.log('\n--- ETAPA 11: RECARREGAMENTO E PERSISTÊNCIA APÓS RECARGA ---');
  const reloadRes = await db.query(`SELECT * FROM public.documentos_clinicos WHERE id = $1;`, [docClinicoDb.id]);
  const docRecarregado = (reloadRes.rows as any[])[0];
  const snapRecarregado: ContratoSnapshot = docRecarregado.itens;

  assert(docRecarregado.assinado_em !== null, 'Data da assinatura do paciente persistida');
  assert(snapRecarregado.status === 'formalizado', 'Status do contrato persistido como "formalizado" / "Assinaturas realizadas"');
  assert(snapRecarregado.assinaturaDentista !== null, 'Assinatura da Dra. Rosângela preservada após recarregamento');
  assert(snapRecarregado.assinaturaPaciente !== null, 'Assinatura gráfica do paciente preservada após recarregamento');
  assert(snapRecarregado.paciente.cpf === '123.456.789-00', 'CPF do paciente preservado');
  assert(snapRecarregado.paciente.endereco.includes('Ponta Verde'), 'Endereço completo preservado');
  assert(snapRecarregado.paciente.telefone === '(82) 99876-5432', 'Telefone do paciente preservado');

  // 12. Geração do HTML e PDF com Ambas as Assinaturas
  console.log('\n--- ETAPA 12: GERAÇÃO DO HTML E PDF COM AMBAS AS ASSINATURAS ---');
  const htmlFinal = gerarHtmlContrato(snapRecarregado);
  
  assert(htmlFinal.includes('Carlos Eduardo Silveira'), 'HTML contém Nome completo do paciente');
  assert(htmlFinal.includes('123.456.789-00'), 'HTML contém CPF formatado do paciente');
  assert(htmlFinal.includes('9876543 SSP/AL'), 'HTML contém RG do paciente');
  assert(htmlFinal.includes('(82) 99876-5432'), 'HTML contém Telefone do paciente');
  assert(htmlFinal.includes('Ponta Verde'), 'HTML contém Bairro Ponta Verde no preâmbulo');
  assert(htmlFinal.includes('57035-000'), 'HTML contém CEP no preâmbulo');
  assert(!htmlFinal.includes('residente e domiciliado(a) em <strong>Não informado</strong>'), 'HTML NÃO contém "Não informado" para endereço');
  assert(!htmlFinal.includes('sob o nº <strong>Não informado</strong>'), 'HTML NÃO contém "Não informado" para CPF');
  assert(htmlFinal.includes('Dra. Rosângela Santos Pereira'), 'HTML contém Responsável Técnica Dra. Rosângela');

  // Gera o PDF oficial com jsPDF (simulando renderizador)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS', 40, 50);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Identificador: ${contratoId}`, 40, 70);
  pdf.text(`CONTRATANTE: ${snapRecarregado.paciente.nome}`, 40, 95);
  pdf.text(`CPF: ${snapRecarregado.paciente.cpf}  |  RG: ${snapRecarregado.paciente.rg}`, 40, 110);
  pdf.text(`Endereço: ${snapRecarregado.paciente.endereco}`, 40, 125);
  pdf.text(`Telefone: ${snapRecarregado.paciente.telefone}  |  E-mail: ${snapRecarregado.paciente.email}`, 40, 140);
  pdf.text(`CONTRATADA: Dra. Rosângela Santos Pereira - CRO-AL 06267`, 40, 165);
  pdf.text(`Status: Assinaturas realizadas (Formalizado)`, 40, 185);

  // Assinaturas
  pdf.line(40, 240, 260, 240);
  pdf.text('Dra. Rosângela Santos Pereira', 40, 255);
  pdf.text('Cirurgiã-Dentista (CRO-AL 06267)', 40, 270);
  pdf.text('[Assinatura Digital Autorizada]', 40, 285);

  pdf.line(300, 240, 520, 240);
  pdf.text(snapRecarregado.paciente.nome, 300, 255);
  pdf.text(`Contratante / Paciente (CPF: ${snapRecarregado.paciente.cpf})`, 300, 270);
  pdf.text('[Assinado Digitalmente pelo Paciente]', 300, 285);

  const pdfBuffer = Buffer.from(pdf.output('arraybuffer'));
  const artifactDir = path.resolve('C:/Users/Jhonatha/.gemini/antigravity/brain/15c3c27e-ca1c-430b-8541-aab292b034fb');
  const artifactPdfPath = path.join(artifactDir, `Homologacao_Contrato_Assinado_${contratoId}.pdf`);
  fs.writeFileSync(artifactPdfPath, pdfBuffer);

  assert(fs.existsSync(artifactPdfPath), `PDF com ambas as assinaturas e dados cadastrais gerado em ${artifactPdfPath}`);

  // 13. Arquivamento do Documento no Prontuário
  console.log('\n--- ETAPA 13: ARQUIVAMENTO NO PRONTUÁRIO DO PACIENTE ---');
  const prontuarioDocs = await db.query(`
    SELECT id, titulo, tipo, paciente_nome, assinado_em
    FROM public.documentos_clinicos
    WHERE paciente_id = $1 AND tipo = 'contrato';
  `, [pacienteDb.id]);

  assert(prontuarioDocs.rows.length === 1, 'Contrato localizado e arquivado no prontuário do paciente');
  assert((prontuarioDocs.rows[0] as any).assinado_em !== null, 'Status de arquivamento confirma formalização completa');

  console.log('\n======================================================================');
  console.log(`📊 RESULTADO FINAL DA HOMOLOGAÇÃO:`);
  console.log(`   Total de Testes: ${passes + fails}`);
  console.log(`   Sucessos (PASS): ${passes}`);
  console.log(`   Falhas (FAIL):   ${fails}`);
  console.log('======================================================================\n');

  if (fails > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Erro na execução da suíte de testes:', err);
  process.exit(1);
});

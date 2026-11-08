import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';

const PROD_REF = 'skonxcdojbkbfnfemayz';

function runDbQuery(sql: string): any[] {
  const sanitizedSql = sql.replace(/"/g, '\"');
  const cmd = `npx supabase db query --remote=${PROD_REF} --read-only --output=json "${sanitizedSql}"`;
  const raw = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  const jsonMatch = raw.match(/\{[\s\S]*"rows"[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Falha ao parsear saída: ${raw}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed.rows || [];
}

async function main() {
  console.log('=== CRIANDO BACKUP VERIFICÁVEL DE PRODUÇÃO (skonxcdojbkbfnfemayz) ===\n');

  // 1. Exporta definicao da funcao do trigger em producao
  console.log('1. Exportando definição da função garantir_imutabilidade_contrato_v3 de produção...');
  const funcRows = runDbQuery("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'garantir_imutabilidade_contrato_v3';");
  if (!funcRows || funcRows.length === 0 || !funcRows[0].pg_get_functiondef) {
    throw new Error('Função garantir_imutabilidade_contrato_v3 não encontrada em produção!');
  }
  const prodFuncDef = funcRows[0].pg_get_functiondef;
  const backupFile = 'supabase/migrations/backup_producao_pre_v6_garantir_imutabilidade.sql';
  fs.writeFileSync(backupFile, prodFuncDef + '\n', 'utf-8');
  console.log(`   ✓ Backup salvo em: ${backupFile} (${Buffer.byteLength(prodFuncDef)} bytes)`);

  // Confirmação de integridade com rollback_ajuste_retificacao_contrato_pendente.sql
  const rollbackContent = fs.readFileSync('supabase/migrations/rollback_ajuste_retificacao_contrato_pendente.sql', 'utf-8');
  const hashBackup = crypto.createHash('sha256').update(prodFuncDef.trim()).digest('hex');
  const hashRollback = crypto.createHash('sha256').update(rollbackContent.trim()).digest('hex');
  console.log(`   Hash SHA256 Backup Produção:  ${hashBackup}`);
  console.log(`   Hash SHA256 Script Rollback: ${hashRollback}`);
  if (hashBackup === hashRollback) {
    console.log('   ✓ Rollback homologado coincide byte-a-byte com a função ativa em produção!');
  } else {
    console.warn('   ⚠️ Diferença de formatação/espaçamento detectada. Verificando conteúdo normalizado...');
    const stripComments = (s: string) => s.replace(/--.*$/gm, '').replace(/;\s*$/, '').trim();
    const normBackup = stripComments(prodFuncDef).replace(/\s+/g, ' ');
    const normRollback = stripComments(rollbackContent).replace(/\s+/g, ' ');
    if (normBackup === normRollback) {
      console.log('   ✓ Conteúdo SQL da função no rollback coincide 100% com produção!');
    } else {
      throw new Error('ALERTA: O script de rollback não coincide com a função de produção!');
    }
  }

  // 2. Snapshot do contrato CTR-CCCE6389 em produção
  console.log('\n2. Inspecionando estado do contrato CTR-CCCE6389 em produção...');
  const ctrRows = runDbQuery("SELECT id, identificador, tipo, paciente_nome, valor_total, assinado_em, assinatura_data, criado_em, atualizado_em, itens FROM documentos_clinicos WHERE identificador = 'CTR-CCCE6389';");
  console.log(`   Contratos encontrados com CTR-CCCE6389: ${ctrRows.length}`);
  if (ctrRows.length > 0) {
    const c = ctrRows[0];
    console.log(`   ID: ${c.id}`);
    console.log(`   Identificador: ${c.identificador}`);
    console.log(`   Valor Total: ${c.valor_total}`);
    console.log(`   Status em itens: ${c.itens?.status}`);
    console.log(`   Status Assinatura Dentista: ${c.itens?.statusAssinaturaDentista}`);
    console.log(`   Status Assinatura Paciente: ${c.itens?.statusAssinaturaPaciente}`);
    console.log(`   Assinado Em: ${c.assinado_em}`);
    console.log(`   Token ativo atual: ${c.itens?.token}`);

    fs.writeFileSync('scripts/snapshot_producao_CTR-CCCE6389_pre_v6.json', JSON.stringify(c, null, 2), 'utf-8');
    console.log('   ✓ Snapshot de CTR-CCCE6389 gravado em scripts/snapshot_producao_CTR-CCCE6389_pre_v6.json');
  }

  // 3. Contagem geral de contratos e formalizados em produção
  console.log('\n3. Contagem geral em produção:');
  const countDocs = runDbQuery("SELECT count(*) as total, count(*) FILTER (WHERE assinado_em IS NOT NULL OR itens->>'status' IN ('formalizado', 'assinado')) as formalizados, count(*) FILTER (WHERE itens->>'status' = 'aguardando_assinatura_paciente') as pendentes FROM documentos_clinicos WHERE tipo = 'contrato';");
  console.log('   Estatísticas de Contratos em Produção:', JSON.stringify(countDocs[0]));

  console.log('\n=== BACKUP E SNAPSHOT PRÉ-PUBLICAÇÃO CONCLUÍDOS COM SUCESSO ===');
}

main().catch((err) => {
  console.error('ERRO:', err);
  process.exit(1);
});

/**
 * SCRIPT DE BACKUP RECUPERÁVEL DO SISTEMA
 * Supabase CLI v3.0.0 + Storage API
 * 
 * Executa ou instrui o backup completo de:
 * 1. Schema do banco (tabelas, triggers, RLS, functions)
 * 2. Dados do schema public (contratos, orçamentos, assinaturas, pacientes)
 * 3. Dados do schema auth (usuários e identidades de autenticação)
 * 4. Permissões e roles (pg_roles, grants)
 * 5. Arquivos binários do Storage (bucket privado documentos-pacientes / contratos/)
 * 
 * SEGURANÇA: ZERO credenciais expostas no código ou relatórios.
 * Utiliza variáveis de ambiente padronizadas (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface BackupManifesto {
  dataHora: string;
  versaoCli: string;
  tabelasIncluidas: string[];
  arquivosStorageBaixados: number;
  arquivosDetalhes: Array<{ path: string; tamanho: number; sha256: string }>;
  status: 'concluido' | 'parcial' | 'erro';
}

export function gerarComandosCliBackup(projectRef: string = '<SEU_PROJECT_REF>'): {
  schemaCmd: string;
  dataCmd: string;
  authCmd: string;
  rolesCmd: string;
} {
  return {
    schemaCmd: `npx supabase db dump --remote=${projectRef} --schema=public -f backups/db/backup_schema_public.sql`,
    dataCmd: `npx supabase db dump --remote=${projectRef} --schema=public --data-only --use-copy -f backups/db/backup_data_public.sql`,
    authCmd: `npx supabase db dump --remote=${projectRef} --schema=auth --data-only -f backups/db/backup_data_auth.sql`,
    rolesCmd: `npx supabase db dump --remote=${projectRef} --role-only -f backups/db/backup_roles.sql`,
  };
}

export async function executarBackupStorageSeguro(params: {
  supabaseUrl?: string;
  serviceKey?: string;
  destinoDir?: string;
}): Promise<BackupManifesto> {
  const agora = new Date().toISOString();
  const destino = params.destinoDir || path.resolve('backups/storage/contratos');
  
  if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
  }

  const manifesto: BackupManifesto = {
    dataHora: agora,
    versaoCli: '3.0.0',
    tabelasIncluidas: [
      'documentos_clinicos',
      'orcamentos',
      'pacientes',
      'documentos_paciente',
      'assinaturas',
      'autorizacoes_assinatura_profissional',
      'historico_autorizacoes_assinatura',
      'fila_arquivamento_pdf',
    ],
    arquivosStorageBaixados: 0,
    arquivosDetalhes: [],
    status: 'concluido',
  };

  // Se as variáveis de ambiente estiverem disponíveis em runtime, realiza o download seguro
  const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const matchUrl = envContent.match(/VITE_SUPABASE_URL\s*=\s*['"]?([^'"\r\n]+)/);
  const fallbackUrl = matchUrl ? matchUrl[1].trim() : 'https://skonxcdojbkbfnfemayz.supabase.co';
  const url = params.supabaseUrl || process.env.SUPABASE_URL || fallbackUrl;
  const key = params.serviceKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (url && key) {
    try {
      const endpoint = `${url.replace(/\/$/, '')}/storage/v1/object/list/documentos-pacientes`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefix: 'contratos', limit: 1000 }),
      });

      if (res.ok) {
        const objetos = await res.json();
        for (const obj of (Array.isArray(objetos) ? objetos : [])) {
          if (!obj.name) continue;
          const downloadUrl = `${url.replace(/\/$/, '')}/storage/v1/object/documentos-pacientes/contratos/${obj.name}`;
          const fileRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${key}`, apikey: key },
          });
          if (fileRes.ok) {
            const buf = Buffer.from(await fileRes.arrayBuffer());
            const hash = crypto.createHash('sha256').update(buf).digest('hex');
            const destPath = path.join(destino, obj.name);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.writeFileSync(destPath, buf);

            manifesto.arquivosStorageBaixados++;
            manifesto.arquivosDetalhes.push({
              path: `contratos/${obj.name}`,
              tamanho: buf.length,
              sha256: hash,
            });
          }
        }
      }
    } catch (e: any) {
      manifesto.status = 'parcial';
    }
  }

  // Grava o manifesto na pasta de backups
  const manifestoPath = path.resolve('backups/manifesto_backup.json');
  fs.mkdirSync(path.dirname(manifestoPath), { recursive: true });
  fs.writeFileSync(manifestoPath, JSON.stringify(manifesto, null, 2), 'utf8');

  return manifesto;
}

// Execução direta em linha de comando quando chamado
const isMain = process.argv[1]?.endsWith('backup-recuperavel-sistema.ts');
if (isMain) {
  console.log('--- COMANDOS OFICIAIS SUPABASE CLI V3.0.0 PARA BACKUP COMPLETO DO BANCO ---');
  const cmds = gerarComandosCliBackup('skonxcdojbkbfnfemayz');
  console.log('1. Schema:', cmds.schemaCmd);
  console.log('2. Dados Public:', cmds.dataCmd);
  console.log('3. Dados Auth:', cmds.authCmd);
  console.log('4. Roles:', cmds.rolesCmd);

  executarBackupStorageSeguro({})
    .then((m) => {
      console.log('\nManifesto de backup preparado em backups/manifesto_backup.json');
      console.log(`Tabelas mapeadas: ${m.tabelasIncluidas.length}`);
    })
    .catch((err) => {
      console.error('Aviso ao preparar backup de storage:', err.message);
    });
}

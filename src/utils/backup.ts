import { supabase } from '@/integrations/supabase/client';

/** Exportação/importação completa dos dados da conta em um único arquivo JSON */

const BUCKET = 'documentos-pacientes';

// Ordem importa: pais antes de filhos (chaves estrangeiras)
export const BACKUP_TABLES = [
  'profiles',
  'user_roles',
  'configuracoes',
  'seguranca_config',
  'certificados_digitais',
  'dentistas',
  'parceiros',
  'medicamentos',
  'procedimentos',
  'pacotes_procedimentos',
  'produtos',
  'pacientes',
  'consultas',
  'transacoes',
  'prontuarios',
  'anamneses',
  'orcamentos',
  'documentos_paciente',
  'documentos_clinicos',
  'odontogramas',
  'odontograma_versoes',
  'extratos_financeiros',
  'assinaturas',
  'bloqueios_agenda',
  'notas',
  'audit_logs',
  'lixeira',
] as const;

/** Tabelas com no máximo um registro por conta (conflito por user_id) */
const SINGLETON_TABLES = new Set(['configuracoes', 'seguranca_config', 'profiles']);

export type BackupArquivo = {
  path: string;
  contentType?: string;
  base64: string;
};

export type BackupPayload = {
  geradoEm: string;
  versao: number;
  origemUserId?: string;
  tabelas: Record<string, any[]>;
  arquivos?: BackupArquivo[];
};

const getUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Usuário não autenticado');
  return session.user.id;
};

const blobParaBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo do armazenamento'));
    reader.readAsDataURL(blob);
  });

const base64ParaBlob = (base64: string, contentType?: string): Blob => {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: contentType || 'application/octet-stream' });
};

/** Lista recursivamente os arquivos do usuário no bucket de documentos */
const listarArquivos = async (prefixo: string): Promise<string[]> => {
  const encontrados: string[] = [];
  const { data, error } = await supabase.storage.from(BUCKET).list(prefixo, { limit: 1000 });
  if (error || !data) return encontrados;

  for (const item of data) {
    const caminho = prefixo ? `${prefixo}/${item.name}` : item.name;
    if ((item as any).id) encontrados.push(caminho);
    else encontrados.push(...(await listarArquivos(caminho)));
  }
  return encontrados;
};

/** Lê todas as tabelas da conta atual (e opcionalmente os arquivos enviados) */
export const gerarBackupCompleto = async (incluirArquivos = true): Promise<BackupPayload> => {
  const userId = await getUserId();
  const tabelas: Record<string, any[]> = {};

  for (const tabela of BACKUP_TABLES) {
    const { data, error } = await (supabase as any)
      .from(tabela)
      .select('*')
      .eq('user_id', userId);
    if (error) {
      console.error(`Backup: erro ao ler ${tabela}`, error);
      tabelas[tabela] = [];
      continue;
    }
    tabelas[tabela] = data || [];
  }

  const arquivos: BackupArquivo[] = [];
  if (incluirArquivos) {
    try {
      const caminhos = await listarArquivos(userId);
      for (const path of caminhos) {
        const { data, error } = await supabase.storage.from(BUCKET).download(path);
        if (error || !data) {
          console.error('Backup: erro ao baixar arquivo', path, error);
          continue;
        }
        arquivos.push({ path, contentType: data.type, base64: await blobParaBase64(data) });
      }
    } catch (e) {
      console.error('Backup: falha ao exportar arquivos', e);
    }
  }

  return {
    geradoEm: new Date().toISOString(),
    versao: 3,
    origemUserId: userId,
    tabelas,
    arquivos,
  };
};

const baixarArquivo = (conteudo: string, nome: string) => {
  const blob = new Blob([conteudo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Gera e baixa o backup completo. Retorna o total de registros exportados. */
export const downloadBackupCompleto = async (
  prefixo = 'backup-dental',
  incluirArquivos = true,
): Promise<number> => {
  const payload = await gerarBackupCompleto(incluirArquivos);
  const total =
    Object.values(payload.tabelas).reduce((acc, arr) => acc + arr.length, 0) +
    (payload.arquivos?.length || 0);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  baixarArquivo(JSON.stringify(payload), `${prefixo}-${stamp}.json`);
  return total;
};

export type RestauracaoResultado = {
  inseridos: number;
  arquivos: number;
  erros: { tabela: string; mensagem: string }[];
};

/**
 * Restaura um backup na conta logada (pode ser outro usuário).
 * Os registros são reatribuídos ao usuário atual e mesclados por id (upsert).
 */
export const restaurarBackup = async (payload: BackupPayload): Promise<RestauracaoResultado> => {
  const userId = await getUserId();
  const resultado: RestauracaoResultado = { inseridos: 0, arquivos: 0, erros: [] };

  if (!payload || typeof payload !== 'object' || !payload.tabelas || typeof payload.tabelas !== 'object') {
    throw new Error('Arquivo de backup inválido ou incompatível');
  }

  const origem = payload.origemUserId;
  const novoCaminho = (path: string) =>
    origem && path.startsWith(`${origem}/`) ? `${userId}/${path.slice(origem.length + 1)}` : path;

  for (const tabela of BACKUP_TABLES) {
    const registros = payload.tabelas[tabela];
    if (!Array.isArray(registros) || registros.length === 0) continue;

    const linhas = registros.map((r) => {
      const linha = { ...r, user_id: userId };

      // Registros únicos por conta: o conflito correto é o user_id, não o id de origem.
      if (SINGLETON_TABLES.has(tabela)) delete linha.id;

      // Documentos apontam para caminhos no armazenamento com o id do usuário de origem
      if (tabela === 'documentos_paciente' && typeof linha.url === 'string') {
        linha.url = novoCaminho(linha.url);
      }

      return linha;
    });

    // Em lotes para evitar payloads gigantes
    for (let i = 0; i < linhas.length; i += 200) {
      const lote = linhas.slice(i, i + 200);
      const { error } = await (supabase as any)
        .from(tabela)
        .upsert(lote, { onConflict: SINGLETON_TABLES.has(tabela) ? 'user_id' : 'id' });
      if (error) {
        console.error(`Restauração: erro em ${tabela}`, error);
        resultado.erros.push({ tabela, mensagem: error.message });
      } else {
        resultado.inseridos += lote.length;
      }
    }
  }

  // Arquivos do armazenamento
  for (const arquivo of payload.arquivos || []) {
    try {
      const blob = base64ParaBlob(arquivo.base64, arquivo.contentType);
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(novoCaminho(arquivo.path), blob, { contentType: arquivo.contentType, upsert: true });
      if (error) throw error;
      resultado.arquivos += 1;
    } catch (e: any) {
      console.error('Restauração: erro ao enviar arquivo', arquivo.path, e);
      resultado.erros.push({ tabela: 'arquivos', mensagem: e?.message || 'falha no upload' });
    }
  }

  if (resultado.inseridos === 0 && resultado.arquivos === 0 && resultado.erros.length > 0) {
    throw new Error(resultado.erros.map(({ tabela, mensagem }) => `${tabela}: ${mensagem}`).join(' | '));
  }

  return resultado;
};

export const lerArquivoBackup = (file: File): Promise<BackupPayload> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch (e) {
        reject(new Error('Não foi possível ler o arquivo JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsText(file);
  });

/** Compatibilidade com chamadas antigas */
export const downloadBackupJSON = (dados: Record<string, unknown>, prefixo = 'backup-dental') => {
  const payload = { geradoEm: new Date().toISOString(), versao: 1, ...dados };
  baixarArquivo(JSON.stringify(payload, null, 2), `${prefixo}-${new Date().toISOString().slice(0, 10)}.json`);
};

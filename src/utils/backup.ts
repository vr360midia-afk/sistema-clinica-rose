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
  'assinaturas',
  'documentos_paciente',
  'documentos_clinicos',
  'odontogramas',
  'odontograma_versoes',
  'extratos_financeiros',
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

export type ProgressoBackup = { etapa: string; percentual: number };
export type OnProgresso = (p: ProgressoBackup) => void;

/** Lê todas as tabelas da conta atual (e opcionalmente os arquivos enviados) */
export const gerarBackupCompleto = async (
  incluirArquivos = true,
  onProgresso?: OnProgresso,
): Promise<BackupPayload> => {
  const userId = await getUserId();
  const tabelas: Record<string, any[]> = {};
  const totalEtapas = BACKUP_TABLES.length + (incluirArquivos ? 1 : 0);
  let etapaAtual = 0;
  const avancar = (etapa: string, extra = 0) => {
    const pct = Math.min(99, Math.round(((etapaAtual + extra) / totalEtapas) * 100));
    onProgresso?.({ etapa, percentual: pct });
  };

  for (const tabela of BACKUP_TABLES) {
    avancar(`Exportando ${tabela}`);
    const { data, error } = await (supabase as any)
      .from(tabela)
      .select('*')
      .eq('user_id', userId);
    if (error) {
      console.error(`Backup: erro ao ler ${tabela}`, error);
      tabelas[tabela] = [];
    } else {
      tabelas[tabela] = data || [];
    }
    etapaAtual++;
  }

  const arquivos: BackupArquivo[] = [];
  if (incluirArquivos) {
    try {
      avancar('Listando arquivos');
      const caminhos = await listarArquivos(userId);
      for (let i = 0; i < caminhos.length; i++) {
        const path = caminhos[i];
        avancar(`Baixando arquivos (${i + 1}/${caminhos.length})`, caminhos.length ? i / caminhos.length : 0);
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
    etapaAtual++;
  }

  onProgresso?.({ etapa: 'Gerando arquivo', percentual: 100 });

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
  onProgresso?: OnProgresso,
): Promise<number> => {
  const payload = await gerarBackupCompleto(incluirArquivos, onProgresso);
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
  porTabela: Record<string, number>;
};

const FOREIGN_KEYS: Record<string, Record<string, string>> = {
  anamneses: { paciente_id: 'pacientes' },
  consultas: { paciente_id: 'pacientes' },
  documentos_clinicos: { paciente_id: 'pacientes', assinatura_id: 'assinaturas' },
  documentos_paciente: { paciente_id: 'pacientes' },
  extratos_financeiros: { paciente_id: 'pacientes' },
  odontogramas: { paciente_id: 'pacientes' },
  odontograma_versoes: { paciente_id: 'pacientes' },
  orcamentos: { paciente_id: 'pacientes', parceiro_id: 'parceiros' },
  prontuarios: { paciente_id: 'pacientes', consulta_id: 'consultas' },
  transacoes: { paciente_id: 'pacientes', consulta_id: 'consultas', parceiro_id: 'parceiros' },
};

const gerarIdDestino = (idOrigem: string, userId: string) => {
  const origemHex = idOrigem.replace(/-/g, '');
  const usuarioHex = userId.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(origemHex) || !/^[0-9a-f]{32}$/i.test(usuarioHex)) {
    return crypto.randomUUID();
  }
  const hex = Array.from({ length: 32 }, (_, i) =>
    (parseInt(origemHex[i], 16) ^ parseInt(usuarioHex[i], 16)).toString(16),
  ).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const criarMapasDeIds = (payload: BackupPayload, crossAccount: boolean, userId: string) => {
  const mapas: Record<string, Map<string, string>> = {};
  if (!crossAccount) return mapas;

  for (const tabela of BACKUP_TABLES) {
    const registros = payload.tabelas[tabela];
    if (!Array.isArray(registros) || SINGLETON_TABLES.has(tabela) || tabela === 'user_roles') continue;
    mapas[tabela] = new Map(
      registros
        .filter((registro) => typeof registro?.id === 'string')
        .map((registro) => [registro.id, gerarIdDestino(registro.id, userId)]),
    );
  }
  return mapas;
};

const remapearCaminhoArquivo = (
  path: string,
  origem: string | undefined,
  destino: string,
  pacientes: Map<string, string> | undefined,
) => {
  const partes = path.split('/');
  if (origem && partes[0] === origem) partes[0] = destino;
  if (partes.length > 1 && pacientes?.has(partes[1])) partes[1] = pacientes.get(partes[1]) || partes[1];
  return partes.join('/');
};

/**
 * Restaura um backup na conta logada (pode ser outro usuário).
 * Os registros são reatribuídos ao usuário atual e mesclados por id (upsert).
 */
export const restaurarBackup = async (
  payload: BackupPayload,
  onProgresso?: OnProgresso,
): Promise<RestauracaoResultado> => {
  const userId = await getUserId();
  const resultado: RestauracaoResultado = { inseridos: 0, arquivos: 0, erros: [], porTabela: {} };

  if (!payload || typeof payload !== 'object' || !payload.tabelas || typeof payload.tabelas !== 'object') {
    throw new Error('Arquivo de backup inválido ou incompatível');
  }

  const origem = payload.origemUserId || Object.values(payload.tabelas)
    .flat()
    .find((registro) => typeof registro?.user_id === 'string')?.user_id;
  const crossAccount = Boolean(origem && origem !== userId);
  const mapasDeIds = criarMapasDeIds(payload, crossAccount, userId);
  const novoCaminho = (path: string) =>
    remapearCaminhoArquivo(path, origem, userId, mapasDeIds.pacientes);

  const totalRegistros = BACKUP_TABLES.reduce(
    (acc, t) => acc + (Array.isArray(payload.tabelas[t]) ? payload.tabelas[t].length : 0),
    0,
  );
  const totalArquivos = payload.arquivos?.length || 0;
  const totalUnidades = Math.max(1, totalRegistros + totalArquivos);
  let processadas = 0;
  const reportar = (etapa: string) =>
    onProgresso?.({ etapa, percentual: Math.min(99, Math.round((processadas / totalUnidades) * 100)) });

  reportar('Preparando restauração');

  for (const tabela of BACKUP_TABLES) {
    const registros = payload.tabelas[tabela];
    if (!Array.isArray(registros) || registros.length === 0) continue;


    // Permissões pertencem à conta de destino e nunca devem ser copiadas de outro usuário.
    if (crossAccount && tabela === 'user_roles') continue;

    const linhas = registros.map((r) => {
      const linha = { ...r, user_id: userId };

      // Registros únicos por conta: o conflito correto é o user_id, não o id de origem.
      if (SINGLETON_TABLES.has(tabela)) delete linha.id;

      // Em outra conta, cada registro recebe um novo id para não colidir com o original.
      if (crossAccount && typeof r.id === 'string' && mapasDeIds[tabela]?.has(r.id)) {
        linha.id = mapasDeIds[tabela].get(r.id);
      }

      // Mantém os relacionamentos apontando para os novos ids da conta de destino.
      for (const [coluna, tabelaPai] of Object.entries(FOREIGN_KEYS[tabela] || {})) {
        const valorAntigo = linha[coluna];
        if (typeof valorAntigo === 'string' && mapasDeIds[tabelaPai]?.has(valorAntigo)) {
          linha[coluna] = mapasDeIds[tabelaPai].get(valorAntigo);
        }
      }

      if (crossAccount && tabela === 'pacotes_procedimentos' && Array.isArray(linha.procedimento_ids)) {
        linha.procedimento_ids = linha.procedimento_ids.map(
          (id: unknown) => typeof id === 'string' ? mapasDeIds.procedimentos?.get(id) || id : id,
        );
      }

      // Documentos apontam para caminhos no armazenamento com o id do usuário de origem
      if (tabela === 'documentos_paciente' && typeof linha.url === 'string') {
        linha.url = novoCaminho(linha.url);
      }

      return linha;
    });

    // Em lotes para evitar payloads gigantes
    for (let i = 0; i < linhas.length; i += 200) {
      const lote = linhas.slice(i, i + 200);
      const query = (supabase as any).from(tabela);
      const { error } = await query.upsert(lote, {
        onConflict: SINGLETON_TABLES.has(tabela) ? 'user_id' : 'id',
      });
      if (error) {
        console.error(`Restauração: erro em ${tabela}`, error);
        resultado.erros.push({ tabela, mensagem: error.message });
      } else {
        resultado.inseridos += lote.length;
        resultado.porTabela[tabela] = (resultado.porTabela[tabela] || 0) + lote.length;
      }
      processadas += lote.length;
      reportar(`Restaurando ${tabela}`);
    }
  }

  // Arquivos do armazenamento
  const arquivosBackup = payload.arquivos || [];
  for (let i = 0; i < arquivosBackup.length; i++) {
    const arquivo = arquivosBackup[i];
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
    processadas += 1;
    reportar(`Enviando arquivos (${i + 1}/${arquivosBackup.length})`);
  }

  onProgresso?.({ etapa: 'Concluído', percentual: 100 });


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

import { supabase } from '@/integrations/supabase/client';

/** Exportação/importação completa dos dados da conta em um único arquivo JSON */

// Ordem importa: pais antes de filhos (chaves estrangeiras)
export const BACKUP_TABLES = [
  'configuracoes',
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
] as const;

export type BackupPayload = {
  geradoEm: string;
  versao: number;
  origemUserId?: string;
  tabelas: Record<string, any[]>;
};

const getUserId = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('Usuário não autenticado');
  return session.user.id;
};

/** Lê todas as tabelas da conta atual */
export const gerarBackupCompleto = async (): Promise<BackupPayload> => {
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

  return {
    geradoEm: new Date().toISOString(),
    versao: 2,
    origemUserId: userId,
    tabelas,
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
export const downloadBackupCompleto = async (prefixo = 'backup-dental'): Promise<number> => {
  const payload = await gerarBackupCompleto();
  const total = Object.values(payload.tabelas).reduce((acc, arr) => acc + arr.length, 0);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  baixarArquivo(JSON.stringify(payload, null, 2), `${prefixo}-${stamp}.json`);
  return total;
};

export type RestauracaoResultado = {
  inseridos: number;
  erros: { tabela: string; mensagem: string }[];
};

/**
 * Restaura um backup na conta logada (pode ser outro usuário).
 * Os registros são reatribuídos ao usuário atual e mesclados por id (upsert).
 */
export const restaurarBackup = async (payload: BackupPayload): Promise<RestauracaoResultado> => {
  const userId = await getUserId();
  const resultado: RestauracaoResultado = { inseridos: 0, erros: [] };

  if (!payload || typeof payload !== 'object' || !payload.tabelas || typeof payload.tabelas !== 'object') {
    throw new Error('Arquivo de backup inválido ou incompatível');
  }

  for (const tabela of BACKUP_TABLES) {
    const registros = payload.tabelas[tabela];
    if (!Array.isArray(registros) || registros.length === 0) continue;

    const linhas = registros.map((r) => {
      const linha = { ...r, user_id: userId };

      // Cada conta possui apenas uma configuração. Na migração entre contas,
      // o conflito correto é o user_id, não o id da conta de origem.
      if (tabela === 'configuracoes') delete linha.id;

      return linha;
    });

    // Em lotes para evitar payloads gigantes
    for (let i = 0; i < linhas.length; i += 200) {
      const lote = linhas.slice(i, i + 200);
      const { error } = await (supabase as any)
        .from(tabela)
        .upsert(lote, { onConflict: tabela === 'configuracoes' ? 'user_id' : 'id' });
      if (error) {
        console.error(`Restauração: erro em ${tabela}`, error);
        resultado.erros.push({ tabela, mensagem: error.message });
      } else {
        resultado.inseridos += lote.length;
      }
    }
  }

  if (resultado.inseridos === 0 && resultado.erros.length > 0) {
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

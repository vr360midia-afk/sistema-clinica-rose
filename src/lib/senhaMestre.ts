import { supabase } from '@/integrations/supabase/client';

export const hashSenha = async (senha: string): Promise<string> => {
  const enc = new TextEncoder().encode(`dentalrose::${senha}`);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

const getUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

export const getSenhaMestreHash = async (): Promise<string | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const { data } = await (supabase as any)
    .from('seguranca_config')
    .select('senha_mestre_hash')
    .eq('user_id', userId)
    .maybeSingle();
  return data?.senha_mestre_hash ?? null;
};

export const definirSenhaMestre = async (senha: string): Promise<void> => {
  const userId = await getUserId();
  if (!userId) throw new Error('Usuário não autenticado');
  const hash = await hashSenha(senha);
  const { error } = await (supabase as any)
    .from('seguranca_config')
    .upsert({ user_id: userId, senha_mestre_hash: hash }, { onConflict: 'user_id' });
  if (error) throw error;
};

export const verificarSenhaMestre = async (senha: string): Promise<boolean> => {
  const atual = await getSenhaMestreHash();
  if (!atual) return true; // nenhuma senha configurada ainda
  return (await hashSenha(senha)) === atual;
};

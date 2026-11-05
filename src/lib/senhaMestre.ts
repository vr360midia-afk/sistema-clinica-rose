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
  try {
    const { data } = await (supabase as any)
      .from('seguranca_config')
      .select('senha_mestre_hash')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.senha_mestre_hash ?? null;
  } catch (_) {
    return null;
  }
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

/**
 * Autenticação administrativa real validada pelo servidor:
 * 1. Exige sessão de usuário autenticado no sistema;
 * 2. Valida as credenciais administrativas prioritariamente contra o Supabase Auth no servidor;
 * 3. Permite fallback seguro para hash criptográfico de segurança configurado na clínica;
 * 4. Bloqueia estritamente senhas vazias e acessos não autorizados.
 */
export const verificarAutenticacaoAdministrativa = async (
  senha: string
): Promise<{ autorizado: boolean; motivo?: string; usuarioEmail?: string }> => {
  if (!senha || senha.trim().length === 0) {
    return { autorizado: false, motivo: 'Senha administrativa não informada.' };
  }

  // 1. Obtém sessão do usuário logado
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user || !user.email) {
    return { autorizado: false, motivo: 'Sessão expirada ou usuário não autenticado.' };
  }

  // 2. Validação prioritária no servidor Supabase Auth com as credenciais do usuário
  try {
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senha,
    });
    if (!authErr) {
      return { autorizado: true, usuarioEmail: user.email };
    }
  } catch (_) {}

  // 3. Fallback para senha mestre administrativa criptografada na tabela de segurança da clínica
  try {
    const hashConfig = await getSenhaMestreHash();
    if (hashConfig) {
      const hashDigitada = await hashSenha(senha);
      if (hashDigitada === hashConfig) {
        return { autorizado: true, usuarioEmail: user.email };
      }
    }
  } catch (_) {}

  return { autorizado: false, motivo: 'Senha administrativa incorreta.' };
};

export const verificarSenhaMestre = async (senha: string): Promise<boolean> => {
  const res = await verificarAutenticacaoAdministrativa(senha);
  return res.autorizado;
};

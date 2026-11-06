import { createClient } from '@supabase/supabase-js';

const PROD_URL = 'https://skonxcdojbkbfnfemayz.supabase.co';
const PROD_ANON_KEY = 'sb_publishable_aldVR3R-4sj0Fs-l1-mFSA_9gPUF9YZ';

async function main() {
  const supabase = createClient(PROD_URL, PROD_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
  if (error) {
    console.error('Erro ao ler configuracoes de producao:', error);
    process.exit(1);
  }
  console.log('DADOS REAIS DE PRODUCAO:');
  console.log('Nome Clinica:', data?.nome_clinica || data?.nomeClinica);
  console.log('Dentista Resp:', data?.dentista_responsavel || data?.dentistaResponsavel);
  console.log('CRO:', data?.cro || data?.cro_responsavel);
  console.log('CNPJ:', data?.cnpj);
  console.log('Telefone:', data?.telefone || data?.whatsapp_numero);
  console.log('Endereco:', data?.endereco);
  console.log('Chave PIX:', data?.chave_pix || data?.chavePix);
  console.log('Tipo Chave PIX:', data?.tipo_chave_pix || data?.tipoChavePix);
  console.log('Favorecido PIX:', data?.favorecido_pix || data?.favorecidoPix);
  console.log('Banco PIX:', data?.banco_pix || data?.bancoPix);
}

main().catch(console.error);

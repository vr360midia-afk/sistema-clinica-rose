/**
 * Utilitários de Links Amigáveis, Codificação e Segurança da Anamnese
 * Permite que pacientes preencham e assinem sem exigir login,
 * com links limpos (ex: /anamnese/nome-do-paciente) e bloqueio definitivo após resposta.
 */

export interface AnamnesePayload {
  id: string; // ID da anamnese
  pacienteId: string;
  pacienteNome: string;
  telefone?: string;
  cpf?: string;
  email?: string;
  queixaPrincipal?: string;
  historiaAtual?: string;
  historiaMedica?: string;
  alergias?: string;
  medicamentos?: string;
  habitos?: string;
  observacoes?: string;
  modo: 'preencher' | 'assinar';
  token: string;
  expiracao: string; // ISO string
  status?: string;
  dataAssinatura?: string;
  clinicaNome?: string;
}

/**
 * Converte o nome do paciente em um slug amigável para a URL
 * Ex: "Diego Duracenski" -> "diego-duracenski"
 */
export function slugifyNome(nome: string): string {
  if (!nome) return 'paciente';
  return (
    nome
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/[^a-z0-9]+/g, '-') // substitui caracteres especiais por hífen
      .replace(/^-+|-+$/g, '') // remove hífens das pontas
      .slice(0, 50) || 'paciente'
  );
}

/**
 * Reconverte o slug da URL de volta para o Nome Legível do Paciente
 * Ex: "diego-duracenski" -> "Diego Duracenski"
 */
export function unslugifyNome(slug: string): string {
  if (!slug) return 'Paciente';
  const clean = slug
    .replace(/^preencher-anamnese-/, '')
    .replace(/^assinar-anamnese-/, '')
    .replace(/^assinar-contrato-/, '')
    .replace(/^assinar-extrato-/, '')
    .replace(/^anamnese-paciente-/, '')
    .replace(/^anamnese-/, '')
    .replace(/^ficha-/, '')
    .replace(/-[a-f0-9]{4,10}$/i, ''); // remove eventual sufixo de hash

  const words = clean.split('-').filter(Boolean);
  if (words.length === 0) return 'Paciente';

  // Capitaliza cada palavra
  return words
    .map((word) => {
      const w = word.toLowerCase();
      // Conectivos em minúsculo
      if (['de', 'da', 'do', 'dos', 'das', 'e'].includes(w)) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/**
 * Codifica o payload em string Base64 URL-safe compacta
 */
export function codificarAnamnesePayload(dados: Partial<AnamnesePayload>): string {
  try {
    const json = JSON.stringify(dados);
    const utf8Bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (e) {
    console.error('Erro ao codificar anamnese:', e);
    return '';
  }
}

/**
 * Decodifica o payload Base64 URL-safe de volta para o objeto
 */
export function decodificarAnamnesePayload(encoded: string): AnamnesePayload | null {
  if (!encoded) return null;
  try {
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as AnamnesePayload;
  } catch (e) {
    console.error('Erro ao decodificar anamnese payload:', e);
    return null;
  }
}

/**
 * Gera o link amigável oficial para o paciente preencher ou assinar
 * Estilo amigável e limpo:
 * Ex: https://app.lentesemresinamaceio.com/anamnese/diego-duracenski?id=...&modo=preencher&token=...
 */
export function gerarLinkAmigavelAnamnese(params: {
  anamneseId: string;
  paciente: {
    id: string;
    nome: string;
    telefone?: string;
    cpf?: string;
    email?: string;
  };
  modo?: 'preencher' | 'assinar';
  token?: string;
  dadosExistentes?: {
    queixaPrincipal?: string;
    historiaAtual?: string;
    historiaMedica?: string;
    alergias?: string;
    medicamentos?: string;
    habitos?: string;
    observacoes?: string;
  };
}): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const token = params.token || Math.random().toString(36).substring(2, 12);
  const modo = params.modo || 'preencher';
  const slug = slugifyNome(params.paciente.nome);

  const expiracao = new Date();
  expiracao.setDate(expiracao.getDate() + 7); // 7 dias de validade

  // Se for apenas assinar e houver dados existentes pré-cadastrados pela clínica
  let paramD = '';
  const temDadosExistentes =
    modo === 'assinar' &&
    params.dadosExistentes &&
    Object.values(params.dadosExistentes).some((v) => Boolean(v && String(v).trim()));

  if (temDadosExistentes && params.dadosExistentes) {
    const compactPayload: Partial<AnamnesePayload> = {
      id: params.anamneseId,
      pacienteId: params.paciente.id,
      pacienteNome: params.paciente.nome,
      modo,
      token,
      expiracao: expiracao.toISOString(),
      queixaPrincipal: params.dadosExistentes.queixaPrincipal || undefined,
      historiaAtual: params.dadosExistentes.historiaAtual || undefined,
      historiaMedica: params.dadosExistentes.historiaMedica || undefined,
      alergias: params.dadosExistentes.alergias || undefined,
      medicamentos: params.dadosExistentes.medicamentos || undefined,
      habitos: params.dadosExistentes.habitos || undefined,
      observacoes: params.dadosExistentes.observacoes || undefined,
    };
    paramD = `&d=${codificarAnamnesePayload(compactPayload)}`;
  }

  // Nome da rota otimizada: {dominio}/{qual ficha a pessoa vai preencher ou assinar}-{nomedopaciente}
  // Ex: {dominio}/preencher-anamnese-diego-duracenski ou {dominio}/assinar-anamnese-diego-duracenski
  const prefixoFicha = modo === 'assinar' ? 'assinar-anamnese' : 'preencher-anamnese';
  const rotaPersonalizada = `${prefixoFicha}-${slug}`;

  // Armazena também em localStorage para cache imediato na mesma máquina/navegador
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const fullPayload = {
        id: params.anamneseId,
        pacienteId: params.paciente.id,
        pacienteNome: params.paciente.nome,
        telefone: params.paciente.telefone,
        cpf: params.paciente.cpf,
        modo,
        token,
        expiracao: expiracao.toISOString(),
        ...(params.dadosExistentes || {}),
      };
      window.localStorage.setItem(`anamnese_payload_${params.anamneseId}`, JSON.stringify(fullPayload));
      window.localStorage.setItem(`anamnese_payload_${token}`, JSON.stringify(fullPayload));
      window.localStorage.setItem(`anamnese_slug_${slug}`, JSON.stringify(fullPayload));
      window.localStorage.setItem(`anamnese_slug_${rotaPersonalizada}`, JSON.stringify(fullPayload));
    } catch (_) {}
  }

  // Monta a URL otimizada no padrão: {dominio}/{qual-ficha-preencher-ou-assinar}-{nomedopaciente}
  return `${origin}/${rotaPersonalizada}?id=${params.anamneseId}&token=${token}${paramD}`;
}

/**
 * Chave de armazenamento para bloqueio de link respondido
 */
export function getChaveBloqueio(anamneseId?: string, token?: string): string {
  return `anamnese_bloqueada_${anamneseId || token || ''}`;
}

/**
 * Verifica se esta ficha já foi respondida/assinada e deve ficar bloqueada contra novos acessos
 */
export function isAnamneseBloqueada(anamneseId?: string, token?: string, slug?: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    if (anamneseId && window.localStorage.getItem(`anamnese_bloqueada_${anamneseId}`)) {
      return true;
    }
    if (token && window.localStorage.getItem(`anamnese_bloqueada_${token}`)) {
      return true;
    }
    if (slug) {
      const clean = slug
        .replace(/^preencher-anamnese-/, '')
        .replace(/^assinar-anamnese-/, '')
        .replace(/^anamnese-/, '');
      if (
        window.localStorage.getItem(`anamnese_bloqueada_${slug}`) ||
        window.localStorage.getItem(`anamnese_bloqueada_${clean}`) ||
        window.localStorage.getItem(`anamnese_bloqueada_preencher-anamnese-${clean}`) ||
        window.localStorage.getItem(`anamnese_bloqueada_assinar-anamnese-${clean}`)
      ) {
        return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * Marca permanentemente a ficha como bloqueada contra acessos futuros
 */
export function marcarAnamneseBloqueada(
  anamneseId?: string,
  token?: string,
  dadosConclusao?: { dataHora: string; pacienteNome?: string }
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const info = JSON.stringify({
      bloqueado: true,
      dataHora: dadosConclusao?.dataHora || new Date().toISOString(),
      pacienteNome: dadosConclusao?.pacienteNome || '',
    });
    if (anamneseId) {
      window.localStorage.setItem(`anamnese_bloqueada_${anamneseId}`, info);
    }
    if (token) {
      window.localStorage.setItem(`anamnese_bloqueada_${token}`, info);
    }
  } catch (_) {}
}

import { supabase } from '@/integrations/supabase/client';

export interface RespostaPdfOficial {
  blob: Blob | null;
  blobUrl: string | null;
  signedUrl: string | null;
  path: string;
  sha256?: string;
  tamanho: number;
}

/**
 * Gera lista exaustiva e ordenada de caminhos candidatos no Supabase Storage
 * para um contrato formalizado, garantindo compatibilidade entre diferentes
 * versões e nomenclaturas sem duplicidade.
 */
export function obterCaminhosCandidatosStorage(
  idOuIdentificador: string,
  docOuSnap?: any
): string[] {
  const cleanId = String(idOuIdentificador || '').trim().replace(/^contratos\//, '').replace(/\.pdf$/i, '');
  const idUpper = cleanId.toUpperCase();
  const idLower = cleanId.toLowerCase();

  const code8Match = cleanId.match(/^(?:CTR-)?([0-9a-f]{8})$/i);
  const code8 = code8Match ? code8Match[1].toUpperCase() : null;

  const rawCandidates: (string | null | undefined)[] = [
    // 1. Caminhos explicitamente vinculados no registro do documento clínico ou snapshot
    docOuSnap?.pdfPath,
    docOuSnap?.pdf_path,
    docOuSnap?.itens?.pdfPath,
    docOuSnap?.snapshot?.pdfPath,
    docOuSnap?.arquivo,
    docOuSnap?.url,

    // 2. Caminhos canônicos pelo identificador principal (ex: CTR-ADC49D8D)
    cleanId ? `contratos/${cleanId}/Contrato_Assinado_${cleanId}.pdf` : null,
    cleanId ? `contratos/${cleanId}/contrato_formalizado.pdf` : null,
    cleanId ? `contratos/${cleanId}/Contrato_Assinado_${idUpper}.pdf` : null,
    cleanId ? `contratos/${idUpper}/Contrato_Assinado_${idUpper}.pdf` : null,
    cleanId ? `contratos/${idUpper}/contrato_formalizado.pdf` : null,

    // 3. Caminhos canônicos caso id seja UUID ou código de 8 dígitos
    docOuSnap?.id ? `contratos/${docOuSnap.id}/Contrato_Assinado_${docOuSnap.id}.pdf` : null,
    docOuSnap?.id ? `contratos/${docOuSnap.id}/contrato_formalizado.pdf` : null,
    docOuSnap?.identificador ? `contratos/${docOuSnap.identificador}/Contrato_Assinado_${docOuSnap.identificador}.pdf` : null,
    docOuSnap?.identificador ? `contratos/${docOuSnap.identificador}/contrato_formalizado.pdf` : null,
    docOuSnap?.itens?.contratoId ? `contratos/${docOuSnap.itens.contratoId}/Contrato_Assinado_${docOuSnap.itens.contratoId}.pdf` : null,
    docOuSnap?.itens?.contratoId ? `contratos/${docOuSnap.itens.contratoId}/contrato_formalizado.pdf` : null,

    // 4. Formato CTR com 8 dígitos hexadecimais
    code8 ? `contratos/CTR-${code8}/Contrato_Assinado_CTR-${code8}.pdf` : null,
    code8 ? `contratos/CTR-${code8}/contrato_formalizado.pdf` : null,
    code8 ? `contratos/${code8}/Contrato_Assinado_${code8}.pdf` : null,
    code8 ? `contratos/${code8.toLowerCase()}/Contrato_Assinado_${code8.toLowerCase()}.pdf` : null,
  ];

  const uniquePaths: string[] = [];
  for (const c of rawCandidates) {
    if (!c || typeof c !== 'string') continue;
    const clean = c.replace(/^.*?documentos-pacientes\//, '').replace(/^\/+/, '').trim();
    if (clean && !uniquePaths.includes(clean)) {
      uniquePaths.push(clean);
    }
  }

  return uniquePaths;
}

/**
 * Calcula o hash SHA-256 de um Blob ou ArrayBuffer no navegador de forma determinística
 */
export async function calcularSha256Binario(data: Blob | ArrayBuffer | Uint8Array): Promise<string> {
  let buffer: ArrayBuffer;
  if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer;
  } else {
    buffer = data;
  }

  const subtle = window.crypto?.subtle || (window as any).msCrypto?.subtle;
  if (!subtle) {
    throw new Error('Criptografia Web Crypto indisponível no ambiente');
  }

  const hashBuffer = await subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * Obtém o PDF oficial definitivo arquivado no Storage (documentos-pacientes).
 * Se o usuário estiver deslogado (fluxo público do paciente), utiliza a Edge Function
 * ou signedUrl fornecida para recuperar o binário com integridade estrita.
 */
export async function obterPdfContratoOficialDefinitivo(
  identificador: string,
  docOuSnap?: any,
  token?: string,
  signedUrlPrevia?: string | null
): Promise<RespostaPdfOficial | null> {
  const candidatePaths = obterCaminhosCandidatosStorage(identificador, docOuSnap);

  // 1. Tenta recuperar via Storage autenticado (sessão do consultório / dentista)
  for (const p of candidatePaths) {
    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from('documentos-pacientes')
        .download(p);

      if (!dlErr && blob && blob.size > 1000) {
        let signedUrl: string | null = null;
        try {
          const { data: sData } = await supabase.storage
            .from('documentos-pacientes')
            .createSignedUrl(p, 3600);
          if (sData?.signedUrl) signedUrl = sData.signedUrl;
        } catch (_) {}

        const sha256 = await calcularSha256Binario(blob).catch(() => undefined);

        return {
          blob,
          blobUrl: URL.createObjectURL(blob),
          signedUrl,
          path: p,
          sha256,
          tamanho: blob.size,
        };
      }
    } catch (_) {}
  }

  // 2. Se temos uma signedUrl previamente fornecida ou podemos obtê-la via Edge Function
  let targetSignedUrl = signedUrlPrevia || null;

  if (!targetSignedUrl && token) {
    try {
      const { data: edgeRes } = await supabase.functions.invoke('contrato-publico', {
        body: {
          action: 'get_pdf_signed_url',
          id: identificador,
          token,
        },
      });
      if (edgeRes?.ok && edgeRes.signedUrl) {
        targetSignedUrl = edgeRes.signedUrl;
      }
    } catch (_) {}
  }

  if (targetSignedUrl) {
    try {
      const res = await fetch(targetSignedUrl);
      if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 1000) {
          const sha256 = await calcularSha256Binario(blob).catch(() => undefined);
          return {
            blob,
            blobUrl: URL.createObjectURL(blob),
            signedUrl: targetSignedUrl,
            path: candidatePaths[0] || `contratos/${identificador}/Contrato_Assinado_${identificador}.pdf`,
            sha256,
            tamanho: blob.size,
          };
        }
      }
    } catch (_) {}
  }

  // 3. Fallback de createSignedUrl caso download direto retorne 403 mas Storage permita URL assinada
  for (const p of candidatePaths) {
    try {
      const { data: sData, error: sErr } = await supabase.storage
        .from('documentos-pacientes')
        .createSignedUrl(p, 3600);

      if (!sErr && sData?.signedUrl) {
        try {
          const res = await fetch(sData.signedUrl);
          if (res.ok) {
            const blob = await res.blob();
            if (blob && blob.size > 1000) {
              const sha256 = await calcularSha256Binario(blob).catch(() => undefined);
              return {
                blob,
                blobUrl: URL.createObjectURL(blob),
                signedUrl: sData.signedUrl,
                path: p,
                sha256,
                tamanho: blob.size,
              };
            }
          }
        } catch (_) {}

        return {
          blob: null,
          blobUrl: null,
          signedUrl: sData.signedUrl,
          path: p,
          tamanho: 0,
        };
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Realiza o download determinístico no navegador de um Blob ou Signed URL
 * garantindo o nome canônico do arquivo oficial sem regenerar documento.
 */
export async function dispararDownloadPdfOficial(
  resultado: RespostaPdfOficial,
  nomeArquivoCanonic?: string
): Promise<boolean> {
  const filename = nomeArquivoCanonic || (resultado.path.split('/').pop() || 'Contrato_Assinado.pdf');

  if (resultado.blob) {
    const url = URL.createObjectURL(resultado.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  if (resultado.signedUrl) {
    try {
      const res = await fetch(resultado.signedUrl);
      if (res.ok) {
        const b = await res.blob();
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
      }
    } catch (_) {}

    // Fallback de navegação se fetch falhar por CORS
    const a = document.createElement('a');
    a.href = resultado.signedUrl;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }

  return false;
}

/**
 * Detecta se existem divergências entre os dados históricos formalizados no contrato
 * e as configurações cadastrais vigentes na clínica (ex: alteração superveniente de PF para PJ).
 * Conforme determinação jurídica, sinaliza para revisão humana sem modificar nem sobrescrever o PDF arquivado.
 */
export function auditarInconsistenciasContratoFormalizado(
  snapshotFormalizado?: any,
  configuracoesAtuais?: any
): { divergente: boolean; mensagens: string[] } {
  const mensagens: string[] = [];
  if (!snapshotFormalizado || !configuracoesAtuais) {
    return { divergente: false, mensagens: [] };
  }

  const clinicaContrato = snapshotFormalizado.clinica || {};
  const nomeContrato = (clinicaContrato.nome || '').trim().toLowerCase();
  const cnpjContrato = (clinicaContrato.cnpj || '').trim().replace(/\D/g, '');
  const tipoContratadaContrato = snapshotFormalizado.contratadaTipo || (cnpjContrato.length > 11 ? 'pj' : 'pf');

  const nomeAtual = (configuracoesAtuais.nomeClinica || configuracoesAtuais.nome || '').trim().toLowerCase();
  const cnpjAtual = (configuracoesAtuais.cnpj || configuracoesAtuais.documento || '').trim().replace(/\D/g, '');
  const tipoAtual = cnpjAtual.length > 11 ? 'pj' : 'pf';

  if (nomeContrato && nomeAtual && nomeContrato !== nomeAtual) {
    mensagens.push(`Identificação da Contratada: formalizado como "${clinicaContrato.nome}", cadastro atual da clínica é "${configuracoesAtuais.nomeClinica || configuracoesAtuais.nome}".`);
  }

  if (cnpjContrato && cnpjAtual && cnpjContrato !== cnpjAtual) {
    mensagens.push(`Documento da Contratada: formalizado com "${clinicaContrato.cnpj}", cadastro atual possui "${configuracoesAtuais.cnpj}".`);
  }

  if (tipoContratadaContrato !== tipoAtual) {
    mensagens.push(`Natureza da Contratada: formalizado como ${tipoContratadaContrato.toUpperCase()}, atual cadastrado como ${tipoAtual.toUpperCase()}.`);
  }

  return {
    divergente: mensagens.length > 0,
    mensagens,
  };
}

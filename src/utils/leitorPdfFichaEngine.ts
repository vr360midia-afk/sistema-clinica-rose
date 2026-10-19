import { GoogleGenerativeAI } from '@google/generative-ai';
import { Paciente } from '@/types/shared';

export interface DadosFichaExtraida {
  nome: string;
  cpf?: string;
  telefone?: string;
  dataNascimento?: string;
  alergias?: string;
  medicamentos?: string;
  queixaPrincipal?: string;
  historicoMedico?: string;
  observacoes?: string;
  fonteDeteccao: 'ia' | 'texto_pdf' | 'nome_arquivo';
}

/**
 * Remove acentos e caracteres especiais para comparação
 */
export function normalizarTexto(txt?: string): string {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formata nome capitalizado (ex.: "DIEGO DURACENSKI" -> "Diego Duracenski")
 */
export function capitalizarNome(nome: string): string {
  const minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return nome
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, index) => {
      if (index > 0 && minusculas.includes(palavra)) {
        return palavra;
      }
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ');
}

/**
 * Extrai nome provável a partir do nome do arquivo
 * Ex.: "Ficha_Anamnese_Diego_Duracenski.pdf" -> "Diego Duracenski"
 */
export function extrairNomeDeNomeArquivo(filename: string): string {
  let nome = filename.replace(/\.[a-zA-Z0-9]+$/i, ''); // remove extensão

  // Remove prefixos comuns em arquivos clínicos
  nome = nome.replace(/^(?:ficha(?:[_\s]+(?:cl[ií]nica|anamnese|cadastral|de\s+anamnese))?|anamnese|prontu[aá]rio|documento|cadastro|exame|termo)[_\s\-:]+/i, '');
  
  // Remove sufixos comuns
  nome = nome.replace(/[_\s\-:]+(?:ficha|anamnese|prontu[aá]rio|assinado|manual|digital|scan(?:ned)?|page_\d+|\d{6,})$/i, '');
  
  // Substitui separadores por espaços
  nome = nome.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();

  // Remove números soltos ou datas no início ou fim
  nome = nome.replace(/^\d+[\s\-]+/, '').replace(/[\s\-]+\d+$/, '').trim();

  if (nome.length >= 3) {
    return capitalizarNome(nome);
  }
  return '';
}

/**
 * Extrai texto bruto contido nos streams de um PDF usando busca por operadores PDF
 */
export function extrairTextoDeBufferPdf(buffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 16384;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    const fragmentos: string[] = [];

    // Padrão 1: Operadores de texto direto: (Texto aqui) Tj ou (Texto) '
    const regexTj = /\(([^)]+)\)\s*(?:Tj|'|")/g;
    let m;
    while ((m = regexTj.exec(binary)) !== null) {
      const limpo = limparTextoPdf(m[1]);
      if (limpo) fragmentos.push(limpo);
    }

    // Padrão 2: Operador TJ com array de fragmentos: [(Texto 1) -10 (Texto 2)] TJ
    const regexArrayTJ = /\[([^\]]+)\]\s*TJ/g;
    while ((m = regexArrayTJ.exec(binary)) !== null) {
      const conteudo = m[1];
      const subRegex = /\(([^)]+)\)/g;
      let sm;
      while ((sm = subRegex.exec(conteudo)) !== null) {
        const limpo = limparTextoPdf(sm[1]);
        if (limpo) fragmentos.push(limpo);
      }
    }

    return fragmentos.join(' ');
  } catch (err) {
    console.warn('Erro ao decodificar buffer do PDF:', err);
    return '';
  }
}

function limparTextoPdf(raw: string): string {
  return raw
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r/g, ' ')
    .replace(/\\n/g, ' ')
    .replace(/\\t/g, ' ')
    .trim();
}

/**
 * Analisa o texto bruto extraído e busca campos estruturados via Regex
 */
export function analisarTextoFicha(texto: string): Partial<DadosFichaExtraida> {
  if (!texto || texto.length < 5) return {};

  const dados: Partial<DadosFichaExtraida> = {};

  // Nome do paciente
  const regexNome = /(?:nome(?:\s+do\s+paciente|\s+completo)?|paciente)[:\s]+([A-Za-zÀ-ÿ\s]{3,60})(?=[,\n\r;]|cpf|data|tel|$)/i;
  const matchNome = texto.match(regexNome);
  if (matchNome && matchNome[1]) {
    const nomeLimpo = matchNome[1].trim();
    if (nomeLimpo.length >= 3 && !/^(completo|do paciente|abaixo)$/i.test(nomeLimpo)) {
      dados.nome = capitalizarNome(nomeLimpo);
    }
  }

  // CPF
  const regexCpf = /(?:\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b)/;
  const matchCpf = texto.match(regexCpf);
  if (matchCpf) {
    dados.cpf = matchCpf[0];
  }

  // Telefone / Celular
  const regexTel = /(?:tel(?:efone)?|cel(?:ular)?|whatsapp)?[:\s]*((?:\(?\d{2}\)?\s*)?(?:9\s*)?\d{4}[-.\s]?\d{4})/i;
  const matchTel = texto.match(regexTel);
  if (matchTel && matchTel[1]) {
    dados.telefone = matchTel[1].trim();
  }

  // Data de nascimento
  const regexDataNasc = /(?:nasc(?:imento)?|data\s+nasc)[:\s]*(\d{2}[/.-]\d{2}[/.-]\d{4})/i;
  const matchDataNasc = texto.match(regexDataNasc);
  if (matchDataNasc && matchDataNasc[1]) {
    dados.dataNascimento = matchDataNasc[1].replace(/[-.]/g, '/');
  }

  // Alergias
  const regexAlergias = /alergia[s]?[:\s]+([^\n\r;.]+)/i;
  const matchAlergias = texto.match(regexAlergias);
  if (matchAlergias && matchAlergias[1] && !/n[aã]o|nenhuma/i.test(matchAlergias[1])) {
    dados.alergias = matchAlergias[1].trim();
  }

  // Medicamentos
  const regexMed = /medicamento[s]?(?:\s+em\s+uso)?[:\s]+([^\n\r;.]+)/i;
  const matchMed = texto.match(regexMed);
  if (matchMed && matchMed[1] && !/n[aã]o|nenhum/i.test(matchMed[1])) {
    dados.medicamentos = matchMed[1].trim();
  }

  // Queixa Principal
  const regexQueixa = /queixa(?:\s+principal)?[:\s]+([^\n\r;.]+)/i;
  const matchQueixa = texto.match(regexQueixa);
  if (matchQueixa && matchQueixa[1]) {
    dados.queixaPrincipal = matchQueixa[1].trim();
  }

  return dados;
}

/**
 * Busca o paciente cadastrado mais próximo a partir do nome ou CPF
 */
export function encontrarPacienteCorrespondente(
  candidatoNome: string,
  candidatoCpf: string | undefined,
  pacientes: Paciente[]
): Paciente | null {
  if (!pacientes || pacientes.length === 0) return null;

  // 1. Busca por CPF se presente
  if (candidatoCpf) {
    const cpfDigitos = candidatoCpf.replace(/\D/g, '');
    if (cpfDigitos.length === 11) {
      const matchCpf = pacientes.find((p) => (p.cpf || '').replace(/\D/g, '') === cpfDigitos);
      if (matchCpf) return matchCpf;
    }
  }

  if (!candidatoNome || candidatoNome.trim().length < 3) return null;

  const nomeNorm = normalizarTexto(candidatoNome);

  // 2. Busca exata por nome
  const matchExato = pacientes.find((p) => normalizarTexto(p.nome) === nomeNorm);
  if (matchExato) return matchExato;

  // 3. Busca por contenção (ex.: "Diego Duracenski" contido em "Diego Duracenski da Silva")
  const partesCandidato = nomeNorm.split(' ').filter((p) => p.length > 2);
  if (partesCandidato.length >= 2) {
    const matchContem = pacientes.find((p) => {
      const pacNorm = normalizarTexto(p.nome);
      // Se todas as partes do candidato existem no nome do paciente ou vice-versa
      const todasPartesEstao = partesCandidato.every((parte) => pacNorm.includes(parte));
      return todasPartesEstao;
    });
    if (matchContem) return matchContem;
  }

  return null;
}

/**
 * Processamento via Google Gemini AI ou OpenAI para fichas manuais digitalizadas / escaneadas
 */
export async function extrairComIa(
  file: File,
  geminiApiKey?: string,
  openaiApiKey?: string
): Promise<DadosFichaExtraida | null> {
  try {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');

    const prompt = `Você é um assistente odontológico/médico de alta precisão.
Analise a ficha clínica/anamnese em anexo (pode ser digitalizada, foto, escrita à mão ou em PDF).
Extraia os seguintes campos do paciente e responda ESTRITAMENTE em formato JSON sem formatação markdown:
{
  "nome": "Nome completo do paciente",
  "cpf": "CPF (apenas números ou formatado se houver)",
  "telefone": "Telefone ou celular do paciente",
  "dataNascimento": "Data de nascimento (DD/MM/AAAA ou YYYY-MM-DD)",
  "alergias": "Alergias relatadas ou null",
  "medicamentos": "Medicamentos em uso contínuo ou null",
  "queixaPrincipal": "Queixa principal ou motivo da consulta ou null",
  "historicoMedico": "Doenças pregressas, diabetes, hipertensão, etc. ou null",
  "observacoes": "Resumo clínico adicional ou observações relevantes"
}
Se algum campo não estiver presente ou for ilegível, deixe como null. O campo "nome" é o mais importante.`;

    // 1. Google Gemini (suporta PDF nativamente e imagens)
    if (geminiApiKey) {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64,
            mimeType: mimeType,
          },
        },
      ]);

      const response = await result.response;
      let text = response.text() || '';
      text = text.replace(/```json|```/g, '').trim();

      const parsed = JSON.parse(text);
      if (parsed.nome) {
        return {
          nome: capitalizarNome(parsed.nome),
          cpf: parsed.cpf || undefined,
          telefone: parsed.telefone || undefined,
          dataNascimento: parsed.dataNascimento || undefined,
          alergias: parsed.alergias || undefined,
          medicamentos: parsed.medicamentos || undefined,
          queixaPrincipal: parsed.queixaPrincipal || undefined,
          historicoMedico: parsed.historicoMedico || undefined,
          observacoes: parsed.observacoes || undefined,
          fonteDeteccao: 'ia',
        };
      }
    }

    // 2. OpenAI fallback se configurado
    if (openaiApiKey && mimeType.startsWith('image/')) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
              ],
            },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        let text = data?.choices?.[0]?.message?.content || '{}';
        text = text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.nome) {
          return {
            nome: capitalizarNome(parsed.nome),
            cpf: parsed.cpf || undefined,
            telefone: parsed.telefone || undefined,
            dataNascimento: parsed.dataNascimento || undefined,
            alergias: parsed.alergias || undefined,
            medicamentos: parsed.medicamentos || undefined,
            queixaPrincipal: parsed.queixaPrincipal || undefined,
            historicoMedico: parsed.historicoMedico || undefined,
            observacoes: parsed.observacoes || undefined,
            fonteDeteccao: 'ia',
          };
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao processar documento com IA:', err);
  }

  return null;
}

/**
 * Converte arquivo File para string base64 pura
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

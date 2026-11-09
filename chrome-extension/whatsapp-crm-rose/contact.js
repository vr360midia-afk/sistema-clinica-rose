// Injetado exclusivamente em web.whatsapp.com
// Identifica apenas os dados visíveis no cabeçalho da conversa ativa (sem varrer mensagens ou APIs privadas)
// Em conformidade estrita com LGPD e políticas do Chrome Web Store

let lastSerialized = '';

const IGNORED_TITLES = [
  'dados do contato',
  'dados da empresa',
  'dados do grupo',
  'dados da comunidade',
  'pesquisar...',
  'pesquisar',
  'mais opções',
  'anexar',
  'mensagens temporárias',
  'mensagens favoritas',
  'silenciar notificações',
  'fechar',
  'voltar',
  'foto do perfil',
  'status',
  'menu',
  'chamada de voz',
  'chamada de vídeo',
  'nova conversa',
  'configurações'
];

function isIgnored(text) {
  if (!text) return true;
  const lower = text.trim().toLowerCase();
  if (lower.length === 0) return true;
  return IGNORED_TITLES.some(ignored => lower === ignored || lower.startsWith(ignored));
}

function isPhone(str) {
  if (!str) return false;
  const clean = str.trim();
  // Se contiver letras, não é um número de telefone direto
  if (/[a-zA-ZÀ-ÿ]/.test(clean)) return false;
  const digits = clean.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function extractEmbeddedPhone(text) {
  if (!text) return '';
  const clean = text.trim();
  // Ignora se for texto de sistema
  if (isIgnored(clean)) return '';

  // Padrão brasileiro (com ou sem DDI 55, DDD, 9 dígitos)
  const matchBr = clean.match(/(?:\+?55\s?)?(?:\(?0?[1-9]{2}\)?\s?)?(?:9\s?)?[6-9]\d{3}[-\s.]?\d{4}/);
  if (matchBr) {
    const digits = matchBr[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 13) return matchBr[0].trim();
  }

  // Padrão internacional genérico (10 a 15 dígitos com pontuação)
  const matchGeneric = clean.match(/\+?\d[\d\s().-]{8,18}\d/);
  if (matchGeneric) {
    const digits = matchGeneric[0].replace(/\D/g, '');
    if (digits.length >= 10 && digits.length <= 15 && !/[a-zA-ZÀ-ÿ]/.test(matchGeneric[0])) {
      return matchGeneric[0].trim();
    }
  }

  return '';
}

function extractContactData() {
  const header = document.querySelector('#main header, [data-testid="conversation-header"], div[data-testid="conversation-panel-wrapper"] header');
  if (!header) return null;

  let rawTitle = '';

  // 1. Prioridade para seletor semântico oficial do WhatsApp Web
  const testIdTitle = header.querySelector('[data-testid="conversation-info-header-chat-title"]');
  if (testIdTitle) {
    const t = testIdTitle.getAttribute('title')?.trim() || testIdTitle.textContent?.trim() || '';
    if (t && !isIgnored(t)) rawTitle = t;
  }

  // 2. Procura título em spans dentro de regiões clicáveis de título (exclui avatares e botões de ação)
  if (!rawTitle) {
    const titleCandidates = header.querySelectorAll('div[role="button"] span[title], span[dir="auto"][title], span[title]');
    for (const el of titleCandidates) {
      const candidate = el.getAttribute('title')?.trim() || '';
      if (candidate && !isIgnored(candidate)) {
        rawTitle = candidate;
        break;
      }
    }
  }

  // 3. Fallback: texto em spans dir="auto"
  if (!rawTitle) {
    const textSpans = header.querySelectorAll('span[dir="auto"]');
    for (const el of textSpans) {
      const candidate = el.textContent?.trim() || '';
      if (candidate && candidate.length > 1 && !isIgnored(candidate)) {
        rawTitle = candidate;
        break;
      }
    }
  }

  let detectedPhone = '';
  let detectedName = '';

  if (isPhone(rawTitle)) {
    detectedPhone = rawTitle;
    detectedName = '';
  } else if (rawTitle) {
    detectedName = rawTitle.slice(0, 120);
  }

  // Se o telefone ainda não foi detectado (contato salvo com nome no WhatsApp), busca no cabeçalho
  if (!detectedPhone) {
    const allSpans = header.querySelectorAll('span, p');
    for (const span of allSpans) {
      const txt = span.getAttribute('title') || span.textContent || '';
      const candidate = extractEmbeddedPhone(txt);
      if (candidate) {
        detectedPhone = candidate;
        break;
      }
    }
  }

  // Se ainda não achou o telefone, verifica se o painel lateral de dados do contato está aberto no DOM
  if (!detectedPhone) {
    const rightDrawer = document.querySelector('[data-testid="contact-info"], section[data-testid="chat-info-drawer"]');
    if (rightDrawer) {
      const drawerSpans = rightDrawer.querySelectorAll('span[title], span[dir="auto"], span[dir="ltr"], p');
      for (const span of drawerSpans) {
        const txt = span.getAttribute('title') || span.textContent || '';
        const candidate = extractEmbeddedPhone(txt);
        if (candidate) {
          detectedPhone = candidate;
          break;
        }
      }
    }
  }

  return {
    name: detectedName,
    phone: detectedPhone
  };
}

function scanHeader() {
  const contact = extractContactData();
  if (!contact) return;

  const serialized = JSON.stringify(contact);
  if (serialized !== lastSerialized) {
    lastSerialized = serialized;
    chrome.runtime.sendMessage({
      type: 'CONTACT_CHANGED',
      contact,
    }).catch(() => {});
  }
}

// Observa mutações no DOM do WhatsApp para capturar trocas instantâneas
const observer = new MutationObserver(() => {
  clearTimeout(window.__roseScanTimeout);
  window.__roseScanTimeout = setTimeout(scanHeader, 250);
});

observer.observe(document.documentElement, { subtree: true, childList: true });

// Adiciona listener de clique na lista de conversas para reação instantânea
document.addEventListener('click', (e) => {
  const isChatListClick = e.target.closest('#pane-side, [data-testid="chat-list"]');
  if (isChatListClick) {
    setTimeout(scanHeader, 150);
    setTimeout(scanHeader, 500);
  }
}, true);

// Scan inicial
scanHeader();

// Permite consulta ativa sob demanda enviada pelo painel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_VISIBLE_CONTACT') {
    const contact = extractContactData() || { name: '', phone: '' };
    sendResponse(contact);
  }
});

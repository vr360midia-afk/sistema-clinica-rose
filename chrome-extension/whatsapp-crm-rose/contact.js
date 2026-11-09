// Injetado exclusivamente em web.whatsapp.com
// Identifica apenas os dados visíveis no cabeçalho da conversa ativa (sem varrer mensagens ou APIs privadas)
// Em conformidade estrita com LGPD e políticas do Chrome Web Store

let lastSerialized = '';

function extractPhoneFromText(text) {
  if (!text) return '';
  const clean = text.trim();
  // Se contiver números com padrão de telefone internacional ou brasileiro
  const digitsOnly = clean.replace(/\D/g, '');
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return clean;
  }
  return '';
}

function scanHeader() {
  const header = document.querySelector('#main header');
  if (!header) return;

  // Busca elemento de título visível
  const titleEl = header.querySelector('[title]');
  const rawTitle = titleEl?.getAttribute('title')?.trim() || '';

  // Se o título for um número de telefone direto
  const isPhoneDirect = /^\+?[\d\s().-]{10,20}$/.test(rawTitle);
  const detectedPhone = isPhoneDirect ? rawTitle : '';
  const detectedName = isPhoneDirect ? '' : rawTitle.slice(0, 120);

  // Tenta também verificar subtítulo se houver número exibido (ex: em contatos sem nome salvo)
  let secondaryPhone = '';
  if (!detectedPhone) {
    const spanList = header.querySelectorAll('span[dir="auto"], span[title]');
    for (const span of spanList) {
      const txt = span.textContent?.trim() || '';
      const candidate = extractPhoneFromText(txt);
      if (candidate && /^\+?[\d\s().-]{10,20}$/.test(candidate)) {
        secondaryPhone = candidate;
        break;
      }
    }
  }

  const contact = {
    name: detectedName,
    phone: detectedPhone || secondaryPhone,
  };

  const serialized = JSON.stringify(contact);
  if (serialized !== lastSerialized) {
    lastSerialized = serialized;
    chrome.runtime.sendMessage({
      type: 'CONTACT_CHANGED',
      contact,
    }).catch(() => {});
  }
}

const observer = new MutationObserver(() => {
  clearTimeout(window.__roseScanTimeout);
  window.__roseScanTimeout = setTimeout(scanHeader, 400);
});

observer.observe(document.documentElement, { subtree: true, childList: true });

// Scan inicial
scanHeader();

// Permite consulta ativa sob demanda enviada pelo painel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'GET_VISIBLE_CONTACT') {
    scanHeader();
    const header = document.querySelector('#main header');
    const title = header?.querySelector('[title]')?.getAttribute('title')?.trim() || '';
    const isPhone = /^\+?[\d\s().-]{10,20}$/.test(title);
    sendResponse({
      name: isPhone ? '' : title.slice(0, 120),
      phone: isPhone ? title : '',
    });
  }
});


// Background Service Worker (Manifest V3)
// Gerencia a abertura do SidePanel no WhatsApp Web e repasse de eventos entre abas

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[Background] Erro ao configurar sidePanel:', err));

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'CONTACT_CHANGED' && sender.tab?.url?.startsWith('https://web.whatsapp.com/')) {
    chrome.runtime.sendMessage({
      type: 'CONTACT_CHANGED',
      contact: message.contact,
    }).catch(() => {});
  }
});


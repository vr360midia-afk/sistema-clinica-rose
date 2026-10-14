import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/common/ErrorBoundary.tsx';

// Lida com atualização de chunks após novos deploys do Vite
window.addEventListener('vite:preloadError', () => {
  console.warn('Vite preload error detectado (nova versão disponível). Recarregando...');
  window.location.reload();
});

// Captura erros globais não tratados, ignorando erros externos inofensivos
window.addEventListener('error', (event) => {
  const msg = event.message || '';

  // Ignora "Script error." (erros de scripts de terceiros, extensões ou cross-origin)
  if (msg === 'Script error.' || !event.error) {
    console.warn('Erro externo ou de extensão ignorado:', msg);
    return;
  }

  // Ignora erros conhecidos e inofensivos do navegador
  if (
    msg.includes('ResizeObserver') ||
    msg.includes('Loading chunk') ||
    msg.includes('Failed to fetch dynamically imported module')
  ) {
    if (msg.includes('Loading chunk') || msg.includes('Failed to fetch dynamically imported module')) {
      window.location.reload();
    }
    return;
  }

  // Só substitui a tela se a aplicação falhou completamente antes da renderização inicial
  const root = document.getElementById('root');
  if (root && (!root.hasChildNodes() || root.children.length === 0)) {
    root.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: #f8fafc; font-family: system-ui, sans-serif; padding: 20px;">
        <div style="max-width: 480px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); text-align: center;">
          <div style="font-size: 36px; margin-bottom: 12px;">🔄</div>
          <h1 style="font-size: 20px; font-weight: bold; margin-bottom: 8px; color: #f1f5f9;">Atualização Detectada</h1>
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 20px;">Uma nova versão do sistema foi atualizada. Clique abaixo para recarregar.</p>
          <button onclick="window.location.reload(true)" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 14px; margin-right: 8px;">
            Recarregar Aplicativo
          </button>
        </div>
      </div>
    `;
  }
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Registro do service worker (PWA instalável)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Error boundary to catch React runtime errors globally
window.addEventListener('error', (event) => {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; background: #fee2e2; color: #991b1b; height: 100vh; overflow: auto; font-family: monospace;">
        <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">Ocorreu um erro no aplicativo</h1>
        <p style="margin-bottom: 10px;">Por favor, envie um print desta tela para o suporte.</p>
        <p style="font-weight: bold; margin-bottom: 5px;">Erro:</p>
        <pre style="background: #fecaca; padding: 10px; border-radius: 4px; white-space: pre-wrap;">${event.error?.message || event.message}</pre>
        <p style="font-weight: bold; margin-top: 15px; margin-bottom: 5px;">Stack Trace:</p>
        <pre style="background: #fecaca; padding: 10px; border-radius: 4px; white-space: pre-wrap; font-size: 12px;">${event.error?.stack || 'No stack trace available'}</pre>
      </div>
    `;
  }
});

createRoot(document.getElementById("root")!).render(<App />);

// Registro do service worker (PWA instalável)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

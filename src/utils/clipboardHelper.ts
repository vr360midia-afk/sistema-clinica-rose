/**
 * Utilitário de alta performance para cópia na área de transferência (Clipboard).
 * Executa de forma síncrona/imediata com fallback universal (document.execCommand)
 * garantindo compatibilidade quando navegadores bloqueiam navigator.clipboard por perda de foco ou delay assíncrono.
 */

export async function copiarTextoParaClipboard(texto: string): Promise<boolean> {
  if (!texto) return false;

  // 1. Tenta API moderna navigator.clipboard se disponível e segura
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText falhou, executando fallback execCommand:', err);
    }
  }

  // 2. Fallback universal garantido usando textarea temporário e document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = texto;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const copiado = document.execCommand('copy');
      document.body.removeChild(textarea);
      return Boolean(copiado);
    } catch (err) {
      console.error('[Clipboard] Fallback execCommand falhou:', err);
    }
  }

  return false;
}

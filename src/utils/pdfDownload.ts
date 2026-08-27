import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const sanitizeFilename = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'documento';

const waitForImages = async (doc: Document) => {
  const imgs = Array.from(doc.images || []);
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
          setTimeout(resolve, 4000);
        })
    )
  );
};

/**
 * Renderiza um HTML completo em um iframe oculto e baixa como PDF (A4).
 * Não depende de window.open (bloqueado em iframes/preview e por popup blockers).
 */
export const downloadHtmlAsPdf = async (html: string, filename: string): Promise<boolean> => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument;
    if (!idoc) throw new Error('iframe indisponível');

    // remove auto-print scripts do template
    const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    idoc.open();
    idoc.write(cleanHtml);
    idoc.close();

    await new Promise((r) => setTimeout(r, 120));
    await waitForImages(idoc);
    if ((idoc as any).fonts?.ready) {
      try {
        await (idoc as any).fonts.ready;
      } catch {
        /* noop */
      }
    }

    const body = idoc.body;
    body.style.background = '#ffffff';
    body.style.width = '794px';

    const canvas = await html2canvas(body, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: 794,
      width: 794,
      height: Math.max(body.scrollHeight, 200),
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, imgH);
    } else {
      // fatia o canvas em páginas
      const pxPerPage = Math.floor((canvas.width * pageH) / pageW);
      let offset = 0;
      let first = true;
      while (offset < canvas.height) {
        const sliceH = Math.min(pxPerPage, canvas.height - offset);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d');
        if (!ctx) break;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (!first) pdf.addPage();
        pdf.addImage(
          slice.toDataURL('image/jpeg', 0.95),
          'JPEG',
          0,
          0,
          pageW,
          (sliceH * pageW) / canvas.width
        );
        first = false;
        offset += sliceH;
      }
    }

    pdf.save(`${sanitizeFilename(filename)}.pdf`);
    return true;
  } catch (e) {
    console.error('Falha ao gerar PDF', e);
    return false;
  } finally {
    setTimeout(() => iframe.remove(), 300);
  }
};

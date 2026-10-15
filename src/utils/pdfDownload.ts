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
    body.style.margin = '0';
    body.style.boxSizing = 'border-box';

    // Mapeia posições verticais de blocos que não devem ser cortados ao meio
    const avoidSelectors = [
      '.alerta-box',
      '.grid-assinaturas',
      '.bloco-assinaturas',
      '.assinaturas',
      '.assinatura',
      '.totais-resumo',
      '.totais',
      '.cabecalho',
      '.topo',
      'table',
      'tr',
      'thead',
      '.clausula-titulo',
      '.secao-titulo',
      'h1',
      'h2',
      'h3',
      '[style*="border-left"]',
      '[style*="border: 1px dashed"]',
      '[style*="border: 1px solid"]',
    ];

    const avoidElements = Array.from(idoc.querySelectorAll(avoidSelectors.join(',')));
    const scrollY = idoc.defaultView?.scrollY || 0;
    const domAvoidRanges = avoidElements.map((el) => {
      const rect = el.getBoundingClientRect();
      const isHeader =
        /^(h1|h2|h3)$/i.test(el.tagName) ||
        el.classList.contains('clausula-titulo') ||
        el.classList.contains('secao-titulo');
      return {
        top: rect.top + scrollY,
        bottom: rect.bottom + scrollY,
        isHeader,
      };
    });

    const scale = 2;
    const canvas = await html2canvas(body, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      windowWidth: 794,
      width: 794,
      height: Math.max(body.scrollHeight, 200),
    });

    // Dimensões padrão A4 em pontos (pt): 595.28 x 841.89
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Margens elegantes e seguras na folha A4 (em pt)
    const marginLeft = 26;
    const marginRight = 26;
    const marginTop = 28;
    const marginBottom = 28;

    const printableW = pageW - marginLeft - marginRight;
    const printableH = pageH - marginTop - marginBottom;

    // Relação pixels do canvas para pontos do PDF
    const pxPerPt = canvas.width / printableW;
    const maxSliceH = Math.floor(printableH * pxPerPt);
    const fullHeight = canvas.height;

    // Converte os intervalos de elementos do DOM para coordenadas de pixel no canvas
    const domRatio = canvas.height / Math.max(body.scrollHeight, 1);
    const canvasAvoidRanges = domAvoidRanges.map((r) => ({
      top: Math.floor(r.top * domRatio),
      bottom: Math.ceil(r.bottom * domRatio),
      isHeader: r.isHeader,
    }));

    if (fullHeight <= maxSliceH) {
      // Documento cabe integralmente em uma página
      const imgHInPt = fullHeight / pxPerPt;
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        marginLeft,
        marginTop,
        printableW,
        imgHInPt
      );
    } else {
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível obter contexto 2D do canvas');

      let currentOffset = 0;
      let isFirstPage = true;

      while (currentOffset < fullHeight) {
        const remaining = fullHeight - currentOffset;

        if (remaining <= maxSliceH) {
          // Última fatia do documento
          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = remaining;
          const sCtx = sliceCanvas.getContext('2d');
          if (sCtx) {
            sCtx.fillStyle = '#ffffff';
            sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            sCtx.drawImage(
              canvas,
              0,
              currentOffset,
              canvas.width,
              remaining,
              0,
              0,
              canvas.width,
              remaining
            );

            if (!isFirstPage) pdf.addPage();
            const sliceHInPt = remaining / pxPerPt;
            pdf.addImage(
              sliceCanvas.toDataURL('image/jpeg', 0.95),
              'JPEG',
              marginLeft,
              marginTop,
              printableW,
              sliceHInPt
            );
          }
          break;
        }

        // Ponto máximo teórico onde a página terminaria
        let targetCut = currentOffset + maxSliceH;

        // 1. Evita cortar no meio de caixas, tabelas e cabeçalhos mapeados
        for (const range of canvasAvoidRanges) {
          const rangeHeight = range.bottom - range.top;
          // Se o elemento cabe numa página inteira e o corte cruza seu interior
          if (rangeHeight < maxSliceH * 0.85 && range.top < targetCut && range.bottom > targetCut) {
            if (range.top > currentOffset + maxSliceH * 0.35) {
              targetCut = range.top - 6;
              break;
            }
          }
          // Se for título que ficou nos últimos 80px do rodapé da página
          if (range.isHeader && range.bottom <= targetCut && range.bottom > targetCut - 80) {
            if (range.top > currentOffset + maxSliceH * 0.35) {
              targetCut = range.top - 6;
              break;
            }
          }
        }

        // 2. Busca uma linha horizontal em branco (sem pixels escuros de texto)
        const searchMin = Math.max(currentOffset + Math.floor(maxSliceH * 0.65), targetCut - 160);
        const searchMax = Math.min(fullHeight - 1, targetCut);

        let bestCut = targetCut;
        let foundBlank = false;

        if (searchMax > searchMin) {
          const stripH = searchMax - searchMin + 1;
          const imgData = ctx.getImageData(0, searchMin, canvas.width, stripH);
          const data = imgData.data;

          const marginScanX = Math.floor(canvas.width * 0.08);
          const endScanX = canvas.width - marginScanX;

          // Varre de baixo para cima procurando uma linha horizontal livre de texto
          for (let relY = stripH - 1; relY >= 0; relY--) {
            let rowHasInk = false;
            const rowStart = relY * canvas.width * 4;

            for (let x = marginScanX; x < endScanX; x += 4) {
              const idx = rowStart + x * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b = data[idx + 2];
              const a = data[idx + 3];

              // Pixel escuro pertencente a caracteres ou linhas de texto
              if (a > 30 && (r < 210 || g < 210 || b < 210)) {
                rowHasInk = true;
                break;
              }
            }

            if (!rowHasInk) {
              bestCut = searchMin + relY;
              foundBlank = true;
              break;
            }
          }
        }

        // Se não encontrou linha livre dentro do limite razoável, usa o targetCut seguro
        if (!foundBlank || bestCut <= currentOffset + maxSliceH * 0.4) {
          bestCut = targetCut;
        }

        const sliceH = Math.max(1, bestCut - currentOffset);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const sCtx = sliceCanvas.getContext('2d');
        if (!sCtx) break;

        sCtx.fillStyle = '#ffffff';
        sCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        sCtx.drawImage(
          canvas,
          0,
          currentOffset,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH
        );

        if (!isFirstPage) pdf.addPage();
        const sliceHInPt = sliceH / pxPerPt;
        pdf.addImage(
          sliceCanvas.toDataURL('image/jpeg', 0.95),
          'JPEG',
          marginLeft,
          marginTop,
          printableW,
          sliceHInPt
        );

        isFirstPage = false;
        currentOffset += sliceH;
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

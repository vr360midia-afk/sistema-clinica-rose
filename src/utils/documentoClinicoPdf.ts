import { DocumentoClinico } from '@/hooks/useDocumentosClinicos';
import { downloadHtmlAsPdf } from './pdfDownload';

export interface ClinicaInfo {
  nomeClinica?: string;
  logoUrl?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
}

export const gerarDocumentoClinicoPdf = async (doc: DocumentoClinico, clinica: ClinicaInfo = {}) => {
  const emissor = clinica.nomeClinica || 'Clínica Odontológica';
  const dataFmt = new Date(doc.criadoEm).toLocaleDateString('pt-BR');
  const isAtestado = doc.tipo === 'atestado';

  const corpo = isAtestado
    ? `<p class="texto">Atesto para os devidos fins que <b>${doc.pacienteNome || 'o(a) paciente'}</b> esteve
        sob atendimento odontológico nesta data${
          doc.diasAfastamento ? `, necessitando de afastamento de suas atividades por <b>${doc.diasAfastamento} dia(s)</b>` : ''
        }.${doc.cid ? ` CID: <b>${doc.cid}</b>.` : ''}</p>
       ${doc.conteudo ? `<p class="texto">${doc.conteudo.replace(/\n/g, '<br/>')}</p>` : ''}`
    : `<p class="texto">Paciente: <b>${doc.pacienteNome || '—'}</b></p>
       <table class="itens">
         <thead><tr><th>Medicamento / Item</th><th>Quantidade</th><th>Posologia</th></tr></thead>
         <tbody>
           ${
             doc.itens.length
               ? doc.itens
                   .map(
                     (i) =>
                       `<tr><td>${i.nome || ''}</td><td>${i.quantidade || '—'}</td><td>${i.posologia || '—'}</td></tr>`
                   )
                   .join('')
               : '<tr><td colspan="3">—</td></tr>'
           }
         </tbody>
       </table>
       ${doc.conteudo ? `<p class="texto">${doc.conteudo.replace(/\n/g, '<br/>')}</p>` : ''}`;

  const assinaturaBloco = doc.assinaturaData
    ? `<div class="assinatura">
        <img src="${doc.assinaturaData}" alt="Assinatura" />
        <div class="linha"></div>
        <div>${doc.assinanteNome || doc.dentista || emissor}</div>
        <div class="mini">Assinado digitalmente em ${
          doc.assinadoEm ? new Date(doc.assinadoEm).toLocaleString('pt-BR') : dataFmt
        } — documento armazenado na nuvem (ID ${doc.id})</div>
      </div>`
    : `<div class="assinatura">
        <div class="linha"></div>
        <div>${doc.dentista || emissor}</div>
      </div>`;

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${doc.titulo} - ${doc.pacienteNome || ''}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 32px; color: #111; }
  .doc { max-width: 720px; margin: 0 auto; border: 1px solid #111; padding: 28px 32px; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .clinica h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: .5px; }
  .clinica p { margin: 0; font-size: 11px; color: #444; }
  .numero { text-align: right; font-size: 11px; }
  h2 { text-align: center; letter-spacing: 3px; font-size: 16px; margin: 24px 0 8px; text-transform: uppercase; }
  .texto { font-size: 14px; line-height: 1.8; text-align: justify; }
  table.itens { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
  table.itens th, table.itens td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  .assinatura { margin-top: 56px; text-align: center; font-size: 12px; }
  .assinatura img { max-height: 90px; display: block; margin: 0 auto 4px; }
  .linha { width: 300px; margin: 0 auto 6px; border-top: 1px solid #111; }
  .mini { font-size: 10px; color: #666; margin-top: 4px; }
  .rodape { margin-top: 24px; text-align: center; font-size: 10px; color: #666; }
  @media print { body { padding: 0; } .doc { border: none; } }
</style></head>
<body>
  <div class="doc">
    <div class="topo">
      <div class="clinica">
        ${clinica.logoUrl ? `<img src="${clinica.logoUrl}" alt="Logo" style="max-height:64px;max-width:200px;margin-bottom:8px;display:block;" />` : ''}
        <h1>${emissor}</h1>
        ${clinica.cnpj ? `<p>CNPJ/CPF: ${clinica.cnpj}</p>` : ''}
        ${clinica.endereco ? `<p>${clinica.endereco}</p>` : ''}
        ${clinica.telefone ? `<p>Tel: ${clinica.telefone}</p>` : ''}
        ${clinica.email ? `<p>${clinica.email}</p>` : ''}
      </div>
      <div class="numero">
        <div>${isAtestado ? 'Atestado' : 'Prescrição'}</div>
        <div>${dataFmt}</div>
      </div>
    </div>

    <h2>${doc.titulo}</h2>
    ${corpo}
    ${assinaturaBloco}
    <div class="rodape">Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')}.</div>
  </div>
</body></html>`;

  return downloadHtmlAsPdf(html, `${doc.tipo || 'documento'}-${doc.pacienteNome || ''}-${dataFmt.replace(/\//g, '-')}`);
};

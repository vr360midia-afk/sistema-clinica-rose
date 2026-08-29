import { downloadHtmlAsPdf } from './pdfDownload';

interface ClinicaInfo {
  nomeClinica?: string;
  logoUrl?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
}

interface OrcamentoItemPdf {
  nome: string;
  quantidade: number;
  valor: number;
}

interface OrcamentoPdf {
  titulo: string;
  pacienteNome?: string | null;
  pacienteCpf?: string | null;
  itens: OrcamentoItemPdf[];
  desconto: number;
  total: number;
  observacoes?: string | null;
  formasPagamento?: string | null;
  validade?: string | null;
  criadoEm?: Date | string;
  dentistaNome?: string | null;
  dentistaCro?: string | null;
}

const money = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const gerarOrcamentoPdf = async (o: OrcamentoPdf, clinica: ClinicaInfo = {}) => {
  const emissor = clinica.nomeClinica || 'Clínica Odontológica';
  const data = o.criadoEm ? new Date(o.criadoEm) : new Date();
  const dataFmt = isNaN(data.getTime()) ? new Date().toLocaleDateString('pt-BR') : data.toLocaleDateString('pt-BR');
  const subtotal = o.itens.reduce((s, i) => s + (i.valor || 0) * (i.quantidade || 1), 0);
  const responsavel = o.dentistaNome || emissor;

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${o.titulo} - ${o.pacienteNome || 'Paciente'}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 40px; color: #1a1a1a; background: #fff; }
  .doc { max-width: 760px; margin: 0 auto; }
  .topo { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding-bottom: 20px; border-bottom: 3px double #1a1a1a; }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand img { max-height: 72px; max-width: 180px; object-fit: contain; }
  .clinica h1 { font-size: 21px; margin: 0 0 6px; letter-spacing: 1px; font-weight: 700; }
  .clinica p { margin: 2px 0; font-size: 11px; color: #555; font-family: Helvetica, Arial, sans-serif; }
  .meta { text-align: right; font-size: 11px; color: #555; font-family: Helvetica, Arial, sans-serif; line-height: 1.7; white-space: nowrap; }
  .meta strong { color: #1a1a1a; font-size: 12px; }
  .titulo-bloco { text-align: center; margin: 30px 0 6px; }
  h2 { display: inline-block; letter-spacing: 8px; font-size: 18px; margin: 0; padding: 8px 34px; border-top: 1px solid #1a1a1a; border-bottom: 1px solid #1a1a1a; font-weight: 600; }
  .sub { text-align: center; font-size: 12px; color: #666; margin: 12px 0 26px; font-family: Helvetica, Arial, sans-serif; }
  table { width: 100%; font-size: 13px; border-collapse: collapse; }
  thead th { text-align: left; font-size: 10px; font-family: Helvetica, Arial, sans-serif; text-transform: uppercase; letter-spacing: 1.5px; color: #555; border-bottom: 2px solid #1a1a1a; padding: 8px 4px; }
  td { padding: 10px 4px; border-bottom: 1px solid #e3e3e3; }
  tbody tr:nth-child(even) { background: #fafafa; }
  th:last-child, td:last-child, th:nth-child(2), td:nth-child(2) { text-align: right; }
  .totais { margin: 22px 0 0 auto; width: 300px; font-size: 13px; }
  .totais div { display: flex; justify-content: space-between; padding: 6px 0; color: #444; }
  .totais .grande { border-top: 2px solid #1a1a1a; margin-top: 8px; padding-top: 10px; font-size: 18px; font-weight: bold; color: #1a1a1a; }
  .bloco { margin-top: 26px; font-size: 12px; line-height: 1.7; font-family: Helvetica, Arial, sans-serif; color: #333; background: #fafafa; border-left: 3px solid #1a1a1a; padding: 12px 16px; }
  .bloco h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px; color: #555; }
  .assinaturas { display: flex; gap: 60px; margin-top: 80px; }
  .assinaturas > div { flex: 1; text-align: center; }
  .linha { border-top: 1px solid #1a1a1a; margin-bottom: 8px; }
  .assinaturas .nome { font-size: 12px; font-weight: bold; }
  .assinaturas .doc-id { font-size: 10px; color: #555; font-family: Helvetica, Arial, sans-serif; margin-top: 2px; }
  .rodape { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e3e3e3; text-align: center; font-size: 9px; color: #888; font-family: Helvetica, Arial, sans-serif; letter-spacing: .5px; }
  @media print { body { padding: 0; } }
</style></head>
<body>
  <div class="doc">
    <div class="topo">
      <div class="brand">
        ${clinica.logoUrl ? `<img src="${clinica.logoUrl}" alt="Logo da clínica" />` : ''}
        <div class="clinica">
          <h1>${emissor}</h1>
          ${clinica.cnpj ? `<p>CNPJ/CPF: ${clinica.cnpj}</p>` : ''}
          ${clinica.endereco ? `<p>${clinica.endereco}</p>` : ''}
          ${clinica.telefone ? `<p>Tel: ${clinica.telefone}</p>` : ''}
          ${clinica.email ? `<p>${clinica.email}</p>` : ''}
          ${o.dentistaCro ? `<p>CRO: ${o.dentistaCro}</p>` : ''}
        </div>
      </div>
      <div class="meta">
        Emitido em<br/><strong>${dataFmt}</strong>
        ${o.validade ? `<div style="margin-top:8px">Válido até<br/><strong>${new Date(o.validade).toLocaleDateString('pt-BR')}</strong></div>` : ''}
      </div>
    </div>

    <div class="titulo-bloco"><h2>ORÇAMENTO</h2></div>
    <div class="sub">${o.titulo}${o.pacienteNome ? ` — Paciente: <strong>${o.pacienteNome}</strong>` : ''}</div>

    <table>
      <thead><tr><th>Procedimento</th><th>Qtd</th><th>Valor</th></tr></thead>
      <tbody>
        ${o.itens
          .map(
            (i) =>
              `<tr><td>${i.nome || '-'}</td><td>${i.quantidade || 1}</td><td>${money((i.valor || 0) * (i.quantidade || 1))}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>

    <div class="totais">
      <div><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div><span>Desconto</span><span>- ${money(o.desconto || 0)}</span></div>
      <div class="grande"><span>Total</span><span>${money(o.total)}</span></div>
    </div>

    ${o.formasPagamento ? `<div class="bloco"><h3>Formas de pagamento</h3>${String(o.formasPagamento).replace(/\n/g, '<br/>')}</div>` : ''}
    ${o.observacoes ? `<div class="bloco"><h3>Observações</h3>${String(o.observacoes).replace(/\n/g, '<br/>')}</div>` : ''}

    <div class="assinaturas">
      <div>
        <div class="linha"></div>
        <div class="nome">${o.pacienteNome || 'Paciente'}</div>
        ${o.pacienteCpf ? `<div class="doc-id">CPF: ${o.pacienteCpf}</div>` : ''}
      </div>
      <div>
        <div class="linha"></div>
        <div class="nome">${responsavel}</div>
        ${o.dentistaCro ? `<div class="doc-id">CRO: ${o.dentistaCro}</div>` : ''}
      </div>
    </div>

    <div class="rodape">Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}.</div>
  </div>
</body></html>`;

  return downloadHtmlAsPdf(html, `orcamento-${o.pacienteNome || 'paciente'}-${dataFmt.replace(/\//g, '-')}`);
};

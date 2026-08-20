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
  itens: OrcamentoItemPdf[];
  desconto: number;
  total: number;
  observacoes?: string | null;
  formasPagamento?: string | null;
  validade?: string | null;
  criadoEm?: Date | string;
}

const money = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const gerarOrcamentoPdf = (o: OrcamentoPdf, clinica: ClinicaInfo = {}) => {
  const emissor = clinica.nomeClinica || 'Clínica Odontológica';
  const data = o.criadoEm ? new Date(o.criadoEm) : new Date();
  const dataFmt = isNaN(data.getTime()) ? new Date().toLocaleDateString('pt-BR') : data.toLocaleDateString('pt-BR');
  const subtotal = o.itens.reduce((s, i) => s + (i.valor || 0) * (i.quantidade || 1), 0);

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>${o.titulo} - ${o.pacienteNome || 'Paciente'}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 32px; color: #111; }
  .doc { max-width: 760px; margin: 0 auto; border: 1px solid #111; padding: 28px 32px; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .clinica h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: .5px; }
  .clinica p { margin: 1px 0; font-size: 11px; color: #444; }
  .meta { text-align: right; font-size: 11px; color: #444; }
  h2 { text-align: center; letter-spacing: 4px; font-size: 17px; margin: 22px 0 4px; }
  .sub { text-align: center; font-size: 12px; color: #555; margin-bottom: 18px; }
  table { width: 100%; font-size: 13px; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #111; padding: 6px 0; }
  td { padding: 7px 0; border-bottom: 1px dotted #bbb; }
  th:last-child, td:last-child, th:nth-child(2), td:nth-child(2) { text-align: right; }
  .totais { margin-top: 16px; margin-left: auto; width: 300px; font-size: 13px; }
  .totais div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totais .grande { border-top: 2px solid #111; margin-top: 6px; padding-top: 8px; font-size: 17px; font-weight: bold; }
  .bloco { margin-top: 20px; font-size: 12px; line-height: 1.6; }
  .bloco h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 4px; }
  .assinaturas { display: flex; gap: 40px; margin-top: 60px; }
  .assinaturas div { flex: 1; text-align: center; font-size: 11px; }
  .linha { border-top: 1px solid #111; margin-bottom: 6px; }
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
      <div class="meta">
        <div>Emitido em</div>
        <strong>${dataFmt}</strong>
        ${o.validade ? `<div style="margin-top:6px">Válido até<br/><strong>${new Date(o.validade).toLocaleDateString('pt-BR')}</strong></div>` : ''}
      </div>
    </div>

    <h2>ORÇAMENTO</h2>
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
      <div><div class="linha"></div>${o.pacienteNome || 'Paciente'}</div>
      <div><div class="linha"></div>${emissor}</div>
    </div>

    <div class="rodape">Documento gerado eletronicamente em ${new Date().toLocaleString('pt-BR')}.</div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
};

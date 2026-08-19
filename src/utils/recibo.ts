interface ReciboClinica {
  nomeClinica?: string;
  logoUrl?: string;
  cnpj?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
}

interface ReciboDados {
  numero: string;
  pacienteNome: string;
  descricao?: string;
  valor: number;
  data: Date | string;
  metodoPagamento?: string;
  parcelas?: number;
  valorParcela?: number;
}

const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

const abaixoDeMil = (n: number): string => {
  if (n < 20) return unidades[n];
  if (n < 100) {
    const d = Math.floor(n / 10);
    const r = n % 10;
    return dezenas[d] + (r ? ` e ${unidades[r]}` : '');
  }
  if (n === 100) return 'cem';
  const c = Math.floor(n / 100);
  const r = n % 100;
  return centenas[c] + (r ? ` e ${abaixoDeMil(r)}` : '');
};

const inteiroPorExtenso = (n: number): string => {
  if (n === 0) return 'zero';
  if (n < 1000) return abaixoDeMil(n);
  const milhares = Math.floor(n / 1000);
  const resto = n % 1000;
  const parteMil = milhares === 1 ? 'mil' : `${abaixoDeMil(milhares)} mil`;
  if (!resto) return parteMil;
  return `${parteMil}${resto < 100 ? ' e ' : ' '}${abaixoDeMil(resto)}`;
};

export const valorPorExtenso = (valor: number): string => {
  const inteiro = Math.floor(valor);
  const centavos = Math.round((valor - inteiro) * 100);
  const parteReais = `${inteiroPorExtenso(inteiro)} ${inteiro === 1 ? 'real' : 'reais'}`;
  if (!centavos) return parteReais;
  return `${parteReais} e ${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`;
};

const metodoLabel: Record<string, string> = {
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  pix: 'PIX',
  boleto: 'Boleto',
  transferencia: 'Transferência',
};

export const gerarRecibo = (dados: ReciboDados, clinica: ReciboClinica = {}) => {
  const data = new Date(dados.data);
  const dataFmt = isNaN(data.getTime()) ? new Date().toLocaleDateString('pt-BR') : data.toLocaleDateString('pt-BR');
  const valorFmt = Number(dados.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const emissor = clinica.nomeClinica || 'Clínica Odontológica';

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Recibo ${dados.numero} - ${dados.pacienteNome}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 32px; color: #111; }
  .recibo { max-width: 720px; margin: 0 auto; border: 1px solid #111; padding: 28px 32px; }
  .topo { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; }
  .clinica h1 { font-size: 20px; margin: 0 0 4px; letter-spacing: .5px; }
  .clinica p { margin: 1px 0; font-size: 11px; color: #444; }
  .numero { text-align: right; }
  .numero span { display: block; font-size: 11px; color: #444; }
  .numero strong { font-size: 15px; }
  h2 { text-align: center; letter-spacing: 4px; font-size: 18px; margin: 22px 0 6px; }
  .valor { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
  .corpo { font-size: 14px; line-height: 1.9; text-align: justify; }
  .corpo b { border-bottom: 1px solid #111; }
  table { width: 100%; font-size: 12px; margin-top: 20px; border-collapse: collapse; }
  td { padding: 5px 0; border-bottom: 1px dotted #bbb; }
  td:last-child { text-align: right; }
  .assinatura { margin-top: 56px; text-align: center; font-size: 12px; }
  .linha { width: 300px; margin: 0 auto 6px; border-top: 1px solid #111; }
  .rodape { margin-top: 24px; text-align: center; font-size: 10px; color: #666; }
  @media print { body { padding: 0; } .recibo { border: none; } }
</style></head>
<body>
  <div class="recibo">
    <div class="topo">
      <div class="clinica">
        ${clinica.logoUrl ? `<img src="${clinica.logoUrl}" alt="Logo" style="max-height:64px;max-width:200px;margin-bottom:8px;display:block;" />` : ''}
        <h1>${emissor}</h1>
        ${clinica.cnpj ? `<p>CNPJ: ${clinica.cnpj}</p>` : ''}
        ${clinica.endereco ? `<p>${clinica.endereco}</p>` : ''}
        ${clinica.telefone ? `<p>Tel: ${clinica.telefone}</p>` : ''}
        ${clinica.email ? `<p>${clinica.email}</p>` : ''}
      </div>
      <div class="numero">
        <span>Recibo nº</span>
        <strong>${dados.numero}</strong>
        <span>${dataFmt}</span>
      </div>
    </div>

    <h2>RECIBO</h2>
    <div class="valor">${valorFmt}</div>

    <div class="corpo">
      Recebi(emos) de <b>${dados.pacienteNome}</b> a importância de
      <b>${valorPorExtenso(Number(dados.valor || 0))}</b>, referente a
      <b>${dados.descricao || 'serviços odontológicos prestados'}</b>,
      dando plena e geral quitação do valor acima descrito.
    </div>

    <table>
      ${dados.metodoPagamento ? `<tr><td>Forma de pagamento</td><td>${metodoLabel[dados.metodoPagamento] || dados.metodoPagamento}</td></tr>` : ''}
      ${dados.parcelas && dados.parcelas > 1 ? `<tr><td>Parcelamento</td><td>${dados.parcelas}x de ${Number(dados.valorParcela || dados.valor / dados.parcelas).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>` : ''}
      <tr><td>Data do pagamento</td><td>${dataFmt}</td></tr>
    </table>

    <div class="assinatura">
      <div class="linha"></div>
      ${emissor}${clinica.cnpj ? ` — CNPJ ${clinica.cnpj}` : ''}
    </div>

    <div class="rodape">Documento emitido eletronicamente em ${new Date().toLocaleString('pt-BR')}.</div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body></html>`;

  const win = window.open('', '_blank', 'width=860,height=1000');
  if (!win) return false;
  win.document.write(html);
  win.document.close();
  return true;
};

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pill, Plus, Trash2, Download, Printer, MessageCircle, AlertCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useDentistas } from '@/hooks/useDentistas';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { openWhatsApp } from '@/lib/whatsapp';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';

interface ModalGerarReceitaProps {
  patient: any;
  isOpen: boolean;
  onClose: () => void;
}

export interface ItemReceita {
  id: string;
  nome: string;
  quantidade: string;
  posologia: string;
}

const PRESET_MEDICAMENTOS: Array<Omit<ItemReceita, 'id'>> = [
  {
    nome: 'Amoxicilina 500mg',
    quantidade: '1 caixa (21 cápsulas)',
    posologia: 'Tomar 1 cápsula via oral de 8 em 8 horas durante 7 dias.',
  },
  {
    nome: 'Amoxicilina + Clavulanato 875mg/125mg',
    quantidade: '1 caixa (14 comprimidos)',
    posologia: 'Tomar 1 comprimido via oral de 12 em 12 horas durante 7 dias.',
  },
  {
    nome: 'Dipirona Monoidratada 500mg',
    quantidade: '1 caixa',
    posologia: 'Tomar 1 comprimido (ou 35 gotas) via oral de 6 em 6 horas se dor ou febre.',
  },
  {
    nome: 'Dipirona Monoidratada 1g',
    quantidade: '1 caixa (10 comprimidos)',
    posologia: 'Tomar 1 comprimido via oral de 6 em 6 horas se dor moderada a intensa.',
  },
  {
    nome: 'Ibuprofeno 600mg',
    quantidade: '1 caixa',
    posologia: 'Tomar 1 comprimido via oral de 8 em 8 horas durante 3 a 5 dias, sempre após as refeições.',
  },
  {
    nome: 'Nimesulida 100mg',
    quantidade: '1 caixa (12 comprimidos)',
    posologia: 'Tomar 1 comprimido via oral de 12 em 12 horas durante 3 dias após as refeições.',
  },
  {
    nome: 'Paracetamol 750mg',
    quantidade: '1 caixa (20 comprimidos)',
    posologia: 'Tomar 1 comprimido via oral de 6 em 6 horas em caso de dor ou febre.',
  },
  {
    nome: 'Dexametasona 4mg',
    quantidade: '1 caixa',
    posologia: 'Tomar 1 comprimido via oral em dose única antes do procedimento ou conforme orientado.',
  },
  {
    nome: 'Solução Bucal de Clorexidina 0,12%',
    quantidade: '1 frasco (250ml)',
    posologia: 'Bochechar 15ml sem diluir por 1 minuto, 2 vezes ao dia (a cada 12 horas), por 7 dias.',
  },
  {
    nome: 'Toragesic (Trometamol Cetorolaco) 10mg',
    quantidade: '1 caixa (10 comprimidos sublinguais)',
    posologia: 'Dissolver 1 comprimido sob a língua de 8 em 8 horas em caso de dor intensa (máximo 4 dias).',
  },
];

const PRESET_ORIENTACOES = [
  'Tomar os medicamentos sempre com água após as principais refeições.',
  'Não ingerir bebidas alcoólicas durante o uso dos medicamentos.',
  'Em caso de reação alérgica, suspender o medicamento e entrar em contato imediato.',
  'Evitar exposição ao sol e esforço físico excessivo nas primeiras 48 horas.',
];

export const ModalGerarReceita = ({ patient, isOpen, onClose }: ModalGerarReceitaProps) => {
  const { dentistas } = useDentistas();
  const { configuracoes } = useConfiguracoes();
  const { config: configContrato } = useConfiguracoesContrato();

  const [itens, setItens] = useState<ItemReceita[]>([
    {
      id: '1',
      nome: 'Dipirona Monoidratada 500mg',
      quantidade: '1 caixa',
      posologia: 'Tomar 1 comprimido por via oral de 6 em 6 horas em caso de dor.',
    },
  ]);

  // Novo item em edição
  const [novoNome, setNovoNome] = useState('');
  const [novaQuantidade, setNovaQuantidade] = useState('1 caixa');
  const [novaPosologia, setNovaPosologia] = useState('');

  const [observacoes, setObservacoes] = useState(
    'Tomar os medicamentos nos horários prescritos. Em caso de reações adversas, suspender o uso e contatar a clínica.'
  );

  const [dentistaNome, setDentistaNome] = useState('');
  const [dentistaCro, setDentistaCro] = useState('');
  const [gerando, setGerando] = useState(false);

  // Dados oficiais da clínica
  const nomeClinica =
    configuracoes?.nomeClinica ||
    configContrato?.nomeClinicaContrato ||
    'Dra. Rosangela Santos - Clínica Odontológica';
  const logoUrl = configuracoes?.logoUrl || '/logo.png';
  const cnpjClinica =
    configuracoes?.cnpj || configContrato?.cnpjClinicaContrato || '032.663.962-43';
  const enderecoClinica =
    configuracoes?.endereco ||
    configContrato?.enderecoContrato ||
    'JTR - Edifício Espanha - R. Comerc. José Pontes de Magalhães, 70 - Sl 405 - Jatiúca, Maceió - AL';
  const telefoneClinica =
    configuracoes?.telefone || configContrato?.telefoneContrato || '(82) 97400-2213';
  const emailClinica =
    configuracoes?.email || configContrato?.emailContrato || 'drarosesantosexpert@gmail.com';

  useEffect(() => {
    if (!isOpen) return;

    const dentistaPadraoNome =
      configContrato?.dentistaResponsavelContrato ||
      (dentistas && dentistas.length > 0 ? dentistas[0].nome : 'Dra. Rosangela Santos');

    setDentistaNome(dentistaPadraoNome);

    const dentistaEncontrado = (dentistas || []).find((d) => d.nome === dentistaPadraoNome);
    setDentistaCro(
      dentistaEncontrado?.cro || configContrato?.croResponsavelContrato || 'CRO-AL 6267'
    );
  }, [isOpen, dentistas, configContrato]);

  const handleDentistaChange = (nome: string) => {
    setDentistaNome(nome);
    const dent = (dentistas || []).find((d) => d.nome === nome);
    if (dent?.cro) {
      setDentistaCro(dent.cro);
    } else if (nome.includes('Rosangela')) {
      setDentistaCro(configContrato?.croResponsavelContrato || 'CRO-AL 6267');
    }
  };

  const handleAdicionarPreset = (med: Omit<ItemReceita, 'id'>) => {
    const jaExiste = itens.some((i) => i.nome.toLowerCase() === med.nome.toLowerCase());
    if (jaExiste) {
      toast.info('Este medicamento já está na receita');
      return;
    }
    const novoItem: ItemReceita = {
      id: String(Date.now() + Math.random()),
      ...med,
    };
    setItens((prev) => [...prev, novoItem]);
    toast.success(`"${med.nome}" adicionado!`);
  };

  const handleAdicionarCustom = () => {
    if (!novoNome.trim()) {
      toast.error('Informe o nome do medicamento');
      return;
    }
    if (!novaPosologia.trim()) {
      toast.error('Informe a posologia (como tomar)');
      return;
    }

    const novoItem: ItemReceita = {
      id: String(Date.now()),
      nome: novoNome.trim(),
      quantidade: novaQuantidade.trim() || '1 caixa',
      posologia: novaPosologia.trim(),
    };

    setItens((prev) => [...prev, novoItem]);
    setNovoNome('');
    setNovaQuantidade('1 caixa');
    setNovaPosologia('');
    toast.success('Medicamento adicionado!');
  };

  const handleRemoverItem = (id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id));
  };

  const formatarDataExtenso = () => {
    const hoje = new Date();
    const dia = hoje.getDate();
    const meses = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    return `${dia} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
  };

  const gerarHtmlReceita = () => {
    const dataExtenso = formatarDataExtenso();

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Receituário Odontológico - ${patient.nome}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 18mm 16mm 18mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 24px 32px;
      background: #ffffff;
      font-size: 14px;
      line-height: 1.6;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 28px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .header-logo {
      max-height: 64px;
      max-width: 140px;
      object-fit: contain;
    }
    .clinic-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 2px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .clinic-sub {
      font-size: 11px;
      color: #475569;
      font-weight: 600;
      margin: 0;
    }
    .header-contact {
      text-align: right;
      font-size: 11px;
      color: #475569;
      line-height: 1.4;
    }
    .doc-badge {
      text-align: center;
      margin: 20px 0 24px;
    }
    .doc-badge h1 {
      display: inline-block;
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #0f172a;
      text-transform: uppercase;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 6px;
      margin: 0;
    }
    .paciente-banner {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px 18px;
      margin-bottom: 26px;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }
    .paciente-nome {
      font-weight: 700;
      color: #0f172a;
      font-size: 14px;
    }
    .receita-titulo {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #0284c7;
      margin: 20px 0 12px;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4px;
    }
    .item-receita {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .item-cabecalho {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
    }
    .item-qtd {
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    .item-posologia {
      font-size: 14px;
      color: #1e293b;
      margin-top: 4px;
      padding-left: 18px;
      line-height: 1.6;
    }
    .item-posologia::before {
      content: "—";
      margin-right: 8px;
      color: #0284c7;
      font-weight: bold;
    }
    .obs-section {
      background: #f8fafc;
      border-left: 4px solid #0284c7;
      border-radius: 4px;
      padding: 12px 16px;
      margin: 28px 0 16px;
      font-size: 12.5px;
      line-height: 1.6;
      color: #334155;
      page-break-inside: avoid;
    }
    .obs-section strong {
      display: block;
      color: #0369a1;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .data-local {
      text-align: right;
      margin: 40px 0 50px;
      font-size: 13.5px;
      color: #334155;
    }
    .signature-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin-top: 20px;
      page-break-inside: avoid;
    }
    .signature-line {
      width: 290px;
      border-top: 1.5px solid #0f172a;
      margin-bottom: 8px;
    }
    .dentist-name {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }
    .dentist-cro {
      font-size: 12px;
      color: #475569;
      margin: 3px 0 0;
    }
    .footer-stamp {
      margin-top: 50px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-brand">
      <img src="${logoUrl}" alt="${nomeClinica}" class="header-logo" onerror="this.style.display='none'" />
      <div>
        <h2 class="clinic-title">${nomeClinica}</h2>
        <p class="clinic-sub">Odontologia Especializada • Prescrição Farmacológica</p>
      </div>
    </div>
    <div class="header-contact">
      <div><strong>CNPJ/CPF:</strong> ${cnpjClinica}</div>
      <div>${enderecoClinica}</div>
      <div><strong>WhatsApp/Tel:</strong> ${telefoneClinica}</div>
      ${emailClinica ? `<div>${emailClinica}</div>` : ''}
    </div>
  </div>

  <div class="doc-badge">
    <h1>Receituário Odontológico</h1>
  </div>

  <div class="paciente-banner">
    <div>
      Paciente: <span class="paciente-nome">${patient.nome}</span>
    </div>
    <div>
      CPF: <strong>${patient.cpf || 'Não informado'}</strong>
    </div>
  </div>

  <div class="receita-titulo">Uso Interno / Oral</div>

  <div class="itens-lista">
    ${
      itens.length > 0
        ? itens
            .map(
              (item, idx) => `
      <div class="item-receita">
        <div class="item-cabecalho">
          <span>${idx + 1}. ${item.nome}</span>
          <span class="item-qtd">${item.quantidade}</span>
        </div>
        <div class="item-posologia">
          ${item.posologia}
        </div>
      </div>
    `
            )
            .join('')
        : '<p style="color: #64748b; font-style: italic;">Nenhum medicamento adicionado à receita.</p>'
    }
  </div>

  ${
    observacoes
      ? `
    <div class="obs-section">
      <strong>Instruções Gerais e Recomendações:</strong>
      ${observacoes.replace(/\n/g, '<br/>')}
    </div>
  `
      : ''
  }

  <div class="data-local">
    Maceió - AL, ${dataExtenso}.
  </div>

  <div class="signature-section">
    <div class="signature-line"></div>
    <div class="dentist-name">${dentistaNome}</div>
    <div class="dentist-cro">Cirurgião(ã)-Dentista • ${dentistaCro}</div>
  </div>

  <div class="footer-stamp">
    Receituário emitido eletronicamente • Dra. Rosangela Santos - Clínica Odontológica • Maceió - AL
  </div>
</body>
</html>`;
  };

  const handleBaixarPdf = async () => {
    if (itens.length === 0) {
      toast.error('Adicione ao menos um medicamento à receita.');
      return;
    }
    setGerando(true);
    try {
      const html = gerarHtmlReceita();
      const filename = `receita_${patient.nome.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;
      const success = await downloadHtmlAsPdf(html, filename);
      if (success) {
        toast.success('Receituário em PDF gerado com sucesso!');
        onClose();
      } else {
        toast.error('Não foi possível gerar o PDF. Tente novamente.');
      }
    } catch (err: any) {
      toast.error('Erro ao gerar receituário: ' + (err?.message || 'Erro inesperado'));
    } finally {
      setGerando(false);
    }
  };

  const handleImprimir = () => {
    if (itens.length === 0) {
      toast.error('Adicione ao menos um medicamento à receita.');
      return;
    }
    const html = gerarHtmlReceita();
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      toast.error('Erro ao abrir impressão');
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    iframe.contentWindow?.focus();
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => iframe.remove(), 1500);
    }, 400);
  };

  const handleEnviarWhatsApp = () => {
    if (!patient.telefone) {
      toast.error('Paciente não possui telefone/WhatsApp cadastrado.');
      return;
    }
    if (itens.length === 0) {
      toast.error('Adicione ao menos um medicamento à receita.');
      return;
    }

    const hojeBr = new Date().toLocaleDateString('pt-BR');
    const msg = [
      `*Receituário Odontológico - ${nomeClinica}*`,
      '',
      `Olá, *${patient.nome}*!`,
      `Segue a sua prescrição de medicamentos emitida em ${hojeBr}:`,
      '',
      ...itens.map(
        (it, idx) =>
          `💊 *${idx + 1}. ${it.nome}* (${it.quantidade})\n👉 *Como tomar:* ${it.posologia}\n`
      ),
      observacoes ? `📝 *Recomendações:* ${observacoes}\n` : null,
      `👨‍⚕️ *Profissional:* ${dentistaNome} (${dentistaCro})`,
      `📍 ${enderecoClinica}`,
      `📞 Dúvidas ou emergência: ${telefoneClinica}`,
      '',
      '_O receituário em PDF assinado também está disponível em nossa clínica._',
    ].filter(Boolean).join('\n');

    openWhatsApp(patient.telefone, msg);
    toast.success('Receita enviada via WhatsApp!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <Pill className="h-5 w-5 text-amber-500" />
            <DialogTitle className="text-lg sm:text-xl font-bold">
              Gerar Receita Odontológica
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Paciente: <strong className="text-foreground">{patient.nome}</strong>
            {patient.cpf && ` • CPF: ${patient.cpf}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Medicamentos Adicionados */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Medicamentos Prescritos ({itens.length})
              </Label>
              {itens.length === 0 && (
                <span className="text-[11px] text-destructive">Nenhum item adicionado</span>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto overscroll-contain pr-1">
              {itens.map((item, idx) => (
                <div
                  key={item.id}
                  className="bg-muted/40 border border-border rounded-lg p-2.5 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">
                        {idx + 1}. {item.nome}
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                        {item.quantidade}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
                      <strong>Como tomar:</strong> {item.posologia}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoverItem(item.id)}
                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                    title="Remover medicamento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Atalhos Rápidos (1-clique para adicionar) */}
          <div className="space-y-1.5 pt-2 border-t border-border/60">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Medicamentos Frequentes (Clique para Adicionar)
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_MEDICAMENTOS.map((p) => {
                const jaAdicionado = itens.some((i) => i.nome === p.nome);
                return (
                  <button
                    key={p.nome}
                    type="button"
                    onClick={() => handleAdicionarPreset(p)}
                    className={`text-[11px] px-2 py-1 rounded-md border transition-colors flex items-center gap-1 ${
                      jaAdicionado
                        ? 'bg-primary/15 text-primary border-primary/40 font-medium'
                        : 'bg-muted/60 hover:bg-muted text-muted-foreground border-border hover:text-foreground'
                    }`}
                  >
                    {jaAdicionado ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    <span>{p.nome}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Adicionar Medicamento Personalizado */}
          <div className="bg-card border border-border/80 rounded-lg p-3 space-y-2.5">
            <Label className="text-xs font-semibold">Adicionar Outro Medicamento</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2 space-y-1">
                <span className="text-[11px] text-muted-foreground">Nome e Dosagem:</span>
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: Amoxicilina 500mg, Toragesic 10mg..."
                  className="text-xs sm:text-sm h-8"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">Quantidade:</span>
                <Input
                  value={novaQuantidade}
                  onChange={(e) => setNovaQuantidade(e.target.value)}
                  placeholder="Ex: 1 caixa, 14 comp."
                  className="text-xs sm:text-sm h-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Como Tomar / Posologia:</span>
              <Input
                value={novaPosologia}
                onChange={(e) => setNovaPosologia(e.target.value)}
                placeholder="Ex: Tomar 1 comprimido de 8 em 8 horas por 5 dias..."
                className="text-xs sm:text-sm h-8"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdicionarCustom();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAdicionarCustom}
              className="w-full text-xs h-8 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar Medicamento à Lista</span>
            </Button>
          </div>

          {/* Orientações Gerais */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Recomendações / Instruções Gerais</Label>
            <div className="flex flex-wrap gap-1 mb-1">
              {PRESET_ORIENTACOES.map((ori) => (
                <button
                  key={ori}
                  type="button"
                  onClick={() =>
                    setObservacoes((prev) => (prev ? `${prev} ${ori}` : ori))
                  }
                  className="text-[10px] px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border"
                >
                  + {ori.slice(0, 32)}...
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Instruções para o paciente..."
              className="text-xs sm:text-sm resize-none"
            />
          </div>

          {/* Dentista Prescritor */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Dentista Prescritor(a)</Label>
              <Select value={dentistaNome} onValueChange={handleDentistaChange}>
                <SelectTrigger className="text-xs sm:text-sm h-9">
                  <SelectValue placeholder="Selecione o(a) dentista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dra. Rosangela Santos">Dra. Rosangela Santos</SelectItem>
                  {(dentistas || [])
                    .filter((d) => d.ativo && d.nome !== 'Dra. Rosangela Santos')
                    .map((d) => (
                      <SelectItem key={d.id} value={d.nome}>
                        {d.nome} {d.cro ? `(${d.cro})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">CRO</Label>
              <Input
                value={dentistaCro}
                onChange={(e) => setDentistaCro(e.target.value)}
                placeholder="CRO-AL 6267"
                className="text-xs sm:text-sm h-9"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-border/60">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto text-xs">
            Cancelar
          </Button>

          {patient.telefone && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEnviarWhatsApp}
              className="w-full sm:w-auto text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 gap-1.5"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Enviar WhatsApp</span>
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImprimir}
            className="w-full sm:w-auto text-xs gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleBaixarPdf}
            disabled={gerando}
            className="w-full sm:w-auto text-xs font-semibold gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{gerando ? 'Gerando...' : 'Baixar PDF'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

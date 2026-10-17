import React, { useState, useEffect, useMemo } from 'react';
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
import { FileText, Download, Printer, MessageCircle, Clock, Calendar, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useDentistas } from '@/hooks/useDentistas';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { openWhatsApp } from '@/lib/whatsapp';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';

interface ModalGerarAtestadoProps {
  patient: any;
  isOpen: boolean;
  onClose: () => void;
}

const MOTIVOS_PRESET = [
  'Consulta Odontológica e Avaliação Clínica',
  'Procedimento Cirúrgico Odontológico',
  'Tratamento Endodôntico (Canal)',
  'Atendimento Odontológico de Urgência',
  'Procedimento Restaurador e Reabilitação',
  'Manutenção e Raspagem Periodontal',
];

export const ModalGerarAtestado = ({ patient, isOpen, onClose }: ModalGerarAtestadoProps) => {
  const { consultas } = useDentalSystem();
  const { dentistas } = useDentistas();
  const { configuracoes } = useConfiguracoes();
  const { config: configContrato } = useConfiguracoesContrato();

  const [motivo, setMotivo] = useState('Consulta e Procedimento Odontológico');
  const [dataAtendimento, setDataAtendimento] = useState('');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFim, setHoraFim] = useState('10:00');
  const [diasAfastamento, setDiasAfastamento] = useState<number>(0);
  const [observacoes, setObservacoes] = useState('');
  const [cid, setCid] = useState('');
  const [dentistaNome, setDentistaNome] = useState('');
  const [dentistaCro, setDentistaCro] = useState('');
  const [consultaEncontrada, setConsultaEncontrada] = useState<any>(null);
  const [gerando, setGerando] = useState(false);

  // Dados oficiais da clínica
  const nomeClinica = configuracoes?.nomeClinica || configContrato?.nomeClinicaContrato || 'Dra. Rosangela Santos - Clínica Odontológica';
  const logoUrl = configuracoes?.logoUrl || '/logo.png';
  const cnpjClinica = configuracoes?.cnpj || configContrato?.cnpjClinicaContrato || '032.663.962-43';
  const enderecoClinica = configuracoes?.endereco || configContrato?.enderecoContrato || 'JTR - Edifício Espanha - R. Comerc. José Pontes de Magalhães, 70 - Sl 405 - Jatiúca, Maceió - AL';
  const telefoneClinica = configuracoes?.telefone || configContrato?.telefoneContrato || '(82) 97400-2213';
  const emailClinica = configuracoes?.email || configContrato?.emailContrato || 'drarosesantosexpert@gmail.com';

  // Pré-preenchimento inteligente baseado na agenda do paciente
  useEffect(() => {
    if (!isOpen || !patient?.id) return;

    const hojeStr = new Date().toISOString().split('T')[0];
    setDataAtendimento(hojeStr);

    // Buscar consultas deste paciente que não foram canceladas
    const consultasPaciente = (consultas || []).filter(
      (c) => c && c.pacienteId === patient.id && c.status !== 'cancelado'
    );

    // Tentar encontrar consulta marcada para hoje ou mais recente
    let consultaAlvo: any = null;
    if (consultasPaciente.length > 0) {
      // 1º: Consulta de hoje
      consultaAlvo = consultasPaciente.find((c) => {
        try {
          const cData = new Date(c.data).toISOString().split('T')[0];
          return cData === hojeStr;
        } catch {
          return false;
        }
      });

      // 2º: Se não achou de hoje, pega a mais recente realizada ou agendada
      if (!consultaAlvo) {
        const sorted = [...consultasPaciente].sort((a, b) => {
          return new Date(b.data).getTime() - new Date(a.data).getTime();
        });
        consultaAlvo = sorted[0];
      }
    }

    if (consultaAlvo) {
      setConsultaEncontrada(consultaAlvo);
      try {
        const dStr = new Date(consultaAlvo.data).toISOString().split('T')[0];
        setDataAtendimento(dStr);
      } catch {
        setDataAtendimento(hojeStr);
      }

      if (consultaAlvo.hora) {
        setHoraInicio(consultaAlvo.hora);
        if (consultaAlvo.horaFim) {
          setHoraFim(consultaAlvo.horaFim);
        } else {
          // Calcula fim somando duração ou padrão 1h
          const duracaoMin = consultaAlvo.duracao || 60;
          const [h, m] = consultaAlvo.hora.split(':').map(Number);
          const totalMin = (h || 0) * 60 + (m || 0) + duracaoMin;
          const endH = String(Math.floor(totalMin / 60) % 24).padStart(2, '0');
          const endM = String(totalMin % 60).padStart(2, '0');
          setHoraFim(`${endH}:${endM}`);
        }
      }

      if (consultaAlvo.procedimento) {
        setMotivo(`Procedimento Odontológico: ${consultaAlvo.procedimento}`);
      }
      if (consultaAlvo.observacoes) {
        setObservacoes(consultaAlvo.observacoes);
      }
    } else {
      setConsultaEncontrada(null);
      // Padrão de horários baseado na hora atual
      const now = new Date();
      const curH = String(now.getHours()).padStart(2, '0');
      const curM = String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, '0');
      setHoraInicio(`${curH}:${curM}`);
      const nextH = String((now.getHours() + 1) % 24).padStart(2, '0');
      setHoraFim(`${nextH}:${curM}`);
    }

    // Configurar dentista padrão
    const dentistaPadraoNome =
      consultaAlvo?.dentista ||
      configContrato?.dentistaResponsavelContrato ||
      (dentistas && dentistas.length > 0 ? dentistas[0].nome : 'Dra. Rosangela Santos');

    setDentistaNome(dentistaPadraoNome);

    const dentistaEncontrado = (dentistas || []).find((d) => d.nome === dentistaPadraoNome);
    setDentistaCro(
      dentistaEncontrado?.cro || configContrato?.croResponsavelContrato || 'CRO-AL 6267'
    );
  }, [isOpen, patient, consultas, dentistas, configContrato]);

  const handleDentistaChange = (nome: string) => {
    setDentistaNome(nome);
    const dent = (dentistas || []).find((d) => d.nome === nome);
    if (dent?.cro) {
      setDentistaCro(dent.cro);
    } else if (nome.includes('Rosangela')) {
      setDentistaCro(configContrato?.croResponsavelContrato || 'CRO-AL 6267');
    }
  };

  const formatarDataExtenso = (dataIso: string) => {
    try {
      const [ano, mes, dia] = dataIso.split('-');
      const meses = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
      ];
      return `${dia} de ${meses[Number(mes) - 1]} de ${ano}`;
    } catch {
      return new Date().toLocaleDateString('pt-BR');
    }
  };

  const formatarDataBr = (dataIso: string) => {
    try {
      const [ano, mes, dia] = dataIso.split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dataIso;
    }
  };

  const gerarHtmlAtestado = () => {
    const dataExtenso = formatarDataExtenso(dataAtendimento || new Date().toISOString().split('T')[0]);
    const dataAtendBr = formatarDataBr(dataAtendimento || new Date().toISOString().split('T')[0]);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Atestado Odontológico - ${patient.nome}</title>
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
      margin-bottom: 36px;
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
      margin: 30px 0 24px;
    }
    .doc-badge h1 {
      display: inline-block;
      font-size: 20px;
      font-weight: 800;
      letter-spacing: 2.5px;
      color: #0f172a;
      text-transform: uppercase;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 6px;
      margin: 0;
    }
    .content-body {
      margin: 32px 0 24px;
      font-size: 15px;
      line-height: 2.0;
      color: #1e293b;
      text-align: justify;
    }
    .destaque {
      font-weight: 700;
      color: #0f172a;
    }
    .obs-card {
      background: #f8fafc;
      border-left: 4px solid #0284c7;
      border-radius: 4px;
      padding: 14px 18px;
      margin: 24px 0;
      font-size: 13px;
      line-height: 1.6;
      color: #334155;
    }
    .obs-card strong {
      color: #0369a1;
      display: block;
      margin-bottom: 4px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .data-local {
      text-align: right;
      margin: 48px 0 60px;
      font-size: 14px;
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
      margin-top: 60px;
      padding-top: 12px;
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
        <p class="clinic-sub">Odontologia Especializada • Reabilitação Oral e Estética</p>
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
    <h1>Atestado Odontológico</h1>
  </div>

  <div class="content-body">
    <p>
      Atesto para os devidos fins legais e comprobatórios que o(a) paciente 
      <span class="destaque">${patient.nome}</span>, 
      inscrito(a) no CPF sob o nº <span class="destaque">${patient.cpf || 'Não informado'}</span>
      ${patient.rg ? `, portador(a) do RG nº <span class="destaque">${patient.rg}</span>` : ''},
      esteve sob atendimento odontológico nesta clínica no dia 
      <span class="destaque">${dataAtendBr}</span>, 
      no período das <span class="destaque">${horaInicio}</span> às <span class="destaque">${horaFim}</span>, 
      para <span class="destaque">${motivo}</span>.
    </p>

    ${
      diasAfastamento > 0
        ? `<p>
            Em decorrência do procedimento realizado e para adequada recuperação clínica, 
            o(a) paciente necessita de 
            <span class="destaque">${diasAfastamento} (${diasAfastamento === 1 ? 'um' : diasAfastamento === 2 ? 'dois' : diasAfastamento === 3 ? 'três' : diasAfastamento}) dia(s) de repouso e afastamento</span> 
            de suas atividades profissionais e rotineiras a contar desta data.
          </p>`
        : `<p>
            O presente documento atesta o comparecimento do(a) paciente à consulta no horário supracitado.
          </p>`
    }

    ${
      cid
        ? `<p>
            Diagnóstico Clínico / CID-10: <span class="destaque">${cid}</span>
          </p>`
        : ''
    }

    ${
      observacoes
        ? `<div class="obs-card">
            <strong>Observações e Recomendações Clínicas:</strong>
            ${observacoes.replace(/\n/g, '<br/>')}
          </div>`
        : ''
    }
  </div>

  <div class="data-local">
    Maceió - AL, ${dataExtenso}.
  </div>

  <div class="signature-section">
    <div class="signature-line"></div>
    <div class="dentist-name">${dentistaNome}</div>
    <div class="dentist-cro">Cirurgião(ã)-Dentista • ${dentistaCro}</div>
  </div>

  <div class="footer-stamp">
    Documento emitido eletronicamente • Dra. Rosangela Santos - Clínica Odontológica • Maceió - AL
  </div>
</body>
</html>`;
  };

  const handleBaixarPdf = async () => {
    setGerando(true);
    try {
      const html = gerarHtmlAtestado();
      const filename = `atestado_${patient.nome.replace(/\s+/g, '_')}_${dataAtendimento || 'hoje'}`;
      const success = await downloadHtmlAsPdf(html, filename);
      if (success) {
        toast.success('Atestado em PDF gerado com sucesso!');
        onClose();
      } else {
        toast.error('Não foi possível gerar o PDF. Tente novamente.');
      }
    } catch (err: any) {
      toast.error('Erro ao gerar atestado: ' + (err?.message || 'Erro inesperado'));
    } finally {
      setGerando(false);
    }
  };

  const handleImprimir = () => {
    const html = gerarHtmlAtestado();
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

    const dataBr = formatarDataBr(dataAtendimento || new Date().toISOString().split('T')[0]);
    const msg = [
      `*Atestado Odontológico - ${nomeClinica}*`,
      '',
      `Olá, *${patient.nome}*!`,
      `Segue a comprovação do seu atendimento odontológico:`,
      '',
      `📅 *Data:* ${dataBr}`,
      `⏰ *Horário:* das ${horaInicio} às ${horaFim}`,
      `🦷 *Motivo:* ${motivo}`,
      diasAfastamento > 0 ? `🛌 *Repouso recomendado:* ${diasAfastamento} dia(s)` : null,
      cid ? `📋 *CID:* ${cid}` : null,
      observacoes ? `📝 *Observações:* ${observacoes}` : null,
      '',
      `👨‍⚕️ *Profissional:* ${dentistaNome} (${dentistaCro})`,
      `📍 ${enderecoClinica}`,
      '',
      '_Caso necessite do documento em PDF carimbado e assinado, ele já está disponível em nosso sistema._',
    ].filter(Boolean).join('\n');

    openWhatsApp(patient.telefone, msg);
    toast.success('Mensagem formatada e enviada via WhatsApp!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto overscroll-contain touch-pan-y p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <FileText className="h-5 w-5" />
            <DialogTitle className="text-lg sm:text-xl font-bold">
              Gerar Atestado Odontológico
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs sm:text-sm">
            Paciente: <strong className="text-foreground">{patient.nome}</strong>
            {patient.cpf && ` • CPF: ${patient.cpf}`}
          </DialogDescription>
        </DialogHeader>

        {consultaEncontrada && (
          <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-lg p-2.5 text-xs text-sky-800 dark:text-sky-300 flex items-start gap-2">
            <Clock className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
            <div>
              <strong>Horário identificado na agenda:</strong> Consulta de{' '}
              {formatarDataBr(new Date(consultaEncontrada.data).toISOString().split('T')[0])} às{' '}
              {consultaEncontrada.hora} ({consultaEncontrada.procedimento || 'Atendimento'}). Os campos foram preenchidos automaticamente.
            </div>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Motivo do Atestado */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Motivo do Atendimento / Procedimento</Label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {MOTIVOS_PRESET.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMotivo(p)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                    motivo === p
                      ? 'bg-primary text-primary-foreground border-primary font-medium'
                      : 'bg-muted/60 hover:bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <Input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do atestado..."
              className="text-xs sm:text-sm"
            />
          </div>

          {/* Data e Horário Conforme Agenda */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Data do Atendimento</Label>
              <Input
                type="date"
                value={dataAtendimento}
                onChange={(e) => setDataAtendimento(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Horário Início</Label>
              <Input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Horário Término</Label>
              <Input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Afastamento / Repouso */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Afastamento / Repouso</Label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {[
                { label: 'Apenas Comparecimento (0 dias)', val: 0 },
                { label: '1 dia de repouso', val: 1 },
                { label: '2 dias de repouso', val: 2 },
                { label: '3 dias de repouso', val: 3 },
                { label: '5 dias de repouso', val: 5 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setDiasAfastamento(opt.val)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                    diasAfastamento === opt.val
                      ? 'bg-primary text-primary-foreground border-primary font-medium'
                      : 'bg-muted/60 hover:bg-muted text-muted-foreground border-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {diasAfastamento > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Quantidade de dias:</span>
                <Input
                  type="number"
                  min="0"
                  max="60"
                  value={diasAfastamento}
                  onChange={(e) => setDiasAfastamento(Number(e.target.value) || 0)}
                  className="w-24 text-xs sm:text-sm h-8"
                />
              </div>
            )}
          </div>

          {/* Observações e CID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-medium">Observações Clínicas (Opcional)</Label>
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Necessita evitar mastigação pesada, repouso físico..."
                className="text-xs sm:text-sm resize-none"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">CID-10 (Opcional)</Label>
              <Input
                value={cid}
                onChange={(e) => setCid(e.target.value)}
                placeholder="Ex: K04.0, K08.1"
                className="text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Cirurgião-Dentista Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Dentista Responsável</Label>
              <Select value={dentistaNome} onValueChange={handleDentistaChange}>
                <SelectTrigger className="text-xs sm:text-sm h-9">
                  <SelectValue placeholder="Selecione o cirurgião-dentista" />
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
              <Label className="text-xs font-medium">CRO do Profissional</Label>
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

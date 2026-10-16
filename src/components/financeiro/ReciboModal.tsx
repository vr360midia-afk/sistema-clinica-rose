import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Printer,
  MessageSquare,
  Mail,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  QrCode,
  FileText,
} from 'lucide-react';
import {
  ReciboDados,
  ReciboClinica,
  gerarReciboHtml,
  valorPorExtenso,
  gerarHashAutenticidade,
  metodoLabel,
} from '@/utils/recibo';
import { toast } from 'sonner';

interface ReciboModalProps {
  isOpen: boolean;
  onClose: () => void;
  dados: ReciboDados;
  clinica?: ReciboClinica;
}

export const ReciboModal: React.FC<ReciboModalProps> = ({
  isOpen,
  onClose,
  dados: dadosIniciais,
  clinica = {},
}) => {
  const [copiouLink, setCopiouLink] = useState(false);
  const [dados, setDados] = useState<ReciboDados>(dadosIniciais);

  // Sincroniza se dadosIniciais mudar
  React.useEffect(() => {
    if (isOpen) {
      setDados(dadosIniciais);
    }
  }, [isOpen, dadosIniciais]);

  const valorNum = Number(dados.valor || 0);
  const valorFmt = valorNum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const valorExtenso = valorPorExtenso(valorNum);

  const dataObj = new Date(dados.data);
  const dataFmt = isNaN(dataObj.getTime())
    ? new Date().toLocaleDateString('pt-BR')
    : dataObj.toLocaleDateString('pt-BR');
  const dataExtenso = isNaN(dataObj.getTime())
    ? new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
    : dataObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  const emissorNome = clinica.nomeClinica || clinica.nomeProfissional || 'Clínica Odontológica';
  const documentoEmitente = clinica.cnpj || clinica.cpf || '';
  const tipoDocEmitente = documentoEmitente.length > 14 ? 'CNPJ' : 'CPF';
  const registroProfissional = clinica.cro || clinica.registroProfissional || '';

  const emitidoEmData = dados.emitidoEm ? new Date(dados.emitidoEm) : new Date();
  const carimboHora =
    emitidoEmData.toLocaleDateString('pt-BR') +
    ' às ' +
    emitidoEmData.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const hashAuth =
    dados.hashAutenticidade ||
    gerarHashAutenticidade({
      numero: dados.numero,
      valor: valorNum,
      data: dataFmt,
      pacienteNome: dados.pacienteNome,
      pacienteCpf: dados.pacienteCpf,
    });

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sistemaclinica.com';
  const urlVerificacao = `${baseUrl}/verificar/${hashAuth}?num=${encodeURIComponent(
    dados.numero
  )}&val=${valorNum}&pac=${encodeURIComponent(dados.pacienteNome)}&emi=${encodeURIComponent(emissorNome)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(
    urlVerificacao
  )}`;

  const parcelasTexto =
    dados.parcelaAtual && dados.totalParcelas
      ? `Parcela ${dados.parcelaAtual} de ${dados.totalParcelas}`
      : dados.parcelas && dados.parcelas > 1
      ? `${dados.parcelas}x parcelas`
      : null;

  const metodoTexto = dados.metodoPagamento
    ? metodoLabel[dados.metodoPagamento] || dados.metodoPagamento
    : 'Transferência / À vista';

  // 1. Imprimir / Salvar como PDF nativo A4 Paisagem
  const handleImprimir = () => {
    const html = gerarReciboHtml(dados, clinica, { publicUrl: baseUrl });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 400);
      };
    } else {
      toast.info('Abrindo impressão...');
      window.print();
    }
  };

  // 2. Enviar por WhatsApp
  const handleEnviarWhatsApp = () => {
    const mensagem =
      `*RECIBO DE PAGAMENTO - ${emissorNome.toUpperCase()}*\n\n` +
      `Olá, *${dados.pacienteNome}*!\n` +
      `Confirmamos o recebimento no valor de *${valorFmt}* (${valorExtenso}) referente a *${
        dados.descricao || 'serviços odontológicos prestados'
      }*.\n\n` +
      `📄 *Recibo nº:* ${dados.numero}\n` +
      `📅 *Data:* ${dataFmt}\n` +
      `💳 *Forma:* ${metodoTexto}\n` +
      (parcelasTexto ? `🔢 *Parcela:* ${parcelasTexto}\n` : '') +
      `\n🔐 *Autenticidade Verificável:*\n${urlVerificacao}\n` +
      `*Código de validação:* ${hashAuth}\n\n` +
      `Agradecemos pela confiança!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, '_blank');
  };

  // 3. Enviar por E-mail
  const handleEnviarEmail = () => {
    const assunto = `Recibo de Pagamento nº ${dados.numero} - ${emissorNome}`;
    const corpo =
      `Prezado(a) ${dados.pacienteNome},\n\n` +
      `Confirmamos o recebimento do valor de ${valorFmt} (${valorExtenso}) referente a ${
        dados.descricao || 'serviços odontológicos prestados'
      }.\n\n` +
      `Número do Recibo: ${dados.numero}\n` +
      `Data: ${dataFmt}\n` +
      `Forma de Pagamento: ${metodoTexto}\n` +
      (parcelasTexto ? `Parcelamento: ${parcelasTexto}\n` : '') +
      `\nVerificação de autenticidade eletrônica:\n${urlVerificacao}\nCódigo: ${hashAuth}\n\n` +
      `Atenciosamente,\n${emissorNome}\n${registroProfissional || ''}`;

    window.open(`mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`, '_blank');
  };

  const copiarLinkVerificacao = () => {
    navigator.clipboard.writeText(urlVerificacao);
    setCopiouLink(true);
    setTimeout(() => setCopiouLink(false), 3000);
    toast.success('Link público de verificação copiado!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border shadow-2xl">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-700">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                Recibo Oficial de Pagamento
                <Badge className="bg-amber-500/20 text-amber-300 text-[10px] uppercase border-amber-500/40 font-semibold">
                  Padrão Premium A4
                </Badge>
              </DialogTitle>
              <p className="text-stone-300 text-xs mt-0.5">
                Layout pronto para impressão, PDF com texto selecionável e autenticidade via QR Code.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleImprimir}
              className="h-8 text-xs font-semibold gap-1.5 bg-white text-stone-900 hover:bg-stone-100 border-0 shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-[#b08d57]" />
              Baixar PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleImprimir}
              className="h-8 text-xs font-semibold gap-1.5 bg-stone-700 hover:bg-stone-600 text-white border-0 shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleEnviarWhatsApp}
              className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              WhatsApp
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleEnviarEmail}
              className="h-8 text-xs font-semibold gap-1.5 bg-stone-700 hover:bg-stone-600 text-white border-0 shadow-xs"
            >
              <Mail className="h-3.5 w-3.5" />
              E-mail
            </Button>
          </div>
        </div>

        {/* Área de Visualização e Ajustes */}
        <div className="p-4 bg-stone-100 dark:bg-stone-950 max-h-[75vh] overflow-y-auto space-y-4">
          {/* Folha do Recibo Formatada em Alta Definição */}
          <div className="bg-white text-stone-900 rounded-none shadow-md border border-stone-300 p-1 mx-auto max-w-[850px] relative font-sans">
            {/* Moldura Dupla Fina: 1px #1a1a1a + 3px gap + 0.5px dourado #b08d57 */}
            <div className="border border-stone-900 p-[3px] bg-white">
              <div className="border-[0.5px] border-[#b08d57] p-5 sm:p-7 relative bg-white min-h-[360px] flex flex-col justify-between">
                
                {/* Marca d'água no centro */}
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none select-none">
                  {clinica.logoUrl ? (
                    <img src={clinica.logoUrl} alt="Logo" className="max-w-[200px] grayscale" />
                  ) : (
                    <div className="font-serif text-6xl font-bold tracking-widest text-stone-900">
                      {emissorNome.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="relative z-10 space-y-4">
                  {/* Cabeçalho em 2 Colunas */}
                  <div className="grid grid-cols-[1fr_auto] gap-4 items-start border-b border-[#d9d4c7] pb-3">
                    <div className="flex items-start gap-3">
                      {clinica.logoUrl && (
                        <img
                          src={clinica.logoUrl}
                          alt="Logo da Clínica"
                          className="max-h-12 max-w-[110px] object-contain shrink-0"
                        />
                      )}
                      <div>
                        <h2 className="font-serif text-base font-bold text-stone-900 leading-tight">
                          {emissorNome}
                        </h2>
                        <p className="text-[11px] text-stone-600 mt-0.5 leading-snug">
                          {registroProfissional && <span>Registro: <strong>{registroProfissional}</strong> • </span>}
                          {documentoEmitente && <span>{tipoDocEmitente}: <strong>{documentoEmitente}</strong></span>}
                        </p>
                        {clinica.endereco && (
                          <p className="text-[10px] text-stone-500 leading-snug">{clinica.endereco}</p>
                        )}
                        <p className="text-[10px] text-stone-500 leading-snug">
                          {clinica.telefone && `Tel: ${clinica.telefone}`}
                          {clinica.telefone && clinica.email && ' • '}
                          {clinica.email}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase tracking-wider text-stone-500 block">Recibo nº</span>
                      <span className="font-mono text-base font-bold text-[#b08d57] block">{dados.numero}</span>
                      <span className="text-[11px] text-stone-500">{dataFmt}</span>
                    </div>
                  </div>

                  {/* Título RECIBO e Caixa de Valor Dourada */}
                  <div className="text-center space-y-1.5 py-1">
                    <h3 className="font-serif text-xs font-bold uppercase tracking-[0.35em] text-stone-900">
                      RECIBO
                    </h3>
                    <div className="inline-block bg-[#faf8f3] border border-[#b08d57] px-8 py-1.5 min-w-[220px]">
                      <span className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
                        {valorFmt}
                      </span>
                    </div>
                  </div>

                  {/* Texto do Corpo da Declaração (Sem line-through, com sublinha neutra fina) */}
                  <div className="text-[13px] sm:text-[13.5px] leading-[1.7] text-stone-900 text-justify px-1">
                    Recebi de{' '}
                    <span className="font-semibold text-stone-900 border-b border-[#d9d4c7] pb-[1px]">
                      {dados.pacienteNome}
                    </span>
                    , CPF{' '}
                    <span className="font-semibold text-stone-900 border-b border-[#d9d4c7] pb-[1px]">
                      {dados.pacienteCpf || 'Não informado'}
                    </span>
                    , a importância de{' '}
                    <span className="font-semibold text-stone-900 border-b border-[#d9d4c7] pb-[1px]">
                      {valorExtenso}
                    </span>{' '}
                    (
                    <span className="font-semibold text-stone-900 border-b border-[#d9d4c7] pb-[1px]">
                      {valorFmt}
                    </span>
                    ), referente a{' '}
                    <span className="font-semibold text-stone-900 border-b border-[#d9d4c7] pb-[1px]">
                      {dados.descricao || 'serviços odontológicos / tratamentos clínicos prestados'}
                    </span>
                    , dando plena e geral quitação do valor acima descrito.
                  </div>

                  {/* Grade de Detalhes do Pagamento */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px] bg-stone-50/50 p-2.5 border border-stone-200">
                    <div className="flex justify-between border-b border-dotted border-[#d9d4c7] pb-1">
                      <span className="text-stone-500 font-medium">Forma de pagamento:</span>
                      <span className="font-semibold text-stone-900">{metodoTexto}</span>
                    </div>

                    <div className="flex justify-between border-b border-dotted border-[#d9d4c7] pb-1">
                      <span className="text-stone-500 font-medium">Data do pagamento:</span>
                      <span className="font-semibold text-stone-900">{dataFmt}</span>
                    </div>

                    {parcelasTexto && (
                      <div className="flex justify-between border-b border-dotted border-[#d9d4c7] pb-1">
                        <span className="text-stone-500 font-medium">Parcelamento:</span>
                        <span className="font-semibold text-stone-900">{parcelasTexto}</span>
                      </div>
                    )}

                    <div className="flex justify-between border-b border-dotted border-[#d9d4c7] pb-1">
                      <span className="text-stone-500 font-medium">Local e data:</span>
                      <span className="font-semibold text-stone-900">
                        {clinica.endereco ? clinica.endereco.split('-')[0].trim() : 'Maceió'}, {dataExtenso}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rodapé: QR Code de Autenticidade, Linha de Assinatura e Carimbo */}
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-end pt-5 mt-2 border-t border-stone-200">
                  {/* QR Code */}
                  <div className="flex items-center gap-2">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code Autenticidade"
                      className="w-12 h-12 border border-[#d9d4c7] p-0.5 bg-white shrink-0"
                    />
                    <div className="text-[9px] text-stone-500 leading-tight">
                      <span className="block font-medium">Autenticidade Verificável</span>
                      <span className="font-mono font-bold text-stone-900 text-[10px] block">{hashAuth}</span>
                      <span className="text-[8px] text-stone-400">Escaneie para validar</span>
                    </div>
                  </div>

                  {/* Assinatura */}
                  <div className="text-center px-2">
                    <div className="w-48 sm:w-56 border-t border-stone-900 mx-auto mb-1"></div>
                    <div className="font-semibold text-xs text-stone-900">
                      {clinica.nomeProfissional || emissorNome}
                    </div>
                    <div className="text-[10px] text-stone-500">
                      {registroProfissional && <span>{registroProfissional}</span>}
                      {registroProfissional && documentoEmitente && ' • '}
                      {documentoEmitente && <span>{tipoDocEmitente}: {documentoEmitente}</span>}
                    </div>
                  </div>

                  {/* Carimbo de Emissão */}
                  <div className="text-right text-[9px] text-stone-500 leading-snug">
                    <div>Documento emitido eletronicamente</div>
                    <div className="font-medium text-stone-700">{carimboHora}</div>
                    <div className="text-[#b08d57] font-semibold text-[8.5px]">Assinatura Digital Válida</div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações Rápidas */}
        <div className="p-3 bg-stone-50 dark:bg-stone-900 border-t flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copiarLinkVerificacao}
              className="h-8 text-xs gap-1.5"
            >
              {copiouLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiouLink ? 'Link Copiado!' : 'Copiar Link de Verificação'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleEnviarEmail}
              className="h-8 text-xs gap-1.5"
            >
              <Mail className="h-3.5 w-3.5" />
              Enviar por E-mail
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handleImprimir}
              className="h-8 text-xs font-semibold gap-1.5 bg-[#b08d57] hover:bg-[#9c7a48] text-white shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar Recibo em PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Utilitário para Geração Determinística de PDF do Termo de Confirmação Digital de Sessão.
 * 
 * Princípios de Resiliência e Integridade:
 * 1. Baseado 100% no registro imutável persistido no banco de dados (documentos_clinicos ou tratamento_confirmacoes).
 * 2. Incorpora o hash SHA-256 canônico, metadados de auditoria (IP, User-Agent, carimbo de tempo) e imagem da assinatura.
 * 3. Recuperável a qualquer momento: caso a conexão falhe ou o navegador feche após a assinatura,
 *    o termo pode ser gerado/re-baixado a partir do banco com fidelidade determinística absoluta.
 */

import jsPDF from 'jspdf';
import { renderHtmlToPdf } from './pdfDownload';

export interface TermoConfirmacaoDados {
  clinicaNome?: string;
  clinicaCnpj?: string;
  clinicaEndereco?: string;
  pacienteNome: string;
  pacienteCpf?: string;
  pacienteTelefone?: string;
  procedimentoNome: string;
  numeroSessao: number;
  nomeObjetivo: string;
  dataRealizada?: string;
  horaRealizada?: string;
  profissionalNome: string;
  descricaoAtos: string;
  declaracaoTexto: string;
  observacoesPaciente?: string;
  concordaRealizacao?: boolean;
  assinaturaBase64: string;
  assinanteNome: string;
  assinanteCpf?: string;
  assinadoEm: string;
  hashIntegridade: string;
  token?: string;
  ipOrigem?: string;
  userAgent?: string;
  identificador?: string;
}

/**
 * Constrói o HTML canônico e determinístico do Termo de Confirmação.
 */
export function gerarTermoConfirmacaoHtml(dados: TermoConfirmacaoDados): string {
  const clinicaNome = dados.clinicaNome || 'Clínica Odontológica Dra. Rosângela';
  const clinicaEndereco = dados.clinicaEndereco || 'Atendimento Odontológico Especializado';
  
  const dataFormatada = dados.assinadoEm 
    ? new Date(dados.assinadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleString('pt-BR');

  const dataSessaoFormatada = dados.dataRealizada
    ? dados.dataRealizada.includes('-')
      ? dados.dataRealizada.split('-').reverse().join('/')
      : dados.dataRealizada
    : 'Data não informada';

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1e293b; line-height: 1.5; padding: 24px; max-width: 740px; margin: 0 auto; background: #ffffff;">
      <!-- CABEÇALHO DA CLÍNICA -->
      <div style="border-bottom: 2px solid #0f766e; padding-bottom: 14px; margin-bottom: 20px; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: bold; color: #0f766e; text-transform: uppercase; letter-spacing: 0.5px;">
          ${clinicaNome}
        </h1>
        <p style="margin: 4px 0 0; font-size: 11px; color: #64748b;">
          ${clinicaEndereco}
        </p>
        <div style="margin-top: 8px; display: inline-block; padding: 4px 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 9999px;">
          <span style="font-size: 12px; font-weight: 600; color: #166534; text-transform: uppercase;">
            Comprovante de Atendimento e Confirmação Digital de Sessão
          </span>
        </div>
      </div>

      <!-- DADOS DO PROCEDIMENTO E PACIENTE -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr>
            <td style="padding: 4px 0; width: 50%;"><strong>Paciente:</strong> ${dados.pacienteNome || '—'}</td>
            <td style="padding: 4px 0; width: 50%;"><strong>CPF do Paciente:</strong> ${dados.pacienteCpf || '—'}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong>Procedimento:</strong> ${dados.procedimentoNome || '—'}</td>
            <td style="padding: 4px 0;"><strong>Sessão:</strong> Nº ${dados.numeroSessao} (${dados.nomeObjetivo})</td>
          </tr>
          <tr>
            <td style="padding: 4px 0;"><strong>Profissional Responsável:</strong> ${dados.profissionalNome || '—'}</td>
            <td style="padding: 4px 0;"><strong>Data / Horário do Atendimento:</strong> ${dataSessaoFormatada} às ${dados.horaRealizada || '—'}</td>
          </tr>
        </table>
      </div>

      <!-- ATOS CLÍNICOS REALIZADOS -->
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13px; font-weight: bold; color: #0f172a; margin: 0 0 6px; text-transform: uppercase;">
          1. Atos Clínicos Realizados
        </h3>
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 12px; background: #ffffff; color: #334155; white-space: pre-line;">
          ${dados.descricaoAtos || 'Atendimento clínico realizado em conformidade com o planejamento.'}
        </div>
      </div>

      <!-- DECLARAÇÃO DO PACIENTE -->
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13px; font-weight: bold; color: #0f172a; margin: 0 0 6px; text-transform: uppercase;">
          2. Declaração e Ciência do Paciente
        </h3>
        <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; font-size: 12px; background: #fdfdfd; color: #334155; line-height: 1.6;">
          ${dados.declaracaoTexto}
        </div>
      </div>

      <!-- OBSERVAÇÕES DO PACIENTE (SE HOUVER) -->
      ${dados.observacoesPaciente ? `
      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13px; font-weight: bold; color: #0f172a; margin: 0 0 6px; text-transform: uppercase;">
          3. Observações Registradas pelo Paciente
        </h3>
        <div style="border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px; font-size: 12px; background: #f8fafc; color: #475569;">
          ${dados.observacoesPaciente}
        </div>
      </div>
      ` : ''}

      <!-- QUADRO DE ASSINATURA ELETRÔNICA -->
      <div style="margin-bottom: 18px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; background: #fafafa;">
        <h3 style="font-size: 13px; font-weight: bold; color: #0f172a; margin: 0 0 10px; text-transform: uppercase;">
          Assinatura Eletrônica do Paciente / Responsável
        </h3>
        
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
          <div style="flex: 1; border: 1px solid #cbd5e1; background: #ffffff; border-radius: 6px; padding: 8px; text-align: center; min-height: 90px; display: flex; align-items: center; justify-content: center;">
            ${dados.assinaturaBase64 ? `
              <img src="${dados.assinaturaBase64}" alt="Assinatura Eletrônica" style="max-height: 80px; max-width: 100%; display: block; margin: 0 auto;" />
            ` : '<span style="color: #94a3b8; font-size: 12px;">Assinatura não renderizada</span>'}
          </div>
          
          <div style="flex: 1; font-size: 11px; color: #475569; line-height: 1.5;">
            <p style="margin: 0 0 4px;"><strong>Assinado por:</strong> ${dados.assinanteNome || dados.pacienteNome}</p>
            ${dados.assinanteCpf ? `<p style="margin: 0 0 4px;"><strong>CPF:</strong> ${dados.assinanteCpf}</p>` : ''}
            <p style="margin: 0 0 4px;"><strong>Data e Hora:</strong> ${dataFormatada}</p>
            <p style="margin: 0 0 4px;"><strong>Status:</strong> <span style="color: #166534; font-weight: bold;">Confirmado Eletronicamente</span></p>
          </div>
        </div>
      </div>

      <!-- TRILHA DE AUDITORIA CRIPTOGRÁFICA -->
      <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 9px; color: #64748b; line-height: 1.4;">
        <p style="margin: 0 0 3px;">
          <strong>HASH SHA-256 DE INTEGRIDADE:</strong> 
          <code style="font-family: monospace; background: #f1f5f9; padding: 1px 4px; border-radius: 3px; font-size: 9px; color: #0f172a;">${dados.hashIntegridade || '—'}</code>
        </p>
        <p style="margin: 0 0 3px;">
          <strong>Vínculo do Registro:</strong> Sessão ID: ${dados.token ? dados.token.substring(0, 16) + '...' : 'CONF'} | 
          IP de Origem: ${dados.ipOrigem || 'Registrado via Web'} | 
          Registro Permanente e Imutável no Banco de Dados
        </p>
        <p style="margin: 0; font-size: 8.5px; color: #94a3b8; font-style: italic;">
          Documento gerado deterministamente com validade jurídica e integridade probatória assegurada. Conforme as normas de prontuário odontológico eletrônico, os registros assinados são protegidos contra alteração ou exclusão.
        </p>
      </div>
    </div>
  `;
}

/**
 * Renderiza o PDF determinístico a partir do HTML.
 */
export async function gerarTermoConfirmacaoPdf(dados: TermoConfirmacaoDados): Promise<jsPDF | null> {
  const html = gerarTermoConfirmacaoHtml(dados);
  try {
    const pdf = await renderHtmlToPdf(html);
    return pdf;
  } catch (err) {
    console.error('[tratamentoPdf] Falha ao renderizar PDF via renderHtmlToPdf, aplicando fallback determinístico jsPDF puro:', err);
    
    // Fallback determinístico jsPDF direto caso ocorra erro no html2canvas/DOM
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const marginLeft = 36;
    let y = 45;

    pdf.setFontSize(16);
    pdf.setTextColor(15, 118, 110);
    pdf.text(dados.clinicaNome || 'Clínica Odontológica Dra. Rosângela', marginLeft, y);
    y += 20;

    pdf.setFontSize(11);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Comprovante de Atendimento e Confirmação Digital de Sessão', marginLeft, y);
    y += 25;

    pdf.setDrawColor(203, 213, 225);
    pdf.line(marginLeft, y, 559, y);
    y += 20;

    pdf.setFontSize(10);
    pdf.setTextColor(30, 41, 59);
    pdf.text(`Paciente: ${dados.pacienteNome} | Procedimento: ${dados.procedimentoNome}`, marginLeft, y);
    y += 16;
    pdf.text(`Sessão ${dados.numeroSessao} (${dados.nomeObjetivo}) - Profissional: ${dados.profissionalNome}`, marginLeft, y);
    y += 25;

    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Atos Clínicos Realizados:', marginLeft, y);
    y += 15;
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    const splitAtos = pdf.splitTextToSize(dados.descricaoAtos || 'Procedimento realizado.', 500);
    pdf.text(splitAtos, marginLeft, y);
    y += splitAtos.length * 12 + 15;

    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text('Declaração do Paciente:', marginLeft, y);
    y += 15;
    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);
    const splitDecl = pdf.splitTextToSize(dados.declaracaoTexto, 500);
    pdf.text(splitDecl, marginLeft, y);
    y += splitDecl.length * 12 + 20;

    // Assinatura
    if (dados.assinaturaBase64 && dados.assinaturaBase64.startsWith('data:image')) {
      try {
        pdf.addImage(dados.assinaturaBase64, 'PNG', marginLeft, y, 160, 60);
      } catch (imgErr) {
        pdf.text('[Assinatura Eletrônica Registrada]', marginLeft, y + 20);
      }
    }
    y += 75;

    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Assinado por: ${dados.assinanteNome} em ${dados.assinadoEm}`, marginLeft, y);
    y += 14;
    pdf.text(`Hash SHA-256: ${dados.hashIntegridade}`, marginLeft, y);

    return pdf;
  }
}

/**
 * Dispara o download determinístico do PDF do Termo de Confirmação.
 */
export async function baixarTermoConfirmacaoPdf(dados: TermoConfirmacaoDados, filename?: string): Promise<void> {
  const pdf = await gerarTermoConfirmacaoPdf(dados);
  if (!pdf) {
    throw new Error('Não foi possível gerar o arquivo PDF.');
  }

  const nomeArquivo = filename || `termo-confirmacao-sessao-${dados.numeroSessao}-${dados.pacienteNome.toLowerCase().replace(/\s+/g, '-')}.pdf`;
  pdf.save(nomeArquivo);
}


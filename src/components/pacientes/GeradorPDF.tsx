import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileText, Download, Loader2, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';

export const GeradorPDF = ({ patient, tipo = 'atestado', conteudo = '' }: { patient: any, tipo?: string, conteudo?: string }) => {
  const { configuracoes } = useConfiguracoes();
  const [gerando, setGerando] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  
  const nomeClinica = configuracoes?.nome_clinica || 'Dental Angel';
  const croResponsavel = configuracoes?.cro_responsavel || 'CRO-XX 12345';
  
  const gerarPDF = async () => {
    if (!pdfRef.current) return;
    setGerando(true);
    
    try {
      // Temporarily make it visible for canvas capturing
      pdfRef.current.style.display = 'block';
      
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
      // A4 format: 210 x 297 mm
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${tipo}_${patient.nome.replace(/\s+/g, '_')}.pdf`);
      
      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao gerar PDF', { description: error.message });
    } finally {
      if (pdfRef.current) {
        pdfRef.current.style.display = 'none';
      }
      setGerando(false);
    }
  };

  return (
    <>
      <Button 
        onClick={gerarPDF} 
        disabled={gerando}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {gerando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
        Gerar {tipo.charAt(0).toUpperCase() + tipo.slice(1)} em PDF
      </Button>

      {/* Hidden Div that forms the PDF Structure */}
      <div 
        ref={pdfRef} 
        style={{ 
          display: 'none', 
          width: '794px', // A4 pixel width at 96 DPI
          minHeight: '1123px', // A4 pixel height
          padding: '40px 60px',
          backgroundColor: 'white',
          color: 'black',
          position: 'absolute',
          left: '-9999px',
          top: 0
        }}
        className="font-sans"
      >
        <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: '20px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', margin: 0 }}>{nomeClinica}</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Odontologia Especializada</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>Resp. Técnico</p>
            <p style={{ fontSize: '14px', margin: 0 }}>{croResponsavel}</p>
          </div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '40px' }}>
          {tipo}
        </h2>

        <div style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '40px' }}>
          <p style={{ marginBottom: '20px' }}>
            Atesto para os devidos fins que o(a) paciente <strong>{patient.nome}</strong>, inscrito(a) no CPF 
            sob o nº <strong>{patient.cpf || 'Não informado'}</strong>, foi atendido(a) em nossa clínica no dia 
            <strong> {new Date().toLocaleDateString('pt-BR')}</strong>.
          </p>
          
          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderLeft: '4px solid #cbd5e1', borderRadius: '4px' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {conteudo || 'Necessita de 1 (um) dia de repouso por motivos de tratamento odontológico.'}
            </p>
          </div>
        </div>

        <div style={{ marginTop: '150px', textAlign: 'center' }}>
          <div style={{ width: '300px', borderBottom: '1px solid black', margin: '0 auto 10px auto' }}></div>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{nomeClinica}</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Assinatura e Carimbo</p>
          <p style={{ marginTop: '20px', fontSize: '12px', color: '#94a3b8' }}>
            Documento emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>
    </>
  );
};

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { toast } from 'sonner';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';

interface GeradorPDFProps {
  patient: any;
  tipo?: string;
  conteudo?: string;
  label?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const GeradorPDF = ({
  patient,
  tipo = 'atestado',
  conteudo = '',
  label,
  icon,
  className,
  variant = 'outline',
  size = 'sm',
}: GeradorPDFProps) => {
  const { configuracoes } = useConfiguracoes();
  const { config: configContrato } = useConfiguracoesContrato();
  const [gerando, setGerando] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  
  const nomeClinica =
    configuracoes?.nomeClinica ||
    configContrato?.nomeClinicaContrato ||
    'Dra. Rosangela Santos - Clínica Odontológica';
  const croResponsavel =
    configContrato?.croResponsavelContrato || 'CRO-AL 6267';
  const dentistaResponsavel =
    configContrato?.dentistaResponsavelContrato || 'Dra. Rosangela Santos';
  const enderecoClinica =
    configuracoes?.endereco ||
    configContrato?.enderecoContrato ||
    'JTR - Edifício Espanha, Sl 405 - Jatiúca, Maceió - AL';
  const telefoneClinica =
    configuracoes?.telefone ||
    configContrato?.telefoneContrato ||
    '(82) 97400-2213';
  const logoUrl = configuracoes?.logoUrl || '/logo.png';
  
  const gerarPDF = async () => {
    if (!pdfRef.current) return;
    setGerando(true);
    
    try {
      pdfRef.current.style.display = 'block';
      
      const canvas = await html2canvas(pdfRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      
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
        variant={variant}
        size={size}
        className={className || "flex items-center gap-2"}
        title={`Gerar ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} em PDF`}
      >
        {gerando ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          icon || <Printer className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{label || `Gerar ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} em PDF`}</span>
      </Button>

      {/* Hidden Div that forms the PDF Structure */}
      <div 
        ref={pdfRef} 
        style={{ 
          display: 'none', 
          width: '794px',
          minHeight: '1123px',
          padding: '40px 60px',
          backgroundColor: 'white',
          color: '#0f172a',
          position: 'absolute',
          left: '-9999px',
          top: 0
        }}
        className="font-sans"
      >
        <div style={{ borderBottom: '2px solid #0f172a', paddingBottom: '20px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img src={logoUrl} alt={nomeClinica} style={{ maxHeight: '60px', maxWidth: '140px', objectFit: 'contain' }} />
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0, textTransform: 'uppercase' }}>{nomeClinica}</h1>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>Odontologia Especializada • Reabilitação Oral</p>
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '11px', color: '#475569', lineHeight: '1.4' }}>
            <p style={{ margin: 0, fontWeight: 'bold', color: '#0f172a' }}>{dentistaResponsavel}</p>
            <p style={{ margin: 0 }}>{croResponsavel}</p>
            <p style={{ margin: '2px 0 0 0' }}>{enderecoClinica}</p>
            <p style={{ margin: 0 }}>Tel: {telefoneClinica}</p>
          </div>
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '40px', color: '#0f172a' }}>
          {tipo}
        </h2>

        <div style={{ fontSize: '15px', lineHeight: '1.8', marginBottom: '40px', color: '#1e293b' }}>
          <p style={{ marginBottom: '20px' }}>
            Atesto para os devidos fins que o(a) paciente <strong>{patient.nome}</strong>, inscrito(a) no CPF 
            sob o nº <strong>{patient.cpf || 'Não informado'}</strong>, foi atendido(a) em nossa clínica no dia 
            <strong> {new Date().toLocaleDateString('pt-BR')}</strong>.
          </p>
          
          <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderLeft: '4px solid #0284c7', borderRadius: '4px' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {conteudo || 'Necessita de repouso por motivos de tratamento odontológico.'}
            </p>
          </div>
        </div>

        <div style={{ marginTop: '120px', textAlign: 'center' }}>
          <div style={{ width: '280px', borderBottom: '1px solid #0f172a', margin: '0 auto 10px auto' }}></div>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '14px' }}>{dentistaResponsavel}</p>
          <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Cirurgiã-Dentista • {croResponsavel}</p>
          <p style={{ marginTop: '24px', fontSize: '11px', color: '#94a3b8' }}>
            Documento emitido em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
          </p>
        </div>
      </div>
    </>
  );
};

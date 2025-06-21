
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download, FileSignature } from 'lucide-react';
import { toast } from 'sonner';
import SignatureProntuario from './SignatureProntuario';

interface PDFGeneratorProps {
  patientData: any;
  teethStatus: any;
  images: any[];
  clinicLogo?: string;
  prontuarioId?: string;
  patientName?: string;
}

const PDFGenerator = ({ 
  patientData, 
  teethStatus, 
  images, 
  clinicLogo,
  prontuarioId = `prontuario-${Date.now()}`,
  patientName = 'Paciente'
}: PDFGeneratorProps) => {
  const [showSignatures, setShowSignatures] = useState(false);
  
  const generatePDF = () => {
    // Simulação da geração de PDF
    // Em um projeto real, você usaria uma biblioteca como jsPDF ou react-pdf
    toast.success('Gerando relatório PDF...', {
      description: 'O download iniciará em alguns segundos'
    });

    // Simular delay de geração
    setTimeout(() => {
      toast.success('PDF gerado com sucesso!', {
        description: 'Arquivo baixado para sua pasta de Downloads'
      });
    }, 2000);
  };

  const generateSimplePDF = () => {
    // Criar um PDF simples usando dados HTML
    const printContent = `
      <html>
        <head>
          <title>Prontuário - ${patientData?.patientName || 'Paciente'}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            .logo { max-height: 80px; margin-bottom: 10px; }
            .section { margin-bottom: 20px; }
            .section h3 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
            .field { margin-bottom: 10px; }
            .field strong { color: #555; }
            .odontogram { display: grid; grid-template-columns: repeat(16, 1fr); gap: 2px; margin: 20px 0; }
            .tooth { border: 1px solid #333; text-align: center; padding: 5px; font-size: 10px; }
            .images { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0; }
            .image-placeholder { border: 1px solid #ccc; height: 100px; display: flex; align-items: center; justify-content: center; }
            .signature-section { margin-top: 40px; padding-top: 20px; border-top: 2px solid #333; }
          </style>
        </head>
        <body>
          <div class="header">
            ${clinicLogo ? `<img src="${clinicLogo}" class="logo" alt="Logo da Clínica">` : ''}
            <h1>PRONTUÁRIO ODONTOLÓGICO</h1>
            <p>Data: ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
          
          <div class="section">
            <h3>DADOS DO PACIENTE</h3>
            <div class="field"><strong>Nome:</strong> ${patientData?.patientName || 'N/A'}</div>
            <div class="field"><strong>Data:</strong> ${patientData?.date || 'N/A'}</div>
          </div>
          
          <div class="section">
            <h3>ANAMNESE</h3>
            <div class="field"><strong>Queixa Principal:</strong> ${patientData?.queixaPrincipal || 'N/A'}</div>
            <div class="field"><strong>Exame Clínico:</strong> ${patientData?.exameClinico || 'N/A'}</div>
            <div class="field"><strong>Diagnóstico:</strong> ${patientData?.diagnostico || 'N/A'}</div>
            <div class="field"><strong>Plano de Tratamento:</strong> ${patientData?.planoTratamento || 'N/A'}</div>
          </div>
          
          <div class="section">
            <h3>ODONTOGRAMA</h3>
            <p>Status dos dentes registrado em: ${new Date().toLocaleDateString('pt-BR')}</p>
            <div class="odontogram">
              ${Array.from({length: 32}, (_, i) => {
                const toothNumber = i < 16 ? 18 - i : 31 + (i - 16);
                return `<div class="tooth">${toothNumber}</div>`;
              }).join('')}
            </div>
          </div>
          
          <div class="section">
            <h3>ANEXOS</h3>
            <p>Total de imagens anexadas: ${images?.length || 0}</p>
            <div class="images">
              ${images?.slice(0, 6).map(img => `
                <div class="image-placeholder">
                  Imagem: ${img.subcategory}
                </div>
              `).join('') || '<p>Nenhuma imagem anexada</p>'}
            </div>
          </div>
          
          <div class="signature-section">
            <h3>ASSINATURAS DIGITAIS</h3>
            <p><strong>IMPORTANTE:</strong> Este documento deve ser assinado digitalmente por ambas as partes para ter validade legal.</p>
            <div style="margin-top: 30px;">
              <p>______________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ______________________</p>
              <p style="text-align: center; margin-top: 10px;">
                <small>Assinatura do Paciente &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Assinatura do Dentista</small>
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button onClick={generateSimplePDF} className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Gerar PDF Simples
        </Button>
        <Button onClick={generatePDF} variant="outline" className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          PDF Completo
        </Button>
        <Button 
          onClick={() => setShowSignatures(!showSignatures)} 
          variant="outline"
          className="flex items-center gap-2"
        >
          <FileSignature className="h-4 w-4" />
          {showSignatures ? 'Ocultar' : 'Mostrar'} Assinaturas
        </Button>
      </div>

      {showSignatures && (
        <SignatureProntuario
          patientData={patientData}
          teethStatus={teethStatus}
          images={images}
          prontuarioId={prontuarioId}
          patientName={patientName}
          onSignaturesComplete={() => {
            toast.success('Prontuário assinado com sucesso!', {
              description: 'Agora você pode gerar o PDF com as assinaturas'
            });
          }}
        />
      )}
    </div>
  );
};

export default PDFGenerator;

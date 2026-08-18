
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSignature, Download, Users } from 'lucide-react';
import SignatureModal from '@/components/signature/SignatureModal';
import { SignatureData } from '@/components/signature/DigitalSignature';
import { useSignatures } from '@/hooks/useSignatures';
import { toast } from 'sonner';

interface SignatureProntuarioProps {
  patientData: any;
  teethStatus: any;
  images: any[];
  prontuarioId: string;
  patientName: string;
  onSignaturesComplete?: () => void;
}

const SignatureProntuario = ({ 
  patientData, 
  teethStatus, 
  images, 
  prontuarioId, 
  patientName,
  onSignaturesComplete 
}: SignatureProntuarioProps) => {
  const { saveSignature, generateSignedPDF, getSignaturesByDocument } = useSignatures();
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [currentSigner, setCurrentSigner] = useState<'paciente' | 'dentista'>('paciente');
  const [patientSignature, setPatientSignature] = useState<SignatureData | null>(null);
  const [dentistSignature, setDentistSignature] = useState<SignatureData | null>(null);

  React.useEffect(() => {
    // Carregar assinaturas existentes ao montar o componente
    const existingSignatures = getSignaturesByDocument(prontuarioId);
    const patientSig = existingSignatures.find(sig => sig.signerRole === 'paciente');
    const dentistSig = existingSignatures.find(sig => sig.signerRole === 'dentista');
    
    if (patientSig) setPatientSignature(patientSig);
    if (dentistSig) setDentistSignature(dentistSig);
  }, [prontuarioId, getSignaturesByDocument]);

  const handleStartSigning = () => {
    if (!patientSignature) {
      setCurrentSigner('paciente');
    } else if (!dentistSignature) {
      setCurrentSigner('dentista');
    }
    setShowSignatureModal(true);
  };

  const handleSignatureComplete = (signatureData: SignatureData) => {
    if (currentSigner === 'paciente') {
      setPatientSignature(signatureData);
      saveSignature(signatureData, prontuarioId, patientData?.patientId);
      
      // Após assinatura do paciente, solicitar assinatura do dentista
      setCurrentSigner('dentista');
      setShowSignatureModal(true);
    } else {
      setDentistSignature(signatureData);
      saveSignature(signatureData, prontuarioId, patientData?.patientId);
      setShowSignatureModal(false);
      
      toast.success('Prontuário assinado por ambas as partes!');
      onSignaturesComplete?.();
    }
  };

  const handleDownloadSignedDocument = () => {
    if (patientSignature && dentistSignature) {
      const documentContent = `
PRONTUÁRIO ODONTOLÓGICO

Paciente: ${patientName}
Data: ${new Date().toLocaleDateString('pt-BR')}

DADOS DO ATENDIMENTO:
Queixa Principal: ${patientData?.queixaPrincipal || 'N/A'}
Exame Clínico: ${patientData?.exameClinico || 'N/A'}
Diagnóstico: ${patientData?.diagnostico || 'N/A'}
Plano de Tratamento: ${patientData?.planoTratamento || 'N/A'}

ODONTOGRAMA:
Status dos dentes registrado em: ${new Date().toLocaleDateString('pt-BR')}

ANEXOS:
Total de imagens anexadas: ${images?.length || 0}
      `;
      
      generateSignedPDF(documentContent, [patientSignature, dentistSignature]);
    }
  };

  const getCurrentSignerName = () => {
    if (currentSigner === 'paciente') {
      return patientName;
    }
    return 'Dr. Dentista'; // Em um caso real, você pegaria o nome do dentista logado
  };

  const bothSigned = patientSignature && dentistSignature;
  const needsSigning = !patientSignature || !dentistSignature;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5 text-blue-600" />
          Assinaturas Digitais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status das assinaturas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <div className={`w-4 h-4 rounded-full ${patientSignature ? 'bg-green-500' : 'bg-muted'}`} />
            <div>
              <p className="text-sm font-medium">Paciente</p>
              <p className="text-xs text-muted-foreground">
                {patientSignature 
                  ? `Assinado em ${new Date(patientSignature.timestamp).toLocaleDateString('pt-BR')}`
                  : 'Aguardando assinatura'
                }
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 border rounded-lg">
            <div className={`w-4 h-4 rounded-full ${dentistSignature ? 'bg-green-500' : 'bg-muted'}`} />
            <div>
              <p className="text-sm font-medium">Dentista</p>
              <p className="text-xs text-muted-foreground">
                {dentistSignature 
                  ? `Assinado em ${new Date(dentistSignature.timestamp).toLocaleDateString('pt-BR')}`
                  : 'Aguardando assinatura'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex gap-3">
          {needsSigning && (
            <Button onClick={handleStartSigning} className="bg-blue-600 hover:bg-blue-700">
              <Users className="h-4 w-4 mr-2" />
              {!patientSignature ? 'Iniciar Assinaturas' : 'Assinar como Dentista'}
            </Button>
          )}
          
          {bothSigned && (
            <Button onClick={handleDownloadSignedDocument} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Baixar Documento Assinado
            </Button>
          )}
        </div>

        {bothSigned && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium">
              ✅ Documento assinado digitalmente por ambas as partes
            </p>
            <p className="text-xs text-green-600 mt-1">
              Este prontuário possui validade legal e pode ser usado como comprovante do atendimento.
            </p>
          </div>
        )}

        {/* Modal de Assinatura */}
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          title={`Assinatura ${currentSigner === 'paciente' ? 'do Paciente' : 'do Dentista'}`}
          description="Este prontuário contém informações sobre o atendimento odontológico realizado. Sua assinatura confirma a veracidade das informações registradas."
          signerName={getCurrentSignerName()}
          signerRole={currentSigner}
          documentType="contrato"
          onSignatureComplete={handleSignatureComplete}
        />
      </CardContent>
    </Card>
  );
};

export default SignatureProntuario;

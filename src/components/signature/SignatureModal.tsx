
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DigitalSignature, { SignatureData } from './DigitalSignature';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  signerName: string;
  signerRole: 'paciente' | 'dentista';
  documentType: 'anamnese' | 'orcamento' | 'contrato' | 'consentimento' | 'prescricao' | 'atestado';
  onSignatureComplete: (signatureData: SignatureData) => void;
  required?: boolean;
  requireIdentificationFields?: boolean;
  requireSelfie?: boolean;
  initialEmail?: string;
  initialCpf?: string;
  initialRg?: string;
}

const SignatureModal = ({
  isOpen,
  onClose,
  title = "Assinatura Digital Requerida",
  description,
  signerName,
  signerRole,
  documentType,
  onSignatureComplete,
  required = true,
  requireIdentificationFields,
  requireSelfie,
  initialEmail,
  initialCpf,
  initialRg,
}: SignatureModalProps) => {
  
  const handleSignatureComplete = (signatureData: SignatureData) => {
    onSignatureComplete(signatureData);
    onClose();
  };

  const getDocumentTypeDescription = () => {
    switch (documentType) {
      case 'anamnese':
        return 'Este documento contém as informações coletadas durante a anamnese. Sua assinatura confirma a veracidade das informações fornecidas.';
      case 'orcamento':
        return 'Este documento contém o orçamento para seu tratamento odontológico. Sua assinatura confirma a aprovação do orçamento apresentado.';
      case 'contrato':
        return 'Este é o contrato de prestação de serviços odontológicos. Sua assinatura confirma o aceite dos termos e condições.';
      case 'consentimento':
        return 'Este documento contém o termo de consentimento esclarecido. Sua assinatura confirma que você foi devidamente informado sobre o procedimento.';
      default:
        return 'Sua assinatura é necessária para validar este documento.';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {description || getDocumentTypeDescription()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-2">
          <DigitalSignature
            title={`Assinatura - ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}`}
            signerName={signerName}
            signerRole={signerRole}
            documentType={documentType}
            onSignatureComplete={handleSignatureComplete}
            onCancel={onClose}
            required={required}
            requireIdentificationFields={requireIdentificationFields}
            requireSelfie={requireSelfie}
            initialEmail={initialEmail}
            initialCpf={initialCpf}
            initialRg={initialRg}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureModal;

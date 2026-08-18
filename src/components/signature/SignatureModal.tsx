
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
  documentType: 'anamnese' | 'orcamento' | 'contrato' | 'consentimento';
  onSignatureComplete: (signatureData: SignatureData) => void;
  required?: boolean;
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
  required = true
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {description || getDocumentTypeDescription()}
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <DigitalSignature
            title={`Assinatura - ${documentType.charAt(0).toUpperCase() + documentType.slice(1)}`}
            signerName={signerName}
            signerRole={signerRole}
            documentType={documentType}
            onSignatureComplete={handleSignatureComplete}
            onCancel={onClose}
            required={required}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureModal;

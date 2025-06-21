
import { useState, useCallback } from 'react';
import { SignatureData } from '@/components/signature/DigitalSignature';

interface StoredSignature extends SignatureData {
  id: string;
  documentId?: string;
  patientId?: string;
}

export const useSignatures = () => {
  const [signatures, setSignatures] = useState<StoredSignature[]>([]);

  // Salvar assinatura no localStorage
  const saveSignature = useCallback((signatureData: SignatureData, documentId?: string, patientId?: string) => {
    const newSignature: StoredSignature = {
      ...signatureData,
      id: Date.now().toString() + Math.random().toString(36).substr(2),
      documentId,
      patientId
    };

    // Buscar assinaturas existentes
    const existingSignatures = getStoredSignatures();
    const updatedSignatures = [...existingSignatures, newSignature];
    
    // Salvar no localStorage
    localStorage.setItem('dental-signatures', JSON.stringify(updatedSignatures));
    setSignatures(updatedSignatures);
    
    return newSignature;
  }, []);

  // Buscar assinaturas do localStorage
  const getStoredSignatures = useCallback((): StoredSignature[] => {
    try {
      const stored = localStorage.getItem('dental-signatures');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar assinaturas:', error);
      return [];
    }
  }, []);

  // Buscar assinaturas por paciente
  const getSignaturesByPatient = useCallback((patientId: string): StoredSignature[] => {
    const allSignatures = getStoredSignatures();
    return allSignatures.filter(sig => sig.patientId === patientId);
  }, [getStoredSignatures]);

  // Buscar assinaturas por documento
  const getSignaturesByDocument = useCallback((documentId: string): StoredSignature[] => {
    const allSignatures = getStoredSignatures();
    return allSignatures.filter(sig => sig.documentId === documentId);
  }, [getStoredSignatures]);

  // Gerar PDF com assinaturas (simulado)
  const generateSignedPDF = useCallback((documentContent: string, signatures: StoredSignature[]) => {
    // Esta é uma implementação simulada
    // Em um projeto real, você usaria uma biblioteca como jsPDF
    const pdfContent = `
      ${documentContent}
      
      =====================================
      ASSINATURAS DIGITAIS
      =====================================
      
      ${signatures.map(sig => `
      Assinante: ${sig.signerName} (${sig.signerRole})
      Data/Hora: ${sig.timestamp.toLocaleString()}
      E-mail: ${sig.signerInfo?.email || 'Não informado'}
      CPF: ${sig.signerInfo?.cpf || 'Não informado'}
      
      [Assinatura Digital Aplicada]
      
      `).join('\n')}
      
      =====================================
      Este documento foi assinado digitalmente.
      Data de geração: ${new Date().toLocaleString()}
      =====================================
    `;

    // Simular download do PDF
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `documento-assinado-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // Limpar todas as assinaturas
  const clearAllSignatures = useCallback(() => {
    localStorage.removeItem('dental-signatures');
    setSignatures([]);
  }, []);

  return {
    signatures,
    saveSignature,
    getStoredSignatures,
    getSignaturesByPatient,
    getSignaturesByDocument,
    generateSignedPDF,
    clearAllSignatures
  };
};

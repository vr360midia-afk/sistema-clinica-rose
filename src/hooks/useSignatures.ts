import { useState, useCallback, useEffect } from 'react';
import { SignatureData } from '@/components/signature/DigitalSignature';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface StoredSignature extends SignatureData {
  id: string;
  documentId?: string;
  patientId?: string;
}

const rowToSignature = (row: any): StoredSignature => ({
  id: row.id,
  signature: row.assinatura_data,
  signerName: row.nome,
  signerRole: (row.tipo === 'paciente' ? 'paciente' : 'dentista'),
  timestamp: new Date(row.criado_em),
  documentType: row.documento_tipo || '',
  documentId: row.documento_id || undefined,
  patientId: row.paciente_id || undefined,
});

export const useSignatures = () => {
  const { user, clinicaId } = useAuth();
  const [signatures, setSignatures] = useState<StoredSignature[]>([]);

  const fetchSignatures = useCallback(async () => {
    if (!clinicaId) {
      setSignatures([]);
      return [];
    }
    const { data, error } = await supabase
      .from('assinaturas')
      .select('*')
      .eq('user_id', clinicaId)
      .order('criado_em', { ascending: false });
    if (error) {
      console.error('Erro ao carregar assinaturas:', error);
      return [];
    }
    const list = (data || []).map(rowToSignature);
    setSignatures(list);
    return list;
  }, [clinicaId]);

  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const saveSignature = useCallback(
    async (signatureData: SignatureData, documentId?: string, patientId?: string) => {
      if (!clinicaId) return null;
      const { data, error } = await supabase
        .from('assinaturas')
        .insert({
          user_id: clinicaId,
          nome: signatureData.signerName,
          tipo: signatureData.signerRole,
          assinatura_data: signatureData.signature,
          documento_id: documentId || null,
          documento_tipo: signatureData.documentType || null,
          paciente_id: patientId || null,
        })
        .select()
        .single();
      if (error) {
        console.error('Erro ao salvar assinatura:', error);
        return null;
      }
      const saved = rowToSignature(data);
      setSignatures((prev) => [saved, ...prev]);
      return saved;
    },
    [clinicaId]
  );

  const getStoredSignatures = useCallback(() => signatures, [signatures]);

  const getSignaturesByPatient = useCallback(
    (patientId: string) => signatures.filter((s) => s.patientId === patientId),
    [signatures]
  );

  const getSignaturesByDocument = useCallback(
    (documentId: string) => signatures.filter((s) => s.documentId === documentId),
    [signatures]
  );

  const generateSignedPDF = useCallback(
    (documentContent: string, sigs: (StoredSignature | SignatureData)[]) => {
      const pdfContent = `
      ${documentContent}

      =====================================
      ASSINATURAS DIGITAIS
      =====================================

      ${sigs
        .map(
          (sig) => `
      Assinante: ${sig.signerName} (${sig.signerRole})
      Data/Hora: ${new Date(sig.timestamp).toLocaleString('pt-BR')}
      E-mail: ${sig.signerInfo?.email || 'Não informado'}
      CPF: ${sig.signerInfo?.cpf || 'Não informado'}

      [Assinatura Digital Aplicada]
      `
        )
        .join('\n')}

      =====================================
      Este documento foi assinado digitalmente.
      Data de geração: ${new Date().toLocaleString('pt-BR')}
      =====================================
    `;

      const blob = new Blob([pdfContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documento-assinado-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    []
  );

  const clearAllSignatures = useCallback(async () => {
    if (!clinicaId) return;
    await supabase.from('assinaturas').delete().eq('user_id', clinicaId);
    setSignatures([]);
  }, [clinicaId]);

  return {
    signatures,
    saveSignature,
    getStoredSignatures,
    getSignaturesByPatient,
    getSignaturesByDocument,
    generateSignedPDF,
    clearAllSignatures,
    refetch: fetchSignatures,
  };
};


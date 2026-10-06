import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilePlus, FileText, Download, Trash2, Eye, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSecurityGate } from '@/context/SecurityContext';
import EmptyState from '@/components/common/EmptyState';

const BUCKET = 'documentos-pacientes';
const MAX_SIZE = 15 * 1024 * 1024; // 15MB
const ACCEPT = 'application/pdf,image/*';

export const FinanceiroComprovantes = ({ patient }: { patient: any }) => {
  const { documentos, saveDocumento, deleteDocumento } = useDentalSystem();
  const { requireMasterPassword } = useSecurityGate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Filtra apenas os comprovantes financeiros deste paciente
  const comprovantes = documentos.filter(
    (d) => d.pacienteId === patient.id && d.tipo === 'comprovante'
  );

  const isValidFile = (file: File) => file.type === 'application/pdf' || file.type.startsWith('image/');

  const uploadFile = async (file: File) => {
    try {
      if (!isValidFile(file)) throw new Error('Formato inválido. Apenas PDF ou imagens.');
      if (file.size > MAX_SIZE) throw new Error('Arquivo muito grande. Máx 15MB.');

      setUploading(true);
      const ext = file.name.split('.').pop();
      const fileName = `${patient.id}/comprovante_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);

      await saveDocumento({
        pacienteId: patient.id,
        tipo: 'comprovante',
        nome: file.name,
        arquivo: urlData.publicUrl,
        tamanho: file.size,
      });

      toast.success('Comprovante salvo com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao enviar comprovante', { description: error.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: any) => {
    const autorizado = await requireMasterPassword('O comprovante será movido para a lixeira por 30 dias.');
    if (!autorizado) return;

    try {
      await deleteDocumento(doc.id);
      toast.success('Comprovante removido com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao remover', { description: error.message });
    }
  };

  return (
    <Card>
      <CardHeader className="p-3 sm:p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Comprovantes Anexados ({comprovantes.length})
        </CardTitle>
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePlus className="w-4 h-4 mr-2" />}
            Anexar Comprovante
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 pt-0 space-y-2">
        {comprovantes.length === 0 ? (
          <div className="text-center py-6 px-4 rounded-lg border border-dashed border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">Nenhum comprovante anexado. Você pode enviar PDFs ou Imagens.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            {comprovantes.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-md bg-muted">
                    {doc.arquivo.toLowerCase().includes('.pdf') ? (
                      <FileText className="h-5 w-5 text-blue-500" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-emerald-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={doc.nome}>{doc.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.criadoEm || '').toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(doc.arquivo, '_blank')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

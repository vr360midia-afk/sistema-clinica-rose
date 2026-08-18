import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Image, Download, Eye, Trash2, Loader2 } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface PatientDocumentsProps {
  patient: any;
}

const BUCKET = 'documentos-pacientes';

const guessTipo = (file: File): string => {
  if (file.type.startsWith('image/')) return 'foto';
  return 'outro';
};

const PatientDocuments = ({ patient }: PatientDocumentsProps) => {
  const { documentos, addDocumento, deleteDocumento } = useDentalSystem();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const patientDocuments = documentos.filter((d) => d.pacienteId === patient?.id);

  const handleNewDocument = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user?.id) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máximo 15 MB)');
      return;
    }

    setUploading(true);
    try {
      const path = `${user.id}/${patient.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file);
      if (error) throw error;

      await addDocumento({
        pacienteId: patient.id,
        nome: file.name,
        tipo: guessTipo(file) as any,
        arquivo: path,
        tamanho: file.size,
      });
    } catch (err: any) {
      toast.error('Erro ao enviar documento', { description: err.message });
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async (documento: any, download = false) => {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(documento.arquivo, 60, download ? { download: documento.nome } : undefined);
      if (error || !data) throw error || new Error('Falha ao gerar link');
      window.open(data.signedUrl, '_blank');
    } catch (err: any) {
      toast.error('Não foi possível abrir o arquivo', { description: err.message });
    }
  };

  const handleDelete = async (documento: any) => {
    try {
      if (documento.arquivo) await supabase.storage.from(BUCKET).remove([documento.arquivo]);
      await deleteDocumento(documento.id);
    } catch (err: any) {
      toast.error('Erro ao excluir documento', { description: err.message });
    }
  };

  const getDocumentIcon = (tipo: string) =>
    tipo === 'foto' || tipo === 'raio-x' ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />;

  const getDocumentTypeLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      foto: 'Foto',
      'raio-x': 'Raio-X',
      exame: 'Exame',
      receita: 'Receita',
      atestado: 'Atestado',
      outro: 'Outro',
    };
    return labels[tipo] || tipo;
  };

  const fileInput = (
    <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
  );

  if (patientDocuments.length === 0) {
    return (
      <>
        {fileInput}
        <EmptyState
          icon={FileText}
          title="Nenhum documento encontrado"
          description="Envie exames, raio-X, receitas e outros arquivos deste paciente"
          action={{
            label: uploading ? 'Enviando...' : 'Adicionar Documento',
            onClick: handleNewDocument,
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      {fileInput}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h3 className="text-base sm:text-lg font-semibold">Documentos ({patientDocuments.length})</h3>
        <Button onClick={handleNewDocument} disabled={uploading} className="w-full sm:w-auto">
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          {uploading ? 'Enviando...' : 'Adicionar Documento'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patientDocuments.map((documento: any) => (
          <Card key={documento.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {getDocumentIcon(documento.tipo)}
                  <Badge variant="outline" className="text-xs">
                    {getDocumentTypeLabel(documento.tipo)}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openDocument(documento)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openDocument(documento, true)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-red-600"
                    onClick={() => handleDelete(documento)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <h4 className="font-medium text-sm mb-2 break-words">{documento.nome}</h4>

              <div className="text-xs text-muted-foreground">
                <p>Adicionado em: {new Date(documento.criadoEm).toLocaleDateString('pt-BR')}</p>
                {documento.tamanho && <p>Tamanho: {(documento.tamanho / 1024).toFixed(1)} KB</p>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default PatientDocuments;

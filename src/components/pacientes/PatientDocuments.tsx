import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FileText, Image, Download, Eye, Trash2, Loader2, UploadCloud } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { TipoDocumento } from '@/types/shared';

interface PatientDocumentsProps {
  patient: any;
}

const BUCKET = 'documentos-pacientes';
const MAX_SIZE = 15 * 1024 * 1024;
const ACCEPT = 'application/pdf,image/*';

const TIPOS: { value: TipoDocumento; label: string }[] = [
  { value: 'exame', label: 'Exame' },
  { value: 'raio-x', label: 'Raio-X' },
  { value: 'foto', label: 'Foto' },
  { value: 'receita', label: 'Receita' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'outro', label: 'Outro' },
];

const isValidFile = (file: File) =>
  file.type === 'application/pdf' || file.type.startsWith('image/');

const PatientDocuments = ({ patient }: PatientDocumentsProps) => {
  const { documentos, addDocumento, deleteDocumento } = useDentalSystem();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [tipo, setTipo] = useState<TipoDocumento>('exame');

  const patientDocuments = documentos.filter((d) => d.pacienteId === patient?.id);

  const handleNewDocument = () => inputRef.current?.click();

  const uploadFiles = async (files: File[]) => {
    if (!files.length || !user?.id || !patient?.id) return;

    setUploading(true);
    let ok = 0;
    for (const file of files) {
      try {
        if (!isValidFile(file)) {
          toast.error(`${file.name}: apenas PDF ou imagens`);
          continue;
        }
        if (file.size > MAX_SIZE) {
          toast.error(`${file.name}: arquivo maior que 15 MB`);
          continue;
        }

        const path = `${user.id}/${patient.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { contentType: file.type || undefined });
        if (error) throw error;

        await addDocumento({
          pacienteId: patient.id,
          nome: file.name,
          tipo: file.type.startsWith('image/') && tipo === 'exame' ? 'foto' : tipo,
          arquivo: path,
          tamanho: file.size,
        });
        ok++;
      } catch (err: any) {
        toast.error(`Erro ao enviar ${file.name}`, { description: err.message });
      }
    }
    setUploading(false);
    if (ok) toast.success(`${ok} arquivo(s) enviado(s)`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    await uploadFiles(files);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    await uploadFiles(Array.from(e.dataTransfer.files || []));
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
      toast.success('Documento excluído');
    } catch (err: any) {
      toast.error('Erro ao excluir documento', { description: err.message });
    }
  };

  const getDocumentIcon = (t: string) =>
    t === 'foto' || t === 'raio-x' ? <Image className="h-4 w-4" /> : <FileText className="h-4 w-4" />;

  const getDocumentTypeLabel = (t: string) =>
    TIPOS.find((x) => x.value === t)?.label || t;

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT}
      className="hidden"
      onChange={handleFileChange}
    />
  );

  const uploader = (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={handleNewDocument}
      className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
    >
      {uploading ? (
        <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-primary" />
      ) : (
        <UploadCloud className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
      )}
      <p className="text-sm font-medium">
        {uploading ? 'Enviando arquivos...' : 'Arraste arquivos aqui ou clique para selecionar'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">PDF ou imagens · até 15 MB por arquivo</p>
    </div>
  );

  const tipoSelect = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Tipo:</span>
      <Select value={tipo} onValueChange={(v) => setTipo(v as TipoDocumento)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIPOS.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      {fileInput}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <h3 className="text-base sm:text-lg font-semibold">
          Documentos ({patientDocuments.length})
        </h3>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {tipoSelect}
          <Button onClick={handleNewDocument} disabled={uploading} className="w-full sm:w-auto">
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {uploading ? 'Enviando...' : 'Adicionar Documento'}
          </Button>
        </div>
      </div>

      {uploader}

      {patientDocuments.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum documento arquivado"
          description="Envie exames, raio-X, receitas e outros arquivos deste paciente"
        />
      ) : (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openDocument(documento)}
                    >
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
                      className="h-8 w-8 p-0 text-destructive"
                      onClick={() => handleDelete(documento)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <h4 className="font-medium text-sm mb-2 break-words">{documento.nome}</h4>

                <div className="text-xs text-muted-foreground">
                  <p>
                    Adicionado em:{' '}
                    {new Date(documento.criadoEm).toLocaleDateString('pt-BR')}
                  </p>
                  {documento.tamanho && (
                    <p>Tamanho: {(documento.tamanho / 1024).toFixed(1)} KB</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientDocuments;

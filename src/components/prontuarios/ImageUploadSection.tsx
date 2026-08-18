
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Eye } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploadSectionProps {
  patientName?: string;
}

interface UploadedFile {
  id: string;
  file: File;
  category: string;
  subcategory: string;
  preview: string;
}

const imageCategories = {
  'antes-depois': {
    title: 'Antes e Depois',
    subcategories: ['Inicial', 'Final', 'Vídeo Comparativo']
  },
  'extraorais': {
    title: 'Fotos Extraorais',
    subcategories: ['Perfil Esquerdo', 'Perfil Direito', 'Frontal', 'Sorrindo']
  },
  'intraorais': {
    title: 'Fotos Intraorais',
    subcategories: ['Arcada Superior', 'Arcada Inferior', 'Visão Direita', 'Visão Esquerda', 'Visão Anterior']
  },
  'radiografias': {
    title: 'Radiografias',
    subcategories: ['Radiografia Panorâmica', 'Cefalograma Lateral', 'Periapical', 'Bitewing']
  }
};

const ImageUploadSection = ({ patientName }: ImageUploadSectionProps) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, category: string, subcategory: string) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newFile: UploadedFile = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            file,
            category,
            subcategory,
            preview: e.target?.result as string
          };
          setUploadedFiles(prev => [...prev, newFile]);
          toast.success(`${file.name} adicionado com sucesso!`);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Formato de arquivo não suportado');
      }
    });
    
    // Reset input
    event.target.value = '';
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    toast.success('Arquivo removido');
  };

  const getFilesByCategory = (category: string, subcategory: string) => {
    return uploadedFiles.filter(f => f.category === category && f.subcategory === subcategory);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Anexos - {patientName || 'Paciente'}</h3>
        <Badge variant="outline">
          {uploadedFiles.length} arquivo(s) carregado(s)
        </Badge>
      </div>

      {Object.entries(imageCategories).map(([categoryKey, categoryData]) => (
        <Card key={categoryKey}>
          <CardHeader>
            <CardTitle className="text-base">{categoryData.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categoryData.subcategories.map((subcategory) => {
                const files = getFilesByCategory(categoryKey, subcategory);
                return (
                  <div key={subcategory} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium text-sm">{subcategory}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {files.length}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        onChange={(e) => handleFileUpload(e, categoryKey, subcategory)}
                        className="text-xs"
                      />
                      
                      {files.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {files.map((file) => (
                            <div key={file.id} className="relative group">
                              {file.file.type.startsWith('image/') ? (
                                <img
                                  src={file.preview}
                                  alt={file.file.name}
                                  className="w-full h-20 object-cover rounded border"
                                />
                              ) : (
                                <div className="w-full h-20 bg-muted rounded border flex items-center justify-center">
                                  <span className="text-xs text-muted-foreground">Vídeo</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-6 w-6 p-0"
                                  onClick={() => window.open(file.preview, '_blank')}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-6 w-6 p-0"
                                  onClick={() => removeFile(file.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-xs mt-1 truncate">{file.file.name}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ImageUploadSection;

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageIcon, SplitSquareHorizontal, UploadCloud } from 'lucide-react';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const EvolucaoSorriso = ({ patient }: { patient: any }) => {
  const { documentos, saveDocumento } = useDentalSystem();
  const [uploading, setUploading] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'compare'>('grid');
  const [compareImages, setCompareImages] = useState<string[]>([]);

  const fotos = documentos.filter(
    (d) => d.pacienteId === patient.id && (d.tipo === 'foto' || d.tipo === 'outro') && d.arquivo.match(/\.(jpeg|jpg|gif|png)$/i)
  );

  const uploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${patient.id}/foto_evolucao_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos-pacientes')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('documentos-pacientes').getPublicUrl(fileName);

      await saveDocumento({
        pacienteId: patient.id,
        tipo: 'foto',
        nome: file.name,
        arquivo: urlData.publicUrl,
        tamanho: file.size,
      });

      toast.success('Foto adicionada à evolução!');
    } catch (error: any) {
      toast.error('Erro ao enviar foto', { description: error.message });
    } finally {
      setUploading(false);
    }
  };

  const toggleCompare = (url: string) => {
    if (compareImages.includes(url)) {
      setCompareImages(compareImages.filter((img) => img !== url));
    } else {
      if (compareImages.length < 2) {
        setCompareImages([...compareImages, url]);
      } else {
        toast.info('Você só pode comparar 2 fotos simultaneamente.');
      }
    }
  };

  return (
    <Card className="mt-6 border-border shadow-sm">
      <CardHeader className="pb-4 flex flex-row items-center justify-between border-b">
        <div>
          <CardTitle className="text-md flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-indigo-500" />
            Galeria: Evolução do Sorriso
          </CardTitle>
          <CardDescription>Acompanhe o tratamento fotográfico (Antes e Depois)</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'compare' : 'grid')}
            className={viewMode === 'compare' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : ''}
          >
            <SplitSquareHorizontal className="w-4 h-4 mr-2" />
            Comparar
          </Button>
          <div className="relative">
            <input 
              type="file" 
              accept="image/*" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              onChange={uploadFoto}
              disabled={uploading}
            />
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <UploadCloud className="w-4 h-4 mr-2" />
              {uploading ? 'Enviando...' : 'Adicionar Foto'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {fotos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-muted/20">
            Nenhuma foto de acompanhamento clínico registrada.
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {fotos.map((foto) => (
                  <div key={foto.id} className="relative group rounded-lg overflow-hidden border">
                    <img 
                      src={foto.arquivo} 
                      alt={foto.nome} 
                      className="w-full h-32 object-cover transition-transform group-hover:scale-105" 
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/50 p-2 text-white text-xs backdrop-blur-sm truncate">
                      {new Date(foto.criadoEm || '').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">Selecione 2 fotos para visualizar o Antes e Depois.</p>
                
                <div className="flex overflow-x-auto gap-2 pb-2">
                  {fotos.map((foto) => (
                    <div 
                      key={foto.id} 
                      onClick={() => toggleCompare(foto.arquivo)}
                      className={`shrink-0 cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                        compareImages.includes(foto.arquivo) ? 'border-indigo-600 scale-105' : 'border-transparent'
                      }`}
                    >
                      <img src={foto.arquivo} className="w-20 h-20 object-cover" />
                    </div>
                  ))}
                </div>

                {compareImages.length === 2 && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="relative rounded-xl overflow-hidden border shadow-sm">
                      <span className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 text-xs font-bold rounded shadow-md z-10">ANTES</span>
                      <img src={compareImages[0]} className="w-full h-[300px] object-cover" />
                    </div>
                    <div className="relative rounded-xl overflow-hidden border shadow-sm">
                      <span className="absolute top-2 left-2 bg-emerald-500 text-white px-2 py-1 text-xs font-bold rounded shadow-md z-10">DEPOIS</span>
                      <img src={compareImages[1]} className="w-full h-[300px] object-cover" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

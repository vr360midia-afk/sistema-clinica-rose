import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CalendarIcon, Camera, UploadCloud, Loader2, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { FotoProcedimento } from './ModalNovoProcedimento';

export interface DadosConclusaoProcedimento {
  dataConclusao: string;
  observacoesConclusao?: string;
  fotosConclusao?: FotoProcedimento[];
}

interface ModalMarcarRealizadoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmar: (dados: DadosConclusaoProcedimento) => void;
  procedimentoNome?: string;
  procedimentoDente?: string;
  pacienteId?: string;
}

export const ModalMarcarRealizado: React.FC<ModalMarcarRealizadoProps> = ({
  isOpen,
  onClose,
  onConfirmar,
  procedimentoNome,
  procedimentoDente,
  pacienteId,
}) => {
  const hoje = new Date().toISOString().split('T')[0];
  const [dataSelecionada, setDataSelecionada] = useState<string>(hoje);
  const [observacoes, setObservacoes] = useState('');
  const [fotos, setFotos] = useState<FotoProcedimento[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);

  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFoto(true);
    try {
      const novas: FotoProcedimento[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        let url = '';
        try {
          const ext = file.name.split('.').pop() || 'jpg';
          const fileName = `${pacienteId || 'geral'}/conclusao_${Date.now()}_${i}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('documentos-pacientes')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

          if (upErr) throw upErr;

          const { data: urlData } = supabase.storage
            .from('documentos-pacientes')
            .getPublicUrl(fileName);
          url = urlData.publicUrl;
        } catch (storageErr) {
          // Fallback seguro em base64
          url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        novas.push({
          id: `foto_conclusao_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          url,
          nome: file.name.replace(/\.[^/.]+$/, ''),
          data: new Date().toISOString(),
          tipo: 'conclusao',
        });
      }

      setFotos((prev) => [...prev, ...novas]);
      toast.success(`${novas.length} foto(s) anexada(s) à conclusão!`);
    } catch (err) {
      console.error('Erro ao anexar foto:', err);
      toast.error('Erro ao anexar imagem.');
    } finally {
      setUploadingFoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemoveFoto = (id: string) => {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSalvar = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmar({
      dataConclusao: dataSelecionada || hoje,
      observacoesConclusao: observacoes.trim() || undefined,
      fotosConclusao: fotos.length > 0 ? fotos : undefined,
    });
    // Limpa estado para o próximo
    setObservacoes('');
    setFotos([]);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0 h-full flex flex-col bg-background border-l border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* Header do Drawer Lateral */}
        <div className="p-4 sm:p-5 border-b border-border/70 flex items-center justify-between shrink-0 bg-background">
          <SheetTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span>Marcar como realizado</span>
          </SheetTitle>
        </div>

        {/* Corpo com Rolagem Lateral */}
        <form
          id="form-marcar-realizado-lateral"
          onSubmit={handleSalvar}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 no-scrollbar"
        >
          {/* Resumo do Procedimento */}
          <div className="bg-muted/40 border border-border/70 rounded-xl p-3.5 flex items-center justify-between shadow-2xs">
            <div className="min-w-0">
              <span className="text-[11px] text-muted-foreground font-semibold block">Procedimento</span>
              <span className="text-xs sm:text-sm font-bold text-foreground truncate block">
                {procedimentoNome || 'Tratamento Odontológico'}
              </span>
            </div>
            {procedimentoDente && (
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2.5 py-1 rounded-md shrink-0 ml-2">
                Dente {procedimentoDente}
              </span>
            )}
          </div>

          {/* Campo Data de Conclusão */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Data da Conclusão / Realização *</Label>
            </div>
            <div className="relative">
              <Input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="h-10 text-xs sm:text-sm pr-9 rounded-lg border-purple-500/40 focus:border-purple-600 focus:ring-purple-500"
                required
              />
              <CalendarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Campo Observações da Conclusão */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Observações Clínicas / Evolução da Conclusão</Label>
              <span className="text-[11px] text-muted-foreground">Opcional</span>
            </div>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Procedimento concluído sem intercorrências, anestesia infiltrativa, resina polida, oclusão checada e orientações pós-operatórias passadas ao paciente..."
              className="text-xs min-h-[90px] rounded-lg"
            />
          </div>

          {/* Seção Anexar Fotos do Resultado */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Fotos do Resultado / Pós-Procedimento</span>
              </Label>
              {fotos.length > 0 ? (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                  {fotos.length} foto(s)
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Opcional</span>
              )}
            </div>

            <div className="p-3 rounded-xl border border-border/80 bg-muted/20 space-y-2">
              <div className="flex flex-wrap gap-2.5 items-center">
                <label
                  htmlFor="conclusao-foto-upload"
                  className={`h-20 w-24 rounded-lg border-2 border-dashed border-emerald-400/50 hover:border-emerald-600 dark:border-emerald-800/80 dark:hover:border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/70 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                    uploadingFoto ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <input
                    id="conclusao-foto-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleUploadFoto}
                    disabled={uploadingFoto}
                  />
                  {uploadingFoto ? (
                    <>
                      <Loader2 className="h-5 w-5 text-emerald-600 animate-spin" />
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">Enviando...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">+ Anexar Foto</span>
                    </>
                  )}
                </label>

                {fotos.map((f) => (
                  <div
                    key={f.id}
                    className="relative h-20 w-24 rounded-lg overflow-hidden border border-border group bg-black/5 shadow-2xs"
                  >
                    <img
                      src={f.url}
                      alt={f.nome || 'Foto do resultado'}
                      className="h-full w-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setPreviewFoto(f.url)}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFoto(f.id);
                      }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/70 hover:bg-destructive text-white flex items-center justify-center transition-colors shadow-xs"
                      title="Remover foto"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {fotos.length === 0 && !uploadingFoto && (
                  <span className="text-[11px] text-muted-foreground ml-2">
                    Anexe foto do resultado imediato, pós-operatório ou antes/depois.
                  </span>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Rodapé Fixo */}
        <div className="p-4 sm:p-5 border-t border-border/70 bg-card/95 backdrop-blur-xs flex items-center justify-end gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="h-10 px-4 text-xs font-semibold border-purple-600 text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="form-marcar-realizado-lateral"
            className="h-10 px-6 text-xs sm:text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            Salvar como Realizado
          </Button>
        </div>

        {/* Visualização da Foto em Zoom */}
        {previewFoto && (
          <Dialog open={Boolean(previewFoto)} onOpenChange={() => setPreviewFoto(null)}>
            <DialogContent className="max-w-2xl p-2 bg-black/95 border-none">
              <div className="relative flex items-center justify-center p-2">
                <img src={previewFoto} alt="Pré-visualização" className="max-h-[80vh] w-auto rounded-lg object-contain" />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default ModalMarcarRealizado;

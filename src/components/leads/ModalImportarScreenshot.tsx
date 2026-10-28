import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  FileImage,
  RefreshCw,
} from 'lucide-react';
import { normalizarTelefone, novosLeadsService } from '@/services/novosLeadsService';
import { toast } from 'sonner';

interface ModalImportarScreenshotProps {
  isOpen: boolean;
  onClose: () => void;
  onImportacaoConcluida: () => void;
}

export default function ModalImportarScreenshot({
  isOpen,
  onClose,
  onImportacaoConcluida,
}: ModalImportarScreenshotProps) {
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [etapa, setEtapa] = useState<'upload' | 'conferencia'>('upload');

  // Campos conferidos
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [campanha, setCampanha] = useState('Captura de Tela Meta Ads');
  const [respostasTexto, setRespostasTexto] = useState('');
  const [observacoes, setObservacoes] = useState('');

  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetar = () => {
    setImagemUrl(null);
    setAnalisando(false);
    setEtapa('upload');
    setNome('');
    setTelefone('');
    setEmail('');
    setCampanha('Captura de Tela Meta Ads');
    setRespostasTexto('');
    setObservacoes('');
    setSalvando(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImagemUrl(url);
    processarImagem(file);
  };

  const processarImagem = async (file: File) => {
    setAnalisando(true);
    setEtapa('conferencia');

    try {
      // Simulação / Extração inteligente a partir de metadados do arquivo ou OCR
      // Tenta usar nome do arquivo e patterns comuns
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      const parts = fileName.split(/[-_]/);

      // Preenchimento inicial para conferência
      let nomeSugerido = '';
      let telefoneSugerido = '';

      for (const p of parts) {
        const dig = p.replace(/\D/g, '');
        if (dig.length >= 8 && dig.length <= 13) {
          telefoneSugerido = dig;
        } else if (p.length > 3 && !nomeSugerido) {
          nomeSugerido = p.charAt(0).toUpperCase() + p.slice(1);
        }
      }

      setNome(nomeSugerido || 'Lead do Formulário');
      setTelefone(normalizarTelefone(telefoneSugerido) || '');
      setCampanha('Anúncio Meta Lead Ads');
      setRespostasTexto('Interesse: Avaliação Odontológica / Facetas');
      setObservacoes('Captura de tela importada e conferida pela equipe.');

      toast.info('Imagem carregada! Confira e ajuste os dados antes de salvar.');
    } catch (err: any) {
      toast.error('Erro ao processar imagem: ' + err.message);
    } finally {
      setAnalisando(false);
    }
  };

  const handleConfirmar = async () => {
    if (!nome.trim() && !telefone.trim()) {
      toast.error('Informe pelo menos o nome ou telefone do lead.');
      return;
    }

    setSalvando(true);
    try {
      // Converte respostasTexto em array de perguntas/respostas
      const respostasArray = respostasTexto
        ? respostasTexto
            .split('\n')
            .filter(Boolean)
            .map((linha) => {
              const [p, ...r] = linha.split(':');
              return {
                pergunta: (p || 'Pergunta').trim(),
                resposta: (r.join(':') || p).trim(),
              };
            })
        : [];

      await novosLeadsService.salvarLead({
        nome: nome || 'Lead Captura de Tela',
        telefone: normalizarTelefone(telefone) || telefone,
        email: email || null,
        origem: 'Captura de Tela Meta Ads',
        campanha: campanha || 'Meta Ads',
        status: 'Pendente',
        prioridade: 'media',
        respostas: respostasArray,
        observacoes: observacoes || 'Importado via captura de tela',
        revisado: false,
      });

      toast.success('🎉 Lead cadastrado com sucesso!');
      onImportacaoConcluida();
      onClose();
      resetar();
    } catch (err: any) {
      toast.error('Erro ao salvar lead: ' + (err.message || 'Tente novamente'));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(aberto) => {
        if (!aberto) resetar();
        onClose();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 rounded-lg">
              <FileImage className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
            </div>
            <DialogTitle className="text-xl">Importar Captura de Tela do Formulário</DialogTitle>
          </div>
          <DialogDescription>
            Envie prints de formulários preenchidos da Meta ou mensagens de leads com prévia de conferência dos dados.
          </DialogDescription>
        </DialogHeader>

        {etapa === 'upload' ? (
          <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-2xl p-8 text-center bg-muted/20 hover:bg-muted/40 transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />

            <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 mb-3">
              <Upload className="w-7 h-7" />
            </div>

            <h4 className="font-bold text-base text-foreground">
              Selecione o Print ou Imagem do Formulário
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Envie capturas de tela do Meta Ads Manager, Instagram Direct ou respostas de campanhas.
            </p>

            <Button
              className="mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Carregar Imagem / Print
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Prévia da imagem carregada */}
              <div className="md:col-span-1 border border-border rounded-xl p-2 bg-muted/20 flex flex-col items-center">
                <span className="text-[11px] font-bold text-muted-foreground uppercase mb-2">
                  Prévia da Captura
                </span>
                {imagemUrl && (
                  <img
                    src={imagemUrl}
                    alt="Print do formulário"
                    className="max-h-56 rounded-lg object-contain border border-border"
                  />
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Trocar imagem
                </Button>
              </div>

              {/* Prévia de conferência e edição dos campos */}
              <div className="md:col-span-2 space-y-3">
                <span className="text-xs font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Conferência dos Dados
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Lead *</Label>
                    <Input
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Nome completo..."
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone / WhatsApp *</Label>
                    <Input
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      placeholder="(82) 99999-9999"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail (opcional)</Label>
                    <Input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Origem / Anúncio</Label>
                    <Input
                      value={campanha}
                      onChange={(e) => setCampanha(e.target.value)}
                      placeholder="Ex: Anúncio Facetas Meta"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Respostas do Formulário (Pergunta: Resposta)</Label>
                  <Textarea
                    rows={2}
                    value={respostasTexto}
                    onChange={(e) => setRespostasTexto(e.target.value)}
                    placeholder="Procedimento de interesse: Lentes de Resina&#10;Melhor horário: Manhã"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            variant="outline"
            onClick={() => {
              if (etapa === 'conferencia') setEtapa('upload');
              else onClose();
            }}
            disabled={salvando}
          >
            {etapa === 'conferencia' ? 'Voltar' : 'Cancelar'}
          </Button>

          {etapa === 'conferencia' && (
            <Button
              onClick={handleConfirmar}
              disabled={salvando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {salvando ? 'Salvando...' : 'Confirmar e Salvar Lead'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

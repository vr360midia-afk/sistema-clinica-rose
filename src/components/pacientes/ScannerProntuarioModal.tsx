import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Loader2, FileImage, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface ScannerProntuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiApiKey: string;
  onExtraido: (dados: any) => void;
}

export const ScannerProntuarioModal = ({ isOpen, onClose, geminiApiKey, onExtraido }: ScannerProntuarioModalProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processarImagem = async () => {
    if (!selectedFile) return;
    if (!geminiApiKey) {
      toast({
        title: "API Key não configurada",
        description: "Configure a chave da API do Google Gemini em Configurações > APIs.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // 1. Converter imagem para base64 limpo (sem o prefixo data:image/...)
      const base64String = preview?.split(',')[1];
      if (!base64String) throw new Error("Erro ao ler a imagem");

      // 2. Chamar o Gemini
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Você é um assistente médico especializado em extrair dados de fichas e prontuários odontológicos/médicos escritos à mão ou digitados.
Extraia as informações da imagem e retorne APENAS um JSON válido com os seguintes campos (use null se não encontrar a informação):
{
  "nome": "Nome do Paciente",
  "telefone": "Telefone ou celular (apenas números ou formatado)",
  "cpf": "CPF",
  "dataNascimento": "YYYY-MM-DD",
  "endereco": "Endereço completo",
  "historicoMedico": "Histórico médico resumido, doenças prévias",
  "alergias": "Alergias relatadas",
  "medicamentos": "Medicamentos em uso",
  "observacoes": "Outras observações clínicas, queixa principal"
}`;

      const imageParts = [
        {
          inlineData: {
            data: base64String,
            mimeType: selectedFile.type
          },
        },
      ];

      const result = await model.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      let text = response.text();
      
      // Limpar o markdown de JSON se o Gemini retornar com ```json
      if (text.includes('\`\`\`json')) {
        text = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
      }

      const dadosExtraidos = JSON.parse(text.trim());
      
      toast({
        title: "Leitura Concluída!",
        description: "Os dados foram extraídos da imagem com sucesso."
      });
      
      onExtraido(dadosExtraidos);
      handleClose();

    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro na leitura",
        description: "Não foi possível entender a imagem ou a API Key é inválida.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700">
            <Sparkles className="w-5 h-5" />
            Scanner Inteligente (IA)
          </DialogTitle>
          <DialogDescription>
            Envie uma foto de uma ficha de papel. A IA irá ler a caligrafia e criar o cadastro automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!preview ? (
            <div className="border-2 border-dashed border-indigo-200 rounded-xl p-8 text-center flex flex-col items-center justify-center bg-indigo-50/30 hover:bg-indigo-50/50 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
              />
              <div className="bg-indigo-100 p-4 rounded-full mb-4">
                <Camera className="w-8 h-8 text-indigo-600" />
              </div>
              <p className="font-medium text-slate-700">Tirar foto ou anexar ficha</p>
              <p className="text-sm text-slate-500 mt-1">Clique aqui para abrir a câmera ou galeria</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-black/5 aspect-[4/3] flex items-center justify-center">
                <img src={preview} alt="Ficha" className="max-w-full max-h-full object-contain" />
                {!loading && (
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setPreview(null);
                      setSelectedFile(null);
                    }}
                  >
                    Remover
                  </Button>
                )}
              </div>
              
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-md" 
                onClick={processarImagem}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    A IA está lendo a ficha...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Processar Ficha com IA
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};


import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PatientPhotoCaptureProps {
  currentPhoto?: string | null;
  onPhotoChange: (photo: string | null) => void;
}

const PatientPhotoCapture = ({ currentPhoto, onPhotoChange }: PatientPhotoCaptureProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhoto || null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função otimizada para redimensionar e comprimir imagem
  const processImage = useCallback(async (file: File | string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Não foi possível processar a imagem'));
            return;
          }

          // Redimensionar para máximo 400x400 mantendo proporção
          const maxSize = 400;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Desenhar imagem redimensionada com melhor qualidade
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          
          // Comprimir para JPEG com qualidade otimizada
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressedDataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Erro ao carregar imagem'));
      
      if (typeof file === 'string') {
        img.src = file;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            img.src = e.target.result as string;
          } else {
            reject(new Error('Erro ao ler arquivo'));
          }
        };
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      setStream(mediaStream);
      setIsCapturing(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Erro ao acessar câmera:', error);
      toast.error('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  }, [stream]);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      toast.error('Erro ao capturar foto');
      return;
    }

    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
          const processedImage = await processImage(dataUrl);
          setPreviewUrl(processedImage);
          onPhotoChange(processedImage);
          stopCamera();
          toast.success('Foto capturada com sucesso!');
        } catch (processError) {
          console.error('Erro ao processar imagem:', processError);
          // Fallback: usar imagem sem processamento
          setPreviewUrl(dataUrl);
          onPhotoChange(dataUrl);
          stopCamera();
          toast.success('Foto capturada!');
        }
      }
    } catch (error) {
      console.error('Erro ao capturar foto:', error);
      toast.error('Erro ao capturar foto');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido');
      return;
    }

    // Verificar tamanho do arquivo (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 5MB.');
      return;
    }

    setIsProcessing(true);

    try {
      const processedImage = await processImage(file);
      setPreviewUrl(processedImage);
      onPhotoChange(processedImage);
      toast.success('Foto carregada com sucesso!');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      // Fallback: tentar usar arquivo original
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          if (result) {
            setPreviewUrl(result);
            onPhotoChange(result);
            toast.success('Foto carregada!');
          }
        };
        reader.readAsDataURL(file);
      } catch (fallbackError) {
        toast.error('Erro ao processar arquivo');
      }
    } finally {
      setIsProcessing(false);
      // Limpar input para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    onPhotoChange(null);
    stopCamera();
    toast.success('Foto removida');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        {isCapturing ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              className="w-80 h-60 rounded-lg border-2 border-gray-300 object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Foto do paciente"
              className="w-40 h-40 rounded-full object-cover border-4 border-gray-200 shadow-sm"
            />
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="w-40 h-40 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center">
            <Camera className="h-12 w-12 text-gray-400" />
          </div>
        )}
      </div>
      
      {isCapturing ? (
        <div className="flex justify-center gap-3">
          <Button 
            type="button" 
            onClick={capturePhoto} 
            disabled={isProcessing}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            {isProcessing ? '...' : 'Capturar'}
          </Button>
          <Button type="button" variant="outline" onClick={stopCamera} disabled={isProcessing}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex justify-center gap-3">
          <Button type="button" onClick={startCamera} variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-2" />
            Câmera
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            className="cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isProcessing ? '...' : (previewUrl ? 'Alterar' : 'Upload')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
};

export default PatientPhotoCapture;

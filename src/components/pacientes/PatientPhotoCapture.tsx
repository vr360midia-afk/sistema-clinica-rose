
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

interface PatientPhotoCaptureProps {
  currentPhoto?: string | null;
  onPhotoChange: (photo: string | null) => void;
}

const PatientPhotoCapture = ({ currentPhoto, onPhotoChange }: PatientPhotoCaptureProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhoto || null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      toast.error('Não foi possível acessar a câmera');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCapturing(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (context) {
        context.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPreviewUrl(dataUrl);
        onPhotoChange(dataUrl);
        stopCamera();
        toast.success('Foto capturada com sucesso!');
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreviewUrl(result);
        onPhotoChange(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPreviewUrl(null);
    onPhotoChange(null);
    stopCamera();
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        {isCapturing ? (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              className="w-64 h-48 rounded-lg border-4 border-blue-200 object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
        ) : previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Foto do paciente"
              className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
            />
            <button
              onClick={handleRemovePhoto}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-dashed border-gray-300 flex items-center justify-center">
            <Camera className="h-8 w-8 text-gray-400" />
          </div>
        )}
      </div>
      
      {isCapturing ? (
        <div className="flex gap-2">
          <Button onClick={capturePhoto} className="bg-blue-600 hover:bg-blue-700">
            <Camera className="h-4 w-4 mr-2" />
            Capturar
          </Button>
          <Button variant="outline" onClick={stopCamera}>
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button onClick={startCamera} variant="outline" size="sm">
            <Camera className="h-4 w-4 mr-2" />
            Câmera
          </Button>
          <label htmlFor="photo-upload">
            <Button type="button" variant="outline" size="sm" className="cursor-pointer">
              <Upload className="h-4 w-4 mr-2" />
              {previewUrl ? 'Alterar' : 'Upload'}
            </Button>
          </label>
          <input
            id="photo-upload"
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

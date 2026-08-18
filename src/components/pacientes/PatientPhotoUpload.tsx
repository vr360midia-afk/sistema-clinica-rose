
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Upload, X } from 'lucide-react';

interface PatientPhotoUploadProps {
  currentPhoto?: string;
  onPhotoChange: (photo: string | null) => void;
}

const PatientPhotoUpload = ({ currentPhoto, onPhotoChange }: PatientPhotoUploadProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentPhoto || null);

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
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Foto do paciente"
              className="w-32 h-32 rounded-full object-cover border-4 border-border"
            />
            <button
              onClick={handleRemovePhoto}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full bg-muted border-4 border-dashed border-border flex items-center justify-center">
            <Camera className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <label htmlFor="photo-upload">
          <Button type="button" variant="outline" size="sm" className="cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            {previewUrl ? 'Alterar Foto' : 'Adicionar Foto'}
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
    </div>
  );
};

export default PatientPhotoUpload;

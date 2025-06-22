
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useState } from 'react';

const quickPatientSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  idade: z.number().min(0, 'Idade deve ser positiva').optional(),
  endereco: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  profissao: z.string().optional(),
  estadoCivil: z.string().optional(),
  convenio: z.string().min(1, 'Convênio é obrigatório'),
  origemLead: z.string().min(1, 'Origem do lead é obrigatória'),
  foto: z.string().optional(),
  historicoMedico: z.string().optional(),
  alergias: z.string().optional(),
  medicamentos: z.string().optional(),
  ultimaConsulta: z.string().optional(),
  observacoes: z.string().optional()
});

export type QuickPatientFormData = z.infer<typeof quickPatientSchema>;

export const useQuickPatientForm = (onPatientCreated: (patientId: string) => void, onClose: () => void) => {
  const { addPaciente } = useDentalSystem();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<QuickPatientFormData>({
    resolver: zodResolver(quickPatientSchema),
    defaultValues: {
      nome: '',
      email: '',
      telefone: '',
      idade: undefined,
      endereco: '',
      cpf: '',
      rg: '',
      profissao: '',
      estadoCivil: '',
      convenio: '',
      origemLead: '',
      foto: '',
      historicoMedico: '',
      alergias: '',
      medicamentos: '',
      ultimaConsulta: '',
      observacoes: ''
    }
  });

  const onSubmit = async (data: QuickPatientFormData) => {
    try {
      setIsLoading(true);
      console.log('Dados do formulário:', data);
      
      // Processar foto - reduzir qualidade se for base64 muito grande
      let fotoProcessada = data.foto;
      if (data.foto && data.foto.startsWith('data:image/')) {
        try {
          // Criar canvas para redimensionar se necessário
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Redimensionar para máximo 300x300
            const maxSize = 300;
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
            
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              fotoProcessada = canvas.toDataURL('image/jpeg', 0.7);
            }
          };
          img.src = data.foto;
        } catch (error) {
          console.warn('Erro ao processar foto:', error);
          fotoProcessada = ''; // Remove foto se houver erro
        }
      }
      
      const pacienteData = {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        idade: data.idade || 0,
        convenio: data.convenio,
        origemLead: data.origemLead as any,
        status: 'Ativo' as const,
        endereco: data.endereco || '',
        cpf: data.cpf || '',
        rg: data.rg || '',
        profissao: data.profissao || '',
        estadoCivil: data.estadoCivil || '',
        foto: fotoProcessada || '',
        historicoMedico: data.historicoMedico || '',
        alergias: data.alergias || '',
        medicamentos: data.medicamentos || '',
        ultimaConsulta: data.ultimaConsulta && data.ultimaConsulta.trim() !== '' 
          ? new Date(data.ultimaConsulta) 
          : undefined,
        observacoes: data.observacoes || ''
      };
      
      console.log('Dados para salvar:', pacienteData);
      const novoPaciente = await addPaciente(pacienteData);
      console.log('Paciente criado:', novoPaciente);
      
      onPatientCreated(novoPaciente.id);
      onClose();
      form.reset();
    } catch (error) {
      console.error('Erro ao criar paciente:', error);
      // Adicionar toast de erro se disponível
      if (typeof window !== 'undefined' && 'toast' in window) {
        (window as any).toast.error('Erro ao salvar paciente. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    onSubmit,
    isLoading
  };
};

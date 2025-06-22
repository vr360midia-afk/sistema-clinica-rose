import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useState } from 'react';
import { toast } from 'sonner';

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
    console.log('Iniciando salvamento do paciente:', data);
    
    try {
      setIsLoading(true);
      
      // Sanitizar e preparar dados para envio
      const pacienteData = {
        nome: data.nome.trim(),
        email: data.email.trim().toLowerCase(),
        telefone: data.telefone.trim(),
        idade: data.idade || 0,
        convenio: data.convenio,
        origemLead: data.origemLead as any,
        status: 'Ativo' as const,
        endereco: data.endereco?.trim() || '',
        cpf: data.cpf?.trim() || '',
        rg: data.rg?.trim() || '',
        profissao: data.profissao?.trim() || '',
        estadoCivil: data.estadoCivil || '',
        foto: data.foto || '',
        historicoMedico: data.historicoMedico?.trim() || '',
        alergias: data.alergias?.trim() || '',
        medicamentos: data.medicamentos?.trim() || '',
        // Corrigir tipo - converter string para Date se preenchida
        ultimaConsulta: data.ultimaConsulta?.trim() ? new Date(data.ultimaConsulta.trim()) : new Date(),
        observacoes: data.observacoes?.trim() || ''
      };
      
      console.log('Dados sanitizados para salvar:', pacienteData);
      
      const novoPaciente = await addPaciente(pacienteData);
      console.log('Paciente criado com sucesso:', novoPaciente);
      
      toast.success(`Paciente ${data.nome} cadastrado com sucesso!`);
      onPatientCreated(novoPaciente.id);
      onClose();
      form.reset();
      
    } catch (error) {
      console.error('Erro detalhado ao criar paciente:', error);
      toast.error('Erro ao salvar paciente. Verifique os dados e tente novamente.');
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


import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useState } from 'react';

const quickPatientSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  idade: z.number().min(0, 'Idade deve ser positiva'),
  convenio: z.string().min(1, 'Convênio é obrigatório'),
  origemLead: z.string().min(1, 'Origem do lead é obrigatória')
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
      idade: 0,
      convenio: '',
      origemLead: ''
    }
  });

  const onSubmit = async (data: QuickPatientFormData) => {
    try {
      setIsLoading(true);
      const pacienteData = {
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        idade: data.idade,
        convenio: data.convenio,
        origemLead: data.origemLead as any,
        status: 'Ativo' as const,
        foto: undefined,
        ultimaConsulta: undefined,
        proximaConsulta: undefined,
        historicoMedico: undefined,
        alergias: undefined,
        medicamentos: undefined,
        observacoes: undefined,
        endereco: undefined,
        cpf: undefined,
        rg: undefined,
        profissao: undefined,
        estadoCivil: undefined,
        dataArquivamento: undefined,
        motivoArquivamento: undefined
      };
      const novoPaciente = await addPaciente(pacienteData);
      onPatientCreated(novoPaciente.id);
      onClose();
      form.reset();
    } catch (error) {
      console.error('Erro ao criar paciente:', error);
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

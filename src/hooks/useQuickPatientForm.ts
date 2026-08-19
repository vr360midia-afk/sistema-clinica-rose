
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useState } from 'react';
import { toast } from 'sonner';
import { calcularIdade } from '@/utils/idade';

const quickPatientSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  telefone: z.string().min(1, 'Telefone é obrigatório'),
  dataNascimento: z.date().optional(),
  endereco: z.string().optional(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  profissao: z.string().optional(),
  estadoCivil: z.string().optional(),
  convenio: z.string().optional(),
  origemLead: z.string().optional(),
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
      dataNascimento: undefined,
      endereco: '',
      cpf: '',
      rg: '',
      profissao: '',
      estadoCivil: '',
      convenio: 'particular',
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
      
      // Preparar dados conforme a interface Paciente
      const pacienteData = {
        nome: data.nome.trim(),
        email: data.email.trim().toLowerCase(),
        telefone: data.telefone.trim(),
        dataNascimento: data.dataNascimento,
        idade: calcularIdade(data.dataNascimento) || 0,
        convenio: data.convenio || 'particular',
        origemLead: (data.origemLead || '') as any,
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
        ultimaConsulta: data.ultimaConsulta?.trim() || '',
        observacoes: data.observacoes?.trim() || ''
      };
      
      console.log('Dados preparados para salvar:', pacienteData);
      
      const novoPaciente = await addPaciente(pacienteData);
      console.log('Paciente criado com sucesso:', novoPaciente);
      
      toast.success(`Paciente ${data.nome} cadastrado com sucesso!`);
      onPatientCreated(novoPaciente.id);
      onClose();
      form.reset();
      
    } catch (error) {
      console.error('Erro detalhado ao criar paciente:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao salvar paciente: ${errorMessage}`);
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

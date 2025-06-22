
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
      
      // Preparar dados apenas com campos que existem na tabela pacientes
      const pacienteData = {
        nome: data.nome.trim(),
        email: data.email.trim().toLowerCase(),
        telefone: data.telefone.trim(),
        idade: data.idade || 0,
        convenio: data.convenio,
        origem_lead: data.origemLead, // Usando snake_case como na tabela
        status: 'Ativo' as const,
        endereco: data.endereco?.trim() || '',
        cpf: data.cpf?.trim() || '',
        rg: data.rg?.trim() || '',
        profissao: data.profissao?.trim() || '',
        estado_civil: data.estadoCivil || '', // Usando snake_case como na tabela
        foto: data.foto || '',
        historico_medico: data.historicoMedico?.trim() || '', // Usando snake_case como na tabela
        alergias: data.alergias?.trim() || '',
        medicamentos: data.medicamentos?.trim() || '',
        observacoes: data.observacoes?.trim() || ''
        // Removendo ultima_consulta pois não está sendo usado corretamente
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

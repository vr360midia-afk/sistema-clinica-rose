import { supabase } from '@/integrations/supabase/client';
import { supabaseService } from '@/services/supabaseService';
import {
  parsearComandoWhatsApp,
  gerarRespostaSucessoWhatsApp,
  DadosPacienteComando,
} from '@/utils/whatsappComandoParser';

export interface ResultadoComandoWhatsApp {
  success: boolean;
  jaExistia?: boolean;
  paciente?: {
    id: string;
    nome: string;
    telefone?: string;
    cpf?: string;
  };
  linkAnamnese?: string;
  respostaWhatsApp?: string;
  erro?: string;
  dadosParsed?: DadosPacienteComando;
}

/**
 * Executa o comando de criação de ficha de paciente diretamente na plataforma
 * (ou via Edge Function com fallback local/Supabase).
 */
export async function processarComandoCriarFicha(
  textoComando: string,
  telefoneRemetente?: string
): Promise<ResultadoComandoWhatsApp> {
  if (!textoComando || !textoComando.trim()) {
    return {
      success: false,
      erro: 'Por favor, informe o comando com os dados do paciente.',
    };
  }

  // 1. Parse dos dados
  const parsed = parsearComandoWhatsApp(textoComando, telefoneRemetente);
  if (!parsed.comandoValido || !parsed.nome) {
    return {
      success: false,
      erro: 'Não foi possível identificar o nome do paciente no comando. Verifique o formato.',
      dadosParsed: parsed,
    };
  }

  try {
    // 2. Tenta via Edge Function primeiro
    try {
      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke(
        'whatsapp-comando-paciente',
        {
          body: {
            texto: textoComando,
            from: telefoneRemetente,
          },
        }
      );

      if (!edgeErr && edgeRes && edgeRes.success) {
        return {
          success: true,
          jaExistia: edgeRes.jaExistia,
          paciente: edgeRes.paciente,
          linkAnamnese: edgeRes.linkAnamnese,
          respostaWhatsApp: edgeRes.respostaWhatsApp,
          dadosParsed: parsed,
        };
      }
    } catch (e) {
      console.warn('[WhatsApp Comando] Edge Function indisponível, usando fallback direto no app:', e);
    }

    // 3. Fallback Direto via Supabase Service
    const pacientesExistentes = await supabaseService.getPacientes();
    let pacienteExistente: any = null;

    if (pacientesExistentes && pacientesExistentes.length > 0) {
      if (parsed.cpf) {
        const cpfDigitos = parsed.cpf.replace(/\D/g, '');
        pacienteExistente = pacientesExistentes.find(
          (p) => (p.cpf || '').replace(/\D/g, '') === cpfDigitos
        );
      }
      if (!pacienteExistente && parsed.telefone) {
        const telDigitos = parsed.telefone.replace(/\D/g, '').slice(-8);
        pacienteExistente = pacientesExistentes.find(
          (p) => (p.telefone || '').replace(/\D/g, '').slice(-8) === telDigitos
        );
      }
      if (!pacienteExistente) {
        const nNorm = parsed.nome.toLowerCase().trim();
        pacienteExistente = pacientesExistentes.find(
          (p) => p.nome.toLowerCase().trim() === nNorm
        );
      }
    }

    let pacienteId: string;
    let jaExistia = false;
    let pacienteSalvo: any = null;

    if (pacienteExistente) {
      pacienteId = pacienteExistente.id;
      pacienteSalvo = pacienteExistente;
      jaExistia = true;
    } else {
      pacienteSalvo = await supabaseService.savePaciente({
        nome: parsed.nome,
        telefone: parsed.telefone || '',
        cpf: parsed.cpf || '',
        convenio: 'Particular',
        status: 'Ativo',
        origemLead: 'whatsapp',
        observacoes: parsed.queixaPrincipal
          ? `Queixa: ${parsed.queixaPrincipal} (Criado via WhatsApp)`
          : 'Criado via comando no WhatsApp',
      } as any);

      pacienteId = pacienteSalvo.id;
    }

    // Cria token e registro de Anamnese
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const originApp = window.location.origin || 'https://app.lentesemresinamaceio.com.br';
    const linkAnamnese = `${originApp}/anamnese/assinar/${pacienteId}?token=${token}&modo=preencher`;

    if (!jaExistia) {
      try {
        await supabaseService.saveAnamnese({
          pacienteId,
          data: new Date(),
          queixaPrincipal: parsed.queixaPrincipal || 'Avaliação Odontológica',
          statusAssinatura: 'pendente',
          tokenAssinatura: token,
          linkAssinatura: linkAnamnese,
          respostas: {},
        } as any);
      } catch (errAnamnese) {
        console.warn('[WhatsApp Comando] Aviso ao salvar anamnese inicial:', errAnamnese);
      }
    }

    const respostaWhatsApp = gerarRespostaSucessoWhatsApp({
      nome: parsed.nome,
      telefone: parsed.telefone,
      cpf: parsed.cpf,
      pacienteId,
      linkAnamnese,
      jaExistia,
    });

    return {
      success: true,
      jaExistia,
      paciente: {
        id: pacienteId,
        nome: pacienteSalvo.nome,
        telefone: pacienteSalvo.telefone,
        cpf: pacienteSalvo.cpf,
      },
      linkAnamnese,
      respostaWhatsApp,
      dadosParsed: parsed,
    };
  } catch (err: any) {
    console.error('[WhatsApp Comando Service] Erro:', err);
    return {
      success: false,
      erro: err.message || 'Erro ao processar criação da ficha.',
      dadosParsed: parsed,
    };
  }
}

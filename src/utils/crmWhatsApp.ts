import { toast } from 'sonner';

export interface WhatsAppTemplate {
  id: string;
  titulo: string;
  descricao: string;
  categoria: 'funil' | 'agendamento' | 'clinica' | 'followup';
  gerarMensagem: (nome: string, clinicaNome?: string) => string;
}

export const TEMPLATES_POR_STATUS: Record<string, { titulo: string; gerarMensagem: (nome: string) => string }> = {
  novo: {
    titulo: 'Boas-vindas (Novo Lead)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Tudo bem? 😊\n\nVi que você entrou em contato querendo saber mais sobre os tratamentos na clínica da *Dra. Rosangela Santos*.\n\nComo posso te ajudar hoje? Ficou com alguma dúvida específica ou gostaria de agendar uma avaliação?`,
  },
  primeiro_contato: {
    titulo: '1º Contato (Apresentação)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Tudo bem? Aqui é da equipe da *Dra. Rosangela Santos*.\n\nTemos horários especiais abertos nesta semana para uma consulta de avaliação personalizada do seu sorriso.\n\nGostaria que eu verificasse os melhores dias e horários para você?`,
  },
  fu_3h: {
    titulo: 'Follow-up 3h (Retorno inicial)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Passando rapidinho para saber se conseguiu dar uma olhada nas informações que conversamos mais cedo. Ficou com alguma dúvida sobre o procedimento?`,
  },
  fu_18h: {
    titulo: 'Follow-up 18h (Disponibilidade)',
    gerarMensagem: (nome) =>
      `Oi, ${nome}! Tudo joia? Para te ajudar a dar o próximo passo no seu sorriso, ainda temos um horário exclusivo com a *Dra. Rosangela* nesta semana. Posso reservar para você?`,
  },
  fu_2d: {
    titulo: 'Follow-up 2 dias (Condições especiais)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Como você está? Sei que a rotina é corrida! Caso ainda tenha interesse em realizar seu tratamento, me avise por aqui para mantermos suas condições ativas, tá bem?`,
  },
  fu_5d: {
    titulo: 'Follow-up 5 dias (Tirar dúvidas)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Passando para te deixar super à vontade: se tiver qualquer pergunta sobre procedimentos, valores ou formas de pagamento, estou à disposição por aqui!`,
  },
  fu_7d: {
    titulo: 'Follow-up 7 dias (Check-in semanal)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Tudo bem por aí? Gostaria de saber se ainda faz sentido conversarmos sobre a transformação do seu sorriso ou se prefere retomar mais adiante.`,
  },
  fu_14d: {
    titulo: 'Follow-up 14 dias (Novos horários)',
    gerarMensagem: (nome) =>
      `Oi, ${nome}! Abrimos novos horários para consultas nesta quinzena. Gostaria de aproveitar para marcar sua avaliação com a *Dra. Rosangela*?`,
  },
  fu_21d: {
    titulo: 'Follow-up 21 dias (Reativação)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Tudo bem? Passando para saber como você está e se deseja agendar um momento para cuidar da saúde e estética do seu sorriso!`,
  },
  fu_30d: {
    titulo: 'Follow-up 30 dias (Mensal)',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Tudo bem? Passando para mandar um abraço e saber se podemos agendar sua avaliação com a *Dra. Rosangela Santos* neste mês. Qualquer dúvida, estou por aqui!`,
  },
  mensal: {
    titulo: 'Acompanhamento Mensal',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Como você está? Estamos entrando em contato para saber se gostaria de agendar uma consulta preventiva ou de avaliação neste mês. Seguimos à disposição!`,
  },
  agendado: {
    titulo: 'Confirmação de Consulta Agendada',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Sua consulta na clínica da *Dra. Rosangela Santos* foi agendada com sucesso! 🎉\n\n📍 *Endereço:* JTR - Edifício Espanha, R. Comerc. José Pontes de Magalhães, 70 - Sala 405 - Jatiúca, Maceió - AL.\n\nPedimos a gentileza de confirmar o recebimento desta mensagem. Até breve!`,
  },
  perdido: {
    titulo: 'Despedida cordial / Portas abertas',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Tudo bem? Compreendemos perfeitamente. Ficamos à sua inteira disposição caso decida cuidar do seu sorriso no futuro. Tenha um ótimo dia!`,
  },
};

export const TEMPLATES_EXTRAS: WhatsAppTemplate[] = [
  {
    id: 'localizacao',
    titulo: '📍 Endereço e Como Chegar',
    descricao: 'Envia o endereço completo da clínica no JTR e link do mapa',
    categoria: 'clinica',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Seguem as informações de localização da nossa clínica:\n\n🏥 *Clínica Dra. Rosangela Santos*\n📍 *Endereço:* JTR - Edifício Espanha, R. Comerc. José Pontes de Magalhães, 70 - Sala 405 - Jatiúca, Maceió - AL, 57036-250.\n🗺️ *Google Maps:* https://maps.app.goo.gl/o1H52U8Fj6J75x8c9\n\nQualquer dúvida no trajeto, pode nos chamar!`,
  },
  {
    id: 'formas_pagamento',
    titulo: '💳 Formas de Pagamento & PIX',
    descricao: 'Informa facilidades de parcelamento, cartão e PIX',
    categoria: 'clinica',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Sobre as formas de pagamento para o seu tratamento:\n\n• Cartões de Crédito em até 12x\n• Cartão de Débito\n• PIX Oficial com baixa e confirmação imediata\n• Condições facilitadas mediante avaliação clínica.\n\nQuer agendar para receber uma proposta personalizada?`,
  },
  {
    id: 'agendar_avaliacao',
    titulo: '📅 Convite para Avaliação',
    descricao: 'Convite direto para marcar horário de avaliação com a Dra. Rosangela',
    categoria: 'agendamento',
    gerarMensagem: (nome) =>
      `Olá, ${nome}! Que tal darmos o primeiro passo? Podemos agendar uma consulta de avaliação para a Dra. Rosangela examinar seu caso com todo cuidado e apresentar o plano ideal para você.\n\nVocê tem preferência por horário pela manhã ou pela tarde?`,
  },
];

/**
 * Normaliza número brasileiro e abre o WhatsApp Web diretamente
 */
export const abrirWhatsAppWeb = (telefone: string | null | undefined, mensagem: string) => {
  if (!telefone) {
    toast.error('Este lead não possui telefone cadastrado');
    return false;
  }

  const digitos = telefone.replace(/\D/g, '');
  if (!digitos) {
    toast.error('Telefone inválido');
    return false;
  }

  const numeroCompleto = digitos.startsWith('55') ? digitos : `55${digitos}`;
  const textoCodificado = encodeURIComponent(mensagem);

  // No desktop, web.whatsapp.com abre direto no WhatsApp Web
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  const url = isMobile
    ? `https://wa.me/${numeroCompleto}?text=${textoCodificado}`
    : `https://web.whatsapp.com/send?phone=${numeroCompleto}&text=${textoCodificado}`;

  window.open(url, '_blank', 'noopener,noreferrer');
  toast.success('Abrindo conversa no WhatsApp Web...', {
    description: `Contato: ${telefone}`,
  });
  return true;
};

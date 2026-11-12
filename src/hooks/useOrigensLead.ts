import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface OrigemLeadItem {
  id: string;
  label: string;
  padrao?: boolean;
  ativo: boolean;
  criadoEm?: string;
}

export const ORIGENS_LEAD_PADRAO: OrigemLeadItem[] = [
  { id: 'indicacao', label: 'Indicação', padrao: true, ativo: true },
  { id: 'google', label: 'Google', padrao: true, ativo: true },
  { id: 'facebook', label: 'Facebook', padrao: true, ativo: true },
  { id: 'instagram', label: 'Instagram', padrao: true, ativo: true },
  { id: 'site', label: 'Site', padrao: true, ativo: true },
  { id: 'whatsapp', label: 'WhatsApp', padrao: true, ativo: true },
  { id: 'panfleto', label: 'Panfleto', padrao: true, ativo: true },
  { id: 'outros', label: 'Outros', padrao: true, ativo: true },
];

const STORAGE_KEY_PREFIX = 'sistema_clinica_origens_lead_';

export const getStorageKey = (clinicaId?: string | null): string => {
  return `${STORAGE_KEY_PREFIX}${clinicaId || 'padrao'}`;
};

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const useOrigensLead = () => {
  const { clinicaId } = useAuth();
  const storageKey = getStorageKey(clinicaId);

  const carregarDoStorage = useCallback((): OrigemLeadItem[] => {
    if (typeof window === 'undefined') return ORIGENS_LEAD_PADRAO;
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return ORIGENS_LEAD_PADRAO;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Garante que todas as origens padrão estejam presentes caso alguma tenha sido criada em versão futura
        const mapaExistente = new Map(parsed.map((item: OrigemLeadItem) => [item.id, item]));
        ORIGENS_LEAD_PADRAO.forEach((p) => {
          if (!mapaExistente.has(p.id)) {
            parsed.push(p);
          }
        });
        return parsed;
      }
      return ORIGENS_LEAD_PADRAO;
    } catch (e) {
      console.warn('Erro ao carregar origens de lead:', e);
      return ORIGENS_LEAD_PADRAO;
    }
  }, [storageKey]);

  const [origens, setOrigens] = useState<OrigemLeadItem[]>(carregarDoStorage);

  const salvarLista = useCallback((novaLista: OrigemLeadItem[]) => {
    setOrigens(novaLista);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, JSON.stringify(novaLista));
        window.dispatchEvent(new CustomEvent('origens-lead-atualizadas', { detail: novaLista }));
      } catch (e) {
        console.error('Erro ao persistir origens de lead:', e);
      }
    }
  }, [storageKey]);

  // Sincronização reativa entre janelas e componentes
  useEffect(() => {
    const handleAtualizacao = (event: Event) => {
      const customEvent = event as CustomEvent<OrigemLeadItem[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setOrigens(customEvent.detail);
      } else {
        setOrigens(carregarDoStorage());
      }
    };

    window.addEventListener('origens-lead-atualizadas', handleAtualizacao);
    window.addEventListener('storage', handleAtualizacao);

    return () => {
      window.removeEventListener('origens-lead-atualizadas', handleAtualizacao);
      window.removeEventListener('storage', handleAtualizacao);
    };
  }, [carregarDoStorage]);

  // Adiciona nova origem de lead (na hora ou em configurações)
  const adicionarOrigem = useCallback((nome: string): OrigemLeadItem | null => {
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error('Informe o nome da nova origem.');
      return null;
    }

    const idGerado = slugify(nomeLimpo);
    if (!idGerado) {
      toast.error('Nome inválido para a origem.');
      return null;
    }

    const listaAtual = carregarDoStorage();
    const jaExiste = listaAtual.find(
      (o) => o.id === idGerado || o.label.toLowerCase() === nomeLimpo.toLowerCase()
    );

    if (jaExiste) {
      if (!jaExiste.ativo) {
        // Se já existia mas estava inativa, reativa
        const atualizada = listaAtual.map((o) =>
          o.id === jaExiste.id ? { ...o, ativo: true } : o
        );
        salvarLista(atualizada);
        toast.success(`Origem "${jaExiste.label}" reativada com sucesso!`);
        return { ...jaExiste, ativo: true };
      }
      toast.info(`A origem "${jaExiste.label}" já está cadastrada.`);
      return jaExiste;
    }

    const novoItem: OrigemLeadItem = {
      id: idGerado,
      label: nomeLimpo,
      padrao: false,
      ativo: true,
      criadoEm: new Date().toISOString(),
    };

    const novaLista = [...listaAtual, novoItem];
    salvarLista(novaLista);
    toast.success(`Origem "${nomeLimpo}" adicionada com sucesso!`);
    return novoItem;
  }, [carregarDoStorage, salvarLista]);

  // Edita o nome/label de uma origem existente
  const editarOrigem = useCallback((id: string, novoLabel: string): boolean => {
    const nomeLimpo = novoLabel.trim();
    if (!nomeLimpo) {
      toast.error('O nome da origem não pode ficar vazio.');
      return false;
    }

    const listaAtual = carregarDoStorage();
    const itemIndex = listaAtual.findIndex((o) => o.id === id);
    if (itemIndex === -1) {
      toast.error('Origem não encontrada.');
      return false;
    }

    const novaLista = [...listaAtual];
    novaLista[itemIndex] = {
      ...novaLista[itemIndex],
      label: nomeLimpo,
    };

    salvarLista(novaLista);
    toast.success('Origem atualizada com sucesso!');
    return true;
  }, [carregarDoStorage, salvarLista]);

  // Remove ou desativa uma origem
  const removerOrigem = useCallback((id: string): boolean => {
    const listaAtual = carregarDoStorage();
    const item = listaAtual.find((o) => o.id === id);
    if (!item) return false;

    // Se for padrão, desativa em vez de excluir permanentemente para preservar integridade
    let novaLista: OrigemLeadItem[];
    if (item.padrao) {
      novaLista = listaAtual.map((o) => (o.id === id ? { ...o, ativo: false } : o));
      toast.success(`Origem padrão "${item.label}" desativada.`);
    } else {
      novaLista = listaAtual.filter((o) => o.id !== id);
      toast.success(`Origem personalizada "${item.label}" removida.`);
    }

    salvarLista(novaLista);
    return true;
  }, [carregarDoStorage, salvarLista]);

  // Alterna status ativo/inativo
  const alternarStatus = useCallback((id: string, ativo: boolean) => {
    const listaAtual = carregarDoStorage();
    const novaLista = listaAtual.map((o) => (o.id === id ? { ...o, ativo } : o));
    salvarLista(novaLista);
    toast.success(`Origem ${ativo ? 'ativada' : 'desativada'} com sucesso.`);
  }, [carregarDoStorage, salvarLista]);

  // Restaura lista aos padrões de fábrica
  const restaurarPadroes = useCallback(() => {
    salvarLista(ORIGENS_LEAD_PADRAO);
    toast.success('Origens de lead restauradas para as opções padrão!');
  }, [salvarLista]);

  // Obter label amigável a partir do id ou valor
  const obterLabel = useCallback((valor?: string | null): string => {
    if (!valor) return 'Não informada';
    const valLimpo = valor.trim().toLowerCase();
    const match = origens.find(
      (o) => o.id.toLowerCase() === valLimpo || o.label.toLowerCase() === valLimpo
    );
    if (match) return match.label;

    // Fallback padrão se não estiver na lista: capitaliza palavras
    return valor
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }, [origens]);

  const origensAtivas = origens.filter((o) => o.ativo);

  return {
    origens,
    origensAtivas,
    adicionarOrigem,
    editarOrigem,
    removerOrigem,
    alternarStatus,
    restaurarPadroes,
    obterLabel,
  };
};


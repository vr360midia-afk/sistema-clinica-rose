import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { novosLeadsService } from '@/services/novosLeadsService';

export function useNovosLeadsBadgeCount() {
  const [count, setCount] = useState<number>(0);

  const atualizarContagem = async () => {
    try {
      const total = await novosLeadsService.contarNaoRevisados();
      setCount(total);
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    atualizarContagem();

    const canal = supabase
      .channel('novos_leads_badge_counter')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crm_leads' },
        () => {
          atualizarContagem();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  return count;
}

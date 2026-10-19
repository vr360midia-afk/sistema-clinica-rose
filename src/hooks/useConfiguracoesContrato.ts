import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { toast } from 'sonner';

export interface ConfiguracoesContrato {
  // Dados Oficiais do PIX para o Contrato e Recibos
  chavePix: string;
  tipoChavePix: 'telefone' | 'cnpj' | 'cpf' | 'email' | 'aleatoria';
  favorecidoPix: string;
  cnpjCpfFavorecidoPix: string;
  bancoPix: string;
  instrucoesPix: string;

  // Dados Cadastrais da Clínica para os Contratos
  nomeClinicaContrato: string;
  cnpjClinicaContrato: string;
  croResponsavelContrato: string;
  dentistaResponsavelContrato: string;
  enderecoContrato: string;
  telefoneContrato: string;
  emailContrato: string;
  cidadeForoContrato: string;

  // Cláusulas e Regras Jurídicas Padrão
  multaAtrasoPercentual: number;
  jurosMoraPercentual: number;
  clausulaEspecialPadrao: string;

  // Assinatura Oficial da Dra. Responsável (pré-assinatura automática dos contratos)
  assinaturaPadraoDentista?: string;
  autoAssinarContrato?: boolean;
}

const STORAGE_KEY_PREFIX = 'sistema_clinica_contrato_config_';

export const getStorageKey = (clinicaId?: string | null): string => {
  return `${STORAGE_KEY_PREFIX}${clinicaId || 'padrao'}`;
};

export const getDefaultConfigContrato = (configGerais?: any): ConfiguracoesContrato => {
  return {
    chavePix: configGerais?.telefone || '82974002213',
    tipoChavePix: 'telefone',
    favorecidoPix: configGerais?.nomeClinica || 'Dra. Rosangela Santos',
    cnpjCpfFavorecidoPix: configGerais?.cnpj || '032.663.962-43',
    bancoPix: '',
    instrucoesPix:
      'O(A) CONTRATANTE poderá utilizar a câmera do smartphone para leitura do QR Code acima ou efetuar a transferência direta para a chave informada, encaminhando o comprovante para confirmação da baixa da parcela.',

    nomeClinicaContrato: configGerais?.nomeClinica || 'DRA. ROSANGELA SANTOS',
    cnpjClinicaContrato: configGerais?.cnpj || '032.663.962-43',
    croResponsavelContrato: configGerais?.croResponsavel || '06267-AL',
    dentistaResponsavelContrato: configGerais?.dentistaResponsavel || 'Dra. Rosangela Santos',
    enderecoContrato:
      configGerais?.endereco ||
      'JTR - Edificio Espanha - R. Comerc. José Pontes de Magalhães, 70 - Sl 405 - Jatiúca, Maceió - AL, 57036-250',
    telefoneContrato: configGerais?.telefone || '82974002213',
    emailContrato: configGerais?.email || 'drarosesantosexpert@gmail.com',
    cidadeForoContrato: 'Maceió - AL',

    multaAtrasoPercentual: 2,
    jurosMoraPercentual: 1,
    clausulaEspecialPadrao: '',

    assinaturaPadraoDentista: '',
    autoAssinarContrato: true,
  };
};

export const carregarConfiguracoesContratoSync = (clinicaId?: string | null, configGerais?: any): ConfiguracoesContrato => {
  const padrao = getDefaultConfigContrato(configGerais);
  try {
    const key = getStorageKey(clinicaId);
    const salvo = localStorage.getItem(key) || localStorage.getItem(STORAGE_KEY_PREFIX + 'padrao');
    if (salvo && typeof salvo === 'string' && salvo !== 'undefined' && salvo !== 'null') {
      const parsed = JSON.parse(salvo);
      if (parsed && typeof parsed === 'object') {
        return {
          ...padrao,
          ...parsed,
          chavePix: parsed.chavePix || padrao.chavePix,
          tipoChavePix: parsed.tipoChavePix || padrao.tipoChavePix,
          favorecidoPix: parsed.favorecidoPix || padrao.favorecidoPix,
          assinaturaPadraoDentista: parsed.assinaturaPadraoDentista || localStorage.getItem('assinatura_padrao_dentista') || '',
          autoAssinarContrato: parsed.autoAssinarContrato !== undefined ? Boolean(parsed.autoAssinarContrato) : true,
        };
      }
    }
  } catch (err) {
    console.error('Erro ao ler configuracoes do contrato do localStorage:', err);
  }
  return padrao;
};

export const useConfiguracoesContrato = () => {
  const { clinicaId } = useAuth();
  const { configuracoes: configGerais } = useConfiguracoes();
  const padrao = getDefaultConfigContrato(configGerais);
  const [configContrato, setConfigContrato] = useState<ConfiguracoesContrato>(() =>
    carregarConfiguracoesContratoSync(clinicaId, configGerais)
  );
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    setLoading(true);
    const dados = carregarConfiguracoesContratoSync(clinicaId, configGerais);
    setConfigContrato(dados);
    setLoading(false);
  }, [clinicaId, configGerais]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Listener para sincronização entre abas e componentes
  useEffect(() => {
    const handleStorageChange = () => carregar();
    window.addEventListener('contrato-config-updated', handleStorageChange);
    return () => window.removeEventListener('contrato-config-updated', handleStorageChange);
  }, [carregar]);

  const salvarConfiguracoesContrato = async (novosDados: Partial<ConfiguracoesContrato>) => {
    try {
      setSalvando(true);
      const atualizados: ConfiguracoesContrato = {
        ...padrao,
        ...configContrato,
        ...novosDados,
      };

      const key = getStorageKey(clinicaId);
      localStorage.setItem(key, JSON.stringify(atualizados));
      // Salva também na chave padrão como fallback
      localStorage.setItem(STORAGE_KEY_PREFIX + 'padrao', JSON.stringify(atualizados));

      setConfigContrato(atualizados);
      window.dispatchEvent(new Event('contrato-config-updated'));
      toast.success('Configurações do Contrato e PIX salvas com sucesso!');
      return true;
    } catch (err: any) {
      console.error('Erro ao salvar configuracoes do contrato:', err);
      toast.error('Erro ao salvar configurações do contrato');
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadrao = () => {
    const padraoAtual = getDefaultConfigContrato(configGerais);
    salvarConfiguracoesContrato(padraoAtual);
    toast.info('Configurações redefinidas para os valores padrão.');
  };

  const dadosGarantidos = configContrato || padrao;

  return {
    ...dadosGarantidos,
    configContrato: dadosGarantidos,
    config: dadosGarantidos, // Alias para compatibilidade
    setConfigContrato,
    salvarConfiguracoesContrato,
    restaurarPadrao,
    loading,
    salvando,
  };
};

export default useConfiguracoesContrato;

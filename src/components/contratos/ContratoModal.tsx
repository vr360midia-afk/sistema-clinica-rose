import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  Download,
  Printer,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  History,
  MessageCircle,
  Calendar,
  DollarSign,
  ShieldCheck,
  User,
  Loader2,
  Eye,
  Link as LinkIcon,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCcw,
  Save,
  Building2,
  CreditCard,
  X,
  Plus,
  RefreshCw,
  Sparkles,
  Camera,
  EyeOff,
  Stethoscope,
  Wallet,
  SlidersHorizontal,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import {
  parseCondicoesPagamento,
  serializarCondicoesPagamento,
  calcularDescricaoCondicao,
  CondicaoPagamento,
} from '@/utils/orcamentoCondicoes';

import { useOrcamentos, Orcamento } from '@/hooks/useOrcamentos';
import { useConfiguracoes } from '@/hooks/useConfiguracoes';
import { useConfiguracoesContrato } from '@/hooks/useConfiguracoesContrato';
import { useDentistas } from '@/hooks/useDentistas';
import { useDentalSystem } from '@/context/DentalSystemContext';
import { useDocumentosClinicos, DocumentoClinico } from '@/hooks/useDocumentosClinicos';
import { useSignatures } from '@/hooks/useSignatures';
import { useParceiros } from '@/hooks/useParceiros';
import SignatureModal from '@/components/signature/SignatureModal';
import type { SignatureData } from '@/components/signature/DigitalSignature';
import {
  mapearDadosContrato,
  gerarHtmlContrato,
  ContratoSnapshot,
  ContratoParcela,
  gerarLinkAssinaturaContrato,
  emitirContratoPersistido,
  isContratoLenteResina,
  isContratoEndodontia,
  downloadContratoEndodontiaPdf,
  downloadTcleEndodontiaPdf,
  identificarTipoDocumento,
  isMetodoCartao,
  temValorValido,
  limparFormaPagamentoParaContrato,
  gerarIdentificadorContrato,
  gerarTokenAcesso,
  validarAutorizacaoAssinatura,
  gerarRubricaPadraoDra,
  validarCronogramaFinanceiroContrato,
  validarIntegridadeOrcamentoContrato,
  parseBrMoney,
  formatarData,
} from '@/utils/contratoEngine';
import { downloadTcleLentesResinaPdf } from '@/utils/tcleLentesResina';
import { downloadTermoUsoImagemPdf } from '@/utils/termoUsoImagem';
import { somarMesesSeguro, formatarEnderecoCompleto, formatarDocumento, formatarTelefone } from '@/utils/documentoFormat';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';
import { openWhatsApp } from '@/lib/whatsapp';
import { formatMoney } from '@/utils/exportCsv';
import { carregarConfiguracoesMaquinasSync, calcularTaxaCartao, extrairDetalhesCartaoDeTexto } from '@/hooks/useMaquinasCartao';
import { supabase } from '@/integrations/supabase/client';
import {
  obterPdfContratoOficialDefinitivo,
  dispararDownloadPdfOficial,
} from '@/utils/contratoPdfOficial';

interface ContratoModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: any;
  initialOrcamento?: Orcamento | any;
}

export const ContratoModal: React.FC<ContratoModalProps> = ({
  isOpen,
  onClose,
  patient,
  initialOrcamento,
}) => {
  const { orcamentos, saveOrcamento } = useOrcamentos(patient?.id);
  const { configuracoes } = useConfiguracoes();
  const { configContrato, autorizacaoAtiva } = useConfiguracoesContrato();
  const { dentistas } = useDentistas();
  const { transacoes, addTransacao, deleteTransacao, updatePaciente, pacientes } = useDentalSystem();
  const { documentos, salvarDocumento } = useDocumentosClinicos(patient?.id);
  const { parceiros } = useParceiros();

  // Estados principais
  const [activeTab, setActiveTab] = useState<'gerar' | 'editar' | 'historico'>('gerar');
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);
  const [documentoIdSendoEditado, setDocumentoIdSendoEditado] = useState<string | null>(null);

  const [selectedOrcamentoId, setSelectedOrcamentoId] = useState<string>('');
  const [selectedDentistaNome, setSelectedDentistaNome] = useState<string>('');
  const [cidadeLocal, setCidadeLocal] = useState<string>('Maceió');

  const [salvando, setSalvando] = useState<boolean>(false);
  const [baixandoPdf, setBaixandoPdf] = useState<boolean>(false);
  const [copiouLink, setCopiouLink] = useState<boolean>(false);

  // Quick-fill e hidratação de dados cadastrais do paciente no contrato
  const [quickCpf, setQuickCpf] = useState<string>('');
  const [quickEndereco, setQuickEndereco] = useState<string>('');
  const [quickTelefone, setQuickTelefone] = useState<string>('');
  const [showQuickFill, setShowQuickFill] = useState<boolean>(false);
  const [salvandoDadosPaciente, setSalvandoDadosPaciente] = useState<boolean>(false);
  const [modalCompletarDadosAdminOpen, setModalCompletarDadosAdminOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileOptionsOpen, setMobileOptionsOpen] = useState<boolean>(false);

  // Múltiplas condições e flexibilização de pagamento do contrato
  const [condicoesContrato, setCondicoesContrato] = useState<CondicaoPagamento[]>([]);
  const [condicaoContratoAtivaId, setCondicaoContratoAtivaId] = useState<string>('');
  const [modalFlexibilizarContratoOpen, setModalFlexibilizarContratoOpen] = useState(false);
  const [condicaoFlexibilizarContrato, setCondicaoFlexibilizarContrato] = useState<Partial<CondicaoPagamento> | null>(null);

  // Assinatura digital interna
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signerRole, setSignerRole] = useState<'paciente' | 'dentista'>('paciente');

  // Contrato emitido selecionado para visualização no histórico
  const [contratoVisualizacao, setContratoVisualizacao] = useState<DocumentoClinico | null>(null);

  // Snapshot em tempo real com os dados do contrato
  const [snapshotAtual, setSnapshotAtual] = useState<ContratoSnapshot | null>(null);

  // Orçamentos aprovados do paciente
  const orcamentosAprovados = useMemo(() => {
    return (orcamentos || []).filter((o) => o?.status === 'aprovado');
  }, [orcamentos]);

  // Contratos emitidos anteriormente para este paciente
  const contratosEmitidos = useMemo(() => {
    return documentos.filter((d) => d.tipo === 'contrato');
  }, [documentos]);

  // Pré-seleciona orçamento inicial ou primeiro aprovado
  useEffect(() => {
    if (initialOrcamento?.id) {
      setSelectedOrcamentoId(initialOrcamento.id);
    } else if (orcamentosAprovados.length > 0 && !selectedOrcamentoId) {
      setSelectedOrcamentoId(orcamentosAprovados[0].id);
    }
  }, [initialOrcamento, orcamentosAprovados, selectedOrcamentoId]);

  // Dentista responsável padrão
  useEffect(() => {
    if (dentistas.length > 0 && !selectedDentistaNome) {
      setSelectedDentistaNome(dentistas[0].nome);
    }
  }, [dentistas, selectedDentistaNome]);

  // Cidade da Comarca / Foro padrão (sempre Maceió por padrão ou o configurado no modelo de contrato)
  useEffect(() => {
    const cidadeConfig = (configContrato?.cidadeForoContrato || '').trim();
    const cidadeFinal = cidadeConfig && !cidadeConfig.toLowerCase().includes('são paulo') && !cidadeConfig.toLowerCase().includes('sao paulo')
      ? cidadeConfig
      : 'Maceió';

    if (!cidadeLocal || cidadeLocal.toLowerCase().includes('são paulo') || cidadeLocal.toLowerCase().includes('sao paulo')) {
      setCidadeLocal(cidadeFinal);
    }
  }, [configContrato?.cidadeForoContrato, cidadeLocal]);

  // Orçamento ativo
  const orcamentoAtual = useMemo(() => {
    return (
      orcamentos.find((o) => o.id === selectedOrcamentoId) ||
      initialOrcamento ||
      orcamentosAprovados[0] ||
      null
    );
  }, [orcamentos, selectedOrcamentoId, initialOrcamento, orcamentosAprovados]);

  // Dentista ativo
  const dentistaAtual = useMemo(() => {
    return dentistas.find((d) => d.nome === selectedDentistaNome);
  }, [dentistas, selectedDentistaNome]);

  // Transações vinculadas ao orçamento
  const transacoesOrcamento = useMemo(() => {
    if (!orcamentoAtual?.id) return [];
    return transacoes.filter((t: any) => t.orcamentoId === orcamentoAtual.id);
  }, [transacoes, orcamentoAtual]);

  const somaTransacoesOrcamento = useMemo(() => {
    return transacoesOrcamento.reduce((acc, t) => acc + (Number(t.valor) || 0), 0);
  }, [transacoesOrcamento]);

  const transacoesSuspeitasOuDivergentes = useMemo(() => {
    if (!orcamentoAtual || transacoesOrcamento.length === 0) return false;
    const temValorZerado = transacoesOrcamento.some((t: any) => Number(t.valor) < 0.5 && orcamentoAtual.total > 10);
    const divergeTotal = Math.abs(somaTransacoesOrcamento - orcamentoAtual.total) > 0.5;
    return temValorZerado || divergeTotal;
  }, [orcamentoAtual, transacoesOrcamento, somaTransacoesOrcamento]);

  // Localiza contrato oficial já persistido no banco para o orçamento selecionado (assinado ou pendente)
  const contratoExistenteOrcamento = useMemo(() => {
    const targetOrcId = orcamentoAtual?.id || initialOrcamento?.id || selectedOrcamentoId;
    const targetContratoId = orcamentoAtual?.contratoId || initialOrcamento?.contratoId || (orcamentos || []).find((o) => o?.id === targetOrcId)?.contratoId;
    if ((!targetOrcId && !targetContratoId) || documentos.length === 0) return null;

    const candidatos = documentos.filter(
      (d) =>
        d.tipo === 'contrato' &&
        ((targetOrcId && ((d.itens as any)?.orcamentoId === targetOrcId || d.orcamentoId === targetOrcId)) ||
          (targetContratoId &&
            (d.id === targetContratoId ||
              d.identificador === targetContratoId ||
              (d.itens as any)?.contratoId === targetContratoId)))
    );

    if (candidatos.length === 0) return null;

    // Prioriza formalizado com ambas assinaturas > assinado por dentista > mais recente
    candidatos.sort((a, b) => {
      const aSnap = (a.itens || {}) as any;
      const bSnap = (b.itens || {}) as any;
      const aFormalizado = Boolean(a.assinadoEm || aSnap.assinaturaPaciente?.assinaturaData || aSnap.status === 'formalizado' || a.status === 'formalizado');
      const bFormalizado = Boolean(b.assinadoEm || bSnap.assinaturaPaciente?.assinaturaData || bSnap.status === 'formalizado' || b.status === 'formalizado');
      if (aFormalizado !== bFormalizado) return aFormalizado ? -1 : 1;

      const aDra = Boolean(aSnap.assinaturaDentista?.assinaturaData || aSnap.statusAssinaturaDentista === 'assinado');
      const bDra = Boolean(bSnap.assinaturaDentista?.assinaturaData || bSnap.statusAssinaturaDentista === 'assinado');
      if (aDra !== bDra) return aDra ? -1 : 1;

      const aTime = new Date(a.assinadoEm || a.atualizadoEm || a.criadoEm || 0).getTime();
      const bTime = new Date(b.assinadoEm || b.atualizadoEm || b.criadoEm || 0).getTime();
      return bTime - aTime;
    });

    return candidatos[0];
  }, [documentos, initialOrcamento, selectedOrcamentoId, orcamentos]);

  // Sincroniza contrato visualizado e snapshot oficial persistido ao abrir o modal
  useEffect(() => {
    if (!isOpen) {
      setContratoVisualizacao(null);
      setIsManuallyEdited(false);
      setDocumentoIdSendoEditado(null);
      return;
    }

    if (contratoExistenteOrcamento) {
      setContratoVisualizacao(contratoExistenteOrcamento);
      const snapDoc = (contratoExistenteOrcamento.itens || {}) as ContratoSnapshot;
      const isAssinado = Boolean(
        contratoExistenteOrcamento.assinadoEm ||
        contratoExistenteOrcamento.status === 'formalizado' ||
        snapDoc?.status === 'formalizado' ||
        snapDoc?.assinaturaPaciente?.assinaturaData
      );

      if (!isManuallyEdited) {
        if (isAssinado) {
          setSnapshotAtual(snapDoc);
        } else if (orcamentoAtual && patient) {
          // Resolve o paciente mais atualizado: prop ou cadastro global em pacientes
          const pacienteCadastrado =
            (patient?.id && pacientes?.find((p) => p.id === patient.id)) ||
            (patient?.nome && pacientes?.find((p) => p.nome && p.nome.trim().toLowerCase() === patient.nome.trim().toLowerCase())) ||
            patient;

          // Se NÃO está assinado pelo paciente, verifica se o orçamento foi atualizado ou possui divergência
          const valExistente = snapDoc?.financeiro ? validarIntegridadeOrcamentoContrato(orcamentoAtual, snapDoc) : null;
          const formasOrc = String(orcamentoAtual.formasPagamento || (orcamentoAtual as any).formas_pagamento || '').trim();
          const formasSnap = String(snapDoc?.financeiro?.formaPagamento || '').trim();
          const totalOrc = Number(orcamentoAtual.total || 0);
          const totalSnap = Number(snapDoc?.financeiro?.total ?? snapDoc?.financeiro?.valorTotal ?? 0);

          const temClinicaPlaceholder =
            !snapDoc?.clinica?.nome ||
            snapDoc.clinica.nome === 'Clínica Odontológica' ||
            !snapDoc?.clinica?.cnpj ||
            snapDoc.clinica.cnpj === 'Não informado' ||
            !snapDoc?.clinica?.endereco ||
            snapDoc.clinica.endereco === 'Endereço da clínica';

          const temPacientePlaceholder =
            !temValorValido(snapDoc?.paciente?.cpf) ||
            !temValorValido(snapDoc?.paciente?.endereco) ||
            !temValorValido(snapDoc?.paciente?.telefone) ||
            !temValorValido(snapDoc?.paciente?.email);

          const pacienteTemNovosDados = Boolean(
            pacienteCadastrado && (
              (temValorValido(pacienteCadastrado.cpf) && (!temValorValido(snapDoc?.paciente?.cpf) || snapDoc?.paciente?.cpf !== pacienteCadastrado.cpf)) ||
              (temValorValido(pacienteCadastrado.telefone) && (!temValorValido(snapDoc?.paciente?.telefone) || snapDoc?.paciente?.telefone !== pacienteCadastrado.telefone)) ||
              (temValorValido(pacienteCadastrado.endereco) && (!temValorValido(snapDoc?.paciente?.endereco) || snapDoc?.paciente?.endereco !== pacienteCadastrado.endereco)) ||
              (temValorValido(pacienteCadastrado.email) && (!temValorValido(snapDoc?.paciente?.email) || snapDoc?.paciente?.email !== pacienteCadastrado.email)) ||
              (temValorValido(pacienteCadastrado.rg) && (!temValorValido(snapDoc?.paciente?.rg) || snapDoc?.paciente?.rg !== pacienteCadastrado.rg))
            )
          );

          const requerAtualizacao =
            temClinicaPlaceholder ||
            (temPacientePlaceholder && pacienteTemNovosDados) ||
            valExistente?.divergenciaFinanceira ||
            (totalOrc > 0 && Math.abs(totalOrc - totalSnap) > 0.05) ||
            (formasOrc && formasSnap && formasOrc !== formasSnap);

          if (requerAtualizacao) {
            const snapAtualizado = mapearDadosContrato({
              patient: pacienteCadastrado || patient,
              orcamento: orcamentoAtual,
              transacoes: transacoesOrcamento,
              configuracoes,
              configContrato,
              dentistaNome: selectedDentistaNome || configContrato?.dentistaResponsavelContrato || configuracoes?.croResponsavel,
              dentistaCro: dentistaAtual?.cro || configContrato?.croResponsavelContrato || configuracoes?.croResponsavel,
              cidadeLocal: cidadeLocal || configContrato?.cidadeForoContrato,
              dadosRestauracoesPreexistentes: (pacienteCadastrado || patient)?.restauracoesPreexistentes,
            });

            if (snapDoc.contratoId) snapAtualizado.contratoId = snapDoc.contratoId;
            if (snapDoc.token) snapAtualizado.token = snapDoc.token;
            if (snapDoc.assinaturaDentista) {
              snapAtualizado.assinaturaDentista = snapDoc.assinaturaDentista;
              snapAtualizado.statusAssinaturaDentista = snapDoc.statusAssinaturaDentista;
            }

            setSnapshotAtual(snapAtualizado);
            setDocumentoIdSendoEditado(contratoExistenteOrcamento.id);
          } else {
            // Mesmo se não requerer recriação completa, mescla os dados cadastrais do paciente atualizados se o contrato não foi assinado
            const endCad = formatarEnderecoCompleto(pacienteCadastrado) || (temValorValido(pacienteCadastrado?.endereco) ? pacienteCadastrado.endereco : '');
            const snapMesclado: ContratoSnapshot = {
              ...snapDoc,
              paciente: {
                ...snapDoc.paciente,
                nome: pacienteCadastrado?.nome || snapDoc?.paciente?.nome || 'Nome não informado',
                cpf: temValorValido(pacienteCadastrado?.cpf) ? formatarDocumento(pacienteCadastrado.cpf) : (temValorValido(snapDoc?.paciente?.cpf) ? snapDoc.paciente.cpf : 'Não informado'),
                rg: temValorValido(pacienteCadastrado?.rg) ? String(pacienteCadastrado.rg).trim() : (snapDoc?.paciente?.rg || ''),
                telefone: temValorValido(pacienteCadastrado?.telefone) ? formatarTelefone(pacienteCadastrado.telefone) : (temValorValido(snapDoc?.paciente?.telefone) ? snapDoc.paciente.telefone : 'Não informado'),
                email: temValorValido(pacienteCadastrado?.email) ? pacienteCadastrado.email : (temValorValido(snapDoc?.paciente?.email) ? snapDoc.paciente.email : 'Não informado'),
                endereco: temValorValido(endCad) ? endCad : (temValorValido(snapDoc?.paciente?.endereco) ? snapDoc.paciente.endereco : 'Não informado'),
                dataNascimento: temValorValido(pacienteCadastrado?.dataNascimento || (pacienteCadastrado as any)?.data_nascimento) ? formatarData(pacienteCadastrado.dataNascimento || (pacienteCadastrado as any).data_nascimento) : (snapDoc?.paciente?.dataNascimento || 'Não informada'),
                profissao: temValorValido(pacienteCadastrado?.profissao) ? String(pacienteCadastrado.profissao).trim() : (snapDoc?.paciente?.profissao || ''),
                estadoCivil: temValorValido(pacienteCadastrado?.estadoCivil || (pacienteCadastrado as any)?.estado_civil) ? String(pacienteCadastrado.estadoCivil || (pacienteCadastrado as any).estado_civil).trim() : (snapDoc?.paciente?.estadoCivil || ''),
              }
            };
            setSnapshotAtual(snapMesclado);
          }
        } else {
          setSnapshotAtual(snapDoc);
        }
      }
    } else {
      setContratoVisualizacao(null);
    }
  }, [
    isOpen,
    contratoExistenteOrcamento,
    isManuallyEdited,
    orcamentoAtual,
    patient,
    pacientes,
    transacoesOrcamento,
    configuracoes,
    configContrato,
    selectedDentistaNome,
    dentistaAtual,
    cidadeLocal,
  ]);

  // Checagens granulares de status de assinatura
  const hasAssinaturaPaciente = useMemo(() => {
    if (contratoVisualizacao) {
      const snapItens = (contratoVisualizacao.itens || {}) as any;
      return Boolean(
        contratoVisualizacao.assinaturaData ||
        contratoVisualizacao.assinadoEm ||
        snapItens.assinaturaPaciente?.assinaturaData ||
        snapItens.status === 'formalizado' ||
        contratoVisualizacao.status === 'formalizado'
      );
    }
    return Boolean(
      snapshotAtual?.assinaturaPaciente?.assinaturaData ||
      snapshotAtual?.status === 'assinado' ||
      snapshotAtual?.status === 'formalizado'
    );
  }, [contratoVisualizacao, snapshotAtual]);

  const hasAssinaturaProfissional = useMemo(() => {
    if (contratoVisualizacao) {
      const snapItens = (contratoVisualizacao.itens || {}) as any;
      return Boolean(
        snapItens.assinaturaDentista?.assinaturaData ||
        snapItens.statusAssinaturaDentista === 'assinado'
      );
    }
    return Boolean(
      snapshotAtual?.assinaturaDentista?.assinaturaData ||
      snapshotAtual?.statusAssinaturaDentista === 'assinado'
    );
  }, [contratoVisualizacao, snapshotAtual]);

  const isFormalizadoBilateral = useMemo(() => {
    return Boolean(hasAssinaturaPaciente && hasAssinaturaProfissional);
  }, [hasAssinaturaPaciente, hasAssinaturaProfissional]);

  // Validação em tempo real da integridade matemática e financeira entre orçamento e contrato
  const validacaoIntegridade = useMemo(() => {
    if (!snapshotAtual) return null;
    return validarIntegridadeOrcamentoContrato(orcamentoAtual, snapshotAtual);
  }, [snapshotAtual, orcamentoAtual]);

  // Identifica se o contrato exibido já está oficialmente gravado e sem pendências de retificação
  const isContratoGravado = useMemo(() => {
    // 1. Contratos formalizados ou assinados pelo paciente são juridicamente imutáveis e permanecem SEMPRE gravados,
    // mesmo se houver qualquer tentativa de edição manual ou flag isManuallyEdited ativa em memória.
    const isFormalizadoOuAssinado = Boolean(
      hasAssinaturaPaciente ||
      contratoVisualizacao?.assinadoEm ||
      contratoExistenteOrcamento?.assinadoEm ||
      contratoVisualizacao?.status === 'formalizado' ||
      contratoExistenteOrcamento?.status === 'formalizado' ||
      snapshotAtual?.status === 'formalizado' ||
      snapshotAtual?.status === 'assinado' ||
      snapshotAtual?.assinaturaPaciente?.assinaturaData
    );
    if (isFormalizadoOuAssinado) {
      return true;
    }

    // 2. Em contratos pendentes (não assinados pelo paciente), se houver edição manual ativa, retificação em andamento
    // ou divergência financeira identificada, o contrato requer gravação.
    if (documentoIdSendoEditado || isManuallyEdited) {
      return false;
    }
    if (validacaoIntegridade?.divergenciaFinanceira) {
      return false;
    }

    // 3. Minuta pendente já persistida no banco sem pendência de retificação
    return Boolean(contratoVisualizacao?.id || contratoExistenteOrcamento?.id);
  }, [documentoIdSendoEditado, isManuallyEdited, contratoVisualizacao, contratoExistenteOrcamento, snapshotAtual, validacaoIntegridade, hasAssinaturaPaciente]);

  // Sincroniza campos rápidos quando snapshot ou patient mudar
  useEffect(() => {
    const pacFonte = (patient?.id && pacientes?.find((p) => p.id === patient.id)) ||
      (patient?.nome && pacientes?.find((p) => p.nome && p.nome.trim().toLowerCase() === patient.nome.trim().toLowerCase())) ||
      patient;

    const cpfFonte = temValorValido(pacFonte?.cpf)
      ? pacFonte.cpf
      : (temValorValido(snapshotAtual?.paciente?.cpf) ? snapshotAtual.paciente.cpf : '');
    setQuickCpf(cpfFonte || '');

    const endFonte = formatarEnderecoCompleto(pacFonte) || (temValorValido(pacFonte?.endereco) ? pacFonte.endereco : '')
      || (temValorValido(snapshotAtual?.paciente?.endereco) ? snapshotAtual.paciente.endereco : '');
    setQuickEndereco(endFonte || '');

    const telFonte = temValorValido(pacFonte?.telefone)
      ? pacFonte.telefone
      : (temValorValido(snapshotAtual?.paciente?.telefone) ? snapshotAtual.paciente.telefone : '');
    setQuickTelefone(telFonte || '');
  }, [patient, pacientes, snapshotAtual?.paciente?.cpf, snapshotAtual?.paciente?.endereco, snapshotAtual?.paciente?.telefone]);

  // Hidrata dados do paciente caso estejam ausentes no momento da abertura
  useEffect(() => {
    const rawId = patient?.id;
    if (!isOpen) return;

    const isAssinado = Boolean(
      snapshotAtual?.status === 'formalizado' ||
      snapshotAtual?.status === 'assinado' ||
      snapshotAtual?.assinaturaPaciente?.assinaturaData ||
      contratoVisualizacao?.assinadoEm
    );
    if (isAssinado) return;

    const snapCpfFaltando = !temValorValido(snapshotAtual?.paciente?.cpf);
    const snapEndFaltando = !temValorValido(snapshotAtual?.paciente?.endereco);
    const snapTelFaltando = !temValorValido(snapshotAtual?.paciente?.telefone);
    const snapEmailFaltando = !temValorValido(snapshotAtual?.paciente?.email);

    const cpfFaltando = snapCpfFaltando || !temValorValido(patient?.cpf);
    const endFaltando = snapEndFaltando || !temValorValido(patient?.endereco);
    const telFaltando = snapTelFaltando || !temValorValido(patient?.telefone);
    const emailFaltando = snapEmailFaltando || !temValorValido(patient?.email);

    if (cpfFaltando || endFaltando || telFaltando || emailFaltando) {
      // 1. Tenta carregar do DentalSystemContext (pacientes)
      const pacContext = (rawId && pacientes?.find((p) => p.id === rawId)) ||
        (patient?.nome && pacientes?.find((p) => p.nome && p.nome.trim().toLowerCase() === patient.nome.trim().toLowerCase()));

      if (pacContext) {
        const endCtx = formatarEnderecoCompleto(pacContext) || (temValorValido(pacContext.endereco) ? pacContext.endereco : '');
        setSnapshotAtual((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            paciente: {
              ...prev.paciente,
              cpf: temValorValido(pacContext.cpf) ? formatarDocumento(pacContext.cpf) : prev.paciente.cpf,
              endereco: temValorValido(endCtx) ? endCtx : prev.paciente.endereco,
              telefone: temValorValido(pacContext.telefone) ? formatarTelefone(pacContext.telefone) : prev.paciente.telefone,
              email: temValorValido(pacContext.email) ? pacContext.email : prev.paciente.email,
              rg: temValorValido(pacContext.rg) ? pacContext.rg : prev.paciente.rg,
            },
          };
        });
      }

      // 2. Tenta carregar do localStorage
      try {
        const raw = localStorage.getItem('dental-system-pacientes');
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const achado = arr.find((p: any) => (rawId && p.id === rawId) || (p.nome && patient?.nome && p.nome.trim().toLowerCase() === patient.nome.trim().toLowerCase()));
            if (achado) {
              const endAchado = formatarEnderecoCompleto(achado) || (temValorValido(achado.endereco) ? achado.endereco : '');
              setSnapshotAtual((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  paciente: {
                    ...prev.paciente,
                    cpf: !temValorValido(prev.paciente.cpf) && temValorValido(achado.cpf) ? formatarDocumento(achado.cpf) : prev.paciente.cpf,
                    endereco: !temValorValido(prev.paciente.endereco) && temValorValido(endAchado) ? endAchado : prev.paciente.endereco,
                    telefone: !temValorValido(prev.paciente.telefone) && temValorValido(achado.telefone) ? formatarTelefone(achado.telefone) : prev.paciente.telefone,
                    email: !temValorValido(prev.paciente.email) && temValorValido(achado.email) ? achado.email : prev.paciente.email,
                    rg: temValorValido(achado.rg) ? achado.rg : prev.paciente.rg,
                  },
                };
              });
            }
          }
        }
      } catch (_) {}

      // 3. Tenta carregar do Supabase
      if (rawId || patient?.nome) {
        let q = supabase.from('pacientes').select('*');
        if (rawId) q = q.eq('id', rawId);
        else if (patient?.nome) q = q.ilike('nome', patient.nome.trim());

        q.maybeSingle()
          .then(({ data: pDb }) => {
            if (pDb) {
              const endDb = formatarEnderecoCompleto(pDb) || (temValorValido(pDb.endereco) ? pDb.endereco : '');
              setSnapshotAtual((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  paciente: {
                    ...prev.paciente,
                    cpf: !temValorValido(prev.paciente.cpf) && temValorValido(pDb.cpf) ? formatarDocumento(pDb.cpf) : prev.paciente.cpf,
                    endereco: !temValorValido(prev.paciente.endereco) && temValorValido(endDb) ? endDb : prev.paciente.endereco,
                    telefone: !temValorValido(prev.paciente.telefone) && temValorValido(pDb.telefone) ? formatarTelefone(pDb.telefone) : prev.paciente.telefone,
                    email: !temValorValido(prev.paciente.email) && temValorValido(pDb.email) ? pDb.email : prev.paciente.email,
                    rg: temValorValido(pDb.rg) ? pDb.rg : prev.paciente.rg,
                  },
                };
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [patient?.id, patient?.nome, isOpen, pacientes]);

  const handleSalvarDadosPacienteRapido = async () => {
    if (!quickCpf && !quickEndereco && !quickTelefone) {
      toast.error('Preencha ao menos o CPF ou o Endereço do paciente.');
      return;
    }
    setSalvandoDadosPaciente(true);
    try {
      const updates: any = {};
      if (quickCpf.trim()) updates.cpf = quickCpf.trim();
      if (quickEndereco.trim()) updates.endereco = quickEndereco.trim();
      if (quickTelefone.trim()) updates.telefone = quickTelefone.trim();

      if (patient?.id && updatePaciente) {
        await updatePaciente(patient.id, updates);
      }

      setSnapshotAtual((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          paciente: {
            ...prev.paciente,
            cpf: quickCpf.trim() ? formatarDocumento(quickCpf.trim()) : prev.paciente.cpf,
            endereco: quickEndereco.trim() ? quickEndereco.trim() : prev.paciente.endereco,
            telefone: quickTelefone.trim() ? formatarTelefone(quickTelefone.trim()) : prev.paciente.telefone,
          },
        };
      });

      if (patient) {
        if (quickCpf.trim()) patient.cpf = quickCpf.trim();
        if (quickEndereco.trim()) patient.endereco = quickEndereco.trim();
        if (quickTelefone.trim()) patient.telefone = quickTelefone.trim();
      }

      toast.success('Dados do paciente salvos com sucesso e atualizados no contrato!');
      setShowQuickFill(false);
    } catch (err: any) {
      toast.error('Erro ao salvar dados do paciente: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSalvandoDadosPaciente(false);
    }
  };

  // Atalho para sair da tela cheia com a tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        e.preventDefault();
        e.stopPropagation();
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFullScreen]);

  const [sincronizandoFinanceiro, setSincronizandoFinanceiro] = useState(false);

  const handleSincronizarFinanceiroComContrato = async () => {
    if (!orcamentoAtual || !snapshotAtual) return;
    try {
      setSincronizandoFinanceiro(true);
      const transPagas = transacoesOrcamento.filter((t: any) => t.status === 'pago');
      for (const t of transacoesOrcamento) {
        if (t.status !== 'pago') {
          try {
            await deleteTransacao(t.id);
          } catch (e) {
            console.error('Erro ao deletar transação antiga:', e);
          }
        }
      }

      const configMaquinas = carregarConfiguracoesMaquinasSync(null);
      let totalTaxasCartao = 0;
      let totalTaxasCartaoQuitadas = 0;
      let operadoraTaxasNome = '';

      for (const p of snapshotAtual.financeiro.parcelas) {
        const isEntrada = (p?.descricao || '').toLowerCase().includes('entrada');
        const jaPaga = transPagas.some((jp: any) => 
          jp.descricao === `${orcamentoAtual.titulo}: ${p.descricao}` ||
          (isEntrada && (jp.descricao || '').toLowerCase().includes('entrada'))
        );
        if (jaPaga) continue;

        let dataVenc = new Date();
        if (p.vencimento && p.vencimento.includes('/')) {
          const [dia, mes, ano] = p.vencimento.split('/');
          dataVenc = new Date(Number(ano), Number(mes) - 1, Number(dia), 12, 0, 0);
        } else {
          const parcIdxMatch = (p.descricao || '').match(/\((\d+)\/\d+/);
          const mesOffset = parcIdxMatch ? Number(parcIdxMatch[1]) : (typeof p.numero === 'number' ? p.numero : 1);
          dataVenc = somarMesesSeguro(new Date(), mesOffset);
        }

        let metodoFinal: any = 'pix';
        const descLower = (p.metodo || p.descricao || '').toLowerCase();
        const isCartao = descLower.includes('cartao') || descLower.includes('cartão') || descLower.includes('crédito') || descLower.includes('debito');
        if (isCartao) {
          metodoFinal = 'cartao';
        } else if (descLower.includes('pix_parcelado') || descLower.includes('pix mensal') || descLower.includes('pix parcelado')) {
          metodoFinal = 'pix_parcelado';
        } else if (descLower.includes('pix')) {
          metodoFinal = 'pix';
        } else if (descLower.includes('dinheiro')) {
          metodoFinal = 'dinheiro';
        } else if (descLower.includes('boleto')) {
          metodoFinal = 'boleto';
        } else if (descLower.includes('transferencia') || descLower.includes('transferência')) {
          metodoFinal = 'transferencia';
        }

        const isQuitada = (p?.status || '').toLowerCase().includes('quitad') || (p?.status || '').toLowerCase().includes('pago');

        let taxaPercItem: number | undefined = undefined;
        let taxaValorItem: number | undefined = undefined;
        let liquidoItem: number | undefined = undefined;

        if (isCartao) {
          const infoCartao = extrairDetalhesCartaoDeTexto(
            `${orcamentoAtual.formasPagamento || orcamentoAtual.formas_pagamento || ''} ${p.descricao || ''}`,
            configMaquinas.operadoras,
            configMaquinas.operadoraPadraoId
          );
          const op = infoCartao.operadora || configMaquinas.operadoras[0];
          operadoraTaxasNome = op?.nome || 'Cartão';
          const calc = calcularTaxaCartao(op, infoCartao.parcelas, Number(p.valor || 0), infoCartao.isDebito);
          taxaPercItem = calc.taxaPercentual;
          taxaValorItem = calc.taxaValor;
          liquidoItem = calc.valorLiquido;
          
          if (isQuitada && calc.taxaValor > 0) {
            totalTaxasCartaoQuitadas += calc.taxaValor;
          }
        }

        await addTransacao({
          pacienteId: patient.id,
          valor: p.valor,
          tipo: 'receita',
          status: isQuitada ? 'pago' : 'pendente',
          metodoPagamento: metodoFinal,
          data: new Date(),
          vencimento: dataVenc,
          descricao: `${orcamentoAtual.titulo}: ${p.descricao}`,
          categoria: 'Tratamentos',
          orcamentoId: orcamentoAtual.id,
          taxaCartaoPercentual: taxaPercItem,
          taxaCartaoValor: taxaValorItem,
          valorLiquido: liquidoItem,
        });
      }

      if (configMaquinas.lancarTaxaComoDespesa !== false && totalTaxasCartaoQuitadas > 0) {
        const catDespesa = configMaquinas.categoriaDespesaPadrao || 'Taxas de Cartão';
        await addTransacao({
          pacienteId: patient.id,
          valor: Number(totalTaxasCartaoQuitadas.toFixed(2)),
          tipo: 'despesa',
          status: 'pago',
          metodoPagamento: 'cartao',
          data: new Date(),
          vencimento: new Date(),
          descricao: `Taxa da Máquina (${operadoraTaxasNome}) - Contrato: ${orcamentoAtual.titulo}`,
          categoria: catDespesa,
          orcamentoId: orcamentoAtual.id,
        });
        toast.success(`Financeiro sincronizado! Receitas geradas e taxa de ${formatMoney(totalTaxasCartaoQuitadas)} da maquininha (${operadoraTaxasNome}) lançada como DESPESA no Caixa!`);
      } else {
        toast.success('Financeiro sincronizado com sucesso com as parcelas do orçamento (Vendas e A Receber atualizados)!');
      }
    } catch (err) {
      console.error('Erro ao sincronizar financeiro:', err);
      toast.error('Erro ao sincronizar parcelas no Financeiro');
    } finally {
      setSincronizandoFinanceiro(false);
    }
  };

  // Inicializa ou atualiza o snapshot automaticamente para novo contrato (caso não exista contrato gravado e não tenha edições manuais)
  useEffect(() => {
    if (isManuallyEdited || contratoExistenteOrcamento || contratoVisualizacao) return;
    if (!patient || !orcamentoAtual) {
      setSnapshotAtual(null);
      return;
    }

    const snap = mapearDadosContrato({
      patient,
      orcamento: orcamentoAtual,
      transacoes: transacoesOrcamento,
      configuracoes,
      configuracoesContrato: configContrato,
      dentistaNome: selectedDentistaNome || configContrato?.dentistaResponsavelContrato || configuracoes?.croResponsavel,
      dentistaCro: dentistaAtual?.cro || configContrato?.croResponsavelContrato || configuracoes?.croResponsavel,
      cidadeLocal: cidadeLocal || configContrato?.cidadeForoContrato,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
    });

    setSnapshotAtual(snap);
  }, [
    isManuallyEdited,
    contratoExistenteOrcamento,
    contratoVisualizacao,
    patient,
    orcamentoAtual,
    transacoesOrcamento,
    configuracoes,
    configContrato,
    selectedDentistaNome,
    dentistaAtual,
    cidadeLocal,
  ]);

  // Sincroniza as condições de pagamento negociadas do orçamento
  useEffect(() => {
    if (orcamentoAtual?.formasPagamento) {
      const parsed = parseCondicoesPagamento(orcamentoAtual.formasPagamento, orcamentoAtual.total);
      setCondicoesContrato(parsed);
      const sel = parsed.find((c) => c.selecionada) || parsed[0];
      if (sel) {
        setCondicaoContratoAtivaId(sel.id);
      }
    } else {
      setCondicoesContrato([]);
      setCondicaoContratoAtivaId('');
    }
  }, [orcamentoAtual?.id, orcamentoAtual?.formasPagamento, orcamentoAtual?.total]);

  const handleTrocarCondicaoContrato = async (id: string) => {
    if (!orcamentoAtual) return;
    setCondicaoContratoAtivaId(id);
    const atualizadas = condicoesContrato.map((c) => ({
      ...c,
      selecionada: c.id === id,
    }));
    setCondicoesContrato(atualizadas);
    const novoJson = serializarCondicoesPagamento(atualizadas, id);

    const orcAtualizado: Orcamento = {
      ...orcamentoAtual,
      formasPagamento: novoJson,
    };
    if (saveOrcamento) {
      try {
        await saveOrcamento(orcAtualizado);
      } catch (e) {
        console.error('Erro ao atualizar orcamento com nova condicao:', e);
      }
    }

    const snap = mapearDadosContrato({
      patient,
      orcamento: orcAtualizado,
      transacoes: transacoesOrcamento,
      configuracoes,
      configuracoesContrato: configContrato,
      dentistaNome: selectedDentistaNome || configContrato?.dentistaResponsavelContrato || configuracoes?.croResponsavel,
      dentistaCro: dentistaAtual?.cro || configContrato?.croResponsavelContrato || configuracoes?.croResponsavel,
      cidadeLocal: cidadeLocal || configContrato?.cidadeForoContrato,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
    });
    setSnapshotAtual(snap);
    toast.success('Condição de pagamento do contrato atualizada!');
  };

  const handleSalvarFlexibilizacaoContrato = async () => {
    if (!condicaoFlexibilizarContrato || !orcamentoAtual) return;
    const descAuto = calcularDescricaoCondicao(condicaoFlexibilizarContrato, condicaoFlexibilizarContrato.valorTotal || orcamentoAtual.total);
    const finalCond: CondicaoPagamento = {
      id: condicaoFlexibilizarContrato.id || String(Date.now()),
      titulo: condicaoFlexibilizarContrato.titulo?.trim() || 'Opção Ajustada',
      tipo: condicaoFlexibilizarContrato.tipo || 'personalizado',
      descontoPercentual: condicaoFlexibilizarContrato.descontoPercentual,
      descontoValor: condicaoFlexibilizarContrato.descontoValor,
      valorTotal: condicaoFlexibilizarContrato.valorTotal || orcamentoAtual.total,
      parcelas: condicaoFlexibilizarContrato.parcelas,
      valorParcela: condicaoFlexibilizarContrato.valorParcela,
      valorEntrada: condicaoFlexibilizarContrato.valorEntrada,
      metodoEntrada: condicaoFlexibilizarContrato.metodoEntrada,
      saldoParcelas: condicaoFlexibilizarContrato.saldoParcelas,
      saldoMetodo: condicaoFlexibilizarContrato.saldoMetodo,
      saldoValorParcela: condicaoFlexibilizarContrato.saldoValorParcela,
      diaVencimento: condicaoFlexibilizarContrato.diaVencimento,
      tipoCartao: condicaoFlexibilizarContrato.tipoCartao,
      descricao: condicaoFlexibilizarContrato.descricao?.trim() || descAuto,
      destaque: true,
      selecionada: true,
    };

    const atualizadas = condicoesContrato.map((c) => (c.id === finalCond.id ? finalCond : { ...c, selecionada: false }));
    if (!atualizadas.some((c) => c.id === finalCond.id)) {
      atualizadas.push(finalCond);
    }
    setCondicoesContrato(atualizadas);
    setCondicaoContratoAtivaId(finalCond.id);
    const novoJson = serializarCondicoesPagamento(atualizadas, finalCond.id);

    const orcAtualizado: Orcamento = {
      ...orcamentoAtual,
      total: finalCond.valorTotal || orcamentoAtual.total,
      formasPagamento: novoJson,
      condicaoEscolhida: finalCond,
    };
    if (saveOrcamento) {
      try {
        await saveOrcamento(orcAtualizado);
      } catch (e) {
        console.error('Erro ao salvar orcamento flexibilizado:', e);
      }
    }

    const snap = mapearDadosContrato({
      patient,
      orcamento: orcAtualizado,
      transacoes: [], // recalcula parcelas e cronograma atualizados a partir da nova condição definida
      configuracoes,
      configuracoesContrato: configContrato,
      dentistaNome: selectedDentistaNome || configContrato?.dentistaResponsavelContrato || configuracoes?.croResponsavel,
      dentistaCro: dentistaAtual?.cro || configContrato?.croResponsavelContrato || configuracoes?.croResponsavel,
      cidadeLocal: cidadeLocal || configContrato?.cidadeForoContrato,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
    });

    if (snapshotAtual?.contratoId) snap.contratoId = snapshotAtual.contratoId;
    if (snapshotAtual?.token) snap.token = snapshotAtual.token;
    if (snapshotAtual?.assinaturaDentista) {
      snap.assinaturaDentista = snapshotAtual.assinaturaDentista;
      snap.statusAssinaturaDentista = snapshotAtual.statusAssinaturaDentista;
    }

    setSnapshotAtual(snap);
    setIsManuallyEdited(true);

    const novoHtml = gerarHtmlContrato(snap);
    if (contratoVisualizacao) {
      setContratoVisualizacao((prev: any) => ({
        ...prev,
        conteudo: novoHtml,
        itens: snap,
      }));
    }

    // Persiste atualização no banco para documento existente em elaboração
    const targetDocId = documentoIdSendoEditado || contratoVisualizacao?.id || contratoExistenteOrcamento?.id;
    if (targetDocId && supabase) {
      try {
        await supabase
          .from('documentos_clinicos')
          .update({
            conteudo: novoHtml,
            itens: snap,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', targetDocId);
      } catch (errDb) {
        console.warn('Erro ao atualizar documento clínico com nova flexibilização:', errDb);
      }
    }

    setModalFlexibilizarContratoOpen(false);
    toast.success('Condições de pagamento e cronograma do contrato atualizados com sucesso!');
  };

  // Identifica se o contrato inclui lentes em resina composta e as cláusulas específicas
  const temLentesResinaNoContrato = useMemo(() => {
    if (!snapshotAtual) return false;
    return isContratoLenteResina(snapshotAtual);
  }, [snapshotAtual]);

  // Identifica se o contrato é específico para Tratamento Endodôntico (Tratamento de Canal)
  const temEndodontiaNoContrato = useMemo(() => {
    if (!snapshotAtual) return false;
    return isContratoEndodontia(snapshotAtual);
  }, [snapshotAtual]);

  // HTML renderizado do contrato atual a partir dos dados do snapshot em memória
  const htmlContratoAtual = useMemo(() => {
    if (!snapshotAtual) return '';
    return gerarHtmlContrato(snapshotAtual);
  }, [snapshotAtual]);

  // Flag que identifica se há edição manual ativa ou restauração de padrão autorizada em contrato pendente (não formalizado)
  const isEmModoEdicaoOuRetificacao = Boolean(
    (isManuallyEdited || documentoIdSendoEditado) &&
    !hasAssinaturaPaciente &&
    !contratoVisualizacao?.assinadoEm
  );

  // HTML da prévia exibido nos visualizadores (Padrão A4 e Modo Tela Cheia):
  // 1. Contratos formalizados com assinatura do paciente NUNCA exibem HTML recalculado em memória (preserva imutabilidade legal)
  // 2. Em contratos em elaboração/não assinados, exibe o HTML em tempo real gerado pelo motor com as condições atuais
  const htmlPreview = useMemo(() => {
    if (hasAssinaturaPaciente || contratoVisualizacao?.assinadoEm) {
      return contratoVisualizacao?.conteudo || '';
    }
    if (htmlContratoAtual) {
      return htmlContratoAtual;
    }
    return contratoVisualizacao?.conteudo || '';
  }, [hasAssinaturaPaciente, contratoVisualizacao, htmlContratoAtual]);

  // Validação de campos cadastrais indispensáveis
  const pendenciasCadastrais = useMemo(() => {
    const pendencias: string[] = [];
    const cpfAtual = snapshotAtual?.paciente?.cpf || patient?.cpf;
    if (!temValorValido(cpfAtual) || cpfAtual === 'Não informado') pendencias.push('CPF');
    // RG e Estado Civil são opcionais e não bloqueiam a geração/assinatura do contrato
    const endAtual = snapshotAtual?.paciente?.endereco || patient?.endereco;
    if (!temValorValido(endAtual) || endAtual === 'Não informado') pendencias.push('Endereço');
    const telAtual = snapshotAtual?.paciente?.telefone || patient?.telefone;
    if (!temValorValido(telAtual) || telAtual === 'Não informado') pendencias.push('Telefone');
    return pendencias;
  }, [patient, snapshotAtual?.paciente?.cpf, snapshotAtual?.paciente?.endereco, snapshotAtual?.paciente?.telefone]);

  // Validação de intervalo de parcelas (ex: Outubro -> Dezembro sem Novembro)
  const alertaIntervaloParcelas = useMemo(() => {
    const parcelas = snapshotAtual?.financeiro?.parcelas || [];
    if (parcelas.length < 2) return null;

    for (let i = 0; i < parcelas.length - 1; i++) {
      const p1 = parcelas[i];
      const p2 = parcelas[i + 1];

      // Quando for cartão de crédito ou constar 'Fatura do Cartão', não possui vencimento fixo pela clínica e não deve alertar intervalo
      const isCartao = (p: typeof p1) =>
        isMetodoCartao(p.metodo, p.descricao) ||
        (p.vencimento && /fatura/i.test(p.vencimento));

      if (isCartao(p1) || isCartao(p2)) {
        continue;
      }

      if (p1.vencimento && p2.vencimento && p1.vencimento.includes('/') && p2.vencimento.includes('/')) {
        const [, m1, a1] = p1.vencimento.split('/').map(Number);
        const [, m2, a2] = p2.vencimento.split('/').map(Number);
        if (!isNaN(m1) && !isNaN(m2) && !isNaN(a1) && !isNaN(a2)) {
          const mesesDiff = (a2 - a1) * 12 + (m2 - m1);
          if (mesesDiff > 1) {
            return `Aviso de Cronograma: A parcela ${p1.numero} vence em ${p1.vencimento} e a parcela ${p2.numero} vence em ${p2.vencimento} (intervalo de ${mesesDiff} meses, pulando mês intermediário). Confirme se esse intervalo foi realmente combinado com o(a) paciente.`;
          }
        }
      }
    }
    return null;
  }, [snapshotAtual?.financeiro?.parcelas]);

  // Atualização granular de campos no snapshot manual
  const handleUpdateSnapshotField = (campo: string, valor: any) => {
    setIsManuallyEdited(true);
    const docPendenteAlvo = contratoVisualizacao || contratoExistenteOrcamento;
    if (!documentoIdSendoEditado && docPendenteAlvo && !docPendenteAlvo.assinadoEm && !hasAssinaturaPaciente) {
      setDocumentoIdSendoEditado(docPendenteAlvo.id);
    }
    setSnapshotAtual((prev) => {
      if (!prev) return prev;
      const partes = campo.split('.');
      if (partes.length === 1) {
        return { ...prev, [partes[0]]: valor };
      }
      if (partes.length === 2) {
        return {
          ...prev,
          [partes[0]]: {
            ...(prev as any)[partes[0]],
            [partes[1]]: valor,
          },
        };
      }
      return prev;
    });
  };

  // Troca de orçamento via seletor
  const handleTrocarOrcamento = (novoOrcamentoId: string) => {
    setSelectedOrcamentoId(novoOrcamentoId);
    setIsManuallyEdited(false);
    setDocumentoIdSendoEditado(null);
    setContratoVisualizacao(null);
  };

  // Restaura dados automáticos do sistema com suporte a retificação segura
  const handleRestaurarPadrao = () => {
    if (!patient || !orcamentoAtual) return;

    const docPendenteExistente = contratoVisualizacao || contratoExistenteOrcamento;
    const isPendenteSemAssinatura = docPendenteExistente && !docPendenteExistente.assinadoEm && !hasAssinaturaPaciente;

    if (isPendenteSemAssinatura && docPendenteExistente?.id) {
      setDocumentoIdSendoEditado(docPendenteExistente.id);
      setIsManuallyEdited(true);
    } else {
      setIsManuallyEdited(false);
      setDocumentoIdSendoEditado(null);
    }

    const snap = mapearDadosContrato({
      patient,
      orcamento: orcamentoAtual,
      transacoes: transacoesOrcamento,
      configuracoes,
      configuracoesContrato: configContrato,
      dentistaNome: selectedDentistaNome || configContrato?.dentistaResponsavelContrato || configuracoes?.croResponsavel,
      dentistaCro: dentistaAtual?.cro || configContrato?.croResponsavelContrato || configuracoes?.croResponsavel,
      cidadeLocal: cidadeLocal || configContrato?.cidadeForoContrato,
      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
      autorizacaoProfissional: autorizacaoAtiva,
    });

    // Preserva o identificador CTR oficial do contrato existente
    if (docPendenteExistente) {
      const snapExistente = (docPendenteExistente.itens || {}) as any;
      if (docPendenteExistente.identificador || snapExistente.contratoId) {
        snap.contratoId = docPendenteExistente.identificador || snapExistente.contratoId;
      }
    }

    setSnapshotAtual(snap);
    toast.success('Valores padrão do sistema restaurados com sucesso.');
  };

  // Descarta alterações não salvas e volta a apresentar o documento oficial persistido
  const handleDescartarEdicao = () => {
    if (contratoVisualizacao?.itens && typeof contratoVisualizacao.itens === 'object') {
      setSnapshotAtual(contratoVisualizacao.itens as ContratoSnapshot);
    }
    setIsManuallyEdited(false);
    setDocumentoIdSendoEditado(null);
    toast.info('Alterações não salvas descartadas. Exibindo documento oficial gravado.');
  };

  // Abre o modal de assinatura com guarda estrita contra prévias não salvas e validação cadastral
  const handleAbrirAssinatura = (role: 'paciente' | 'dentista') => {
    if (isEmModoEdicaoOuRetificacao) {
      toast.warning('Salve as alterações do contrato antes de registrar assinaturas.', {
        description: 'Não é possível assinar uma prévia com alterações pendentes de gravação no sistema.',
      });
      return;
    }
    if (role === 'paciente' && pendenciasCadastrais.length > 0) {
      setModalCompletarDadosAdminOpen(true);
      return;
    }
    setSignerRole(role);
    setIsSignatureModalOpen(true);
  };

  // Carrega contrato do histórico para edição
  const handleCarregarContratoParaEdicao = (doc: DocumentoClinico) => {
    const snapItens = (doc.itens || {}) as any;
    const jaAssinado = Boolean(
      doc.assinadoEm ||
      doc.status === 'formalizado' ||
      snapItens.status === 'formalizado' ||
      snapItens.assinaturaPaciente?.assinaturaData
    );
    if (jaAssinado) {
      toast.warning('Este contrato já possui assinaturas válidas registradas e não pode ser editado diretamente.', {
        description: 'Para preservar a segurança jurídica, contratos formalizados ou assinados não podem ser sobrescritos.',
      });
      return;
    }

    if (doc.itens && typeof doc.itens === 'object' && doc.itens.paciente) {
      const snap = { ...(doc.itens as ContratoSnapshot) };
      if (snap.financeiro) {
        snap.financeiro = {
          ...snap.financeiro,
          formaPagamento: limparFormaPagamentoParaContrato(snap.financeiro.formaPagamento),
          metodoParcelamento: snap.financeiro.metodoParcelamento ? limparFormaPagamentoParaContrato(snap.financeiro.metodoParcelamento) : undefined,
          parcelas: (snap.financeiro.parcelas || []).map((p) => {
            if (isMetodoCartao(p.metodo, p.descricao)) {
              return { ...p, vencimento: 'Fatura do Cartão', descricao: limparFormaPagamentoParaContrato(p.descricao), metodo: p.metodo ? limparFormaPagamentoParaContrato(p.metodo) : p.metodo };
            }
            return { ...p, descricao: limparFormaPagamentoParaContrato(p.descricao), metodo: p.metodo ? limparFormaPagamentoParaContrato(p.metodo) : p.metodo };
          }),
        };
      }
      if (snap.orcamento) {
        snap.orcamento = {
          ...snap.orcamento,
          formasPagamento: limparFormaPagamentoParaContrato(snap.orcamento.formasPagamento),
        };
      }
      setSnapshotAtual(snap);
      setDocumentoIdSendoEditado(doc.id);
      setIsManuallyEdited(true);
      setActiveTab('editar');
      toast.info('Contrato carregado para edição manual.');
    } else {
      toast.warning('Este registro foi gerado em formato legado e não possui itens editáveis.');
    }
  };

  // Salva e emite o contrato (novo ou atualização com versionamento)
  const handleEmitirContrato = async () => {
    if (!snapshotAtual) {
      toast.error('Nenhum dado de contrato para emitir.');
      return;
    }

    // Proteção 1: Bloqueia apenas se o contrato já estiver gravado sem nenhuma edição manual ou necessidade de retificação
    const targetDocId = documentoIdSendoEditado || contratoVisualizacao?.id || contratoExistenteOrcamento?.id;
    let docExistente: DocumentoClinico | undefined = undefined;
    if (targetDocId) {
      docExistente = documentos.find((d) => d.id === targetDocId);
    }
    // Fallback defensivo: se não encontrou no array documentos (ex: latência de carregamento), utiliza o objeto em memória
    if (!docExistente && targetDocId) {
      if (contratoVisualizacao?.id === targetDocId) {
        docExistente = contratoVisualizacao;
      } else if (contratoExistenteOrcamento?.id === targetDocId) {
        docExistente = contratoExistenteOrcamento;
      }
    }
    if (!docExistente) {
      docExistente = contratoVisualizacao || contratoExistenteOrcamento || undefined;
    }
    const finalTargetDocId = targetDocId || docExistente?.id;
    const isPendenteNaoAssinado = Boolean(docExistente && !docExistente.assinadoEm && !hasAssinaturaPaciente);
    const temDivergencia = Boolean(validacaoIntegridade?.divergenciaFinanceira);

    if (isContratoGravado && !documentoIdSendoEditado && !isManuallyEdited && !temDivergencia && activeTab !== 'editar') {
      toast.info('Este contrato já está gravado no sistema.', {
        description: `Identificador: ${snapshotAtual.contratoId}`,
      });
      return;
    }

    // Proteção 2: Trava estrita de segurança jurídica - impede sobrescrever contrato formalizado ou assinado
    if (targetDocId && docExistente) {
      const snapExistente = docExistente?.itens as any;
      const jaAssinado = Boolean(
        docExistente?.assinadoEm ||
        docExistente?.status === 'formalizado' ||
        snapExistente?.status === 'formalizado' ||
        snapExistente?.assinaturaPaciente?.assinaturaData
      );

      if (jaAssinado) {
        toast.error('Operação bloqueada: este contrato já possui assinaturas válidas registradas.', {
          description: 'Para preservar a segurança jurídica, contratos formalizados ou assinados não podem ser sobrescritos.',
        });
        return;
      }
    }

    try {
      setSalvando(true);
      if (snapshotAtual.financeiro?.parcelas) {
        snapshotAtual.financeiro.parcelas = snapshotAtual.financeiro.parcelas.map((p) => {
          if (isMetodoCartao(p.metodo, p.descricao)) {
            return { ...p, vencimento: 'Fatura do Cartão' };
          }
          return p;
        });
      }

      // Conciliação automática da entrada:
      // Se houver entrada e as parcelas cadastradas somarem o saldo (somaParcelas + entrada = total),
      // auto-inclui a entrada como Parcela 1 no snapshot para garantir integridade perfeita do cronograma
      let entVal = Number(snapshotAtual.financeiro?.entrada || 0);
      if (entVal === 0 && snapshotAtual.financeiro?.formaPagamento) {
        const matchEnt = snapshotAtual.financeiro.formaPagamento.match(/entrada[^\d\n\r]*?(?:de|:)?\s*(?:r\$)?\s*([\d.,]+)/i);
        if (matchEnt) {
          entVal = parseBrMoney(matchEnt[1]);
          snapshotAtual.financeiro.entrada = entVal;
        }
      }
      if (entVal === 0 && orcamentoAtual) {
        const txtOrc = `${orcamentoAtual.formasPagamento || (orcamentoAtual as any).formas_pagamento || ''} ${orcamentoAtual.condicoes || ''}`;
        const matchEntOrc = txtOrc.match(/entrada[^\d\n\r]*?(?:de|:)?\s*(?:r\$)?\s*([\d.,]+)/i);
        if (matchEntOrc) {
          entVal = parseBrMoney(matchEntOrc[1]);
          snapshotAtual.financeiro.entrada = entVal;
        }
      }

      const totVal = Number(snapshotAtual.financeiro?.total ?? (snapshotAtual.financeiro as any)?.valorTotal ?? 0);
      const parcelasAtuais = snapshotAtual.financeiro?.parcelas || [];
      const somaP = parcelasAtuais.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
      const temEntradaNaLista = parcelasAtuais.some((p) => /entrada|sinal/i.test(p?.descricao || ''));

      if (!temEntradaNaLista && entVal > 0 && Math.abs((somaP + entVal) - totVal) <= 0.05) {
        const descForma = snapshotAtual.financeiro?.formaPagamento || orcamentoAtual?.formasPagamento || '';
        const matchDataEnt = descForma.match(/em\s+(\d{2}\/\d{2}\/\d{4})/i);
        const dataVencEntrada = matchDataEnt ? matchDataEnt[1] : new Date().toLocaleDateString('pt-BR');
        const metodoEnt = /pix/i.test(descForma) ? 'PIX' : /dinheiro/i.test(descForma) ? 'Dinheiro' : 'PIX';
        const isQuitada = /quitada/i.test(descForma) || Boolean(transacoesOrcamento.some(t => /entrada/i.test(t.descricao || '') && (t.status === 'pago' || t.status === 'quitado')));

        snapshotAtual.financeiro.parcelas = [
          {
            numero: 1,
            descricao: `Entrada Inicial (${metodoEnt})`,
            vencimento: dataVencEntrada,
            valor: entVal,
            metodo: metodoEnt,
            status: isQuitada ? 'Quitada' : 'Pendente',
          },
          ...parcelasAtuais.map((p, idx) => ({
            ...p,
            numero: idx + 2,
          })),
        ];
      }

      // Proteção 3: Versionamento estrito e rotação segura de token em caso de retificação de contrato pendente
      let idParaGravar: string | undefined = undefined;
      let snapshotParaSalvar = {
        ...snapshotAtual,
        financeiro: {
          ...snapshotAtual.financeiro,
          entrada: entVal > 0 ? entVal : snapshotAtual.financeiro?.entrada,
          parcelas: snapshotAtual.financeiro?.parcelas || [],
        },
      };

      if ((finalTargetDocId || docExistente) && docExistente && isPendenteNaoAssinado) {
        const snapExistente = (docExistente.itens || {}) as any;
        const versaoAnteriorRaw = snapExistente.versao !== undefined && snapExistente.versao !== null
          ? String(snapExistente.versao).trim()
          : '';

        // Formato seguro da versão anterior (default '1.0' caso não exista ainda no registro)
        const versaoAnteriorValida = (versaoAnteriorRaw && /^\d+(\.\d+)?$/.test(versaoAnteriorRaw))
          ? versaoAnteriorRaw
          : '1.0';

        const versaoAnteriorNum = Number(versaoAnteriorValida);
        const novaVersaoNum = Math.floor(versaoAnteriorNum) + 1;
        const novaVersaoStr = versaoAnteriorValida.includes('.') ? `${novaVersaoNum}.0` : `${novaVersaoNum}`;
        const tokenAntigo = snapExistente.token || snapshotAtual.token;
        const tokensRevogadosAnteriores = Array.isArray(snapExistente.tokensRevogados) ? snapExistente.tokensRevogados : [];
        const tokensRevogadosAtualizados = Array.from(new Set([...tokensRevogadosAnteriores, tokenAntigo].filter(Boolean)));
        const historicoAnterior = Array.isArray(snapExistente.versoesAnteriores) ? snapExistente.versoesAnteriores : [];

        // Rotação segura do token de acesso (invalida o link e token anteriores)
        const novoToken = gerarTokenAcesso();

        // Validação da assinatura profissional para a versão retificada:
        // Apenas aplica assinatura se existir autorização expressa válida da Dra. Rosângela.
        // Caso contrário, exige nova assinatura manual da cirurgiã-dentista.
        let assinaturaDentistaFinal = snapshotParaSalvar.assinaturaDentista;
        const isAutorizacaoValida = Boolean(
          autorizacaoAtiva &&
          autorizacaoAtiva.ativo &&
          !autorizacaoAtiva.revogadoEm &&
          validarAutorizacaoAssinatura(autorizacaoAtiva, snapshotParaSalvar.tipoModeloContrato)
        );

        if (isAutorizacaoValida) {
          assinaturaDentistaFinal = {
            assinaturaData: autorizacaoAtiva.assinaturaGrafica || gerarRubricaPadraoDra(autorizacaoAtiva.profissionalNome, autorizacaoAtiva.profissionalCro),
            nome: autorizacaoAtiva.profissionalNome,
            cro: autorizacaoAtiva.profissionalCro,
            documento: autorizacaoAtiva.profissionalDocumento || '032.663.962-43',
            dataHora: new Date().toISOString(),
            metodo: 'assinatura_automatica_autorizada',
            autorizacaoId: autorizacaoAtiva.id,
            autorizadoEm: autorizacaoAtiva.autorizadoEm || new Date().toISOString(),
            autorizacaoExpressa: true,
          };
        } else {
          // Exige nova assinatura da Dra. caso não haja autorização expressa válida para os termos retificados
          assinaturaDentistaFinal = null;
        }

        snapshotParaSalvar = {
          ...snapshotParaSalvar,
          versao: novaVersaoStr,
          contratoAnteriorId: snapExistente.contratoAnteriorId && snapExistente.contratoAnteriorId !== docExistente.id
            ? snapExistente.contratoAnteriorId
            : null,
          contratoId: docExistente.identificador || snapExistente.contratoId || snapshotAtual.contratoId,
          orcamentoId: docExistente.orcamento_id || snapExistente.orcamentoId || orcamentoAtual?.id || '',
          token: novoToken,
          tokensRevogados: tokensRevogadosAtualizados,
          tokenValidoAte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          assinaturaDentista: assinaturaDentistaFinal,
          statusAssinaturaDentista: assinaturaDentistaFinal ? 'assinado' : 'pendente',
          status: assinaturaDentistaFinal ? 'aguardando_assinatura_paciente' : 'aguardando_assinatura_dentista',
          versoesAnteriores: [
            ...historicoAnterior,
            {
              versao: versaoAnteriorRaw,
              substituidoEm: new Date().toISOString(),
              motivo: 'Retificação de valores para alinhamento estrito com o orçamento aprovado',
              token: tokenAntigo,
              financeiro: snapExistente.financeiro,
              orcamento: snapExistente.orcamento,
              assinaturaDentista: snapExistente.assinaturaDentista,
              conteudoHtml: docExistente.conteudo || null,
            },
          ],
        } as any;

        // Atualização estrita in-place no mesmo registro (preserva UUID sem duplicatas)
        idParaGravar = docExistente.id;
      } else {
        idParaGravar = finalTargetDocId || documentoIdSendoEditado || contratoVisualizacao?.id || contratoExistenteOrcamento?.id || undefined;
      }

      if (!snapshotParaSalvar.token) {
        snapshotParaSalvar.token =
          contratoVisualizacao?.itens?.token ||
          contratoExistenteOrcamento?.itens?.token ||
          initialOrcamento?.contratoToken ||
          (initialOrcamento as any)?.contrato_token ||
          snapshotAtual.token ||
          gerarTokenAcesso();
      }
      if (!snapshotParaSalvar.contratoId) {
        snapshotParaSalvar.contratoId =
          contratoVisualizacao?.itens?.contratoId ||
          contratoExistenteOrcamento?.itens?.contratoId ||
          snapshotAtual.contratoId ||
          gerarIdentificadorContrato();
      }
      snapshotAtual.token = snapshotParaSalvar.token;
      snapshotAtual.contratoId = snapshotParaSalvar.contratoId;

      // Validação impeditiva obrigatória: bloqueia emissão de novo contrato com divergência financeira
      const validacaoIntegridadeEmissao = validarIntegridadeOrcamentoContrato(orcamentoAtual, snapshotParaSalvar);
      if (!validacaoIntegridadeEmissao.valido) {
        toast.error('Emissão bloqueada por divergência financeira:', {
          description: validacaoIntegridadeEmissao.erros.join('; '),
        });
        setSalvando(false);
        return;
      }

      const htmlFinal = gerarHtmlContrato(snapshotParaSalvar);

      const docCriado = await salvarDocumento({
        id: idParaGravar || undefined,
        identificador: snapshotParaSalvar.contratoId,
        pacienteId: patient?.id,
        pacienteNome: patient?.nome,
        tipo: 'contrato',
        titulo: `Contrato Odontológico - Orçamento #${snapshotParaSalvar.orcamento?.numeroIdentificador || (orcamentoAtual?.id ? orcamentoAtual.id.slice(0, 8) : 'Geral')}`,
        conteudo: htmlFinal,
        itens: snapshotParaSalvar as any,
        dentista: snapshotParaSalvar?.clinica?.dentistaResponsavel || selectedDentistaNome || null,
        assinadoEm: snapshotParaSalvar.assinaturaPaciente ? new Date() : null,
        assinanteNome: snapshotParaSalvar.assinaturaPaciente?.nome || null,
        assinaturaData: snapshotParaSalvar.assinaturaPaciente?.assinaturaData || null,
      });

      if (docCriado) {
        // Se houve rotação de token, sincroniza também na tabela orçamentos
        if (orcamentoAtual?.id && snapshotParaSalvar.token) {
          try {
            await supabase.from('orcamentos').update({
              contrato_id: snapshotParaSalvar.contratoId,
              contrato_token: snapshotParaSalvar.token,
              token_assinatura: snapshotParaSalvar.token,
            }).eq('id', orcamentoAtual.id);
          } catch (_) {}
        }

        try {
          const snapJson = JSON.stringify(snapshotParaSalvar);
          localStorage.setItem(`contrato_${docCriado.id}`, snapJson);
          localStorage.setItem(`contrato_${snapshotParaSalvar.contratoId}`, snapJson);
        } catch (_) {}

        setSnapshotAtual(snapshotParaSalvar);
        setContratoVisualizacao(docCriado);
        setDocumentoIdSendoEditado(null);
        setIsManuallyEdited(false);
        setActiveTab('gerar');

        toast.success(
          isPendenteNaoAssinado
            ? 'Contrato retificado com sucesso! Novo token de acesso gerado e token anterior revogado.'
            : 'Contrato emitido e gravado com sucesso!',
          {
            description: `Identificador: ${snapshotParaSalvar.contratoId}`,
          }
        );
      }
    } catch (err: any) {
      console.error('Erro ao emitir contrato:', err);
      toast.error('Erro ao salvar contrato', { description: err?.message });
    } finally {
      setSalvando(false);
    }
  };

  // Download do PDF formatado - exclusivo para documentos persistidos e validados
  const handleDownloadPdf = async (htmlParaBaixar?: string, nomeArquivo?: string) => {
    // 1. Bloqueia estritamente se houver prévia não salva ou se htmlParaBaixar for a prévia em edição
    if (isEmModoEdicaoOuRetificacao) {
      const isTentandoBaixarPrevia = !htmlParaBaixar || htmlParaBaixar === htmlContratoAtual || htmlParaBaixar === htmlPreview;
      if (isTentandoBaixarPrevia) {
        toast.warning('Salve as alterações do contrato antes de baixar o PDF oficial.', {
          description: 'A minuta possui alterações ou valores recalculados pendentes de gravação no sistema.',
        });
        return;
      }
    }

    // 2. Determina o HTML oficial: se passado explicitamente (ex: histórico), valida se corresponde a documento persistido;
    // caso contrário, utiliza estritamente o conteúdo persistido do contrato atual no banco de dados.
    let htmlOficial: string | null = null;
    if (htmlParaBaixar) {
      const docEncontrado = documentos.find((d) => d.conteudo === htmlParaBaixar);
      if (docEncontrado && docEncontrado.conteudo) {
        htmlOficial = docEncontrado.conteudo;
      } else if (contratoVisualizacao && contratoVisualizacao.conteudo === htmlParaBaixar) {
        htmlOficial = contratoVisualizacao.conteudo;
      } else {
        toast.error('Download bloqueado: o documento informado não está gravado no sistema.', {
          description: 'Todas as ações oficiais exigem documento formalmente persistido no banco de dados.',
        });
        return;
      }
    } else {
      if (!contratoVisualizacao?.conteudo) {
        toast.warning('Grave o contrato no sistema antes de baixar o PDF oficial.', {
          description: 'Não é possível emitir PDF oficial de uma minuta ainda não gravada.',
        });
        return;
      }
      htmlOficial = contratoVisualizacao.conteudo;
    }

    if (!htmlOficial) {
      toast.error('Conteúdo do contrato não disponível');
      return;
    }

    try {
      setBaixandoPdf(true);
      const filename =
        nomeArquivo ||
        `contrato_${patient?.nome ? patient.nome.replace(/\s+/g, '_') : 'paciente'}_orc_${snapshotAtual?.orcamento.numeroIdentificador || 'aprovado'}`;

      // Se o contrato for formalizado e possuir PDF definitivo no Storage, baixa o binário oficial arquivado
      const docId = String(snapshotAtual?.contratoId || contratoVisualizacao?.identificador || contratoVisualizacao?.id || 'contrato');
      const canonicalName = `Contrato_Assinado_${docId}.pdf`;
      const resPdf = await obterPdfContratoOficialDefinitivo(docId, contratoVisualizacao || snapshotAtual);
      if (resPdf && (resPdf.blob || resPdf.signedUrl)) {
        const ok = await dispararDownloadPdfOficial(resPdf, canonicalName);
        if (ok) {
          toast.success('PDF oficial arquivado baixado com sucesso!');
          return;
        }
      }

      // Download determinístico direto no padrão oficial formal de 5 páginas
      const nomeFinal = snapshotAtual?.status === 'formalizado' || contratoVisualizacao?.assinadoEm ? canonicalName : filename;
      await downloadHtmlAsPdf(htmlOficial, nomeFinal);
      toast.success('PDF oficial do contrato baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF do contrato');
    } finally {
      setBaixandoPdf(false);
    }
  };

  // Impressão nativa do contrato - exclusiva para documentos persistidos e validados
  const handleImprimir = (htmlParaImprimir?: string) => {
    // 1. Bloqueia estritamente se houver prévia não salva ou se htmlParaImprimir for a prévia em edição
    if (isEmModoEdicaoOuRetificacao) {
      const isTentandoImprimirPrevia = !htmlParaImprimir || htmlParaImprimir === htmlContratoAtual || htmlParaImprimir === htmlPreview;
      if (isTentandoImprimirPrevia) {
        toast.warning('Salve as alterações do contrato antes de imprimir o documento oficial.', {
          description: 'A minuta possui alterações ou valores recalculados pendentes de gravação no sistema.',
        });
        return;
      }
    }

    // 2. Determina o HTML oficial: se passado explicitamente (ex: histórico), valida se corresponde a documento persistido;
    // caso contrário, utiliza estritamente o conteúdo persistido do contrato atual no banco de dados.
    let htmlOficial: string | null = null;
    if (htmlParaImprimir) {
      const docEncontrado = documentos.find((d) => d.conteudo === htmlParaImprimir);
      if (docEncontrado && docEncontrado.conteudo) {
        htmlOficial = docEncontrado.conteudo;
      } else if (contratoVisualizacao && contratoVisualizacao.conteudo === htmlParaImprimir) {
        htmlOficial = contratoVisualizacao.conteudo;
      } else {
        toast.error('Impressão bloqueada: o documento informado não está gravado no sistema.', {
          description: 'Todas as ações oficiais exigem documento formalmente persistido no banco de dados.',
        });
        return;
      }
    } else {
      if (!contratoVisualizacao?.conteudo) {
        toast.warning('Grave o contrato no sistema antes de imprimir o documento oficial.', {
          description: 'Não é possível imprimir documento oficial de uma minuta ainda não gravada.',
        });
        return;
      }
      htmlOficial = contratoVisualizacao.conteudo;
    }

    if (!htmlOficial) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlOficial);
      doc.close();

      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1500);
      }, 300);
    }
  };

  // Copia link de assinatura pública (garantindo que o contrato esteja registrado no banco)
  const handleCopiarLinkAssinatura = async () => {
    if (!snapshotAtual) return;
    if (isEmModoEdicaoOuRetificacao) {
      toast.warning('Salve as alterações do contrato antes de gerar ou copiar o link de assinatura.', {
        description: 'O paciente só pode assinar a versão formalmente gravada no sistema.',
      });
      return;
    }
    const docId = contratoVisualizacao?.id || documentoIdSendoEditado || contratoExistenteOrcamento?.id;

    // Garante que o snapshot possua identificador e token válidos antes de emitir
    if (!snapshotAtual.contratoId) {
      snapshotAtual.contratoId = docId && !docId.includes('-') ? docId : gerarIdentificadorContrato();
    }
    if (!snapshotAtual.token) {
      snapshotAtual.token = gerarTokenAcesso();
    }
    if (!snapshotAtual.tokenValidoAte) {
      snapshotAtual.tokenValidoAte = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const emissaoRes = await emitirContratoPersistido(snapshotAtual, docId || undefined);
    if (emissaoRes.id) {
      setDocumentoIdSendoEditado(emissaoRes.id);
      setContratoVisualizacao((prev: any) => ({
        ...(prev || {}),
        id: emissaoRes.id,
        identificador: emissaoRes.identificador,
        itens: emissaoRes.snapshot,
      }));
    }
    const link = emissaoRes.link;
    navigator.clipboard.writeText(link);
    setCopiouLink(true);
    toast.success('Link seguro de assinatura copiado!', {
      description: 'Envie o link para o paciente assinar pelo celular.',
    });
    setTimeout(() => setCopiouLink(false), 2500);
  };

  // Abre a tela pública de assinatura em nova aba
  const handleAbrirPaginaAssinatura = async () => {
    if (!snapshotAtual) return;
    if (isEmModoEdicaoOuRetificacao) {
      toast.warning('Salve as alterações do contrato antes de abrir a página de assinatura.', {
        description: 'Grave as alterações para que a minuta retificada esteja disponível para assinatura.',
      });
      return;
    }

    const valCronograma = validarCronogramaFinanceiroContrato(snapshotAtual);
    if (!valCronograma.valido) {
      toast.error('Emissão bloqueada: o cronograma financeiro está incompleto.', {
        description: valCronograma.erros[0] || 'Selecione uma condição de pagamento aprovada com parcelas válidas.',
      });
      return;
    }
    const docId = contratoVisualizacao?.id || documentoIdSendoEditado || contratoExistenteOrcamento?.id;

    // Garante que o snapshot possua identificador e token válidos antes de emitir
    if (!snapshotAtual.contratoId) {
      snapshotAtual.contratoId = docId && !docId.includes('-') ? docId : gerarIdentificadorContrato();
    }
    if (!snapshotAtual.token) {
      snapshotAtual.token = gerarTokenAcesso();
    }
    if (!snapshotAtual.tokenValidoAte) {
      snapshotAtual.tokenValidoAte = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const emissaoRes = await emitirContratoPersistido(snapshotAtual, docId || undefined);
    if (emissaoRes.id) {
      setDocumentoIdSendoEditado(emissaoRes.id);
      setContratoVisualizacao((prev: any) => ({
        ...(prev || {}),
        id: emissaoRes.id,
        identificador: emissaoRes.identificador,
        itens: emissaoRes.snapshot,
      }));
    }
    const link = emissaoRes.link;
    window.open(link, '_blank');
  };

  // Envio de notificação no WhatsApp
  const handleEnviarWhatsApp = async () => {
    if (isEmModoEdicaoOuRetificacao) {
      toast.warning('Salve as alterações do contrato antes de enviar por WhatsApp.', {
        description: 'O paciente deve receber os termos e o link da versão oficialmente salva no sistema.',
      });
      return;
    }
    let tel = patient?.telefone?.trim() || '';
    if (!tel) {
      const inputTel = window.prompt('Informe o número de WhatsApp do paciente com DDD (ex: 82999998888):', '');
      if (!inputTel) {
        toast.info('Envio cancelado: telefone não informado.');
        return;
      }
      tel = inputTel.trim();
    }
    if (!snapshotAtual) return;

    const docId = contratoVisualizacao?.id || documentoIdSendoEditado || contratoExistenteOrcamento?.id;

    // Garante que o snapshot possua identificador e token válidos antes da emissão
    if (!snapshotAtual.contratoId) {
      snapshotAtual.contratoId = docId && !docId.includes('-')
        ? docId
        : (contratoVisualizacao?.itens?.contratoId || contratoExistenteOrcamento?.itens?.contratoId || gerarIdentificadorContrato());
    }
    if (!snapshotAtual.token) {
      snapshotAtual.token =
        contratoVisualizacao?.itens?.token ||
        contratoExistenteOrcamento?.itens?.token ||
        gerarTokenAcesso();
    }
    if (!snapshotAtual.tokenValidoAte) {
      snapshotAtual.tokenValidoAte = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    const clinicaPix = snapshotAtual?.clinica?.chavePix || configContrato?.chavePix || configuracoes?.telefone || configuracoes?.cnpj || '';
    const favorecidoPix = snapshotAtual?.clinica?.favorecidoPix || configContrato?.favorecidoPix || snapshotAtual?.clinica?.nome || configuracoes?.nomeClinica || 'Dra. Rosangela Santos';
    const bancoPix = snapshotAtual?.clinica?.bancoPix || configContrato?.bancoPix || '';
    const emissaoResWhats = await emitirContratoPersistido(snapshotAtual, docId || undefined);
    if (emissaoResWhats.id) {
      setDocumentoIdSendoEditado(emissaoResWhats.id);
      setContratoVisualizacao((prev: any) => ({
        ...(prev || {}),
        id: emissaoResWhats.id,
        identificador: emissaoResWhats.identificador,
        itens: emissaoResWhats.snapshot,
      }));
    }
    const linkAssinatura = emissaoResWhats.link;

    // Baixa o PDF no computador para facilitar anexar caso a recepcionista deseje arrastar na conversa
    handleDownloadPdf();

    let mensagem =
      `Olá, ${patient.nome}! Tudo bem?\n\n` +
      `Aqui está o resumo oficial do seu *Contrato de Prestação de Serviços Odontológicos* referente ao plano de tratamento (*Orçamento #${snapshotAtual?.orcamento.numeroIdentificador}*):\n\n` +
      `• *Valor Total:* ${formatMoney(snapshotAtual?.financeiro.total ?? (snapshotAtual?.financeiro as any)?.valorTotal ?? 0)}\n` +
      `• *Forma de Pagamento:* ${limparFormaPagamentoParaContrato(snapshotAtual?.financeiro.formaPagamento)}\n`;

    if (snapshotAtual?.financeiro.entrada && snapshotAtual.financeiro.entrada > 0) {
      mensagem += `• *Entrada (PIX):* ${formatMoney(snapshotAtual.financeiro.entrada)}\n`;
    }

    if (snapshotAtual?.financeiro.quantidadeParcelas && snapshotAtual.financeiro.quantidadeParcelas > 1) {
      mensagem += `• *Parcelamento:* ${snapshotAtual.financeiro.quantidadeParcelas}x de ${formatMoney(snapshotAtual.financeiro.valorParcela)}\n`;
    }

    if (clinicaPix) {
      mensagem +=
        `\n✦ *Dados Oficiais para Pagamento via PIX:*\n` +
        `• *Chave PIX:* ${clinicaPix}\n` +
        `• *Titular / Favorecido:* ${favorecidoPix}\n` +
        (bancoPix ? `• *Banco / Instituição:* ${bancoPix}\n` : '') +
        `• Favor encaminhar o comprovante por este canal para baixa contábil e emissão do recibo.\n`;
    }

    if (linkAssinatura) {
      mensagem +=
        `\n✍️ *LINK PARA VISUALIZAR E ASSINAR DIGITALMENTE O CONTRATO:*\n` +
        `Acesse o link abaixo pelo seu celular ou computador para conferir os termos e assinar online agora:\n` +
        `👉 ${linkAssinatura}\n\n` +
        `Após assinar, você também poderá baixar a sua via oficial em PDF diretamente pela página.\n`;
    }

    mensagem += `\nQualquer dúvida, nossa equipe está à sua inteira disposição!`;

    openWhatsApp(tel, mensagem);
    toast.info('Abrindo WhatsApp Web com o link de assinatura!', {
      description: 'O PDF do contrato também foi baixado caso deseje anexá-lo na conversa.',
    });
  };

  // Guarda para download de termos avulsos (TCLE, Imagem, Canal)
  const handleDownloadTermoAvulso = async (geradorPdf: (snap: ContratoSnapshot) => Promise<any>, titulo: string) => {
    if (!snapshotAtual) return;
    if (isEmModoEdicaoOuRetificacao) {
      toast.warning(`Salve as alterações do contrato antes de baixar o ${titulo}.`, {
        description: 'Os termos complementares devem refletir a versão formalmente gravada no sistema.',
      });
      return;
    }
    try {
      await geradorPdf(snapshotAtual);
      toast.success(`${titulo} gerado com sucesso!`);
    } catch (e) {
      toast.error(`Erro ao gerar ${titulo} em PDF`);
    }
  };

  // Aplicação da Assinatura Digital Interna
  const handleAssinaturaConcluida = async (sigData: SignatureData) => {
    if (!snapshotAtual) return;

    let novoSnapshot: ContratoSnapshot;
    if (signerRole === 'paciente') {
      novoSnapshot = {
        ...snapshotAtual,
        status: 'assinado',
        assinaturaPaciente: {
          assinaturaData: sigData.signature,
          nome: sigData.signerName,
          dataHora: new Date().toISOString(),
          email: sigData.signerInfo?.email || patient?.email,
          cpf: sigData.signerInfo?.cpf || patient?.cpf,
          rg: sigData.signerInfo?.rg || patient?.rg,
          selfie: sigData.selfie || sigData.signerInfo?.selfie,
        },
      };
      toast.success('Assinatura do paciente registrada no contrato!');
    } else {
      novoSnapshot = {
        ...snapshotAtual,
        assinaturaDentista: {
          assinaturaData: sigData.signature,
          nome: sigData.signerName || snapshotAtual.clinica.dentistaResponsavel,
          cro: snapshotAtual.clinica.cro,
          dataHora: new Date().toISOString(),
        },
      };
      // Salva como assinatura padrão da Dra. para os próximos contratos emitidos
      if (typeof window !== 'undefined' && window.localStorage && sigData.signature) {
        localStorage.setItem('assinatura_padrao_dentista', sigData.signature);
      }
      toast.success('Assinatura da cirurgiã-dentista registrada e definida como padrão para novos contratos!');
    }

    setSnapshotAtual(novoSnapshot);

    // Persiste no localStorage
    if (novoSnapshot.contratoId) {
      localStorage.setItem(`contrato_assinado_${novoSnapshot.contratoId}`, JSON.stringify(novoSnapshot));
      localStorage.setItem(`contrato_${novoSnapshot.contratoId}`, JSON.stringify(novoSnapshot));
    }

    // Se já existe um documento emitido ou selecionado, atualiza-o imediatamente no banco
    const docId = contratoVisualizacao?.id || documentoIdSendoEditado;
    if (docId) {
      try {
        const htmlFinal = gerarHtmlContrato(novoSnapshot);
        await salvarDocumento({
          id: docId,
          pacienteId: patient?.id,
          pacienteNome: patient?.nome,
          tipo: 'contrato',
          titulo: `Contrato Odontológico - Orçamento #${novoSnapshot.orcamento.numeroIdentificador}`,
          conteudo: htmlFinal,
          itens: novoSnapshot as any,
          dentista: novoSnapshot.clinica.dentistaResponsavel || selectedDentistaNome || null,
        });
        localStorage.setItem(`contrato_assinado_${docId}`, JSON.stringify(novoSnapshot));
      } catch (err) {
        console.warn('Erro ao atualizar documento com a assinatura:', err);
      }
    }
  };

  // Renderiza o painel completo de parâmetros e modelos de contrato
  const renderPainelOpcoes = () => (
    <div className="space-y-3.5">
      {/* Status do Orçamento Selecionado e Condições de Pagamento */}
      {orcamentoAtual && (
        <div className="p-3.5 bg-card rounded-lg border border-border shadow-sm text-xs text-foreground space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge
                variant={orcamentoAtual?.status === 'aprovado' ? 'default' : 'secondary'}
                className="capitalize text-[10px] h-5"
              >
                {orcamentoAtual?.status || 'rascunho'}
              </Badge>
              <span className="font-bold text-sm text-foreground">
                {formatMoney(snapshotAtual?.financeiro?.total || orcamentoAtual?.total || 0)}
              </span>
            </div>
            <span className="text-muted-foreground text-[11px]">
              {orcamentoAtual?.itens?.length || 0} procedimento(s)
            </span>
          </div>

          {/* Condição de Pagamento Fechada / Aprovada do Contrato */}
          <div className="pt-2 border-t border-border/70 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                Condição Fechada no Contrato:
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const condAprovada = extrairCondicaoEscolhida(orcamentoAtual);
                  const sel = condicaoFlexibilizarContrato ||
                    (condAprovada ? condicoesContrato.find((c) => c.id === condAprovada.id || c.titulo === condAprovada.titulo) || condAprovada : null) ||
                    condicoesContrato.find((c) => c.id === condicaoContratoAtivaId) ||
                    condicoesContrato[0] || {
                      id: "1",
                      titulo: "Condição Fechada",
                      tipo: "personalizado" as const,
                      valorTotal: snapshotAtual?.financeiro?.total || orcamentoAtual.total,
                      descricao: snapshotAtual?.financeiro?.formaPagamento || orcamentoAtual.formasPagamento || "",
                      selecionada: true,
                    };
                  setCondicaoFlexibilizarContrato({ ...sel });
                  setModalFlexibilizarContratoOpen(true);
                }}
                className="h-6 text-[10.5px] gap-1 text-primary hover:bg-primary/10 border-primary/30 font-medium px-2"
                title="Apenas administradores podem editar ou flexibilizar as condições de pagamento do contrato"
              >
                <Pencil className="h-3 w-3" />
                Editar Pagamento
              </Button>
            </div>

            <div className="p-2.5 rounded-md bg-muted/40 border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between gap-1">
                <span className="font-semibold text-xs text-foreground truncate">
                  {condicoesContrato.find((c) => c.id === condicaoContratoAtivaId)?.titulo ||
                   (orcamentoAtual as any)?.condicaoEscolhida?.titulo ||
                   'Condição Aprovada no Orçamento'}
                </span>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium shrink-0">
                  ✓ Aprovada
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {snapshotAtual?.financeiro?.formaPagamento ||
                 condicoesContrato.find((c) => c.id === condicaoContratoAtivaId)?.descricao ||
                 'Conforme acordado entre as partes'}
              </p>

              {snapshotAtual?.financeiro && (
                <div className="pt-1.5 border-t border-border/50 flex flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
                  <span><strong>Total:</strong> {formatMoney(snapshotAtual.financeiro.total)}</span>
                  {snapshotAtual.financeiro.entrada > 0 && (
                    <span><strong>Entrada:</strong> {formatMoney(snapshotAtual.financeiro.entrada)}</span>
                  )}
                  {snapshotAtual.financeiro.quantidadeParcelas > 0 && (
                    <span><strong>Parcelas:</strong> {snapshotAtual.financeiro.quantidadeParcelas}x de {formatMoney(snapshotAtual.financeiro.valorParcela)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra de Seleção e Parâmetros */}
      <div className="p-3.5 bg-card rounded-lg border border-border shadow-sm space-y-2.5">
        <div className="font-semibold text-xs text-foreground flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          Parâmetros do Contrato
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-primary" />
              Orçamento Vinculado
            </Label>
            <Select value={selectedOrcamentoId} onValueChange={handleTrocarOrcamento}>
              <SelectTrigger className="h-8 text-xs border-border bg-background text-foreground">
                <SelectValue placeholder="Selecione um orçamento" />
              </SelectTrigger>
              <SelectContent>
                {orcamentos.length === 0 ? (
                  <SelectItem value="none" disabled>Nenhum orçamento encontrado</SelectItem>
                ) : (
                  (orcamentos || []).filter(Boolean).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.titulo} — {formatMoney(o.total || 0)} {o?.status === 'aprovado' ? '✓ (Aprovado)' : `(${o?.status || ''})`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-3 w-3 text-primary" />
              Profissional Responsável
            </Label>
            <Select value={selectedDentistaNome} onValueChange={setSelectedDentistaNome}>
              <SelectTrigger className="h-8 text-xs border-border bg-background text-foreground">
                <SelectValue placeholder="Selecione o profissional" />
              </SelectTrigger>
              <SelectContent>
                {dentistas.length === 0 ? (
                  <SelectItem value={configuracoes?.croResponsavel || 'Clínica'}>
                    {configuracoes?.nomeClinica || 'Responsável Técnico'}
                  </SelectItem>
                ) : (
                  dentistas.map((d) => (
                    <SelectItem key={d.id} value={d.nome}>
                      {d.nome} {d.cro ? `(CRO ${d.cro})` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3 text-primary" />
              Comarca / Cidade
            </Label>
            <Input
              type="text"
              value={cidadeLocal}
              onChange={(e) => setCidadeLocal(e.target.value)}
              placeholder="Maceió"
              className="h-8 text-xs border-border bg-background text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Modelos e Cláusulas Especiais */}
      <div className="space-y-2">
        {/* Lentes em Resina Composta */}
        <div className="p-3 bg-card rounded-lg border border-border shadow-sm flex items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-foreground text-[11px] truncate">
                Lentes em Resina (CFO 118/2012)
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {temLentesResinaNoContrato ? '✓ Cláusulas 4ª e 5ª inclusas' : 'Não aplicável'}
              </p>
            </div>
          </div>
          <Switch
            id="toggleLentesResina"
            checked={temLentesResinaNoContrato}
            onCheckedChange={(checked) => {
              setIsManuallyEdited(true);
              setSnapshotAtual((prev) => (prev ? { ...prev, incluiLentesResina: checked } : prev));
            }}
          />
        </div>

        {/* Termo de Uso de Imagem e Voz */}
        <div className="p-3 bg-card rounded-lg border border-border shadow-sm flex items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Camera className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-foreground text-[11px] truncate">
                Uso de Imagem e Voz (LGPD)
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {snapshotAtual?.termoUsoImagem?.autorizado ? '✓ Anexo Oficial Ativo' : 'Opcional / Não anexado'}
              </p>
            </div>
          </div>
          <Switch
            id="toggleTermoImagem"
            checked={Boolean(snapshotAtual?.termoUsoImagem?.autorizado)}
            onCheckedChange={(checked) => {
              setIsManuallyEdited(true);
              setSnapshotAtual((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  termoUsoImagem: {
                    ativo: true,
                    autorizado: checked,
                    usoDidaticoCientifico: prev.termoUsoImagem?.usoDidaticoCientifico !== false,
                    usoPublicitarioRedesSociais: prev.termoUsoImagem?.usoPublicitarioRedesSociais !== false,
                    identificacaoFacialVoz: prev.termoUsoImagem?.identificacaoFacialVoz || "rosto_e_voz",
                    depoimentos: prev.termoUsoImagem?.depoimentos !== false,
                    canalContatoLgpd: prev.clinica.email || prev.clinica.telefone,
                  },
                };
              });
            }}
          />
        </div>

        {/* Tratamento Endodôntico (Canal) */}
        <div className="p-3 bg-card rounded-lg border border-border shadow-sm text-xs space-y-2">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                <Stethoscope className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground text-[11px] truncate">
                  Tratamento de Canal (Endodontia)
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {temEndodontiaNoContrato ? '✓ 17 Cláusulas Endodontia ativas' : 'Padrão / Desativado'}
                </p>
              </div>
            </div>
            <Switch
              id="toggleEndodontia"
              checked={temEndodontiaNoContrato}
              onCheckedChange={(checked) => {
                setIsManuallyEdited(true);
                setSnapshotAtual((prev) => {
                  if (!prev) return prev;
                  const dentesOrcamento = prev.orcamento.itens?.map((i) => i.denteOuRegiao).filter(Boolean).join(", ") || "";
                  const procsOrcamento = prev.orcamento.itens?.map((i) => `${i.nome}${i.denteOuRegiao ? ` (${i.denteOuRegiao})` : ""}`).join(", ") || prev.orcamento.titulo;
                  return {
                    ...prev,
                    tipoModeloContrato: checked ? 'endodontia' : 'geral',
                    dadosEndodontia: {
                      ativo: checked,
                      executorTipo: prev.dadosEndodontia?.executorTipo || 'dentista_titular',
                      parceiro: prev.dadosEndodontia?.parceiro || null,
                      dentes: prev.dadosEndodontia?.dentes || dentesOrcamento || 'Elemento(s) dentário(s) indicado(s) na avaliação clínica',
                      procedimentosAprovados: prev.dadosEndodontia?.procedimentosAprovados || procsOrcamento,
                      diagnostico: prev.dadosEndodontia?.diagnostico || 'Avaliação clínica compatível com necessidade de intervenção endodôntica',
                      etapasPrevistas: prev.dadosEndodontia?.etapasPrevistas || 'Abertura coronária, localização dos canais, limpeza, instrumentação biomecânica, desinfecção e obturação radicular',
                      procedimentosIncluidos: prev.dadosEndodontia?.procedimentosIncluidos || 'Tratamento endodôntico (canal), instrumentação, medicação intracanal (quando indicada) e obturação dos canais radiculares',
                      procedimentosNaoIncluidos: prev.dadosEndodontia?.procedimentosNaoIncluidos || 'Restaurações definitivas, coroas protéticas, pinos/núcleos intracanais, reconstruções estéticas ou cirurgias parendodônticas',
                    },
                  };
                });
              }}
            />
          </div>

          {temEndodontiaNoContrato && (
            <div className="pt-2 border-t border-border/80 space-y-2">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-foreground">Profissional Executor</Label>
                <Select
                  value={snapshotAtual?.dadosEndodontia?.executorTipo || 'dentista_titular'}
                  onValueChange={(val: 'dentista_titular' | 'parceiro') => {
                    setIsManuallyEdited(true);
                    setSnapshotAtual((prev) => {
                      if (!prev) return prev;
                      return {
                        ...prev,
                        dadosEndodontia: {
                          ...prev.dadosEndodontia!,
                          ativo: true,
                          executorTipo: val,
                        },
                      };
                    });
                  }}
                >
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dentista_titular">Dra. Rosângela (CRO-AL 06267)</SelectItem>
                    <SelectItem value="parceiro">Cirurgião Parceiro Cadastrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {snapshotAtual?.dadosEndodontia?.executorTipo === 'parceiro' && (
                <div className="space-y-1.5 bg-muted/40 p-2 rounded border border-border">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-foreground">Selecionar Parceiro</Label>
                    <Select
                      value={snapshotAtual?.dadosEndodontia?.parceiro?.id || 'manual'}
                      onValueChange={(pId) => {
                        setIsManuallyEdited(true);
                        const parcEncontrado = parceiros.find((p) => p.id === pId);
                        setSnapshotAtual((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            dadosEndodontia: {
                              ...prev.dadosEndodontia!,
                              ativo: true,
                              executorTipo: "parceiro",
                              parceiro: parcEncontrado ? {
                                id: parcEncontrado.id,
                                nome: parcEncontrado.nome,
                                croUf: (prev.dadosEndodontia?.parceiro?.croUf) || "",
                                documento: (prev.dadosEndodontia?.parceiro?.documento) || "",
                                especialidade: parcEncontrado.especialidade || "",
                                telefone: parcEncontrado.telefone || "",
                              } : prev.dadosEndodontia?.parceiro,
                            },
                          };
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 text-[11px]">
                        <SelectValue placeholder="Selecione um parceiro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manual">-- Outro parceiro / Digitação direta --</SelectItem>
                        {parceiros.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome} {p.especialidade ? `(${p.especialidade})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] font-semibold text-foreground">Nome do Parceiro</Label>
                    <Input
                      value={snapshotAtual?.dadosEndodontia?.parceiro?.nome || ""}
                      onChange={(e) => {
                        setIsManuallyEdited(true);
                        const val = e.target.value;
                        setSnapshotAtual((prev) => prev ? {
                          ...prev,
                          dadosEndodontia: {
                            ...prev.dadosEndodontia!,
                            ativo: true,
                            executorTipo: "parceiro",
                            parceiro: {
                              ...(prev.dadosEndodontia?.parceiro || { nome: "", croUf: "" }),
                              nome: val,
                            },
                          },
                        } : prev);
                      }}
                      placeholder="Dr(a). Nome do Cirurgião Parceiro"
                      className="h-7 text-[11px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-foreground">CRO / UF</Label>
                      <Input
                        value={snapshotAtual?.dadosEndodontia?.parceiro?.croUf || ""}
                        onChange={(e) => {
                          setIsManuallyEdited(true);
                          const val = e.target.value;
                          setSnapshotAtual((prev) => prev ? {
                            ...prev,
                            dadosEndodontia: {
                              ...prev.dadosEndodontia!,
                              ativo: true,
                              executorTipo: "parceiro",
                              parceiro: {
                                ...(prev.dadosEndodontia?.parceiro || { nome: "", croUf: "" }),
                                croUf: val,
                              },
                            },
                          } : prev);
                        }}
                        placeholder="CRO-AL 12345"
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-semibold text-foreground">CPF / CNPJ</Label>
                      <Input
                        value={snapshotAtual?.dadosEndodontia?.parceiro?.documento || ""}
                        onChange={(e) => {
                          setIsManuallyEdited(true);
                          const val = e.target.value;
                          setSnapshotAtual((prev) => prev ? {
                            ...prev,
                            dadosEndodontia: {
                              ...prev.dadosEndodontia!,
                              ativo: true,
                              executorTipo: "parceiro",
                              parceiro: {
                                ...(prev.dadosEndodontia?.parceiro || { nome: "", croUf: "" }),
                                documento: val,
                              },
                            },
                          } : prev);
                        }}
                        placeholder="000.000.000-00"
                        className="h-7 text-[11px]"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-foreground">Dente(s) Tratado(s)</Label>
                <Input
                  value={snapshotAtual?.dadosEndodontia?.dentes || ""}
                  onChange={(e) => {
                    setIsManuallyEdited(true);
                    const val = e.target.value;
                    setSnapshotAtual((prev) => prev ? {
                      ...prev,
                      dadosEndodontia: {
                        ...prev.dadosEndodontia!,
                        ativo: true,
                        executorTipo: prev.dadosEndodontia?.executorTipo || 'dentista_titular',
                        dentes: val,
                      },
                    } : prev);
                  }}
                  placeholder="Ex: Dente 16, Elemento 21..."
                  className="h-7 text-[11px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Alerta de Pendências Cadastrais */}
      {pendenciasCadastrais.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-900 dark:text-amber-100 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Dados pendentes no paciente:</span>
            <span className="text-amber-700 dark:text-amber-300 font-bold">{pendenciasCadastrais.join(", ")}</span>
          </div>
          <div className="space-y-1.5 pt-1 border-t border-amber-500/20">
            <Input
              placeholder="CPF do Paciente (000.000.000-00)"
              value={quickCpf}
              onChange={(e) => setQuickCpf(formatarDocumento(e.target.value))}
              className="h-7 text-[11px] bg-background text-foreground"
            />
            <Input
              placeholder="Endereço Completo"
              value={quickEndereco}
              onChange={(e) => setQuickEndereco(e.target.value)}
              className="h-7 text-[11px] bg-background text-foreground"
            />
            <Button
              size="sm"
              type="button"
              disabled={salvandoDadosPaciente}
              onClick={handleSalvarDadosPacienteRapido}
              className="w-full h-7 text-[11px] font-semibold bg-amber-600 hover:bg-amber-700 text-white"
            >
              {salvandoDadosPaciente ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : "💾 Salvar no Paciente"}
            </Button>
          </div>
        </div>
      )}

      {/* Alerta de Divergência Financeira */}
      {transacoesSuspeitasOuDivergentes && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-800 dark:text-rose-200 text-xs space-y-2">
          <div className="font-semibold flex items-center gap-1.5 text-[11px]">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
            <span>Divergência Financeira Detectada</span>
          </div>
          <p className="text-[10px] leading-tight text-muted-foreground">
            As parcelas no financeiro diferem do total do contrato ({formatMoney(snapshotAtual?.financeiro?.total || 0)}).
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-[11px] border-rose-400 text-rose-700 hover:bg-rose-100"
            disabled={sincronizandoFinanceiro}
            onClick={handleSincronizarFinanceiroComContrato}
          >
            {sincronizandoFinanceiro ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
            Sincronizar Financeiro
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent
          position="center"
          className={cn(
            "flex flex-col p-0 overflow-hidden bg-background text-foreground transition-all duration-200 !z-50",
            isFullScreen
              ? "!fixed !inset-0 !w-screen !h-[100dvh] !max-w-none !max-h-none !rounded-none !m-0 !p-0 !border-0 !top-0 !left-0 !translate-x-0 !translate-y-0 [&>button:last-child]:hidden"
              : "!fixed !top-2 !bottom-2 !left-2 !right-2 sm:!top-4 sm:!bottom-4 sm:!left-4 sm:!right-4 md:!top-6 md:!bottom-6 md:!left-6 md:!right-6 lg:!top-[50px] lg:!bottom-[50px] lg:!left-[50px] lg:!right-[50px] !w-[calc(100vw-16px)] sm:!w-[calc(100vw-32px)] md:!w-[calc(100vw-48px)] lg:!w-[calc(100vw-100px)] !h-[calc(100dvh-16px)] sm:!h-[calc(100dvh-32px)] md:!h-[calc(100dvh-48px)] lg:!h-[calc(100dvh-100px)] !max-w-none !max-h-none !translate-x-0 !translate-y-0 !m-0 rounded-2xl border border-border shadow-2xl"
          )}
        >
          {isFullScreen ? (
            /* Modo Tela Cheia: Exclusivo para o Visualizador do Contrato (sem o popup todo) */
            <div className="w-full h-full flex flex-col bg-slate-950 text-white select-none">
              {/* Barra Superior Exclusiva do Visualizador em Tela Cheia */}
              <div className="h-12 sm:h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-md">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                    <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-xs sm:text-sm font-bold text-slate-100 flex flex-wrap items-center gap-1.5 sm:gap-2 truncate">
                      <span>Visualização do Contrato</span>
                      {isFormalizadoBilateral ? (
                        <span className="inline-flex text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                          ✓ Formalizado Bilateralmente
                        </span>
                      ) : isEmModoEdicaoOuRetificacao ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-200 font-bold border border-amber-500/50">
                          ⚠️ Prévia não salva
                        </span>
                      ) : (
                        <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                          📄 Documento Gravado
                        </span>
                      )}
                      <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                        Padrão A4
                      </span>
                    </DialogTitle>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                      Paciente: <strong className="text-slate-200">{patient?.nome}</strong>
                      {orcamentoAtual?.titulo ? ` — ${orcamentoAtual.titulo}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    onClick={() => handleAbrirAssinatura('dentista')}
                    title="Assinar como Profissional / Cirurgião-Dentista"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">{snapshotAtual?.assinaturaDentista ? '✓ Assinado Dentista' : 'Assinar Profissional'}</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    onClick={() => handleAbrirAssinatura('paciente')}
                    title="Assinar como Paciente"
                  >
                    <PenTool className="h-3.5 w-3.5 text-blue-400" />
                    <span className="hidden sm:inline">{snapshotAtual?.assinaturaPaciente ? '✓ Assinado Paciente' : 'Assinar Paciente'}</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    onClick={() => handleDownloadPdf()}
                    disabled={baixandoPdf || (!snapshotAtual && !contratoVisualizacao)}
                    title="Baixar Contrato em PDF"
                  >
                    {baixandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" /> : <Download className="h-3.5 w-3.5 text-emerald-400" />}
                    <span className="hidden sm:inline">Baixar PDF</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                    onClick={() => handleImprimir()}
                    disabled={!snapshotAtual && !contratoVisualizacao}
                    title="Imprimir Contrato"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-400" />
                    <span className="hidden sm:inline">Imprimir</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                    onClick={() => setIsFullScreen(false)}
                    title="Sair do modo tela cheia (ESC)"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                    <span>Sair da Tela Cheia</span>
                  </Button>
                </div>
              </div>

              {/* Área do Iframe com visualização A4 limpa e rolagem perfeita */}
              <div
                className="flex-1 bg-slate-900/90 dark:bg-slate-950 p-2 sm:p-5 flex flex-col items-center justify-start overflow-y-auto w-full"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {isEmModoEdicaoOuRetificacao && (
                  <div className="w-full max-w-[860px] mb-3 p-2.5 px-3.5 rounded-md border text-xs bg-amber-500/20 border-amber-500/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shrink-0">
                    <span className="leading-snug">
                      ⚠️ <strong>Prévia não salva:</strong> Estes termos refletem as alterações em edição e aguardam gravação para se tornarem oficiais.
                    </span>
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
                        onClick={handleDescartarEdicao}
                      >
                        Descartar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={handleEmitirContrato}
                        disabled={salvando}
                      >
                        {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Salvar Alterações
                      </Button>
                    </div>
                  </div>
                )}
                <iframe
                  srcDoc={htmlPreview}
                  title="Contrato Oficial A4"
                  className="w-full max-w-[860px] h-[calc(100vh-4.5rem)] rounded-md border border-slate-700/80 bg-white shadow-2xl"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Header do Modal */}
              <div className="p-3 sm:p-5 border-b border-border bg-card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base sm:text-xl font-bold flex flex-wrap items-center gap-1.5 sm:gap-2 text-foreground">
                      <span>Contrato de Serviços</span>
                      {isFormalizadoBilateral ? (
                        <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs border-emerald-500/30 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300">
                          ✓ Contrato Formalizado e Assinado Bilateralmente
                        </Badge>
                      ) : hasAssinaturaProfissional && !hasAssinaturaPaciente ? (
                        <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs border-amber-500/30 text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                          ⏳ Contrato Emitido — Assinado pela Profissional / Aguardando Paciente
                        </Badge>
                      ) : hasAssinaturaPaciente && !hasAssinaturaProfissional ? (
                        <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs border-purple-500/30 text-purple-700 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300">
                          ⏳ Assinado pelo Paciente — Aguardando Profissional
                        </Badge>
                      ) : isContratoGravado ? (
                        <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs border-blue-500/30 text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300">
                          ⏳ Contrato Gravado — Aguardando Assinaturas
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-semibold text-[10px] sm:text-xs border-slate-500/30 text-slate-700 bg-slate-50 dark:bg-slate-950/40 dark:text-slate-300">
                          📝 Minuta em Elaboração — Aguardando Gravação
                        </Badge>
                      )}
                      {isEmModoEdicaoOuRetificacao && (
                        <Badge variant="outline" className="font-bold text-[10px] sm:text-xs bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500">
                          ⚠️ Prévia não salva
                        </Badge>
                      )}
                      {isManuallyEdited && !isEmModoEdicaoOuRetificacao && (
                        <Badge variant="secondary" className="font-semibold text-[10px] sm:text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Edição Manual
                        </Badge>
                      )}
                    </DialogTitle>
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                      Paciente: <strong className="text-foreground">{patient?.nome}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto">
                  {/* Botão de Tela Cheia com texto visível */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 sm:h-9 px-2 sm:px-2.5 text-xs gap-1.5 border-border text-foreground hover:bg-muted shrink-0"
                    onClick={() => setIsFullScreen(true)}
                    title="Visualizar Contrato em Tela Cheia"
                  >
                    <Maximize2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-medium">Tela Cheia</span>
                  </Button>

              {/* Abas */}
              <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 sm:w-auto">
                <TabsList className="grid grid-cols-3 h-8 sm:h-9 bg-muted p-0.5 sm:p-1 w-full">
                  <TabsTrigger
                    value="gerar"
                    className="text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium px-1 sm:px-2"
                  >
                    <Eye className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                    <span>Visualizar</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="editar"
                    className="text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium px-1 sm:px-2"
                  >
                    <Pencil className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500 shrink-0" />
                    <span>Editar</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="historico"
                    className="text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm font-medium px-1 sm:px-2"
                  >
                    <History className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                    <span>Emitidos ({contratosEmitidos.length})</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {/* Conteúdo das Abas */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-muted/20">
            {/* ABA 1: VISUALIZAR CONTRATO (Layout Responsivo Especial: 2 Colunas no Desktop / Otimizado iPad e Mobile) */}
            {activeTab === 'gerar' && (
              <div className="flex-1 w-full h-full overflow-hidden flex flex-col lg:flex-row min-h-0">
                {/* Em Mobile e iPad: Barra Superior com Resumo da Condição e Botão de Opções */}
                <div className="lg:hidden shrink-0 bg-card border-b border-border shadow-xs">
                  <div className="p-2 sm:p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant={orcamentoAtual?.status === 'aprovado' ? 'default' : 'secondary'}
                        className="text-[10px] h-5 px-1.5 shrink-0 capitalize"
                      >
                        {orcamentoAtual?.status || 'Aprovado'}
                      </Badge>
                      <span className="text-xs font-bold truncate text-foreground">
                        {formatMoney(snapshotAtual?.financeiro?.total || orcamentoAtual?.total || 0)}
                      </span>
                      {snapshotAtual?.financeiro?.formaPagamento && (
                        <span className="hidden sm:inline text-xs text-primary font-medium truncate">
                          • {limparFormaPagamentoParaContrato(snapshotAtual.financeiro.formaPagamento)}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 shrink-0 border-border text-foreground hover:bg-muted"
                      onClick={() => setMobileOptionsOpen((prev) => !prev)}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                      <span>{mobileOptionsOpen ? "Ocultar Ajustes" : "Ajustes & Opções"}</span>
                      {mobileOptionsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </div>

                  {mobileOptionsOpen && (
                    <div className="max-h-[50vh] overflow-y-auto p-3.5 bg-card/95 border-t border-border shadow-inner space-y-3.5">
                      {renderPainelOpcoes()}
                    </div>
                  )}
                </div>

                {/* Em Desktop: Barra Lateral Fixa com Rolagem Independente (380px) */}
                {sidebarOpen && (
                  <div className="hidden lg:flex w-[380px] xl:w-[420px] shrink-0 border-r border-border bg-card/70 flex-col h-full overflow-hidden">
                    <div className="p-3 border-b border-border/80 flex items-center justify-between bg-card shrink-0">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-primary" />
                        <span className="text-xs font-bold text-foreground">Ajustes & Parâmetros do Contrato</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-muted-foreground hover:text-foreground px-1.5"
                        onClick={() => setSidebarOpen(false)}
                        title="Ocultar painel para foco total no contrato"
                      >
                        Ocultar ◀
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
                      {renderPainelOpcoes()}
                    </div>
                  </div>
                )}

                {/* Coluna Principal: O Visualizador do Contrato (Foco Total, Altura Máxima, 100% Visível) */}
                <div className="flex-1 h-full flex flex-col overflow-hidden bg-slate-200/80 dark:bg-slate-950/80 min-w-0">
                  {/* Barra de Ferramentas da Visualização */}
                  <div className="px-3 sm:px-4 py-2 border-b border-border bg-card flex items-center justify-between text-xs text-muted-foreground shrink-0 shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {!sidebarOpen && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="hidden lg:flex h-7 text-xs gap-1.5 px-2.5 border-primary/40 text-primary hover:bg-primary/10 shrink-0 font-medium"
                          onClick={() => setSidebarOpen(true)}
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          <span>Exibir Ajustes</span>
                        </Button>
                      )}
                      <span className="flex items-center gap-1.5 text-foreground font-semibold truncate text-[11px] sm:text-xs">
                        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>Visualização Oficial do Contrato</span>
                        <Badge variant="outline" className="hidden sm:inline-flex text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                          Padrão A4
                        </Badge>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-border text-foreground hover:bg-muted"
                        onClick={() => handleAbrirAssinatura("paciente")}
                      >
                        <PenTool className="h-3 w-3 text-primary" />
                        <span className="hidden sm:inline">{snapshotAtual?.assinaturaPaciente ? "✓ Assinado Paciente" : "Assinar Paciente"}</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-border text-foreground hover:bg-muted"
                        onClick={() => handleAbrirAssinatura("dentista")}
                      >
                        <ShieldCheck className="h-3 w-3 text-emerald-600" />
                        <span className="hidden sm:inline">{snapshotAtual?.assinaturaDentista ? "✓ Assinado Dentista" : "Assinar Profissional"}</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-border text-foreground hover:bg-muted"
                        onClick={() => setIsFullScreen(true)}
                        title="Visualizar em Tela Cheia"
                      >
                        <Maximize2 className="h-3 w-3 text-primary" />
                        <span className="hidden md:inline font-medium">Tela Cheia</span>
                      </Button>
                    </div>
                  </div>

                  {/* Alerta de Edição ou Divergência se houver */}
                  {isEmModoEdicaoOuRetificacao && (
                    <div className="mx-3 mt-2 p-2.5 rounded-lg border text-xs shadow-xs shrink-0 bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-[10px] uppercase shrink-0">
                          Prévia não salva
                        </span>
                        <span className="truncate text-[11px]">Você está visualizando valores recalculados em memória.</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px] border-amber-400 text-amber-900 px-2"
                          onClick={handleDescartarEdicao}
                        >
                          Descartar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-6 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                          onClick={handleEmitirContrato}
                          disabled={salvando}
                        >
                          {salvando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  )}

                  {validacaoIntegridade?.divergenciaFinanceira && (
                    <div className="mx-3 mt-2 p-2.5 rounded-lg border text-xs shadow-xs shrink-0 bg-amber-50 border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200">
                      <div className="font-bold flex items-center gap-1.5 uppercase tracking-wide text-[11px] mb-1 text-amber-800 dark:text-amber-300">
                        {hasAssinaturaPaciente ? "⚠️ Alerta de Integridade Histórica (Contrato Assinado)" : "🚨 Divergência Financeira Detectada"}
                      </div>
                      <p className="leading-relaxed text-[11px]">
                        {hasAssinaturaPaciente
                          ? "Este contrato foi formalizado anteriormente e mantém sua integridade documental histórica inalterada. Foi constatada divergência entre o orçamento e os valores formalizados."
                          : `O contrato gerado apresenta inconsistência financeira com o orçamento aprovado: ${validacaoIntegridade.erros.join("; ")}.`}
                      </p>
                    </div>
                  )}

                  {/* O Iframe do Contrato em Destaque Absoluto */ }
                  <div
                    className="flex-1 w-full h-full p-2 sm:p-4 md:p-6 flex items-center justify-center overflow-auto"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    <iframe
                      srcDoc={htmlPreview}
                      title="Contrato Oficial A4"
                      className="w-full h-full max-w-[880px] rounded-lg border border-slate-300 dark:border-slate-800 bg-white shadow-2xl transition-all"
                      style={{ minHeight: "100%", height: "100%" }}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* ABA 2: EDITAR CAMPOS MANUALMENTE */}
            {activeTab === 'editar' && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-muted/20 space-y-4">
                {/* Banner Informativo de Edição Manual */}
                <div className="p-3.5 bg-card rounded-lg border border-border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Pencil className="h-4 w-4 text-amber-500" />
                      Editor Manual de Informações do Contrato
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Altere qualquer dado cadastral, profissional ou financeiro. As alterações refletem imediatamente no contrato gerado e no link de assinatura.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                      onClick={handleRestaurarPadrao}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restaurar Padrão
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={() => {
                        setActiveTab('gerar');
                        toast.success('Alterações aplicadas na visualização!');
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver Contrato
                    </Button>
                  </div>
                </div>

                {snapshotAtual && (
                  <div className="space-y-4">
                    {/* Seção 1: Dados do Paciente */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-primary" />
                        1. Dados do Paciente (Contratante)
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nome Completo</Label>
                          <Input
                            value={snapshotAtual.paciente.nome || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.nome', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">CPF</Label>
                          <Input
                            value={snapshotAtual.paciente.cpf || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.cpf', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">RG (Opcional)</Label>
                          <Input
                            value={snapshotAtual.paciente.rg || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.rg', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Telefone / WhatsApp</Label>
                          <Input
                            value={snapshotAtual.paciente.telefone || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.telefone', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Profissão (Opcional)</Label>
                          <Input
                            value={snapshotAtual.paciente.profissao || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.profissao', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Estado Civil (Opcional)</Label>
                          <Input
                            value={snapshotAtual.paciente.estadoCivil || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.estadoCivil', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2 md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Endereço Residencial Completo</Label>
                          <Input
                            value={snapshotAtual.paciente.endereco || ''}
                            onChange={(e) => handleUpdateSnapshotField('paciente.endereco', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção 2: Dados da Clínica e Cirurgião-Dentista */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-primary" />
                        2. Dados da Clínica e Profissional Responsável
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Cirurgião-Dentista Responsável</Label>
                          <Input
                            value={snapshotAtual?.clinica?.dentistaResponsavel || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.dentistaResponsavel', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Número do CRO</Label>
                          <Input
                            value={snapshotAtual?.clinica?.cro || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.cro', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Nome da Clínica</Label>
                          <Input
                            value={snapshotAtual?.clinica?.nome || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.nome', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">Documento da Contratada</Label>
                            <span className="text-[10px] font-semibold text-primary">
                              {identificarTipoDocumento(snapshotAtual?.clinica?.cnpj) === 'cpf' ? 'CPF (Pessoa Física)' : 'CNPJ (Pessoa Jurídica)'}
                            </span>
                          </div>
                          <Input
                            value={snapshotAtual?.clinica?.cnpj || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.cnpj', e.target.value)}
                            placeholder="000.000.000-00 ou 00.000.000/0001-00"
                            className="h-8 text-xs border-border bg-background text-foreground font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Chave PIX Oficial</Label>
                          <Input
                            value={snapshotAtual?.clinica?.chavePix || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.chavePix', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Titular / Favorecido PIX</Label>
                          <Input
                            value={snapshotAtual?.clinica?.favorecidoPix || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.favorecidoPix', e.target.value)}
                            placeholder="Ex: Dra. Rosangela Santos"
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs text-muted-foreground">CPF / CNPJ do Titular PIX</Label>
                            {snapshotAtual?.clinica?.cnpjCpfFavorecidoPix && (
                              <span className="text-[10px] font-semibold text-primary">
                                {identificarTipoDocumento(snapshotAtual.clinica.cnpjCpfFavorecidoPix) === 'cpf' ? 'CPF' : 'CNPJ'}
                              </span>
                            )}
                          </div>
                          <Input
                            value={snapshotAtual?.clinica?.cnpjCpfFavorecidoPix || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.cnpjCpfFavorecidoPix', e.target.value)}
                            placeholder="032.663.962-43"
                            className="h-8 text-xs border-border bg-background text-foreground font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Banco / Instituição</Label>
                          <Input
                            value={snapshotAtual?.clinica?.bancoPix || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.bancoPix', e.target.value)}
                            placeholder="Ex: Nubank, Banco do Brasil..."
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Comarca / Cidade do Foro</Label>
                          <Input
                            value={snapshotAtual?.clinica?.cidade || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.cidade', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2 md:col-span-3">
                          <Label className="text-xs text-muted-foreground">Endereço do Consultório / Clínica</Label>
                          <Input
                            value={snapshotAtual?.clinica?.endereco || ''}
                            onChange={(e) => handleUpdateSnapshotField('clinica.endereco', e.target.value)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção 3: Condições Financeiras e Formas de Pagamento */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        3. Condições Financeiras e Formas de Pagamento
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Valor Total (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={snapshotAtual.financeiro.total ?? (snapshotAtual.financeiro as any)?.valorTotal ?? ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleUpdateSnapshotField('financeiro.total', val);
                              handleUpdateSnapshotField('financeiro.valorTotal', val);
                            }}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Entrada (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={snapshotAtual.financeiro.entrada || ''}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.entrada', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Qtd. de Parcelas</Label>
                          <Input
                            type="number"
                            min="1"
                            value={snapshotAtual.financeiro.quantidadeParcelas || 1}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.quantidadeParcelas', parseInt(e.target.value, 10) || 1)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Valor da Parcela (R$)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={snapshotAtual.financeiro.valorParcela || ''}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.valorParcela', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2 md:col-span-4">
                          <Label className="text-xs text-muted-foreground">Descrição da Forma de Pagamento (Cláusula 3ª)</Label>
                          <Input
                            value={snapshotAtual.financeiro.formaPagamento || ''}
                            onChange={(e) => handleUpdateSnapshotField('financeiro.formaPagamento', e.target.value)}
                            placeholder="Ex: PIX Parcelado: Entrada de R$ 450,00 + 2x de R$ 200,00 (Vencimento todo dia 10)"
                            className="h-8 text-xs border-border bg-background text-foreground"
                          />
                        </div>

                        {/* Tabela de Parcelas e Situações do Contrato */}
                        {snapshotAtual.financeiro.parcelas && snapshotAtual.financeiro.parcelas.length > 0 && (
                          <div className="sm:col-span-2 md:col-span-4 pt-3 border-t border-border/70 space-y-2">
                            <Label className="text-xs font-semibold text-foreground flex items-center justify-between flex-wrap gap-2">
                              <span>Parcelas e Cronograma Oficial (Cláusula 3ª)</span>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] gap-1 px-2 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium"
                                  onClick={() => {
                                    if (!patient || !orcamentoAtual) return;
                                    const snapAtualizado = mapearDadosContrato({
                                      patient,
                                      orcamento: orcamentoAtual,
                                      transacoes: transacoesOrcamento,
                                      configuracoes,
                                      configContrato,
                                      dentistaNome: selectedDentistaNome || configContrato?.dentistaResponsavelContrato || configuracoes?.croResponsavel,
                                      dentistaCro: dentistaAtual?.cro || configContrato?.croResponsavelContrato || configuracoes?.croResponsavel,
                                      cidadeLocal: cidadeLocal || configContrato?.cidadeForoContrato,
                                      dadosRestauracoesPreexistentes: patient?.restauracoesPreexistentes,
                                    });
                                    if (snapshotAtual?.contratoId) snapAtualizado.contratoId = snapshotAtual.contratoId;
                                    if (snapshotAtual?.token) snapAtualizado.token = snapshotAtual.token;
                                    setSnapshotAtual(snapAtualizado);
                                    setIsManuallyEdited(true);
                                    const docPendenteAlvo = contratoVisualizacao || contratoExistenteOrcamento;
                                    if (!documentoIdSendoEditado && docPendenteAlvo && !docPendenteAlvo.assinadoEm && !hasAssinaturaPaciente) {
                                      setDocumentoIdSendoEditado(docPendenteAlvo.id);
                                    }
                                    toast.success('Cronograma e valores sincronizados com o orçamento aprovado!');
                                  }}
                                  title="Recarrega o cronograma oficial de parcelas diretamente da condição aprovada no orçamento"
                                >
                                  <RefreshCw className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                  <span>Sincronizar com Orçamento</span>
                                </Button>

                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[10px] gap-1 px-2 border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10 font-medium"
                                  onClick={() => {
                                    const dataHoje = new Date().toLocaleDateString('pt-BR');
                                    const novasParcelas: ContratoParcela[] = [
                                      {
                                        numero: 1,
                                        descricao: 'Entrada Inicial (PIX)',
                                        vencimento: dataHoje,
                                        valor: 4000,
                                        metodo: 'PIX',
                                        status: 'Quitada',
                                      },
                                      {
                                        numero: 2,
                                        descricao: 'Saldo Restante (1/4 - Boleto Bancário)',
                                        vencimento: '26/12/2026',
                                        valor: 1000,
                                        metodo: 'Boleto Bancário',
                                        status: 'Pendente',
                                      },
                                      {
                                        numero: 3,
                                        descricao: 'Saldo Restante (2/4 - Boleto Bancário)',
                                        vencimento: '26/01/2027',
                                        valor: 1000,
                                        metodo: 'Boleto Bancário',
                                        status: 'Pendente',
                                      },
                                      {
                                        numero: 4,
                                        descricao: 'Saldo Restante (3/4 - Boleto Bancário)',
                                        vencimento: '26/02/2027',
                                        valor: 1000,
                                        metodo: 'Boleto Bancário',
                                        status: 'Pendente',
                                      },
                                      {
                                        numero: 5,
                                        descricao: 'Saldo Restante (4/4 - Boleto Bancário)',
                                        vencimento: '26/03/2027',
                                        valor: 1000,
                                        metodo: 'Boleto Bancário',
                                        status: 'Pendente',
                                      },
                                    ];

                                    setSnapshotAtual((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        financeiro: {
                                          ...prev.financeiro,
                                          total: 8000,
                                          valorTotal: 8000,
                                          entrada: 4000,
                                          quantidadeParcelas: 4,
                                          valorParcela: 1000,
                                          formaPagamento: `Entrada: R$ 4.000,00 via PIX (em ${dataHoje}) [Quitada] + Saldo: R$ 4.000,00 em 4x de R$ 1.000,00 no Boleto Bancário (Vencimento todo dia 26)`,
                                          parcelas: novasParcelas,
                                        },
                                      };
                                    });
                                    setIsManuallyEdited(true);
                                    const docPendenteAlvo = contratoVisualizacao || contratoExistenteOrcamento;
                                    if (!documentoIdSendoEditado && docPendenteAlvo && !docPendenteAlvo.assinadoEm && !hasAssinaturaPaciente) {
                                      setDocumentoIdSendoEditado(docPendenteAlvo.id);
                                    }
                                    toast.success(`Cronograma configurado: Entrada hoje (${dataHoje}) + 4 parcelas dia 26 iniciando em Dezembro/2026!`);
                                  }}
                                >
                                  <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                  <span>Aplicar: Entrada Hoje + 4x Boleto dia 26 (Dez a Mar)</span>
                                </Button>
                                <span className="text-[10px] text-muted-foreground font-normal">Edite a data, valor ou situação de cada parcela</span>
                              </div>
                            </Label>

                            {(() => {
                              const somaP = (snapshotAtual.financeiro.parcelas || []).reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
                              const ent = Number(snapshotAtual.financeiro.entrada || 0);
                              const tot = Number(snapshotAtual.financeiro.total ?? (snapshotAtual.financeiro as any)?.valorTotal ?? 0);
                              const temEntNaLista = (snapshotAtual.financeiro.parcelas || []).some((p) => /entrada|sinal/i.test(p?.descricao || ''));
                              const bateComEnt = !temEntNaLista && ent > 0 && Math.abs((somaP + ent) - tot) <= 0.05;

                              return (
                                <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border border-border/70 text-xs">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-muted-foreground">Soma das parcelas:</span>
                                    <strong className="text-foreground">{formatMoney(somaP)}</strong>
                                    {bateComEnt && (
                                      <>
                                        <span className="text-muted-foreground">+ Entrada:</span>
                                        <strong className="text-emerald-600 dark:text-emerald-400">{formatMoney(ent)}</strong>
                                        <span className="text-muted-foreground">=</span>
                                        <strong className="text-primary font-bold">{formatMoney(somaP + ent)}</strong>
                                        <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 py-0 h-5">
                                          ✓ Total conciliado ({formatMoney(tot)})
                                        </Badge>
                                      </>
                                    )}
                                  </div>

                                  {!temEntNaLista && ent > 0 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-6 text-[10px] gap-1 px-2 border-primary/30 text-primary hover:bg-primary/10"
                                      onClick={() => {
                                        const dataHoje = new Date().toLocaleDateString('pt-BR');
                                        const pEntrada: ContratoParcela = {
                                          numero: 1,
                                          descricao: 'Entrada Inicial (PIX)',
                                          vencimento: dataHoje,
                                          valor: ent,
                                          metodo: 'PIX',
                                          status: 'Quitada',
                                        };
                                        const novas = [
                                          pEntrada,
                                          ...(snapshotAtual.financeiro.parcelas || []).map((p, idx) => ({
                                            ...p,
                                            numero: idx + 2,
                                          })),
                                        ];
                                        handleUpdateSnapshotField('financeiro.parcelas', novas);
                                        toast.success('Entrada adicionada ao cronograma com sucesso!');
                                      }}
                                    >
                                      <Plus className="h-3 w-3" />
                                      <span>Incluir Entrada como Linha 1</span>
                                    </Button>
                                  )}
                                </div>
                              );
                            })()}

                            {alertaIntervaloParcelas && (
                              <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                                <div>
                                  <span className="font-semibold">{alertaIntervaloParcelas}</span>
                                  <p className="text-[11px] text-amber-700 dark:text-amber-400/90 mt-0.5">
                                    Caso seja necessário ajustar o vencimento para meses consecutivos, altere diretamente o campo "Venc." da parcela abaixo.
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                              {snapshotAtual.financeiro.parcelas.map((parc, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md bg-muted/40 border border-border/70 text-xs hover:border-primary/40 transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-36">
                                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold text-[10px]">
                                      {parc.numero}
                                    </span>
                                    <span className="font-medium text-foreground truncate max-w-[200px]" title={parc.descricao}>
                                      {parc.descricao}
                                    </span>
                                  </div>

                                  <div className="flex items-center flex-wrap gap-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">Valor:</span>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={parc.valor || ''}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value) || 0;
                                          const novas = [...snapshotAtual.financeiro.parcelas];
                                          novas[pIdx] = { ...novas[pIdx], valor: val };
                                          handleUpdateSnapshotField('financeiro.parcelas', novas);
                                        }}
                                        className="h-7 text-xs w-24 border-border bg-background"
                                      />
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">Venc.:</span>
                                      {isMetodoCartao(parc.metodo, parc.descricao) || (parc.vencimento && /fatura/i.test(parc.vencimento)) ? (
                                        <div
                                          className="h-7 px-2 flex items-center justify-center text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded w-28 select-none truncate"
                                          title="Cartão de crédito não requer vencimento (cobrado diretamente na fatura do cartão)"
                                        >
                                          Fatura do Cartão
                                        </div>
                                      ) : (
                                        <Input
                                          type="text"
                                          value={parc.vencimento || ''}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const novas = [...snapshotAtual.financeiro.parcelas];
                                            novas[pIdx] = { ...novas[pIdx], vencimento: val };

                                            // Auto-sequenciamento inteligente de datas nos meses consecutivos ao preencher ou alterar a primeira parcela do saldo
                                            if (/^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
                                              const [dStr, mStr, yStr] = val.split('/');
                                              const dia = parseInt(dStr, 10);
                                              const mes = parseInt(mStr, 10) - 1;
                                              const ano = parseInt(yStr, 10);
                                              const baseDate = new Date(ano, mes, dia, 12, 0, 0);

                                              if (!isNaN(baseDate.getTime())) {
                                                for (let j = pIdx + 1; j < novas.length; j++) {
                                                  const isEnt = /entrada|sinal/i.test(novas[j]?.descricao || '');
                                                  if (!isEnt) {
                                                    const offsetMeses = j - pIdx;
                                                    const proxData = somarMesesSeguro(baseDate, offsetMeses, dia);
                                                    novas[j] = {
                                                      ...novas[j],
                                                      vencimento: formatarData(proxData),
                                                    };
                                                  }
                                                }
                                              }
                                            }

                                            handleUpdateSnapshotField('financeiro.parcelas', novas);
                                          }}
                                          placeholder="DD/MM/AAAA"
                                          className="h-7 text-xs w-28 border-border bg-background"
                                        />
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] text-muted-foreground">Situação:</span>
                                      <Select
                                        value={parc.status || 'A vencer'}
                                        onValueChange={(v) => {
                                          const novas = [...snapshotAtual.financeiro.parcelas];
                                          novas[pIdx] = { ...novas[pIdx], status: v as any };
                                          handleUpdateSnapshotField('financeiro.parcelas', novas);
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-28 font-semibold">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="A vencer">
                                            <span className="text-amber-500 font-medium">● A vencer</span>
                                          </SelectItem>
                                          <SelectItem value="Quitada">
                                            <span className="text-emerald-500 font-medium">● Quitada</span>
                                          </SelectItem>
                                          <SelectItem value="Autorizado">
                                            <span className="text-blue-500 font-medium">● Autorizado</span>
                                          </SelectItem>
                                          <SelectItem value="Vencida">
                                            <span className="text-rose-500 font-medium">● Vencida</span>
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-1 sm:col-span-2 md:col-span-4">
                          <Label className="text-xs text-muted-foreground">Observações do Orçamento / Recomendações (Cláusula 1ª)</Label>
                          <Textarea
                            value={snapshotAtual.orcamento.observacoes || ''}
                            onChange={(e) => handleUpdateSnapshotField('orcamento.observacoes', e.target.value)}
                            placeholder="Observações do plano de tratamento ou especificações clínicas..."
                            rows={2}
                            className="text-xs border-border bg-background text-foreground"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção 4: Cláusula Adicional ou Observações Especiais */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-primary" />
                        4. Cláusula Adicional ou Observações Especiais (Opcional)
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Texto livre inserido como Cláusula Especial no contrato para registrar acordos verbais, condições de garantia, cronogramas ou detalhes específicos.
                      </p>
                      <Textarea
                        value={snapshotAtual.observacoesCustomizadas || ''}
                        onChange={(e) => handleUpdateSnapshotField('observacoesCustomizadas', e.target.value)}
                        placeholder="Digite aqui eventuais termos adicionais para este paciente..."
                        rows={3}
                        className="text-xs border-border bg-background text-foreground"
                      />
                    </div>

                    {/* Seção 5: Cláusulas de Lentes em Resina e Restaurações Preexistentes */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                          5. Cláusulas de Lentes em Resina e Restaurações Preexistentes
                        </h4>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="incluiLentesSwitchEdit" className="text-xs text-muted-foreground cursor-pointer select-none">
                            {temLentesResinaNoContrato ? 'Ativadas' : 'Desativadas'}
                          </Label>
                          <Switch
                            id="incluiLentesSwitchEdit"
                            checked={temLentesResinaNoContrato}
                            onCheckedChange={(checked) => {
                              handleUpdateSnapshotField('incluiLentesResina', checked);
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Insere as cláusulas de Manutenção Preventiva Semestral (a cada 6 meses) e de Restaurações Preexistentes / Condições Clínicas Ocultas, ajustando a numeração sequencial automaticamente.
                      </p>

                      {temLentesResinaNoContrato && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-border">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Tipo de Restauração Preexistente</Label>
                            <Input
                              value={snapshotAtual.dadosRestauracoesPreexistentes?.tipoRestauracao || ''}
                              onChange={(e) => handleUpdateSnapshotField('dadosRestauracoesPreexistentes.tipoRestauracao', e.target.value)}
                              placeholder="Ex: Lentes em resina, facetas..."
                              className="h-8 text-xs border-border bg-background text-foreground"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Dentes Envolvidos</Label>
                            <Input
                              value={snapshotAtual.dadosRestauracoesPreexistentes?.dentesEnvolvidos || ''}
                              onChange={(e) => handleUpdateSnapshotField('dadosRestauracoesPreexistentes.dentesEnvolvidos', e.target.value)}
                              placeholder="Ex: 11, 12, 13, 21, 22, 23"
                              className="h-8 text-xs border-border bg-background text-foreground"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Orçamento Complementar (R$)</Label>
                            <Input
                              value={snapshotAtual.dadosRestauracoesPreexistentes?.orcamentoComplementar || ''}
                              onChange={(e) => handleUpdateSnapshotField('dadosRestauracoesPreexistentes.orcamentoComplementar', e.target.value)}
                              placeholder="Ex: 450,00"
                              className="h-8 text-xs border-border bg-background text-foreground"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Seção 6: Termo de Autorização de Uso de Imagem, Voz e Registros Odontológicos */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-emerald-500" />
                          6. Termo de Autorização de Uso de Imagem e Voz (LGPD / CFO)
                        </h4>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="termoImagemSwitchEdit" className="text-xs text-muted-foreground cursor-pointer select-none">
                            {snapshotAtual.termoUsoImagem?.autorizado ? 'Autorizado (Anexo Ativo)' : 'Não Autorizado'}
                          </Label>
                          <Switch
                            id="termoImagemSwitchEdit"
                            checked={Boolean(snapshotAtual.termoUsoImagem?.autorizado)}
                            onCheckedChange={(checked) => {
                              handleUpdateSnapshotField('termoUsoImagem.autorizado', checked);
                            }}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Documento oficial com 10 seções em conformidade com a LGPD e Código de Ética do CFO. Se autorizado, o Termo é anexado ao final do contrato. Se não autorizado, o contrato permanece sem anexo de imagem.
                      </p>

                      {snapshotAtual.termoUsoImagem?.autorizado && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">B — Didático & Científico</Label>
                              <Select
                                value={snapshotAtual.termoUsoImagem?.usoDidaticoCientifico !== false ? 'sim' : 'nao'}
                                onValueChange={(v) => handleUpdateSnapshotField('termoUsoImagem.usoDidaticoCientifico', v === 'sim')}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sim">✓ AUTORIZO</SelectItem>
                                  <SelectItem value="nao">✕ NÃO AUTORIZO</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">C — Publicitário & Redes</Label>
                              <Select
                                value={snapshotAtual.termoUsoImagem?.usoPublicitarioRedesSociais !== false ? 'sim' : 'nao'}
                                onValueChange={(v) => handleUpdateSnapshotField('termoUsoImagem.usoPublicitarioRedesSociais', v === 'sim')}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sim">✓ AUTORIZO</SelectItem>
                                  <SelectItem value="nao">✕ NÃO AUTORIZO</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">E — Depoimentos</Label>
                              <Select
                                value={snapshotAtual.termoUsoImagem?.depoimentos !== false ? 'sim' : 'nao'}
                                onValueChange={(v) => handleUpdateSnapshotField('termoUsoImagem.depoimentos', v === 'sim')}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sim">✓ AUTORIZO</SelectItem>
                                  <SelectItem value="nao">✕ NÃO AUTORIZO</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1 sm:col-span-2 md:col-span-3">
                              <Label className="text-xs text-muted-foreground">D — Nível de Identificação Facial & Voz</Label>
                              <Select
                                value={snapshotAtual.termoUsoImagem?.identificacaoFacialVoz || 'rosto_e_voz'}
                                onValueChange={(v) => handleUpdateSnapshotField('termoUsoImagem.identificacaoFacialVoz', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="rosto_e_voz">Rosto reconhecível e gravações de voz</SelectItem>
                                  <SelectItem value="apenas_bucal">Apenas região bucal (Sorriso/dentes sem identificação direta do rosto)</SelectItem>
                                  <SelectItem value="apenas_voz">Apenas gravações de voz</SelectItem>
                                  <SelectItem value="nao_autoriza_identificacao">Não autorizo identificação (Totalmente anônimo)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1 sm:col-span-2 md:col-span-3">
                              <Label className="text-xs text-muted-foreground">Canal de Atendimento LGPD da Clínica</Label>
                              <Input
                                value={snapshotAtual.termoUsoImagem?.canalContatoLgpd || snapshotAtual?.clinica?.email || ''}
                                onChange={(e) => handleUpdateSnapshotField('termoUsoImagem.canalContatoLgpd', e.target.value)}
                                placeholder="E-mail ou WhatsApp oficial para solicitações de privacidade..."
                                className="h-8 text-xs border-border bg-background text-foreground"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Seção 7: Tratamento Endodôntico (Canal) & Profissional Parceiro */}
                    <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5 text-purple-500" />
                          7. Tratamento Endodôntico (Canal) & Profissional Parceiro
                        </h4>
                        <div className="flex items-center gap-2">
                          <Label htmlFor="toggleEndoEditTab" className="text-xs text-muted-foreground cursor-pointer select-none">
                            {snapshotAtual.dadosEndodontia?.ativo ? 'Ativo (17 Cláusulas)' : 'Inativo'}
                          </Label>
                          <Switch
                            id="toggleEndoEditTab"
                            checked={Boolean(snapshotAtual.dadosEndodontia?.ativo)}
                            onCheckedChange={(checked) => {
                              handleUpdateSnapshotField('dadosEndodontia.ativo', checked);
                              handleUpdateSnapshotField('tipoModeloContrato', checked ? 'endodontia' : 'geral');
                            }}
                          />
                        </div>
                      </div>

                      {snapshotAtual.dadosEndodontia?.ativo && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Executor do Tratamento</Label>
                              <Select
                                value={snapshotAtual.dadosEndodontia.executorTipo || 'dentista_titular'}
                                onValueChange={(v) => handleUpdateSnapshotField('dadosEndodontia.executorTipo', v)}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dentista_titular">Dra. Rosângela Santos Pereira (CRO-AL 06267)</SelectItem>
                                  <SelectItem value="parceiro">Cirurgião-Dentista Parceiro Cadastrado</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {snapshotAtual.dadosEndodontia.executorTipo === 'parceiro' && (
                              <>
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Nome do Parceiro</Label>
                                  <Input
                                    value={snapshotAtual.dadosEndodontia.parceiro?.nome || ''}
                                    onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.parceiro.nome', e.target.value)}
                                    placeholder="Nome do cirurgião parceiro"
                                    className="h-8 text-xs"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">CRO / UF do Parceiro</Label>
                                  <Input
                                    value={snapshotAtual.dadosEndodontia.parceiro?.croUf || ''}
                                    onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.parceiro.croUf', e.target.value)}
                                    placeholder="Ex: CRO-AL 06267"
                                    className="h-8 text-xs"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">CPF / CNPJ do Parceiro</Label>
                                  <Input
                                    value={snapshotAtual.dadosEndodontia.parceiro?.documento || ''}
                                    onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.parceiro.documento', e.target.value)}
                                    placeholder="000.000.000-00 (quando pertinente)"
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </>
                            )}

                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Dente(s) Envolvido(s)</Label>
                              <Input
                                value={snapshotAtual.dadosEndodontia.dentes || ''}
                                onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.dentes', e.target.value)}
                                placeholder="Dente 16, Elemento 21..."
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-2 md:col-span-3">
                              <Label className="text-xs text-muted-foreground">Procedimento(s) Aprovado(s)</Label>
                              <Input
                                value={snapshotAtual.dadosEndodontia.procedimentosAprovados || ''}
                                onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.procedimentosAprovados', e.target.value)}
                                placeholder="Tratamento endodôntico (canal)..."
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-2 md:col-span-3">
                              <Label className="text-xs text-muted-foreground">Diagnóstico Clínico</Label>
                              <Input
                                value={snapshotAtual.dadosEndodontia.diagnostico || ''}
                                onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.diagnostico', e.target.value)}
                                placeholder="Diagnóstico do elemento dental..."
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-2 md:col-span-3">
                              <Label className="text-xs text-muted-foreground">Etapas Previstas</Label>
                              <Input
                                value={snapshotAtual.dadosEndodontia.etapasPrevistas || ''}
                                onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.etapasPrevistas', e.target.value)}
                                placeholder="Abertura coronária, instrumentação biomecânica, desinfecção e obturação..."
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-2 md:col-span-3">
                              <Label className="text-xs text-muted-foreground">Procedimentos Incluídos</Label>
                              <Input
                                value={snapshotAtual.dadosEndodontia.procedimentosIncluidos || ''}
                                onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.procedimentosIncluidos', e.target.value)}
                                placeholder="Tratamento endodôntico (canal), medicação intracanal..."
                                className="h-8 text-xs"
                              />
                            </div>

                            <div className="space-y-1 sm:col-span-2 md:col-span-3">
                              <Label className="text-xs text-muted-foreground">Procedimentos Não Incluídos</Label>
                              <Input
                                value={snapshotAtual.dadosEndodontia.procedimentosNaoIncluidos || ''}
                                onChange={(e) => handleUpdateSnapshotField('dadosEndodontia.procedimentosNaoIncluidos', e.target.value)}
                                placeholder="Restauração definitiva, coroas, pinos, reconstrução protética..."
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botões de Ação na Aba de Edição */}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-border text-foreground hover:bg-muted"
                        onClick={handleRestaurarPadrao}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restaurar Padrão
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 border-border text-foreground hover:bg-muted"
                        onClick={() => {
                          setActiveTab('gerar');
                          toast.success('Visualizando contrato com as alterações aplicadas.');
                        }}
                      >
                        <Eye className="h-4 w-4 text-primary" />
                        Aplicar e Visualizar
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        className="h-9 gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                        onClick={handleEmitirContrato}
                        disabled={salvando}
                      >
                        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {documentoIdSendoEditado ? 'Salvar Alterações no Contrato' : 'Salvar e Emitir Contrato'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: HISTÓRICO DE CONTRATOS EMITIDOS */}
            {activeTab === 'historico' && (
              <div className="space-y-4">
                {contratosEmitidos.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-lg border border-border text-foreground">
                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
                    <h3 className="font-semibold text-base">Nenhum contrato emitido ainda</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Gere o primeiro contrato para este paciente a partir de um orçamento aprovado na aba "Visualizar".
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {contratosEmitidos.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-foreground"
                      >
                        {(() => {
                          const snapItens = (doc.itens || {}) as any;
                          const hasAssinaturaPaciente = Boolean(doc.assinaturaData || doc.assinadoEm || snapItens.assinaturaPaciente?.assinaturaData);
                          const hasAssinaturaProfissional = Boolean(snapItens.assinaturaDentista?.assinaturaData);
                          const isFormalizado = hasAssinaturaPaciente && hasAssinaturaProfissional;

                          return (
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <FileText className="h-4 w-4 text-primary shrink-0" />
                                <h4 className="font-semibold text-sm text-foreground">{doc.titulo}</h4>
                                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                                  Imutável
                                </Badge>

                                {isFormalizado ? (
                                  <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" /> Formalizado por ambas as partes
                                  </Badge>
                                ) : hasAssinaturaPaciente ? (
                                  <Badge className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Assinado pelo paciente
                                  </Badge>
                                ) : hasAssinaturaProfissional ? (
                                  <Badge className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white font-semibold flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Assinado pela profissional
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 font-semibold flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> Pendente de assinatura
                                  </Badge>
                                )}
                              </div>

                              <p className="text-xs text-muted-foreground">
                                Emitido em: {new Date(doc.criadoEm).toLocaleString('pt-BR')}
                                {doc.dentista ? ` • Responsável: ${doc.dentista}` : ''}
                                {hasAssinaturaPaciente && snapItens.assinaturaPaciente?.dataHora && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                    {' '}• Assinado pelo paciente em {new Date(snapItens.assinaturaPaciente.dataHora).toLocaleString('pt-BR')}
                                  </span>
                                )}
                                {hasAssinaturaProfissional && snapItens.assinaturaDentista?.dataHora && (
                                  <span className="text-purple-600 dark:text-purple-400 font-medium">
                                    {' '}• Assinado pela profissional em {new Date(snapItens.assinaturaDentista.dataHora).toLocaleString('pt-BR')}
                                  </span>
                                )}
                              </p>
                            </div>
                          );
                        })()}

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                            onClick={() => {
                              setContratoVisualizacao(doc);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Visualizar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            onClick={() => handleCarregarContratoParaEdicao(doc)}
                            title="Editar manualmente campos deste contrato"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            onClick={() => handleDownloadPdf(doc.conteudo || '', `contrato_${patient?.nome}_${doc.id.slice(0, 8)}`)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            PDF
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                            onClick={() => handleImprimir(doc.conteudo || '')}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Imprimir
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Visualizador de Contrato Selecionado do Histórico */}
                {contratoVisualizacao && (
                  <div className="mt-6 p-4 bg-card rounded-lg border border-border space-y-3 shadow-md">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <h4 className="font-semibold text-sm flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Cópia Fiel Registrada: {contratoVisualizacao.titulo}
                      </h4>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 border-border text-foreground hover:bg-muted"
                          onClick={() => setIsFullScreen(true)}
                        >
                          <Maximize2 className="h-3 w-3" />
                          Tela Cheia
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setContratoVisualizacao(null)}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Fechar
                        </Button>
                      </div>
                    </div>

                    <div
                      className="p-1 sm:p-4 bg-slate-200/70 dark:bg-slate-950/80 rounded flex flex-col items-center justify-start overflow-auto w-full transition-all min-h-[380px] h-[58vh] sm:h-[68vh] flex-1"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                    <iframe
                        srcDoc={contratoVisualizacao.conteudo || ''}
                        title="Visualização do Contrato Gravado"
                        className="w-full h-full max-w-[840px] rounded border border-border bg-white shadow-xl min-h-[360px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rodapé de Ações do Modal */}
          <div className="p-2.5 sm:p-4 border-t border-border bg-card flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
            <div className="text-xs text-muted-foreground hidden lg:flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Gera documento com validade jurídica perante o CFO, CDC e Código Civil.</span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1.5 sm:gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs border-border text-foreground hover:bg-muted"
                onClick={onClose}
              >
                Fechar
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                onClick={() => handleImprimir()}
                disabled={!snapshotAtual}
              >
                <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Imprimir</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs gap-1.5 border-border text-foreground hover:bg-muted"
                onClick={() => handleDownloadPdf()}
                disabled={baixandoPdf || !snapshotAtual}
              >
                {baixandoPdf ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                <span>Baixar PDF</span>
              </Button>

              {temLentesResinaNoContrato && snapshotAtual && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 text-xs gap-1.5 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50"
                  onClick={() => handleDownloadTermoAvulso(downloadTcleLentesResinaPdf, 'TCLE de Lentes em Resina (CFO)')}
                  disabled={!snapshotAtual}
                  title="Baixar Termo de Consentimento Livre e Esclarecido específico para Lentes em Resina (Recomendação CFO)"
                >
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600" />
                  <span>TCLE Lentes (CFO)</span>
                </Button>
              )}

              {snapshotAtual && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 text-xs gap-1.5 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                  onClick={() => handleDownloadTermoAvulso(downloadTermoUsoImagemPdf, 'Termo de Imagem e Voz (LGPD/CFO)')}
                  disabled={!snapshotAtual}
                  title="Baixar Termo de Autorização de Uso de Imagem, Voz e Registros Odontológicos em PDF avulso"
                >
                  <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" />
                  <span>Termo Imagem (PDF)</span>
                </Button>
              )}

              {temEndodontiaNoContrato && snapshotAtual && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 text-xs gap-1.5 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                  onClick={() => handleDownloadTermoAvulso(downloadContratoEndodontiaPdf, 'Contrato de Endodontia (Canal)')}
                  disabled={!snapshotAtual}
                  title="Baixar Contrato Oficial de Tratamento de Canal (Endodontia) em formato PDF A4"
                >
                  <Stethoscope className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600" />
                  <span>Contrato Canal (PDF)</span>
                </Button>
              )}

              {temEndodontiaNoContrato && snapshotAtual && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 text-xs gap-1.5 border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                  onClick={() => handleDownloadTermoAvulso(downloadTcleEndodontiaPdf, 'TCLE de Canal (Endodontia CFO)')}
                  disabled={!snapshotAtual}
                  title="Baixar Termo de Consentimento Livre e Esclarecido específico para Tratamento de Canal (TCLE Endodontia CFO) em PDF A4 de 2 páginas"
                >
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600" />
                  <span>TCLE Canal (CFO)</span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs gap-1.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                onClick={handleCopiarLinkAssinatura}
                disabled={!snapshotAtual}
                title="Copiar link para o paciente assinar online pelo celular"
              >
                {copiouLink ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600" /> : <LinkIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                <span>{copiouLink ? 'Link Copiado!' : 'Copiar Link'}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs gap-1.5 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                onClick={handleAbrirPaginaAssinatura}
                disabled={!snapshotAtual}
                title="Abrir página pública de assinatura digital em nova aba"
              >
                <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Assinatura</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 sm:h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs border-transparent"
                onClick={handleEnviarWhatsApp}
                disabled={!snapshotAtual}
                title="Enviar contrato e link de assinatura via WhatsApp"
              >
                <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>WhatsApp</span>
              </Button>

              {isContratoGravado && !isManuallyEdited && !documentoIdSendoEditado && activeTab !== 'editar' ? (
                <div
                  className="flex items-center gap-1.5 px-3 h-8 sm:h-9 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shadow-xs select-none"
                  title="Este contrato já está gravado no banco de dados e vinculado ao orçamento."
                >
                  <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Contrato Gravado</span>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 sm:h-9 text-xs gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                  onClick={handleEmitirContrato}
                  disabled={salvando || !snapshotAtual || !orcamentoAtual}
                  title={documentoIdSendoEditado || isManuallyEdited || isContratoGravado ? "Salvar alterações realizadas na minuta" : "Gravar contrato oficialmente no sistema"}
                >
                  {salvando ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  <span>{documentoIdSendoEditado || isManuallyEdited || isContratoGravado ? 'Salvar Alterações' : 'Gravar Contrato'}</span>
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </DialogContent>
      </Dialog>

      {/* Modal de Assinatura Digital Integrado */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        title={signerRole === 'paciente' ? 'Assinatura do Paciente / Contratante' : 'Assinatura do Cirurgião-Dentista'}
        signerName={signerRole === 'paciente' ? patient?.nome || 'Paciente' : snapshotAtual?.clinica?.dentistaResponsavel || selectedDentistaNome || 'Cirurgião-Dentista'}
        signerRole={signerRole}
        documentType="contrato"
        requireIdentificationFields={signerRole === 'paciente'}
        requireSelfie={false}
        initialEmail={signerRole === 'paciente' ? (temValorValido(patient?.email) ? patient.email : (temValorValido(snapshotAtual?.paciente?.email) ? snapshotAtual?.paciente?.email : '')) : snapshotAtual?.clinica?.email}
        initialCpf={signerRole === 'paciente' ? (temValorValido(patient?.cpf) ? patient.cpf : (temValorValido(snapshotAtual?.paciente?.cpf) ? snapshotAtual?.paciente?.cpf : '')) : snapshotAtual?.clinica?.cnpj}
        initialRg={signerRole === 'paciente' ? (temValorValido(patient?.rg) ? patient.rg : (temValorValido(snapshotAtual?.paciente?.rg) ? snapshotAtual?.paciente?.rg : '')) : snapshotAtual?.clinica?.cro}
        onSignatureComplete={handleAssinaturaConcluida}
      />

      {/* Modal para Completar Dados Cadastrais do Paciente ao Assinar */}
      <Dialog open={modalCompletarDadosAdminOpen} onOpenChange={setModalCompletarDadosAdminOpen}>
        <DialogContent className="max-w-md w-full p-5 sm:p-6 bg-card text-card-foreground border border-border shadow-2xl rounded-xl">
          <DialogHeader className="space-y-1.5">
            <div className="flex items-center gap-2 text-primary">
              <MapPin className="h-5 w-5" />
              <DialogTitle className="text-base font-bold text-foreground">
                Completar Dados do Paciente para Formalização
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
              O contrato exige qualificação completa (Endereço e CPF) para validação jurídica perante o CFO e Código Civil.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 my-2">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">CPF do Paciente:</label>
                <Input
                  placeholder="000.000.000-00"
                  value={quickCpf}
                  onChange={(e) => setQuickCpf(formatarDocumento(e.target.value))}
                  maxLength={14}
                  className="h-9 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Telefone / WhatsApp:</label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={quickTelefone}
                  onChange={(e) => setQuickTelefone(formatarTelefone(e.target.value))}
                  maxLength={15}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground mb-1 block">
                Endereço Completo: <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Ex: Rua das Flores, 123, Apto 402, Ponta Verde, Maceió - AL, CEP 57035-000"
                value={quickEndereco}
                onChange={(e) => setQuickEndereco(e.target.value)}
                rows={3}
                className="text-xs resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Informe logradouro, número, complemento (se houver), bairro, cidade e estado.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalCompletarDadosAdminOpen(false)}
              disabled={salvandoDadosPaciente}
              className="text-xs h-9"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={salvandoDadosPaciente || !quickEndereco.trim()}
              onClick={async () => {
                await handleSalvarDadosPacienteRapido();
                setModalCompletarDadosAdminOpen(false);
                setSignerRole('paciente');
                setIsSignatureModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 gap-1.5 shadow-sm"
            >
              {salvandoDadosPaciente ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Salvar e Abrir Assinatura
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Flexibilização de Pagamento no Contrato */}
      <Dialog open={modalFlexibilizarContratoOpen} onOpenChange={(open) => !open && setModalFlexibilizarContratoOpen(false)}>
        <DialogContent className="max-w-md w-full">
          <div className="space-y-1 border-b pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-5 w-5 text-primary" />
              Flexibilizar Condição de Pagamento do Contrato
            </DialogTitle>
            <p className="text-xs text-muted-foreground">
              Ajuste valores de entrada, desconto ou parcelas. O contrato e o cronograma serão atualizados na hora.
            </p>
          </div>

          {condicaoFlexibilizarContrato && orcamentoAtual && (
            <div className="space-y-3.5 py-1">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Título Comercial da Condição:</Label>
                <Input
                  value={condicaoFlexibilizarContrato.titulo || ''}
                  onChange={(e) => setCondicaoFlexibilizarContrato((prev) => ({ ...prev, titulo: e.target.value }))}
                  className="h-8 text-xs font-semibold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Modelo:</Label>
                <select
                  value={condicaoFlexibilizarContrato.tipo || 'personalizado'}
                  onChange={(e) => {
                    const t = e.target.value as any;
                    const upd: Partial<CondicaoPagamento> = { ...condicaoFlexibilizarContrato, tipo: t };
                    if (t === 'a_vista') {
                      upd.descontoPercentual = upd.descontoPercentual ?? 10;
                      upd.descontoValor = Number(((orcamentoAtual.total * (upd.descontoPercentual || 10)) / 100).toFixed(2));
                      upd.valorTotal = Math.max(0, orcamentoAtual.total - (upd.descontoValor || 0));
                    } else if (t === 'cartao') {
                      upd.parcelas = upd.parcelas || 6;
                      upd.valorTotal = orcamentoAtual.total;
                      upd.valorParcela = Number((orcamentoAtual.total / (upd.parcelas || 6)).toFixed(2));
                      upd.tipoCartao = 'credito';
                    } else if (t === 'entrada_saldo') {
                      upd.valorEntrada = upd.valorEntrada ?? Math.round(orcamentoAtual.total * 0.3);
                      upd.metodoEntrada = upd.metodoEntrada || 'pix';
                      upd.saldoParcelas = upd.saldoParcelas || 5;
                      upd.saldoMetodo = upd.saldoMetodo || 'cartao';
                      const s = Math.max(0, orcamentoAtual.total - (upd.valorEntrada || 0));
                      upd.saldoValorParcela = Number((s / (upd.saldoParcelas || 5)).toFixed(2));
                      upd.valorTotal = orcamentoAtual.total;
                    } else if (t === 'pix_parcelado') {
                      upd.parcelas = upd.parcelas || 4;
                      upd.diaVencimento = upd.diaVencimento || 10;
                      upd.valorTotal = orcamentoAtual.total;
                      upd.valorParcela = Number((orcamentoAtual.total / (upd.parcelas || 4)).toFixed(2));
                    }
                    upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                    setCondicaoFlexibilizarContrato(upd);
                  }}
                  className="w-full h-8 px-2 text-xs font-semibold rounded-md bg-background border border-border"
                >
                  <option value="a_vista">À Vista (PIX / Transferência)</option>
                  <option value="cartao">Cartão de Crédito</option>
                  <option value="entrada_saldo">Entrada + Saldo Parcelado</option>
                  <option value="pix_parcelado">PIX Parcelado</option>
                  <option value="boleto">Boleto Bancário</option>
                  <option value="personalizado">Personalizado</option>
                </select>
              </div>

              {condicaoFlexibilizarContrato.tipo === 'a_vista' && (
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/40 border border-border text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px]">% Desconto:</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={condicaoFlexibilizarContrato.descontoPercentual ?? ''}
                      onChange={(e) => {
                        const p = Number(e.target.value) || 0;
                        const descVal = Number(((orcamentoAtual.total * p) / 100).toFixed(2));
                        const upd = {
                          ...condicaoFlexibilizarContrato,
                          descontoPercentual: p,
                          descontoValor: descVal,
                          valorTotal: Math.max(0, orcamentoAtual.total - descVal),
                        };
                        upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                        setCondicaoFlexibilizarContrato(upd);
                      }}
                      className="h-8 text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Valor Final Contrato:</Label>
                    <div className="h-8 px-2 flex items-center font-bold text-xs text-emerald-600 bg-background rounded border border-border">
                      {formatMoney(condicaoFlexibilizarContrato.valorTotal || orcamentoAtual.total)}
                    </div>
                  </div>
                </div>
              )}

              {condicaoFlexibilizarContrato.tipo === 'cartao' && (
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/40 border border-border text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Parcelas Cartão:</Label>
                    <select
                      value={condicaoFlexibilizarContrato.parcelas || 1}
                      onChange={(e) => {
                        const p = Number(e.target.value) || 1;
                        const upd = {
                          ...condicaoFlexibilizarContrato,
                          parcelas: p,
                          valorParcela: Number((orcamentoAtual.total / p).toFixed(2)),
                        };
                        upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                        setCondicaoFlexibilizarContrato(upd);
                      }}
                      className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                    >
                      {[1, 2, 3, 4, 5, 6, 8, 10, 12, 18].map((n) => (
                        <option key={n} value={n}>
                          {n}x de {formatMoney(orcamentoAtual.total / n)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Tipo:</Label>
                    <select
                      value={condicaoFlexibilizarContrato.tipoCartao || 'credito'}
                      onChange={(e) => {
                        const upd = { ...condicaoFlexibilizarContrato, tipoCartao: e.target.value as any };
                        upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                        setCondicaoFlexibilizarContrato(upd);
                      }}
                      className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                    >
                      <option value="credito">Crédito</option>
                      <option value="debito">Débito</option>
                    </select>
                  </div>
                </div>
              )}

              {condicaoFlexibilizarContrato.tipo === 'entrada_saldo' && (
                <div className="space-y-2 p-2.5 rounded bg-muted/40 border border-border text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Entrada (R$):</Label>
                      <Input
                        type="number"
                        min={0}
                        max={orcamentoAtual.total}
                        step="0.01"
                        value={condicaoFlexibilizarContrato.valorEntrada || ''}
                        onChange={(e) => {
                          const ent = Number(e.target.value) || 0;
                          const s = Math.max(0, orcamentoAtual.total - ent);
                          const parc = condicaoFlexibilizarContrato.saldoParcelas || 1;
                          const upd = {
                            ...condicaoFlexibilizarContrato,
                            valorEntrada: ent,
                            saldoValorParcela: Number((s / parc).toFixed(2)),
                          };
                          upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                          setCondicaoFlexibilizarContrato(upd);
                        }}
                        className="h-8 text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Método Entrada:</Label>
                      <select
                        value={condicaoFlexibilizarContrato.metodoEntrada || 'pix'}
                        onChange={(e) => {
                          const upd = { ...condicaoFlexibilizarContrato, metodoEntrada: e.target.value as any };
                          upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                          setCondicaoFlexibilizarContrato(upd);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                      >
                        <option value="pix">PIX</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao_debito">Débito</option>
                        <option value="cartao_credito">Crédito</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px]">Parcelas do Saldo:</Label>
                      <select
                        value={condicaoFlexibilizarContrato.saldoParcelas || 1}
                        onChange={(e) => {
                          const parc = Number(e.target.value) || 1;
                          const ent = condicaoFlexibilizarContrato.valorEntrada || 0;
                          const s = Math.max(0, orcamentoAtual.total - ent);
                          const upd = {
                            ...condicaoFlexibilizarContrato,
                            saldoParcelas: parc,
                            saldoValorParcela: Number((s / parc).toFixed(2)),
                          };
                          upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                          setCondicaoFlexibilizarContrato(upd);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24].map((n) => (
                          <option key={n} value={n}>
                            {n}x mensais
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Forma do Saldo:</Label>
                      <select
                        value={condicaoFlexibilizarContrato.saldoMetodo || 'cartao'}
                        onChange={(e) => {
                          const upd = { ...condicaoFlexibilizarContrato, saldoMetodo: e.target.value as any };
                          upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                          setCondicaoFlexibilizarContrato(upd);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                      >
                        <option value="cartao">Cartão de Crédito</option>
                        <option value="pix_parcelado">PIX Parcelado</option>
                        <option value="boleto">Boleto Bancário</option>
                        <option value="conclusao">Na Conclusão</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px]">Dia de Vencimento:</Label>
                      <select
                        value={condicaoFlexibilizarContrato.diaVencimento || 10}
                        onChange={(e) => {
                          const d = Number(e.target.value) || 10;
                          const upd = { ...condicaoFlexibilizarContrato, diaVencimento: d };
                          upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                          setCondicaoFlexibilizarContrato(upd);
                        }}
                        className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                      >
                        {[1, 5, 10, 15, 20, 25, 26, 28, 30].map((d) => (
                          <option key={d} value={d}>
                            Todo dia {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {condicaoFlexibilizarContrato.tipo === 'pix_parcelado' && (
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/40 border border-border text-xs">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Parcelas no PIX:</Label>
                    <select
                      value={condicaoFlexibilizarContrato.parcelas || 3}
                      onChange={(e) => {
                        const p = Number(e.target.value) || 3;
                        const upd = { ...condicaoFlexibilizarContrato, parcelas: p };
                        upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                        setCondicaoFlexibilizarContrato(upd);
                      }}
                      className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                    >
                      {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                        <option key={n} value={n}>
                          {n}x de {formatMoney(orcamentoAtual.total / n)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Dia de Vencimento:</Label>
                    <select
                      value={condicaoFlexibilizarContrato.diaVencimento || 10}
                      onChange={(e) => {
                        const d = Number(e.target.value) || 10;
                        const upd = { ...condicaoFlexibilizarContrato, diaVencimento: d };
                        upd.descricao = calcularDescricaoCondicao(upd, orcamentoAtual.total);
                        setCondicaoFlexibilizarContrato(upd);
                      }}
                      className="w-full h-8 px-2 text-xs font-semibold rounded bg-background border border-border"
                    >
                      {[1, 5, 10, 15, 20, 25, 28, 30].map((d) => (
                        <option key={d} value={d}>
                          Todo dia {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label className="text-[11px] font-semibold">Descrição no Contrato (Cláusula 3ª):</Label>
                  <button
                    type="button"
                    onClick={() => {
                      const desc = calcularDescricaoCondicao(condicaoFlexibilizarContrato, orcamentoAtual.total);
                      setCondicaoFlexibilizarContrato((prev) => (prev ? { ...prev, descricao: desc } : null));
                    }}
                    className="text-[10px] text-primary hover:underline font-medium"
                  >
                    Recalcular texto
                  </button>
                </div>
                <Textarea
                  rows={2}
                  value={condicaoFlexibilizarContrato.descricao || ''}
                  onChange={(e) => setCondicaoFlexibilizarContrato((prev) => (prev ? { ...prev, descricao: e.target.value } : null))}
                  className="text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setModalFlexibilizarContratoOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSalvarFlexibilizacaoContrato}
                >
                  Aplicar ao Contrato e Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ContratoModal;

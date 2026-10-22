import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import {
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Download,
  Copy,
  Check,
  ShieldCheck,
  MessageCircle,
  Building2,
  User,
  CreditCard,
  QrCode,
  FileCheck,
  Maximize2,
  Minimize2,
  Camera,
  EyeOff,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Stethoscope,
  FileSignature,
  PenTool,
  RefreshCw,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/utils/exportCsv';
import { gerarPayloadPix, gerarQrCodePixUrl } from '@/utils/pixPayload';
import {
  ContratoSnapshot,
  decodificarContratoUrl,
  gerarHtmlContrato,
  identificarTipoDocumento,
  isContratoLenteResina,
  isContratoEndodontia,
  temValorValido,
  obterCardsResumoPagamento,
  isMetodoPix,
  isMetodoCartao,
  limparFormaPagamentoParaContrato,
  mapearDadosContrato,
} from '@/utils/contratoEngine';
import { slugifyNome } from '@/utils/anamneseEngine';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { downloadHtmlAsPdf } from '@/utils/pdfDownload';
import { openWhatsApp } from '@/lib/whatsapp';
import { supabase } from '@/integrations/supabase/client';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start py-8 px-3 sm:px-6">
    <div className="w-full max-w-4xl space-y-6">{children}</div>
  </div>
);

export default function AssinarContrato() {
  const { id, slug, publicSlug } = useParams<{ id?: string; slug?: string; publicSlug?: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t');
  const encodedData = searchParams.get('c') || searchParams.get('data');
  const idFromQuery = searchParams.get('id') || searchParams.get('contratoId');
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const rawSlug = slug || publicSlug || (currentPath ? currentPath.replace(/^\//, '') : '');
  const targetId = idFromQuery || id || '';

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<ContratoSnapshot | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showProfessionalSignatureModal, setShowProfessionalSignatureModal] = useState(false);
  const [concordouTermos, setConcordouTermos] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [copiouPix, setCopiouPix] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Estado para Modal de QR Code PIX por Parcela ou Geral em Tela Cheia
  const [modalPixParcela, setModalPixParcela] = useState<{
    numero: number;
    descricao: string;
    vencimento: string;
    valor: number;
    payloadPix: string;
    qrCodeUrl: string;
  } | null>(null);
  const [copiouModalPix, setCopiouModalPix] = useState(false);

  // Estados de Autorização de Uso de Imagem e Voz (Facultativo - Autorizo por primeiro)
  const [autorizaImagem, setAutorizaImagem] = useState<boolean>(true);
  const [usoDidatico, setUsoDidatico] = useState<boolean>(true);
  const [usoPublicitario, setUsoPublicitario] = useState<boolean>(true);
  const [identificacao, setIdentificacao] = useState<'rosto_e_voz' | 'apenas_voz' | 'apenas_bucal' | 'nao_autoriza_identificacao'>('rosto_e_voz');
  const [depoimentos, setDepoimentos] = useState<boolean>(true);
  const [expandirLeituraTermo, setExpandirLeituraTermo] = useState<boolean>(true);

  // HTML oficial completo do contrato gerado na íntegra
  const htmlContrato = useMemo(() => {
    if (!snapshot) return '';
    return gerarHtmlContrato(snapshot);
  }, [snapshot]);

  // Cartões inteligentes de resumo financeiro (Entrada sinalizada em verde, Parcelamento restante e PIX Final)
  const cardsPagamento = useMemo(() => {
    return obterCardsResumoPagamento(snapshot);
  }, [snapshot]);

  // Tecla ESC fecha a visualização em tela cheia
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        e.preventDefault();
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFullScreen]);

  // Sincroniza escolhas de imagem a partir do snapshot (Autorizo por primeiro)
  useEffect(() => {
    if (snapshot) {
      const isJaAssinado = Boolean(snapshot.assinaturaPaciente?.assinaturaData || snapshot.status === 'assinado');
      if (isJaAssinado && snapshot.termoUsoImagem) {
        setAutorizaImagem(Boolean(snapshot.termoUsoImagem.autorizado));
      } else {
        // Para contratos pendentes ou novos, define 'Autorizo' por primeiro
        setAutorizaImagem(true);
      }
      if (snapshot.termoUsoImagem) {
        if (snapshot.termoUsoImagem.usoDidaticoCientifico !== undefined) {
          setUsoDidatico(snapshot.termoUsoImagem.usoDidaticoCientifico);
        }
        if (snapshot.termoUsoImagem.usoPublicitarioRedesSociais !== undefined) {
          setUsoPublicitario(snapshot.termoUsoImagem.usoPublicitarioRedesSociais);
        }
        if (snapshot.termoUsoImagem.identificacaoFacialVoz) {
          setIdentificacao(snapshot.termoUsoImagem.identificacaoFacialVoz);
        } else {
          setIdentificacao('rosto_e_voz');
        }
        if (snapshot.termoUsoImagem.depoimentos !== undefined) {
          setDepoimentos(snapshot.termoUsoImagem.depoimentos);
        }
      }
    }
  }, [snapshot?.contratoId]);

  // Atualiza as preferências de imagem no snapshot em tempo real
  const handleAtualizarTermoImagem = (
    novoAutoriza: boolean,
    opts?: {
      didatico?: boolean;
      publicitario?: boolean;
      ident?: 'rosto_e_voz' | 'apenas_voz' | 'apenas_bucal' | 'nao_autoriza_identificacao';
      depoim?: boolean;
    }
  ) => {
    setAutorizaImagem(novoAutoriza);
    const did = opts?.didatico !== undefined ? opts.didatico : usoDidatico;
    const pub = opts?.publicitario !== undefined ? opts.publicitario : usoPublicitario;
    const idf = opts?.ident !== undefined ? opts.ident : identificacao;
    const dep = opts?.depoim !== undefined ? opts.depoim : depoimentos;

    if (opts?.didatico !== undefined) setUsoDidatico(did);
    if (opts?.publicitario !== undefined) setUsoPublicitario(pub);
    if (opts?.ident !== undefined) setIdentificacao(idf);
    if (opts?.depoim !== undefined) setDepoimentos(dep);

    if (!snapshot) return;

    setSnapshot({
      ...snapshot,
      termoUsoImagem: {
        ativo: true,
        autorizado: novoAutoriza,
        usoDidaticoCientifico: did,
        usoPublicitarioRedesSociais: pub,
        identificacaoFacialVoz: idf,
        depoimentos: dep,
        canalContatoLgpd: snapshot.clinica.email || snapshot.clinica.telefone,
      },
    });
  };

  // Carrega os dados do contrato
  useEffect(() => {
    async function carregarContrato() {
      setLoading(true);
      let foundSnapshot: ContratoSnapshot | null = null;
      const cleanSlug = rawSlug
        ? rawSlug.replace(/^assinar-contrato-/, '').replace(/^contrato-/, '').replace(/^contrato\//, '').trim()
        : '';

      // 1. Tenta decodificar da URL (?c= ou ?data=) - 100% autônomo e cross-device via WhatsApp
      if (encodedData) {
        const decoded = decodificarContratoUrl(encodedData);
        if (decoded) {
          foundSnapshot = decoded;
          // Se já houver versão assinada salva no cache local deste dispositivo, prioriza
          const localAssinado =
            (decoded.contratoId ? localStorage.getItem(`contrato_assinado_${decoded.contratoId}`) : null) ||
            (targetId ? localStorage.getItem(`contrato_assinado_${targetId}`) : null);
          if (localAssinado) {
            try {
              const cachedSnap = JSON.parse(localAssinado);
              if (cachedSnap?.assinaturaPaciente?.assinaturaData) {
                foundSnapshot = cachedSnap;
              }
            } catch (_) {}
          }
        }
      }

      // 2. Tenta recuperar do localStorage por targetId, contratoId, cleanSlug ou varredura de chaves
      if (!foundSnapshot && (targetId || rawSlug || cleanSlug)) {
        const possibleKeys = [
          targetId ? `contrato_assinado_${targetId}` : '',
          targetId ? `contrato_${targetId}` : '',
          rawSlug ? `contrato_assinado_${rawSlug}` : '',
          rawSlug ? `contrato_slug_${rawSlug}` : '',
          cleanSlug ? `contrato_slug_${cleanSlug}` : '',
          cleanSlug ? `contrato_assinado_${cleanSlug}` : '',
        ].filter(Boolean);

        for (const k of possibleKeys) {
          const item = localStorage.getItem(k);
          if (item) {
            try {
              const parsed = JSON.parse(item);
              if (parsed && (parsed.contratoId || parsed.paciente || parsed.orcamento)) {
                foundSnapshot = parsed as ContratoSnapshot;
                break;
              }
            } catch (_) {}
          }
        }

        // Varredura de segurança em todas as chaves de contrato do localStorage
        if (!foundSnapshot) {
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (!key || (!key.startsWith('contrato_') && !key.startsWith('documento_'))) continue;
              const val = localStorage.getItem(key);
              if (!val) continue;
              try {
                const parsed = JSON.parse(val);
                if (!parsed || typeof parsed !== 'object') continue;

                // Match por ID ou ContratoId ou OrçamentoId
                if (
                  targetId &&
                  (parsed.contratoId === targetId ||
                    parsed.id === targetId ||
                    parsed.orcamentoId === targetId ||
                    parsed.orcamento?.id === targetId)
                ) {
                  foundSnapshot = parsed as ContratoSnapshot;
                  break;
                }

                // Match por slug ou nome do paciente
                if (cleanSlug) {
                  const nomeP = (parsed.pacienteNome || parsed.paciente?.nome || '').toLowerCase();
                  if (slugifyNome(nomeP) === cleanSlug || nomeP.includes(cleanSlug)) {
                    foundSnapshot = parsed as ContratoSnapshot;
                    break;
                  }
                }
              } catch (_) {}
            }
          } catch (_) {}
        }

        // Tenta também recuperar de documentos clínicos salvos localmente
        if (!foundSnapshot) {
          try {
            const docsLocais = JSON.parse(localStorage.getItem('dental-system-documentos') || '[]');
            if (Array.isArray(docsLocais)) {
              const docMatch = docsLocais.find((d: any) => {
                if (d.tipo !== 'contrato') return false;
                if (targetId && (d.id === targetId || d.itens?.contratoId === targetId)) return true;
                if (cleanSlug) {
                  const nomeDoc = (d.pacienteNome || d.paciente_nome || d.itens?.pacienteNome || '').toLowerCase();
                  return slugifyNome(nomeDoc) === cleanSlug;
                }
                return false;
              });
              if (docMatch && docMatch.itens) {
                foundSnapshot = docMatch.itens as ContratoSnapshot;
              }
            }
          } catch (_) {}
        }

        // Tenta também recuperar a partir dos orçamentos locais (dental-system-orcamentos)
        if (!foundSnapshot) {
          try {
            const orcsRaw = localStorage.getItem('dental-system-orcamentos');
            if (orcsRaw) {
              const orcs = JSON.parse(orcsRaw);
              if (Array.isArray(orcs)) {
                const orcMatch = orcs.find((o: any) => {
                  if (targetId && (o.id === targetId || o.numeroIdentificador === targetId)) return true;
                  if (cleanSlug) {
                    const pName = (o.pacienteNome || o.paciente_nome || '').toLowerCase();
                    return slugifyNome(pName) === cleanSlug || pName.includes(cleanSlug);
                  }
                  return false;
                });

                if (orcMatch) {
                  const pacsRaw = localStorage.getItem('dental-system-pacientes');
                  const pacs = pacsRaw ? JSON.parse(pacsRaw) : [];
                  const pacMatch = Array.isArray(pacs)
                    ? pacs.find((p: any) => p.id === orcMatch.pacienteId || p.nome === orcMatch.pacienteNome)
                    : null;

                  const cfgRaw = localStorage.getItem('dental-system-configuracoes');
                  const configuracoes = cfgRaw ? JSON.parse(cfgRaw) : null;
                  const cfgContratoRaw = localStorage.getItem('dental-system-configuracoes-contrato');
                  const configContrato = cfgContratoRaw ? JSON.parse(cfgContratoRaw) : null;
                  const dtsRaw = localStorage.getItem('dental-system-dentistas');
                  const dentistas = dtsRaw ? JSON.parse(dtsRaw) : [];

                  foundSnapshot = mapearDadosContrato({
                    patient: pacMatch || { nome: orcMatch.pacienteNome || 'Paciente' },
                    orcamento: orcMatch,
                    configuracoes,
                    configContrato,
                    dentistas,
                    dadosRestauracoesPreexistentes: pacMatch?.restauracoesPreexistentes,
                  });
                }
              }
            }
          } catch (err) {
            console.warn('Erro ao restaurar snapshot de dental-system-orcamentos:', err);
          }
        }
      }

      // 3. Tenta buscar via Edge Function pública 'contrato-publico' (se disponível)
      if (!foundSnapshot && targetId) {
        try {
          const { data: funcData, error: funcErr } = await supabase.functions.invoke('contrato-publico', {
            body: { action: 'get', id: targetId },
          });

          if (!funcErr && funcData?.ok && funcData?.snapshot) {
            const snap = funcData.snapshot as ContratoSnapshot;
            if (funcData.assinadoEm && !snap.assinaturaPaciente) {
              snap.status = 'assinado';
              snap.assinaturaPaciente = {
                assinaturaData: '',
                nome: funcData.assinanteNome || snap.paciente.nome,
                dataHora: funcData.assinadoEm,
              };
            }
            foundSnapshot = snap;
          }
        } catch (_) {}
      }

      // 4. Fallback no banco de dados Supabase (documentos_clinicos) com proteção contra erros de sintaxe UUID
      if (!foundSnapshot && (targetId || rawSlug || cleanSlug)) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);

          if (isUuid) {
            // Busca diretamente pelo UUID do registro
            const { data, error } = await supabase
              .from('documentos_clinicos')
              .select('*')
              .eq('id', targetId)
              .maybeSingle();

            if (!error && data && data.itens) {
              foundSnapshot = data.itens as ContratoSnapshot;
              if (data.assinado_em && !foundSnapshot.assinaturaPaciente) {
                foundSnapshot.status = 'assinado';
                foundSnapshot.assinaturaPaciente = {
                  assinaturaData: data.assinatura_data || '',
                  nome: data.assinante_nome || foundSnapshot.paciente.nome,
                  dataHora: data.assinado_em,
                };
              }
            }
          } else {
            // Se NÃO for UUID (ex: CTR-1234), busca documentos tipo 'contrato' sem estourar erro de sintaxe UUID
            const { data: listaDocs, error } = await supabase
              .from('documentos_clinicos')
              .select('*')
              .eq('tipo', 'contrato')
              .order('criado_em', { ascending: false })
              .limit(30);

            if (!error && listaDocs && listaDocs.length > 0) {
              const matched = listaDocs.find((doc: any) => {
                const itens = doc.itens;
                if (!itens) return false;
                if (targetId && (itens.contratoId === targetId || itens.orcamentoId === targetId || doc.id === targetId)) {
                  return true;
                }
                if (cleanSlug) {
                  const nomeP = (doc.paciente_nome || itens.pacienteNome || itens.paciente?.nome || '').toLowerCase();
                  return slugifyNome(nomeP) === cleanSlug;
                }
                return false;
              });

              if (matched && matched.itens) {
                foundSnapshot = matched.itens as ContratoSnapshot;
                if (matched.assinado_em && !foundSnapshot.assinaturaPaciente) {
                  foundSnapshot.status = 'assinado';
                  foundSnapshot.assinaturaPaciente = {
                    assinaturaData: matched.assinatura_data || '',
                    nome: matched.assinante_nome || foundSnapshot.paciente.nome,
                    dataHora: matched.assinado_em,
                  };
                }
              }
            }
          }

          // Fallback na tabela orcamentos do Supabase se o targetId for o UUID de um orçamento
          if (!foundSnapshot && targetId && isUuid) {
            try {
              const { data: orcData, error: orcErr } = await supabase
                .from('orcamentos')
                .select('*')
                .eq('id', targetId)
                .maybeSingle();

              if (!orcErr && orcData) {
                let pacData: any = null;
                if (orcData.paciente_id) {
                  const { data: p } = await supabase
                    .from('pacientes')
                    .select('*')
                    .eq('id', orcData.paciente_id)
                    .maybeSingle();
                  pacData = p;
                }
                foundSnapshot = mapearDadosContrato({
                  patient: pacData || { nome: orcData.paciente_nome || 'Paciente' },
                  orcamento: orcData as any,
                });
              }
            } catch (_) {}
          }
        } catch (_) {}
      }

      // Aplica o snapshot encontrado e atualiza o cache local
      if (foundSnapshot) {
        setSnapshot(foundSnapshot);
        try {
          const snapStr = JSON.stringify(foundSnapshot);
          if (foundSnapshot.contratoId) {
            localStorage.setItem(`contrato_${foundSnapshot.contratoId}`, snapStr);
          }
          if (targetId) {
            localStorage.setItem(`contrato_${targetId}`, snapStr);
          }
          if (cleanSlug) {
            localStorage.setItem(`contrato_slug_${cleanSlug}`, snapStr);
          }
        } catch (_) {}
      } else {
        setSnapshot(null);
      }

      setLoading(false);
    }

    carregarContrato();
  }, [targetId, rawSlug, encodedData]);

  // Registra a assinatura digital do paciente
  const handleSignatureComplete = async (sigData: SignatureData) => {
    if (!snapshot) return;

    try {
      const dataHoraIso = new Date().toISOString();
      const updatedSnapshot: ContratoSnapshot = {
        ...snapshot,
        status: 'assinado',
        termoUsoImagem: {
          ativo: true,
          autorizado: autorizaImagem,
          usoDidaticoCientifico: usoDidatico,
          usoPublicitarioRedesSociais: usoPublicitario,
          identificacaoFacialVoz: identificacao,
          depoimentos: depoimentos,
          canalContatoLgpd: snapshot.clinica.email || snapshot.clinica.telefone,
        },
        assinaturaPaciente: {
          assinaturaData: sigData.signature,
          nome: sigData.signerName || snapshot.paciente.nome,
          dataHora: dataHoraIso,
          email: sigData.signerInfo?.email || snapshot.paciente.email,
          cpf: sigData.signerInfo?.cpf || snapshot.paciente.cpf,
          rg: sigData.signerInfo?.rg || snapshot.paciente.rg,
          selfie: sigData.selfie || sigData.signerInfo?.selfie,
        },
      };

      setSnapshot(updatedSnapshot);
      setShowSignatureModal(false);

      // Salva no localStorage para persistência garantida no navegador do paciente
      const finalDocId = targetId || snapshot.contratoId;
      localStorage.setItem(`contrato_assinado_${snapshot.contratoId}`, JSON.stringify(updatedSnapshot));
      if (finalDocId) {
        localStorage.setItem(`contrato_assinado_${finalDocId}`, JSON.stringify(updatedSnapshot));
      }

      // 1. Tenta persistir remotamente via Edge Function pública (sem exigir login)
      let persistiuRemoto = false;
      if (finalDocId) {
        try {
          const { data: signRes, error: signErr } = await supabase.functions.invoke('contrato-publico', {
            body: {
              action: 'sign',
              id: finalDocId,
              signature: sigData.signature,
              signerName: sigData.signerName || snapshot.paciente.nome,
              selfie: sigData.selfie,
              signerInfo: sigData.signerInfo,
              snapshot: updatedSnapshot,
            },
          });
          if (!signErr && signRes?.ok) {
            persistiuRemoto = true;
          }
        } catch (edgeErr) {
          console.warn('Erro ao assinar via Edge function:', edgeErr);
        }
      }

      // 2. Fallback: Tenta persistir direto no Supabase caso a tabela permita
      if (finalDocId && !persistiuRemoto) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalDocId);
          if (isUuid) {
            await supabase
              .from('documentos_clinicos')
              .update({
                assinatura_data: sigData.signature,
                assinante_nome: sigData.signerName || snapshot.paciente.nome,
                assinado_em: dataHoraIso,
                itens: updatedSnapshot as any,
              })
              .eq('id', finalDocId);
          } else {
            const { data: matchedDocs } = await supabase
              .from('documentos_clinicos')
              .select('id, itens')
              .eq('tipo', 'contrato')
              .limit(20);
            const foundDoc = (matchedDocs || []).find(
              (d: any) => d.itens?.contratoId === finalDocId || d.itens?.contratoId === snapshot.contratoId
            );
            if (foundDoc?.id) {
              await supabase
                .from('documentos_clinicos')
                .update({
                  assinatura_data: sigData.signature,
                  assinante_nome: sigData.signerName || snapshot.paciente.nome,
                  assinado_em: dataHoraIso,
                  itens: updatedSnapshot as any,
                })
                .eq('id', foundDoc.id);
            }
          }
        } catch (dbErr) {
          console.warn('Persistência remota direta silenciosa:', dbErr);
        }
      }

      toast.success('Contrato assinado com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar assinatura: ' + (err?.message || 'Tente novamente'));
    }
  };

  // Registra a assinatura digital do(a) Cirurgião(ã)-Dentista / Profissional Responsável
  const handleProfessionalSignatureComplete = async (sigData: SignatureData) => {
    if (!snapshot) return;

    try {
      const dataHoraIso = new Date().toISOString();
      const updatedSnapshot: ContratoSnapshot = {
        ...snapshot,
        status: snapshot.assinaturaPaciente?.assinaturaData ? 'assinado' : snapshot.status,
        assinaturaDentista: {
          assinaturaData: sigData.signature,
          nome: sigData.signerName || snapshot.clinica.dentistaResponsavel,
          cro: snapshot.clinica.cro,
          dataHora: dataHoraIso,
        },
      };

      setSnapshot(updatedSnapshot);
      setShowProfessionalSignatureModal(false);

      // Salva no localStorage para persistência em múltiplos navegadores e acessos
      const finalDocId = targetId || snapshot.contratoId;
      localStorage.setItem(`contrato_assinado_${snapshot.contratoId}`, JSON.stringify(updatedSnapshot));
      localStorage.setItem(`contrato_${snapshot.contratoId}`, JSON.stringify(updatedSnapshot));
      if (finalDocId) {
        localStorage.setItem(`contrato_assinado_${finalDocId}`, JSON.stringify(updatedSnapshot));
        localStorage.setItem(`contrato_${finalDocId}`, JSON.stringify(updatedSnapshot));
      }
      if (rawSlug) {
        localStorage.setItem(`contrato_slug_${rawSlug}`, JSON.stringify(updatedSnapshot));
        localStorage.setItem(`contrato_slug_${rawSlug.replace(/^assinar-contrato-/, '')}`, JSON.stringify(updatedSnapshot));
      }

      // 1. Tenta persistir remotamente via Edge Function pública
      let persistiuRemoto = false;
      if (finalDocId) {
        try {
          const { data: signRes, error: signErr } = await supabase.functions.invoke('contrato-publico', {
            body: {
              action: 'sign',
              id: finalDocId,
              signerRole: 'dentista',
              signature: sigData.signature,
              signerName: sigData.signerName || snapshot.clinica.dentistaResponsavel,
              snapshot: updatedSnapshot,
            },
          });
          if (!signErr && signRes?.ok) {
            persistiuRemoto = true;
          }
        } catch (edgeErr) {
          console.warn('Erro ao assinar dentista via Edge function:', edgeErr);
        }
      }

      // 2. Fallback: Tenta persistir direto no Supabase caso permitido
      if (finalDocId && !persistiuRemoto) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalDocId);
          if (isUuid) {
            await supabase
              .from('documentos_clinicos')
              .update({
                itens: updatedSnapshot as any,
              })
              .eq('id', finalDocId);
          } else {
            const { data: matchedDocs } = await supabase
              .from('documentos_clinicos')
              .select('id, itens')
              .eq('tipo', 'contrato')
              .limit(20);
            const foundDoc = (matchedDocs || []).find(
              (d: any) => d.itens?.contratoId === finalDocId || d.itens?.contratoId === snapshot.contratoId
            );
            if (foundDoc?.id) {
              await supabase
                .from('documentos_clinicos')
                .update({
                  itens: updatedSnapshot as any,
                })
                .eq('id', foundDoc.id);
            }
          }
        } catch (dbErr) {
          console.warn('Persistência remota direta dentista:', dbErr);
        }
      }

      toast.success('Assinatura do cirurgião(ã)-dentista registrada com sucesso!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao registrar assinatura do profissional: ' + (err?.message || 'Tente novamente'));
    }
  };

  // Download do PDF
  const handleBaixarPdf = async () => {
    if (!snapshot) return;
    try {
      setBaixandoPdf(true);
      const html = gerarHtmlContrato(snapshot);
      const filename = `contrato_${snapshot.paciente.nome.replace(/\s+/g, '_')}_${snapshot.contratoId}`;
      await downloadHtmlAsPdf(html, filename);
      toast.success('Download do contrato em PDF concluído!');
    } catch (err) {
      toast.error('Erro ao gerar PDF do contrato');
    } finally {
      setBaixandoPdf(false);
    }
  };

  // Notificar a clínica pelo WhatsApp
  const handleNotificarClinica = () => {
    if (!snapshot) return;
    const telefoneClinica = snapshot.clinica.telefone?.replace(/\D/g, '') || '';
    if (!telefoneClinica) {
      toast.info('Telefone da clínica não informado no contrato.');
      return;
    }

    const mensagem =
      `Olá, equipe da *${snapshot.clinica.nome}*!\n\n` +
      `Aqui é *${snapshot.paciente.nome}*.\n` +
      `Acabei de conferir e realizar a *Assinatura Digital* do meu *Contrato Odontológico* (#${snapshot.contratoId}) referente ao plano de tratamento.\n\n` +
      `• *Valor Total:* ${formatMoney(snapshot.financeiro.total)}\n` +
      `• *Data da Assinatura:* ${snapshot.assinaturaPaciente?.dataHora ? new Date(snapshot.assinaturaPaciente.dataHora).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}\n\n` +
      `Agradeço e aguardo as orientações dos próximos atendimentos!`;

    openWhatsApp(telefoneClinica, mensagem);
  };

  const [copiouPayloadPix, setCopiouPayloadPix] = useState(false);

  // Identifica se a entrada do contrato já está quitada / paga
  const isEntradaPaga = useMemo(() => {
    if (!snapshot?.financeiro) return false;
    const entradaCard = cardsPagamento.find((c) => c.tipo === 'entrada');
    if (entradaCard) {
      return Boolean(entradaCard.pago || /paga|pago|quitad/i.test(entradaCard.statusBadge || ''));
    }
    const parcEntrada = snapshot.financeiro.parcelas?.find((p) =>
      /entrada|sinal/i.test(p.descricao || '')
    ) || (snapshot.financeiro.entrada && snapshot.financeiro.parcelas?.[0]);
    if (parcEntrada?.status) {
      return /paga|pago|quitad/i.test(parcEntrada.status);
    }
    return false;
  }, [snapshot, cardsPagamento]);

  // Identifica se todas as parcelas do cronograma já estão quitadas / pagas
  const isContratoQuitado = useMemo(() => {
    if (!snapshot?.financeiro) return false;
    if (snapshot.financeiro.parcelas && snapshot.financeiro.parcelas.length > 0) {
      return snapshot.financeiro.parcelas.every((p) => p.status && /paga|pago|quitad/i.test(p.status));
    }
    return false;
  }, [snapshot]);

  // Se a entrada já está paga/quitada, NÃO deve cobrar a entrada novamente no link de assinatura
  const valorPixContrato = useMemo(() => {
    if (!snapshot?.financeiro) return 0;
    if (snapshot.financeiro.entrada && snapshot.financeiro.entrada > 0) {
      if (isEntradaPaga) {
        return 0; // Entrada já quitada! Não gera cobrança PIX da entrada
      }
      return snapshot.financeiro.entrada;
    }
    if (isContratoQuitado) return 0;
    return snapshot.financeiro.total || 0;
  }, [snapshot, isEntradaPaga, isContratoQuitado]);

  const payloadPixContrato = useMemo(() => {
    if (!snapshot?.clinica?.chavePix || valorPixContrato <= 0) return '';
    return gerarPayloadPix({
      chave: snapshot?.clinica?.chavePix || '',
      tipoChave: snapshot?.clinica?.tipoChavePix,
      nomeFavorecido: snapshot?.clinica?.favorecidoPix || snapshot?.clinica?.nome,
      cidade: (snapshot?.clinica?.cidade && !snapshot.clinica.cidade.toUpperCase().includes('SAO PAULO')) ? snapshot.clinica.cidade : 'MACEIO',
      valor: valorPixContrato > 0 ? valorPixContrato : undefined,
      descricao: `Contrato ${snapshot?.numero || ''}`.trim(),
    });
  }, [snapshot, valorPixContrato]);

  const handleCopiarPixCopiaECola = () => {
    if (!payloadPixContrato) return;
    navigator.clipboard.writeText(payloadPixContrato);
    setCopiouPayloadPix(true);
    toast.success(
      valorPixContrato > 0
        ? `PIX Copia e Cola com valor de ${formatMoney(valorPixContrato)} copiado!`
        : 'Código PIX Copia e Cola copiado!'
    );
    setTimeout(() => setCopiouPayloadPix(false), 2500);
  };

  const handleCopiarPix = () => {
    if (!snapshot?.clinica?.chavePix) return;
    navigator.clipboard.writeText(snapshot.clinica?.chavePix || '');
    setCopiouPix(true);
    toast.success('Chave PIX copiada para a área de transferência!');
    setTimeout(() => setCopiouPix(false), 2500);
  };

  if (loading) {
    return (
      <Shell>
        <Card className="p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Carregando contrato...</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Validando os dados e preparando o documento seguro para assinatura.
          </p>
        </Card>
      </Shell>
    );
  }

  if (!snapshot) {
    return (
      <Shell>
        <Card className="p-8 text-center border-destructive/30 max-w-xl mx-auto shadow-sm">
          <AlertCircle className="h-14 w-14 text-destructive mx-auto mb-4 animate-pulse" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Contrato Não Encontrado</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
            O link de assinatura acessado pode ser inválido, ter expirado ou ainda não foi emitido no sistema.
          </p>
          {(targetId || rawSlug) && (
            <div className="mt-4 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 font-mono break-all inline-block max-w-full">
              Ref: {targetId || rawSlug}
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" /> Tentar Recarregar
            </Button>
            <Button
              size="sm"
              onClick={() => (window.location.href = '/')}
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Home className="h-4 w-4" /> Ir para o Sistema
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-5">
            Por favor, solicite um novo link diretamente à equipe da clínica odontológica via WhatsApp.
          </p>
        </Card>
      </Shell>
    );
  }

  const isAssinado = !!snapshot.assinaturaPaciente?.assinaturaData;
  const isAssinadoDentista = !!snapshot.assinaturaDentista?.assinaturaData;
  const isTotalmenteAssinado = isAssinado && isAssinadoDentista;

  return (
    <Shell>
      {/* Topo Oficial com Logo da Clínica */}
      <Card className="overflow-hidden border-border shadow-sm">
        <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-sm text-blue-100 mb-2">
                <ShieldCheck className="h-3.5 w-3.5" /> Documento Oficial e Válido (Art. 784, III CPC)
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex flex-wrap items-center gap-2">
                <span>
                  {isContratoEndodontia(snapshot)
                    ? 'Contrato de Prestação de Serviços — Tratamento de Canal (Endodontia)'
                    : isContratoLenteResina(snapshot)
                    ? 'Contrato de Prestação de Serviços — Lentes em Resina Composta'
                    : 'Contrato de Prestação de Serviços Odontológicos'}
                </span>
                {isContratoEndodontia(snapshot) && (
                  <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-0 text-[11px] font-semibold">
                    Endodontia
                  </Badge>
                )}
              </h1>
              <p className="text-blue-200 text-xs sm:text-sm mt-0.5">
                {snapshot.clinica.nome} • Identificador: #{snapshot.contratoId}
              </p>
            </div>
            <div>
              {isTotalmenteAssinado ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                  <CheckCircle2 className="h-4 w-4" /> 100% Assinado (Ambas as Partes)
                </Badge>
              ) : isAssinado ? (
                <Badge className="bg-blue-600 hover:bg-blue-700 text-white border-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                  <Check className="h-4 w-4" /> Assinado Paciente • Pendente Dentista
                </Badge>
              ) : isAssinadoDentista ? (
                <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                  <Check className="h-4 w-4" /> Assinado Dentista • Pendente Paciente
                </Badge>
              ) : (
                <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 animate-pulse">
                  <Clock className="h-4 w-4" /> Pendente de Assinatura
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Banner Informativo de Status das Assinaturas */}
        {(isAssinado || isAssinadoDentista) && (
          <div className={cn(
            "border-b p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all",
            isTotalmenteAssinado
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40"
              : "bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50"
          )}>
            <div className="flex items-start gap-3">
              <div className={cn(
                "p-2 rounded-full mt-0.5 shrink-0",
                isTotalmenteAssinado
                  ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300"
                  : "bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300"
              )}>
                {isTotalmenteAssinado ? <FileCheck className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div>
                <h3 className={cn(
                  "font-semibold text-sm sm:text-base",
                  isTotalmenteAssinado
                    ? "text-emerald-900 dark:text-emerald-200"
                    : "text-blue-900 dark:text-blue-200"
                )}>
                  {isTotalmenteAssinado
                    ? 'Contrato formalizado e assinado digitalmente por ambas as partes!'
                    : isAssinado
                    ? 'Assinatura do Paciente concluída • Aguardando Profissional Responsável'
                    : 'Assinatura do Profissional registrada • Aguardando Paciente'}
                </h3>
                <p className={cn(
                  "text-xs sm:text-sm mt-0.5",
                  isTotalmenteAssinado
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-blue-700 dark:text-blue-400"
                )}>
                  {isTotalmenteAssinado ? (
                    <>
                      Assinado por <strong>{snapshot.assinaturaPaciente?.nome}</strong> (Paciente) e{' '}
                      <strong>{snapshot.assinaturaDentista?.nome}</strong> (Cirurgião-Dentista Responsável).
                    </>
                  ) : isAssinado ? (
                    <>
                      Assinado por <strong>{snapshot.assinaturaPaciente?.nome}</strong> em{' '}
                      {snapshot.assinaturaPaciente?.dataHora
                        ? new Date(snapshot.assinaturaPaciente.dataHora).toLocaleString('pt-BR')
                        : 'data registrada'}
                      . O profissional pode assinar no quadro de assinaturas abaixo.
                    </>
                  ) : (
                    <>
                      Assinado pelo(a) cirurgião(ã)-dentista <strong>{snapshot.assinaturaDentista?.nome}</strong> em{' '}
                      {snapshot.assinaturaDentista?.dataHora
                        ? new Date(snapshot.assinaturaDentista.dataHora).toLocaleString('pt-BR')
                        : 'data registrada'}
                      . Aguardando a assinatura digital do(a) paciente.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!isAssinadoDentista && (
                <Button
                  size="sm"
                  onClick={() => setShowProfessionalSignatureModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                >
                  <Stethoscope className="h-3.5 w-3.5 mr-1.5" />
                  Assinar Profissional
                </Button>
              )}
              {!isAssinado && (
                <Button
                  size="sm"
                  onClick={() => {
                    setConcordouTermos(true);
                    setShowSignatureModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                >
                  <PenTool className="h-3.5 w-3.5 mr-1.5" />
                  Assinar Paciente
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleBaixarPdf}
                disabled={baixandoPdf}
                className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
              >
                {baixandoPdf ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5 text-primary" />}
                Baixar PDF
              </Button>
              <Button size="sm" onClick={handleNotificarClinica} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" /> WhatsApp
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* Identificação das Partes */}
          <div className={cn(
            "grid grid-cols-1 gap-4",
            isContratoEndodontia(snapshot) && snapshot.dadosEndodontia?.executorTipo === 'parceiro' && snapshot.dadosEndodontia.parceiro?.nome
              ? "md:grid-cols-3"
              : "md:grid-cols-2"
          )}>
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <User className="h-3.5 w-3.5 text-primary" /> Contratante (Paciente)
              </div>
              <p className="font-bold text-base text-slate-800 dark:text-slate-100">{snapshot.paciente.nome}</p>
              <p className="text-xs text-muted-foreground mt-1">
                CPF: <span className="font-medium text-slate-700 dark:text-slate-300">{snapshot.paciente.cpf}</span>
                {temValorValido(snapshot.paciente.rg) ? ` • RG: ${snapshot.paciente.rg}` : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Telefone: {snapshot.paciente.telefone}</p>
              {snapshot.paciente.endereco && snapshot.paciente.endereco !== 'Não informado' && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">Endereço: {snapshot.paciente.endereco}</p>
              )}
            </div>

            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Building2 className="h-3.5 w-3.5 text-primary" /> {identificarTipoDocumento(snapshot.clinica.cnpj) === 'cpf' ? 'Contratada (Cirurgiã-Dentista)' : 'Contratada (Clínica)'}
              </div>
              <p className="font-bold text-base text-slate-800 dark:text-slate-100">{snapshot.clinica.nome}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {identificarTipoDocumento(snapshot.clinica.cnpj) === 'cpf' ? 'CPF' : 'CNPJ'}: <span className="font-medium text-slate-700 dark:text-slate-300">{snapshot.clinica.cnpj}</span> • CRO: {snapshot.clinica.cro}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {identificarTipoDocumento(snapshot.clinica.cnpj) === 'cpf' ? 'Cirurgião(ã)-Dentista' : 'Resp. Técnico'}: {snapshot.clinica.dentistaResponsavel}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">Endereço: {snapshot.clinica.endereco}</p>
            </div>

            {isContratoEndodontia(snapshot) && snapshot.dadosEndodontia?.executorTipo === 'parceiro' && snapshot.dadosEndodontia.parceiro?.nome && (
              <div className="p-4 rounded-lg bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-2">
                  <Stethoscope className="h-3.5 w-3.5 text-purple-600" /> Profissional Executor Parceiro
                </div>
                <p className="font-bold text-base text-slate-800 dark:text-slate-100">{snapshot.dadosEndodontia.parceiro.nome}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  CRO: <span className="font-medium text-slate-700 dark:text-slate-300">{snapshot.dadosEndodontia.parceiro.croUf}</span>
                  {snapshot.dadosEndodontia.parceiro.documento ? ` • Documento: ${snapshot.dadosEndodontia.parceiro.documento}` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Executor dos atos clínicos do tratamento de canal</p>
              </div>
            )}
          </div>

          {/* Resumo Financeiro e Condições de Pagamento */}
          <div className="p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-blue-200/60 pb-3">
              <div>
                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Valor Total do Tratamento
                </span>
                <p className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {formatMoney(snapshot.financeiro.total)}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium italic">
                  ({snapshot.financeiro.totalExtenso})
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-xs text-muted-foreground block">Forma Acordada:</span>
                <Badge variant="outline" className="bg-white dark:bg-slate-900 border-blue-300 text-blue-800 dark:text-blue-300 text-xs font-semibold mt-0.5">
                  {limparFormaPagamentoParaContrato(snapshot.financeiro.formaPagamento)}
                </Badge>
              </div>
            </div>

            {/* Detalhes de Entrada, Parcelas e Opções de Pagamento */}
            {cardsPagamento.length > 0 && (
              <div
                className={cn(
                  'grid grid-cols-1 gap-2.5 text-xs',
                  cardsPagamento.length === 1 && 'sm:grid-cols-1',
                  cardsPagamento.length === 2 && 'sm:grid-cols-2',
                  cardsPagamento.length >= 3 && 'sm:grid-cols-3'
                )}
              >
                {cardsPagamento.map((card) => {
                  const isEntrada = card.tipo === 'entrada';
                  const isEntradaPaga = isEntrada && (card.pago || /paga|quitad|autoriz/i.test(card.statusBadge || ''));

                  return (
                    <div
                      key={card.id}
                      className={cn(
                        'p-3 rounded-lg transition-all flex flex-col justify-between min-h-[72px]',
                        isEntrada
                          ? 'bg-emerald-500/10 border-2 border-emerald-500/60 dark:border-emerald-500/50 shadow-xs'
                          : 'bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900/40 shadow-xs'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span
                          className={cn(
                            'block text-xs font-semibold',
                            isEntrada ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground'
                          )}
                        >
                          {card.rotulo}
                        </span>

                        {isEntrada && isEntradaPaga && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-600 text-white dark:bg-emerald-500 shadow-xs tracking-tight">
                            <Check className="h-3 w-3 stroke-[3]" />
                            Paga
                          </span>
                        )}

                        {!isEntrada && card.statusBadge && (
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                              card.statusBadge.toLowerCase().includes('autoriz')
                                ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800'
                                : card.statusBadge.toLowerCase().includes('quitad') || card.statusBadge.toLowerCase().includes('pago')
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            )}
                          >
                            {card.statusBadge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between gap-1 mt-0.5">
                        <span
                          className={cn(
                            'font-bold text-sm tracking-tight',
                            isEntrada
                              ? 'text-emerald-600 dark:text-emerald-400 text-base'
                              : 'text-slate-800 dark:text-slate-100'
                          )}
                        >
                          {card.valorFormatado}
                        </span>
                        {card.detalhe && (
                          <span className="text-[11px] font-medium text-muted-foreground truncate" title={card.detalhe}>
                            {card.detalhe}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Chave PIX Oficial da Clínica */}
            {snapshot?.clinica?.chavePix && (
              <div className="mt-3 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 uppercase tracking-wide block">
                      Dados para Pagamento via PIX Oficial
                    </span>
                    <span className="font-mono text-sm font-bold text-emerald-900 dark:text-emerald-100 select-all">
                      {snapshot?.clinica?.chavePix}
                    </span>
                    {(snapshot?.clinica?.favorecidoPix || snapshot?.clinica?.cnpjCpfFavorecidoPix) && (
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                        Favorecido: <strong>{snapshot?.clinica?.favorecidoPix || snapshot?.clinica?.nome}</strong>
                        {snapshot?.clinica?.cnpjCpfFavorecidoPix && ` • ${identificarTipoDocumento(snapshot?.clinica?.cnpjCpfFavorecidoPix) === 'cpf' ? 'CPF' : 'CNPJ'}: ${snapshot?.clinica?.cnpjCpfFavorecidoPix}`}
                        {snapshot?.clinica?.bancoPix && ` • ${snapshot?.clinica?.bancoPix}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 self-start sm:self-center">
                  {isContratoQuitado ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 text-xs py-1.5 px-3 font-bold gap-1 shadow-xs">
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                      Contrato Quitado
                    </Badge>
                  ) : isEntradaPaga ? (
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 text-xs py-1.5 px-3 font-bold gap-1 shadow-xs">
                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                      Entrada Quitada
                    </Badge>
                  ) : payloadPixContrato ? (
                    <>
                      <Button
                        size="sm"
                        onClick={handleCopiarPixCopiaECola}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs font-semibold gap-1"
                      >
                        {copiouPayloadPix ? <Check className="h-3.5 w-3.5 text-white" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {copiouPayloadPix
                          ? 'Código Copiado!'
                          : valorPixContrato > 0
                          ? `Copiar PIX (${formatMoney(valorPixContrato)})`
                          : 'Copiar PIX Copia e Cola'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setModalPixParcela({
                            numero: 1,
                            descricao: 'Pagamento Principal / Entrada',
                            vencimento: 'Conforme acordado',
                            valor: valorPixContrato,
                            payloadPix: payloadPixContrato,
                            qrCodeUrl: gerarQrCodePixUrl(payloadPixContrato, 360),
                          });
                        }}
                        className="border-emerald-300 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 text-xs gap-1"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Ver QR Code
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopiarPix}
                    className="border-emerald-300 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 text-xs gap-1"
                  >
                    {copiouPix ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiouPix ? 'Chave Copiada!' : 'Copiar Chave'}
                  </Button>
                </div>
              </div>
            )}

            {/* Cronograma Interativo de Pagamentos com PIX Copia e Cola e QR Code por Parcela */}
            {snapshot.financeiro.parcelas && snapshot.financeiro.parcelas.length > 0 && (
              <div className="mt-3 border rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs border-blue-200/80 dark:border-blue-900/60">
                <div className="bg-slate-100/90 dark:bg-slate-800/90 px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-wide">
                      Cronograma de Pagamento & PIX por Parcela
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {snapshot.financeiro.parcelas.length} {snapshot.financeiro.parcelas.length === 1 ? 'parcela' : 'parcelas configuradas'}
                  </span>
                </div>
                <div className="divide-y divide-border/60">
                  {snapshot.financeiro.parcelas.map((parc) => {
                    const isCartao = isMetodoCartao(parc.metodo, parc.descricao);
                    const isPix = !isCartao && (isMetodoPix(parc.metodo, parc.descricao) || (snapshot?.financeiro?.formaPagamento || '').toLowerCase().includes('pix'));

                    const isPaga = Boolean(parc.status && /paga|pago|quitad/i.test(parc.status));

                    // Payload dinâmico individual para a parcela (APENAS se NÃO estiver quitada/paga)
                    let parcPayload = isPaga ? '' : (parc.payloadPix || '');
                    if (!isPaga && isPix && !parcPayload && snapshot?.clinica?.chavePix && parc.valor > 0) {
                      parcPayload = gerarPayloadPix({
                        chave: snapshot?.clinica?.chavePix || '',
                        tipoChave: snapshot?.clinica?.tipoChavePix,
                        nomeFavorecido: snapshot?.clinica?.favorecidoPix || snapshot?.clinica?.nome,
                        cidade: (snapshot?.clinica?.cidade && !snapshot.clinica.cidade.toUpperCase().includes('SAO PAULO')) ? snapshot.clinica.cidade : 'MACEIO',
                        valor: parc.valor,
                        descricao: `Parc ${parc.numero} CTR-${snapshot?.numero || snapshot?.contratoId || ''}`.slice(0, 25),
                      });
                    }
                    const parcQrCode = isPaga ? '' : (parc.qrCodePixUrl || (parcPayload ? gerarQrCodePixUrl(parcPayload, 360) : ''));

                    return (
                      <div key={parc.numero} className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-colors">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5",
                            isPaga ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          )}>
                            {parc.numero}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                                {limparFormaPagamentoParaContrato(parc.descricao || `Parcela ${parc.numero}`)}
                              </span>
                              {parc.status && (
                                <Badge variant="outline" className={cn(
                                  "text-[10px] px-1.5 py-0 font-medium",
                                  isPaga ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950" : "bg-slate-50 text-slate-600 border-slate-300 dark:bg-slate-800"
                                )}>
                                  {parc.status}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                              <span>Vencimento: <strong className="text-slate-700 dark:text-slate-300">{parc.vencimento}</strong></span>
                              <span>•</span>
                              <span>Forma: <span className="font-medium text-slate-700 dark:text-slate-300">{limparFormaPagamentoParaContrato(parc.metodo || (isPix ? 'PIX' : 'A combinar'))}</span></span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2.5 self-stretch sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0">
                          <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                            {formatMoney(parc.valor)}
                          </span>

                          {isPaga ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 text-xs py-1 px-2.5 font-semibold gap-1 shrink-0">
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" /> Quitado
                            </Badge>
                          ) : isPix && parcPayload ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setModalPixParcela({
                                    numero: parc.numero,
                                    descricao: parc.descricao || `Parcela ${parc.numero}`,
                                    vencimento: parc.vencimento,
                                    valor: parc.valor,
                                    payloadPix: parcPayload,
                                    qrCodeUrl: parcQrCode,
                                  });
                                }}
                                className="border-blue-300 text-blue-700 dark:text-blue-300 hover:bg-blue-50 text-xs gap-1 h-7 px-2"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">QR Code</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText(parcPayload);
                                  toast.success(`PIX Copia e Cola da parcela ${parc.numero} (${formatMoney(parc.valor)}) copiado com sucesso!`);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 h-7 px-2 font-semibold"
                              >
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copiar PIX</span>
                              </Button>
                            </div>
                          ) : isCartao ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs py-0.5">
                              <CreditCard className="h-3 w-3 mr-1" /> Cartão
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Procedimentos Inclusos */}
          <div>
            <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100 mb-2 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-primary" /> Procedimentos Aprovados no Plano de Tratamento
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-100 dark:bg-slate-900 text-muted-foreground border-b font-medium text-left">
                  <tr>
                    <th className="p-2.5 sm:p-3">Procedimento</th>
                    <th className="p-2.5 sm:p-3 text-center">Qtd / Região</th>
                    <th className="p-2.5 sm:p-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {snapshot.orcamento.itens.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="p-2.5 sm:p-3 font-medium text-slate-800 dark:text-slate-200">{item.nome}</td>
                      <td className="p-2.5 sm:p-3 text-center text-muted-foreground">
                        {item.quantidade}x {item.denteOuRegiao ? `(${item.denteOuRegiao})` : ''}
                      </td>
                      <td className="p-2.5 sm:p-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                        {formatMoney(item.valorTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {snapshot.orcamento.observacoes && snapshot.orcamento.observacoes.trim() && (
              <div className="mt-3 p-3.5 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide text-[11px] mb-1">
                  <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  Observações do Orçamento / Recomendações:
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {snapshot.orcamento.observacoes}
                </p>
              </div>
            )}
          </div>

          {/* Visualizador Oficial do Contrato Completo na Íntegra (Padrão Oficial A4) */}
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
            <div className="bg-slate-100 dark:bg-slate-900/90 px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-2 truncate">
                    <span>Contrato de Prestação de Serviços Odontológicos</span>
                    <Badge variant="outline" className="hidden sm:inline-flex text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                      Texto Integral • Padrão A4
                    </Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Documento oficial completo com todas as cláusulas jurídicas e cronograma financeiro
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-border bg-background hover:bg-muted text-foreground"
                  onClick={handleBaixarPdf}
                  disabled={baixandoPdf}
                  title="Baixar Contrato Completo em PDF"
                >
                  {baixandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                  <span className="hidden sm:inline">Baixar PDF</span>
                </Button>

                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                  onClick={() => setIsFullScreen(true)}
                  title="Ampliar visualização em tela cheia"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Modo Tela Cheia</span>
                </Button>
              </div>
            </div>

            {/* Container Iframe com visualização A4 limpa e rolagem perfeita */}
            <div
              className="p-2 sm:p-5 bg-slate-200/70 dark:bg-slate-950 flex justify-center items-start overflow-y-auto w-full min-h-[480px] h-[68vh] sm:h-[78vh]"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <iframe
                srcDoc={htmlContrato}
                title="Contrato Completo na Íntegra"
                className="w-full h-full max-w-[840px] rounded-lg border border-slate-300 dark:border-slate-800 bg-white shadow-xl min-h-[460px]"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 px-4 py-2 border-t border-border flex flex-wrap items-center justify-between text-xs text-muted-foreground gap-2">
              <span className="flex items-center gap-1.5 text-[11px] sm:text-xs">
                <FileCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Role o documento acima para ler todas as cláusulas e o Termo de Consentimento (TCLE) na íntegra.
              </span>
              <button
                type="button"
                onClick={() => setIsFullScreen(true)}
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium text-[11px] sm:text-xs cursor-pointer"
              >
                <Maximize2 className="h-3 w-3" /> Expandir em Tela Cheia
              </button>
            </div>
          </div>

          {/* Seção de Escolha Facultativa: Termo de Autorização de Uso de Imagem e Voz */}
          {!isAssinado ? (
            <Card className="border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-950 overflow-hidden shadow-xs">
              <CardHeader className="pb-3 border-b border-emerald-100 dark:border-emerald-900/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>Termo de Autorização de Uso de Imagem e Voz</span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300">
                          Opcional / Facultativo
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs text-muted-foreground mt-0.5">
                        Consentimento livre, informado e específico (Lei Geral de Proteção de Dados - LGPD e CFO)
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-5 space-y-4">
                {/* Aviso informativo de liberdade de escolha */}
                <div className="text-xs text-slate-600 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800 leading-relaxed">
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold block mb-1">
                    ✦ Importante: A sua escolha é totalmente livre e independente.
                  </strong>
                  A autorização para fins didáticos, científicos ou de divulgação em redes sociais é facultativa. 
                  <strong> Caso opte por NÃO autorizar</strong>, o termo <u>não</u> será anexado ao seu contrato e o seu atendimento odontológico seguirá rigorosamente com o mesmo cuidado, dedicação e sigilo profissional.
                </div>

                {/* Cards de Opção: DESEJO AUTORIZAR (1º) vs NÃO AUTORIZO (2º) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Opção 1: DESEJO AUTORIZAR (Por Primeiro) */}
                  <button
                    type="button"
                    onClick={() => handleAtualizarTermoImagem(true)}
                    className={cn(
                      "p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 relative",
                      autorizaImagem
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-md dark:border-emerald-500 dark:bg-emerald-700"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-300 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      autorizaImagem ? "bg-white/20 text-white" : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                    )}>
                      <Camera className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm">DESEJO AUTORIZAR</span>
                        {autorizaImagem && (
                          <CheckCircle2 className="h-4 w-4 text-white shrink-0" />
                        )}
                      </div>
                      <p className={cn(
                        "text-[11px] mt-1 leading-snug",
                        autorizaImagem ? "text-emerald-100" : "text-muted-foreground"
                      )}>
                        Autorizo o uso para fins odontológicos. Ativa a leitura do termo na íntegra, opções e inclusão em anexo.
                      </p>
                    </div>
                  </button>

                  {/* Opção 2: NÃO AUTORIZO */}
                  <button
                    type="button"
                    onClick={() => handleAtualizarTermoImagem(false)}
                    className={cn(
                      "p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 relative",
                      !autorizaImagem
                        ? "border-slate-700 bg-slate-900 text-white shadow-md dark:border-slate-400 dark:bg-slate-800"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      !autorizaImagem ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}>
                      <EyeOff className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm">NÃO AUTORIZO</span>
                        {!autorizaImagem && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className={cn(
                        "text-[11px] mt-1 leading-snug",
                        !autorizaImagem ? "text-slate-200" : "text-muted-foreground"
                      )}>
                        Prefiro não divulgar imagens/voz. Meu atendimento segue normalmente e o termo <strong>NÃO</strong> será anexado ao contrato.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Painel expandido quando AUTORIZOU */}
                {autorizaImagem && (
                  <div className="mt-3 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                          Personalize as Finalidades que Você Autoriza:
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandirLeituraTermo(!expandirLeituraTermo)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        {expandirLeituraTermo ? 'Recolher Leitura' : 'Ler Termo Completo (10 Cláusulas)'}
                        {expandirLeituraTermo ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>

                    {/* Opções Granulares B, C, D, E */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Item B: Didático & Científico */}
                      <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50 space-y-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          B — Utilização Didática e Científica
                        </span>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Atividades de ensino, palestras, congressos odontológicos e artigos científicos.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={usoDidatico ? "default" : "outline"}
                            onClick={() => handleAtualizarTermoImagem(true, { didatico: true })}
                            className={cn("h-7 text-xs flex-1", usoDidatico ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "")}
                          >
                            {usoDidatico && <Check className="h-3 w-3 mr-1" />} Autorizo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={!usoDidatico ? "default" : "outline"}
                            onClick={() => handleAtualizarTermoImagem(true, { didatico: false })}
                            className={cn("h-7 text-xs flex-1", !usoDidatico ? "bg-slate-700 hover:bg-slate-800 text-white" : "")}
                          >
                            {!usoDidatico && <Check className="h-3 w-3 mr-1" />} Não Autorizo
                          </Button>
                        </div>
                      </div>

                      {/* Item C: Publicitário & Redes Sociais */}
                      <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50 space-y-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          C — Divulgação Publicitária e Redes Sociais
                        </span>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          Publicações profissionais da cirurgiã-dentista no Instagram, site e portfólio ético.
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={usoPublicitario ? "default" : "outline"}
                            onClick={() => handleAtualizarTermoImagem(true, { publicitario: true })}
                            className={cn("h-7 text-xs flex-1", usoPublicitario ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "")}
                          >
                            {usoPublicitario && <Check className="h-3 w-3 mr-1" />} Autorizo
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={!usoPublicitario ? "default" : "outline"}
                            onClick={() => handleAtualizarTermoImagem(true, { publicitario: false })}
                            className={cn("h-7 text-xs flex-1", !usoPublicitario ? "bg-slate-700 hover:bg-slate-800 text-white" : "")}
                          >
                            {!usoPublicitario && <Check className="h-3 w-3 mr-1" />} Não Autorizo
                          </Button>
                        </div>
                      </div>

                      {/* Item D: Identificação Facial & Voz */}
                      <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50 space-y-2 sm:col-span-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block">
                          D — Identificação Facial e Utilização da Voz
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                          {[
                            { id: 'rosto_e_voz', label: 'Rosto e Voz reconhecíveis', desc: 'Permite foto completa do rosto e voz' },
                            { id: 'apenas_bucal', label: 'Apenas região bucal (Sorriso/Dentes sem rosto direto)', desc: 'Mais recomendado e seguro para privacidade' },
                            { id: 'apenas_voz', label: 'Apenas gravações com minha voz', desc: 'Áudio sem imagem facial' },
                            { id: 'nao_autoriza_identificacao', label: 'Nenhuma identificação permitida', desc: 'Apenas registros estritamente anônimos' },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleAtualizarTermoImagem(true, { ident: item.id as any })}
                              className={cn(
                                "p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2",
                                identificacao === item.id
                                  ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 font-medium"
                                  : "border-border bg-white dark:bg-slate-900 hover:border-slate-300 text-slate-700 dark:text-slate-300"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5",
                                identificacao === item.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400"
                              )}>
                                {identificacao === item.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-[11.5px] leading-tight font-semibold">{item.label}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Item E: Depoimentos */}
                      <div className="p-3 rounded-lg border border-border bg-slate-50 dark:bg-slate-800/50 space-y-2 sm:col-span-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">
                              E — Depoimentos Voluntários sobre o Tratamento
                            </span>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                              Captação e eventual divulgação de depoimento espontâneo sobre sua satisfação com o atendimento.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant={depoimentos ? "default" : "outline"}
                              onClick={() => handleAtualizarTermoImagem(true, { depoim: true })}
                              className={cn("h-7 text-xs px-3", depoimentos ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "")}
                            >
                              {depoimentos && <Check className="h-3 w-3 mr-1" />} Autorizo
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={!depoimentos ? "default" : "outline"}
                              onClick={() => handleAtualizarTermoImagem(true, { depoim: false })}
                              className={cn("h-7 text-xs px-3", !depoimentos ? "bg-slate-700 hover:bg-slate-800 text-white" : "")}
                            >
                              {!depoimentos && <Check className="h-3 w-3 mr-1" />} Não Autorizo
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Visualizador de Leitura Completa do Termo de Imagem (10 Cláusulas) */}
                    {expandirLeituraTermo && (
                      <div className="mt-2 pt-3 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-emerald-600" />
                            Texto Integral do Termo de Autorização (10 Seções Oficiais):
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            (O texto abaixo também foi inserido como Anexo ao contrato exibido acima)
                          </span>
                        </div>
                        <div className="max-h-[280px] overflow-y-auto p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 space-y-3 leading-relaxed">
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">1. IDENTIFICAÇÃO DA PROFISSIONAL RESPONSÁVEL</h5>
                            <p className="text-[11px] mt-0.5">Dra. Rosângela Santos Pereira — Cirurgiã-Dentista, CRO-AL 06267, CPF: 032.663.962-43. Endereço: JTR — Edifício Espanha, Rua Comerciante José Pontes de Magalhães, nº 70, Sala 405, Jatiúca, Maceió/AL.</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">2. IDENTIFICAÇÃO DO PACIENTE</h5>
                            <p className="text-[11px] mt-0.5">Nome: {snapshot.paciente.nome} • CPF: {snapshot.paciente.cpf}{temValorValido(snapshot.paciente.rg) ? ` • RG: ${snapshot.paciente.rg}` : ''} • Endereço: {snapshot.paciente.endereco || 'Não informado'}</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">3. OBJETO DA AUTORIZAÇÃO</h5>
                            <p className="text-[11px] mt-0.5">Declaro que fui informado(a) sobre a possibilidade de captação e utilização de fotografias, vídeos, gravações de voz, imagens odontológicas e demais registros relacionados ao meu atendimento (rosto, sorriso, dentes, cavidade bucal, antes e depois). As autorizações didática, científica e publicitária são facultativas e independentes do tratamento odontológico.</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">4. DAS FINALIDADES E AUTORIZAÇÕES</h5>
                            <p className="text-[11px] mt-0.5">Manifestações registradas conforme seleção: Didático/Científico ({usoDidatico ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}), Publicitário/Redes ({usoPublicitario ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}), Identificação ({identificacao}), Depoimentos ({depoimentos ? 'AUTORIZADO' : 'NÃO AUTORIZADO'}).</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">5. DAS CONDIÇÕES DE UTILIZAÇÃO</h5>
                            <p className="text-[11px] mt-0.5">5.1 a 5.5: Utilização restrita às finalidades autorizadas; vedada comercialização a terceiros; respeito rigoroso às normas éticas do CFO e sem alterações enganosas.</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">6. DA GRATUIDADE E DA LIBERDADE DE ESCOLHA</h5>
                            <p className="text-[11px] mt-0.5">6.1 a 6.4: Autorização gratuita; recusa não acarreta prejuízo nem restrição ao tratamento; não há obrigação de participar de gravações nem presunção por contratação.</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">7. DA REVOGAÇÃO DO CONSENTIMENTO</h5>
                            <p className="text-[11px] mt-0.5">7.1 a 7.5: O paciente poderá revogar as autorizações facultativas a qualquer momento perante a profissional responsável, sem comprometer a licitude de usos pretéritos.</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">8. DA PROTEÇÃO DOS DADOS PESSOAIS (LGPD)</h5>
                            <p className="text-[11px] mt-0.5">8.1 a 8.4: Conformidade estrita com a Lei Geral de Proteção de Dados (Lei 13.709/2018). Canal de contato: {snapshot.clinica.email || snapshot.clinica.telefone || 'contato@clinica.com'}.</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">9. DA VIGÊNCIA</h5>
                            <p className="text-[11px] mt-0.5">9.1 a 9.3: Validade até revogação expressa; vedado uso indefinido após cessadas as finalidades legítimas.</p>
                          </div>
                          <div>
                            <h5 className="font-bold text-[12px] text-slate-900 dark:text-slate-100">10. DECLARAÇÃO FINAL DE CONSENTIMENTO</h5>
                            <p className="text-[11px] mt-0.5">Declaro que recebi informações claras, compreendi o caráter facultativo de cada item, tive livre oportunidade de escolha e manifesto minha vontade de forma livre, informada e específica.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Quadro Oficial de Assinaturas das Partes Contratantes */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FileSignature className="h-5 w-5 text-primary" />
                  Assinaturas Digitais do Contrato (Art. 784, III CPC)
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Formalização bilateral com validade jurídica plena (MP nº 2.200-2/2001 e Código Civil Brasileiro)
                </p>
              </div>

              <div>
                {isTotalmenteAssinado ? (
                  <Badge className="bg-emerald-600 text-white border-0 px-3 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 100% Formalizado (Ambas as Partes)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-xs font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {isAssinado ? 'Pendente Assinatura Profissional' : isAssinadoDentista ? 'Pendente Assinatura Paciente' : 'Aguardando Assinaturas'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Grid de 2 Colunas: Paciente e Profissional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: CONTRATANTE (Paciente) */}
              <div className={cn(
                "p-4 rounded-xl border flex flex-col justify-between transition-all",
                isAssinado
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-xs"
                  : "bg-blue-50/30 dark:bg-slate-900 border-dashed border-2 border-blue-300 dark:border-blue-800"
              )}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isAssinado ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300"
                      )}>
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          1. Contratante (Paciente)
                        </span>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          {snapshot.paciente.nome}
                        </h4>
                      </div>
                    </div>

                    {isAssinado ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] font-semibold flex items-center gap-1">
                        <Check className="h-3 w-3" /> Assinado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-[10px] font-semibold">
                        Pendente
                      </Badge>
                    )}
                  </div>

                  {isAssinado ? (
                    <div className="space-y-2 pt-1">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-center space-y-1.5">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                          <CheckCircle className="h-4 w-4" /> Assinatura Digital Registrada
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Em {new Date(snapshot.assinaturaPaciente!.dataHora).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          CPF: {snapshot.assinaturaPaciente?.cpf || snapshot.paciente.cpf}
                          {temValorValido(snapshot.assinaturaPaciente?.rg) ? ` • RG: ${snapshot.assinaturaPaciente?.rg}` : ''}
                        </p>

                        <div className="flex items-center justify-center gap-2 pt-1">
                          {snapshot.assinaturaPaciente?.assinaturaData && (
                            <img
                              src={snapshot.assinaturaPaciente.assinaturaData}
                              alt="Assinatura Paciente"
                              className="max-h-12 max-w-[160px] object-contain border-b border-slate-300 pb-1"
                            />
                          )}
                          {snapshot.assinaturaPaciente?.selfie && (
                            <img
                              src={snapshot.assinaturaPaciente.selfie}
                              alt="Selfie"
                              className="w-12 h-12 object-cover rounded-md border border-emerald-300 shadow-2xs"
                              title="Selfie Biométrica"
                            />
                          )}
                        </div>
                      </div>

                      {/* Status do termo de imagem */}
                      <div className="text-[11px] text-center">
                        {snapshot.termoUsoImagem?.autorizado ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center justify-center gap-1">
                            <Camera className="h-3 w-3" /> Termo de Imagem: Autorizado
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center justify-center gap-1">
                            <EyeOff className="h-3 w-3" /> Termo de Imagem: Não Autorizado
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-start gap-2.5 p-2.5 bg-white dark:bg-slate-900/80 rounded-lg border text-xs">
                        <Checkbox
                          id="concordo-paciente"
                          checked={concordouTermos}
                          onCheckedChange={(c) => setConcordouTermos(!!c)}
                          className="mt-0.5 shrink-0"
                        />
                        <label
                          htmlFor="concordo-paciente"
                          className="text-[11px] text-slate-700 dark:text-slate-300 font-medium cursor-pointer select-none leading-snug"
                        >
                          Declaro que li o contrato na íntegra, conferi procedimentos, valores e concordo com todos os termos acordados.
                        </label>
                      </div>

                      <Button
                        size="lg"
                        disabled={!concordouTermos}
                        onClick={() => setShowSignatureModal(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 text-sm shadow-xs"
                      >
                        <PenTool className="h-4 w-4 mr-2" />
                        Assinar como Paciente
                      </Button>
                    </div>
                  )}
                </div>

                {isAssinado && (
                  <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 mt-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSignatureModal(true)}
                      className="text-[11px] h-7 text-muted-foreground hover:text-foreground"
                    >
                      Alterar / Refazer Assinatura
                    </Button>
                  </div>
                )}
              </div>

              {/* Card 2: CONTRATADA (Cirurgião-Dentista / Profissional Responsável) */}
              <div className={cn(
                "p-4 rounded-xl border flex flex-col justify-between transition-all",
                isAssinadoDentista
                  ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 shadow-xs"
                  : "bg-emerald-50/20 dark:bg-slate-900 border-dashed border-2 border-emerald-300 dark:border-emerald-800"
              )}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isAssinadoDentista ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      )}>
                        <Stethoscope className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                          2. Contratada (Profissional)
                        </span>
                        <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          {snapshot.clinica.dentistaResponsavel || 'Cirurgião(ã)-Dentista Responsável'}
                        </h4>
                      </div>
                    </div>

                    {isAssinadoDentista ? (
                      <Badge className="bg-emerald-600 text-white text-[10px] font-semibold flex items-center gap-1">
                        <Check className="h-3 w-3" /> Assinado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-[10px] font-semibold">
                        Pendente
                      </Badge>
                    )}
                  </div>

                  {isAssinadoDentista ? (
                    <div className="space-y-2 pt-1">
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-center space-y-1.5">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
                          <CheckCircle className="h-4 w-4" /> Assinatura do Profissional Registrada
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Em {new Date(snapshot.assinaturaDentista!.dataHora).toLocaleString('pt-BR')}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          CRO: {snapshot.assinaturaDentista?.cro || snapshot.clinica.cro} • {snapshot.clinica.nome}
                        </p>

                        {snapshot.assinaturaDentista?.assinaturaData && (
                          <div className="flex items-center justify-center pt-1">
                            <img
                              src={snapshot.assinaturaDentista.assinaturaData}
                              alt="Assinatura Dentista"
                              className="max-h-12 max-w-[180px] object-contain border-b border-slate-300 pb-1"
                            />
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] text-center text-muted-foreground">
                        Responsável técnico(a) / Contratada formalmente autenticada.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div className="p-2.5 bg-white dark:bg-slate-900/80 rounded-lg border text-xs text-slate-600 dark:text-slate-300 leading-snug">
                        Campo destinado à assinatura digital do(a) <strong>Cirurgião(ã)-Dentista / Responsável Técnico(a)</strong> pelo plano de tratamento.
                      </div>

                      <Button
                        size="lg"
                        onClick={() => setShowProfessionalSignatureModal(true)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 text-sm shadow-xs"
                      >
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Assinar como Profissional / Dentista
                      </Button>
                    </div>
                  )}
                </div>

                {isAssinadoDentista && (
                  <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 mt-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowProfessionalSignatureModal(true)}
                      className="text-[11px] h-7 text-muted-foreground hover:text-foreground"
                    >
                      Alterar / Refazer Assinatura
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de Ações Finais (PDF e WhatsApp) */}
            <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground text-center sm:text-left">
                {isTotalmenteAssinado ? (
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-center sm:justify-start gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Contrato 100% formalizado e válido juridicamente perante o Art. 784, III CPC.
                  </span>
                ) : (
                  <span>
                    O contrato final em PDF incluirá as assinaturas à medida que forem confirmadas.
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 shrink-0 w-full sm:w-auto">
                <Button
                  onClick={handleBaixarPdf}
                  disabled={baixandoPdf}
                  variant="outline"
                  className="h-9 text-xs border-slate-300 dark:border-slate-700"
                >
                  {baixandoPdf ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5 text-primary" />}
                  Baixar Contrato em PDF
                </Button>
                <Button
                  onClick={handleNotificarClinica}
                  className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                >
                  <MessageCircle className="h-4 w-4 mr-1.5" />
                  Notificar via WhatsApp
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Assinatura Digital do Paciente */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl my-auto">
            <DigitalSignature
              title="Assinatura Digital do Contrato — Paciente"
              signerName={snapshot.paciente.nome}
              signerRole="paciente"
              documentType="contrato"
              requireIdentificationFields={true}
              requireSelfie={true}
              initialEmail={snapshot.paciente.email}
              initialCpf={snapshot.paciente.cpf}
              initialRg={temValorValido(snapshot.paciente.rg) ? snapshot.paciente.rg : ''}
              onSignatureComplete={handleSignatureComplete}
              onCancel={() => setShowSignatureModal(false)}
            />
          </div>
        </div>
      )}

      {/* Modal de Assinatura Digital do Profissional / Cirurgião-Dentista */}
      {showProfessionalSignatureModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-xl overflow-hidden shadow-2xl my-auto">
            <DigitalSignature
              title="Assinatura Digital — Cirurgião(ã)-Dentista Responsável"
              signerName={snapshot.clinica.dentistaResponsavel || 'Cirurgião(ã)-Dentista'}
              signerRole="dentista"
              documentType="contrato"
              requireIdentificationFields={false}
              requireSelfie={false}
              initialCpf={snapshot.clinica.cnpj}
              initialRg={snapshot.clinica.cro}
              onSignatureComplete={handleProfessionalSignatureComplete}
              onCancel={() => setShowProfessionalSignatureModal(false)}
            />
          </div>
        </div>
      )}

      {/* Modal de Leitura em Tela Cheia do Contrato na Íntegra */}
      {isFullScreen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
          <div className="h-14 bg-slate-900 border-b border-slate-800 px-3 sm:px-6 flex items-center justify-between shrink-0 shadow-lg">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-2 truncate">
                  <span>Contrato de Prestação de Serviços Odontológicos</span>
                  <span className="hidden sm:inline-flex text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                    Texto Integral Oficial
                  </span>
                </h2>
                <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                  {snapshot.paciente.nome} • {formatMoney(snapshot.financeiro.total)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                onClick={handleBaixarPdf}
                disabled={baixandoPdf}
                title="Baixar Contrato em PDF"
              >
                {baixandoPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" /> : <Download className="h-3.5 w-3.5 text-blue-400" />}
                <span className="hidden sm:inline">Baixar PDF</span>
              </Button>

              {!isAssinado && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-sm"
                  onClick={() => {
                    setIsFullScreen(false);
                    setConcordouTermos(true);
                    setShowSignatureModal(true);
                  }}
                  title="Concordar e assinar contrato digitalmente como Paciente"
                >
                  <PenTool className="h-3.5 w-3.5" />
                  <span>Assinar Paciente</span>
                </Button>
              )}

              {!isAssinadoDentista && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm"
                  onClick={() => {
                    setIsFullScreen(false);
                    setShowProfessionalSignatureModal(true);
                  }}
                  title="Assinar contrato digitalmente como Profissional / Cirurgião-Dentista"
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  <span>Assinar Profissional</span>
                </Button>
              )}

              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
                onClick={() => setIsFullScreen(false)}
                title="Fechar modo tela cheia (ESC)"
              >
                <Minimize2 className="h-4 w-4" />
                <span className="hidden sm:inline">Fechar (ESC)</span>
              </Button>
            </div>
          </div>

          <div
            className="flex-1 bg-slate-900/95 p-2 sm:p-6 flex justify-center items-start overflow-y-auto w-full"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <iframe
              srcDoc={htmlContrato}
              title="Contrato Oficial Completo Tela Cheia"
              className="w-full max-w-[860px] h-[calc(100vh-4.75rem)] rounded-md border border-slate-700/80 bg-white shadow-2xl"
            />
          </div>
        </div>
      )}
      {/* Modal Dialog com QR Code PIX em Alta Resolução */}
      <Dialog open={!!modalPixParcela} onOpenChange={(open) => !open && setModalPixParcela(null)}>
        <DialogContent className="max-w-md w-full p-6 text-center">
          <DialogHeader className="text-center">
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
              <QrCode className="h-5 w-5 text-emerald-600" />
              Pagamento via PIX — {modalPixParcela?.descricao}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Aponte a câmera do aplicativo do seu banco para o QR Code abaixo. O valor de <strong>{modalPixParcela ? formatMoney(modalPixParcela.valor) : ''}</strong> já está pré-configurado.
            </DialogDescription>
          </DialogHeader>

          {modalPixParcela && (
            <div className="space-y-4 my-2">
              <div className="bg-white p-4 rounded-xl border-2 border-emerald-500/40 inline-block mx-auto shadow-sm">
                <img
                  src={modalPixParcela.qrCodeUrl || (modalPixParcela.payloadPix ? gerarQrCodePixUrl(modalPixParcela.payloadPix, 360) : '')}
                  alt="QR Code PIX Bacen"
                  className="w-56 h-56 sm:w-64 sm:h-64 mx-auto block rounded"
                />
                <span className="text-[11px] font-bold text-emerald-700 block mt-2 tracking-wide uppercase">
                  Padrão Oficial Banco Central (Bacen)
                </span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border text-left text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 text-sm">{formatMoney(modalPixParcela.valor)}</strong>
                </div>
                {modalPixParcela.vencimento && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vencimento:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{modalPixParcela.vencimento}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Favorecido:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{snapshot?.clinica?.favorecidoPix || snapshot?.clinica?.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chave PIX:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{snapshot?.clinica?.chavePix}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(modalPixParcela.payloadPix);
                    setCopiouModalPix(true);
                    toast.success(`Código PIX Copia e Cola (${formatMoney(modalPixParcela.valor)}) copiado com sucesso!`);
                    setTimeout(() => setCopiouModalPix(false), 2500);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 gap-2 text-sm"
                >
                  {copiouModalPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiouModalPix ? 'Código Copiado!' : 'Copiar Código PIX Copia e Cola'}
                </Button>

                <p className="text-[11px] text-muted-foreground">
                  Após copiar, abra o aplicativo do seu banco (Nubank, Itaú, Inter, etc.), clique em <strong>Pix Copia e Cola</strong> e confirme o pagamento.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Shell>
  );
}

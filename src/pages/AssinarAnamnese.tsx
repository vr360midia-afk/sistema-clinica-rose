import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import DigitalSignature, { SignatureData } from '@/components/signature/DigitalSignature';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  ClipboardList,
  HeartPulse,
  AlertTriangle,
  Pill,
  Check,
  FileSignature,
  Building2,
  Calendar,
  User,
  ShieldCheck,
  Lock,
  MessageCircle,
  Activity,
  Smile,
  ShieldAlert,
  Sparkles,
  Users,
  Flame,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';
import { openWhatsApp } from '@/lib/whatsapp';
import {
  decodificarAnamnesePayload,
  isAnamneseBloqueada,
  marcarAnamneseBloqueada,
  unslugifyNome,
} from '@/utils/anamneseEngine';

type Status = 'loading' | 'valid' | 'invalid' | 'expired' | 'completed' | 'blocked';

const DEFAULT_CLINICA_WHATSAPP = '5582974002213';
const DEFAULT_CLINICA_NOME = 'Dra. Rosangela Santos';

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start py-6 sm:py-8 px-3 sm:px-6 overflow-x-hidden w-full max-w-full print:min-h-0 print:h-auto print:bg-white print:p-0 print:m-0 print:overflow-visible">
    <div className="w-full max-w-3xl space-y-6 overflow-x-hidden print:max-w-none print:w-full print:space-y-0 print:overflow-visible">{children}</div>
  </div>
);

// Componente interativo para perguntas objetivas de Sim / Não na triagem
const PerguntaSimNao = ({
  titulo,
  descricao,
  valor,
  onChange,
  alertaSeSim = false,
}: {
  titulo: string;
  descricao?: string;
  valor?: 'sim' | 'nao';
  onChange: (val: 'sim' | 'nao') => void;
  alertaSeSim?: boolean;
}) => (
  <div className="p-3 rounded-lg border bg-card/70 hover:bg-card transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
    <div className="space-y-0.5 pr-2">
      <p className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
        {alertaSeSim && valor === 'sim' && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
        {titulo}
      </p>
      {descricao && <p className="text-[11px] text-muted-foreground leading-relaxed">{descricao}</p>}
    </div>
    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
      <button
        type="button"
        onClick={() => onChange('nao')}
        className={cn(
          "px-3 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer",
          valor === 'nao'
            ? "bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 shadow-xs"
            : "bg-background text-muted-foreground border-border hover:bg-accent"
        )}
      >
        Não
      </button>
      <button
        type="button"
        onClick={() => onChange('sim')}
        className={cn(
          "px-3 py-1 text-xs font-semibold rounded-md border transition-all cursor-pointer",
          valor === 'sim'
            ? alertaSeSim
              ? "bg-amber-600 text-white border-amber-600 shadow-xs"
              : "bg-primary text-primary-foreground border-primary shadow-xs"
            : "bg-background text-muted-foreground border-border hover:bg-accent"
        )}
      >
        Sim
      </button>
    </div>
  </div>
);

const ITENS_TRIAGEM = [
  {
    id: 'hipertensao',
    titulo: 'Possui Hipertensão (Pressão Alta)?',
    descricao: 'Diagnóstico prévio ou em tratamento com anti-hipertensivo.',
    alertaSeSim: true,
  },
  {
    id: 'diabetes',
    titulo: 'Possui Diabetes?',
    descricao: 'Glicemia alterada ou uso diário de medicação/insulina.',
    alertaSeSim: true,
  },
  {
    id: 'cardiopatia',
    titulo: 'Problemas Cardíacos (Coração)?',
    descricao: 'Infarto prévio, sopro, angina, marca-passo ou cirurgia cardíaca.',
    alertaSeSim: true,
  },
  {
    id: 'coagulacao',
    titulo: 'Distúrbio de Coagulação ou Sangramento Excessivo?',
    descricao: 'Dificuldade de estancar sangue ou uso de anticoagulantes/aspirina.',
    alertaSeSim: true,
  },
  {
    id: 'alergia_anestesia',
    titulo: 'Reação ou Alergia a Anestesia Odontológica?',
    descricao: 'Já passou mal, teve taquicardia severa ou alergia durante anestesia.',
    alertaSeSim: true,
  },
  {
    id: 'bisfosfonatos',
    titulo: 'Uso de Remédios para Ossos / Osteoporose?',
    descricao: 'Uso atual ou pregresso de bisfosfonatos (ex: Alendronato, Prolia, Zometa).',
    alertaSeSim: true,
  },
  {
    id: 'bruxismo_atm',
    titulo: 'Aperta/Ranger os Dentes ou Dores na Mandíbula (ATM)?',
    descricao: 'Bruxismo diurno/noturno, estalos na articulação ou dores de cabeça.',
    alertaSeSim: false,
  },
  {
    id: 'gestante_lactante',
    titulo: 'Está Grávida ou Amamentando?',
    descricao: 'Importante para a seleção segura de anestésicos, fármacos e radiografias.',
    alertaSeSim: true,
  },
];

const AssinarAnamnese = () => {
  const { id, slug, publicSlug } = useParams<{ id?: string; slug?: string; publicSlug?: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t') || '';
  const modoUrl = searchParams.get('modo') || searchParams.get('m');
  const encodedData = searchParams.get('d') || searchParams.get('data') || searchParams.get('c');
  const idFromQuery = searchParams.get('id');
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const effectiveSlug = slug || publicSlug || (currentPath ? currentPath.replace(/^\//, '') : '');
  const targetId = idFromQuery || id || effectiveSlug || '';

  const modoDetectado = modoUrl
    ? (modoUrl === 'assinar' ? 'assinar' : 'preencher')
    : currentPath.includes('assinar')
    ? 'assinar'
    : 'preencher';

  const [status, setStatus] = useState<Status>('loading');
  const [anamnese, setAnamnese] = useState<any>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [telefoneClinica, setTelefoneClinica] = useState<string>(DEFAULT_CLINICA_WHATSAPP);
  const [nomeClinica, setNomeClinica] = useState<string>(DEFAULT_CLINICA_NOME);
  const [showSignature, setShowSignature] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modoVisualizacao, setModoVisualizacao] = useState<'preencher' | 'assinar'>(modoDetectado);

  // Carrega configurações da clínica para contato via WhatsApp
  useEffect(() => {
    const carregarConfigClinica = async () => {
      try {
        const { data: cfg } = await supabase
          .from('configuracoes')
          .select('whatsapp_numero, telefone, nome_clinica')
          .limit(1)
          .maybeSingle();

        if (cfg) {
          const num = cfg.whatsapp_numero || cfg.telefone;
          if (num) {
            setTelefoneClinica(num);
          }
          if (cfg.nome_clinica) {
            setNomeClinica(cfg.nome_clinica);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar configurações da clínica em AssinarAnamnese:', err);
      }
    };
    carregarConfigClinica();
  }, []);

  // Campos preenchíveis/editáveis pelo paciente
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [historiaAtual, setHistoriaAtual] = useState('');
  const [historiaFamiliar, setHistoriaFamiliar] = useState('');
  const [historiaMedica, setHistoriaMedica] = useState('');
  const [alergias, setAlergias] = useState('');
  const [medicamentos, setMedicamentos] = useState('');
  const [habitosViciosPositivos, setHabitosViciosPositivos] = useState('');
  const [habitosViciosNegativos, setHabitosViciosNegativos] = useState('');
  const [observacoes, setObservacoes] = useState('');

  // Triagem de Segurança Odontológica (Perguntas Objetivas Sim / Não)
  const [triagem, setTriagem] = useState<Record<string, 'sim' | 'nao'>>({});

  const handleTriagemChange = (campo: string, valor: 'sim' | 'nao') => {
    setTriagem((prev) => ({ ...prev, [campo]: valor }));
  };

  const call = useCallback(
    async (action: 'get' | 'sign', extra: Record<string, unknown> = {}) => {
      // 1. Tenta Edge Function 'assinatura-publica'
      try {
        const { data, error } = await supabase.functions.invoke('assinatura-publica', {
          body: { action, id: targetId, token, ...extra },
        });
        if (!error && data && !data.error) {
          return data;
        }
      } catch (err) {
        console.warn('Edge function indisponível, recorrendo ao fallback direto:', err);
      }

      // 2. Fallback direto no Supabase
      if (action === 'get') {
        const { data: anamneseDb, error: dbErr } = await supabase
          .from('anamneses')
          .select('*, paciente:pacientes(nome, telefone, cpf, email)')
          .eq('id', targetId)
          .maybeSingle();

        if (dbErr || !anamneseDb) {
          // 3. Fallback LocalStorage (útil para testes em desenvolvimento)
          try {
            const localAnams = JSON.parse(localStorage.getItem('dental-system-anamneses') || '[]');
            const localMatch = localAnams.find((a: any) => a.id === targetId);
            if (localMatch) {
              return {
                anamnese: {
                  id: localMatch.id,
                  data: localMatch.data,
                  queixaPrincipal: localMatch.queixaPrincipal,
                  historiaAtual: localMatch.historiaAtual,
                  historiaFamiliar: localMatch.historiaFamiliar,
                  historiaMedica: localMatch.historiaMedica,
                  alergias: localMatch.alergias,
                  medicamentos: localMatch.medicamentos,
                  habitosViciosPositivos: localMatch.habitosViciosPositivos,
                  habitosViciosNegativos: localMatch.habitosViciosNegativos,
                  observacoes: localMatch.observacoes,
                  respostas: localMatch.respostas,
                  jaAssinado: !!localMatch.assinaturaPaciente,
                  assinaturaPaciente: localMatch.assinaturaPaciente,
                },
                paciente: { nome: localMatch.pacienteNome || 'Paciente' },
              };
            }
          } catch (e) {
            console.warn('Erro ao ler localStorage fallback:', e);
          }
          throw new Error('Anamnese não encontrada');
        }

        return {
          anamnese: {
            id: anamneseDb.id,
            data: anamneseDb.data,
            queixaPrincipal: anamneseDb.queixa_principal,
            historiaAtual: anamneseDb.historia_atual,
            historiaFamiliar: anamneseDb.historia_familiar,
            historiaMedica: anamneseDb.historia_medica,
            alergias: anamneseDb.alergias,
            medicamentos: anamneseDb.medicamentos,
            habitosViciosPositivos: anamneseDb.habitos_vicios_positivos,
            habitosViciosNegativos: anamneseDb.habitos_vicios_negativos,
            observacoes: anamneseDb.observacoes,
            respostas: anamneseDb.respostas,
            jaAssinado: anamneseDb.status_assinatura === 'paciente_assinado' || anamneseDb.status_assinatura === 'completo' || !!anamneseDb.assinatura_paciente,
            assinaturaPaciente: anamneseDb.assinatura_paciente,
          },
          paciente: {
            nome: (anamneseDb as any).paciente?.nome || anamneseDb.paciente_nome || 'Paciente',
            telefone: (anamneseDb as any).paciente?.telefone,
            cpf: (anamneseDb as any).paciente?.cpf,
            email: (anamneseDb as any).paciente?.email,
          },
        };
      }

      if (action === 'sign') {
        const assinaturaData = {
          signature: extra.signature,
          signerName: extra.signerName || paciente?.nome || 'Paciente',
          signerRole: 'paciente',
          timestamp: new Date().toISOString(),
        };

        const updatePayload: any = {
          assinatura_paciente: assinaturaData,
          status_assinatura: 'paciente_assinado',
          data_assinatura: new Date().toISOString(),
        };

        if (extra.respostasAtualizadas) {
          const r = extra.respostasAtualizadas as any;
          if (r.queixaPrincipal !== undefined) updatePayload.queixa_principal = r.queixaPrincipal;
          if (r.historiaAtual !== undefined) updatePayload.historia_atual = r.historiaAtual;
          if (r.historiaFamiliar !== undefined) updatePayload.historia_familiar = r.historiaFamiliar;
          if (r.historiaMedica !== undefined) updatePayload.historia_medica = r.historiaMedica;
          if (r.alergias !== undefined) updatePayload.alergias = r.alergias;
          if (r.medicamentos !== undefined) updatePayload.medicamentos = r.medicamentos;
          if (r.habitosViciosPositivos !== undefined) updatePayload.habitos_vicios_positivos = r.habitosViciosPositivos;
          if (r.habitosViciosNegativos !== undefined) updatePayload.habitos_vicios_negativos = r.habitosViciosNegativos;
          if (r.observacoes !== undefined) updatePayload.observacoes = r.observacoes;
          if (r.respostas !== undefined) updatePayload.respostas = r.respostas;
        }

        // Tenta atualizar no Supabase com todas as colunas suportadas
        try {
          const supabasePayload: any = {
            status_assinatura: 'paciente_assinado',
            data_assinatura: new Date().toISOString(),
            assinatura_paciente: assinaturaData,
          };
          if (updatePayload.queixa_principal !== undefined) supabasePayload.queixa_principal = updatePayload.queixa_principal;
          if (updatePayload.historia_atual !== undefined) supabasePayload.historia_atual = updatePayload.historia_atual;
          if (updatePayload.historia_familiar !== undefined) supabasePayload.historia_familiar = updatePayload.historia_familiar;
          if (updatePayload.historia_medica !== undefined) supabasePayload.historia_medica = updatePayload.historia_medica;
          if (updatePayload.alergias !== undefined) supabasePayload.alergias = updatePayload.alergias;
          if (updatePayload.medicamentos !== undefined) supabasePayload.medicamentos = updatePayload.medicamentos;
          if (updatePayload.habitos_vicios_positivos !== undefined) supabasePayload.habitos_vicios_positivos = updatePayload.habitos_vicios_positivos;
          if (updatePayload.habitos_vicios_negativos !== undefined) supabasePayload.habitos_vicios_negativos = updatePayload.habitos_vicios_negativos;
          if (updatePayload.observacoes !== undefined) supabasePayload.observacoes = updatePayload.observacoes;
          if (updatePayload.respostas !== undefined) supabasePayload.respostas = updatePayload.respostas;

          await supabase.from('anamneses').update(supabasePayload).eq('id', targetId);
        } catch (dbUpErr) {
          console.warn('Erro na atualização direta:', dbUpErr);
        }

        // Sincroniza também no localStorage
        try {
          const localAnams = JSON.parse(localStorage.getItem('dental-system-anamneses') || '[]');
          const idx = localAnams.findIndex((a: any) => a.id === targetId);
          if (idx >= 0) {
            localAnams[idx] = {
              ...localAnams[idx],
              assinaturaPaciente: assinaturaData,
              statusAssinatura: 'paciente_assinado',
              dataAssinatura: new Date(),
              queixaPrincipal: updatePayload.queixa_principal || localAnams[idx].queixaPrincipal,
              historiaAtual: updatePayload.historia_atual || localAnams[idx].historiaAtual,
              historiaFamiliar: updatePayload.historia_familiar || localAnams[idx].historiaFamiliar,
              historiaMedica: updatePayload.historia_medica || localAnams[idx].historiaMedica,
              alergias: updatePayload.alergias || localAnams[idx].alergias,
              medicamentos: updatePayload.medicamentos || localAnams[idx].medicamentos,
              habitosViciosPositivos: updatePayload.habitos_vicios_positivos || localAnams[idx].habitosViciosPositivos,
              habitosViciosNegativos: updatePayload.habitos_vicios_negativos || localAnams[idx].habitosViciosNegativos,
              observacoes: updatePayload.observacoes || localAnams[idx].observacoes,
              respostas: updatePayload.respostas || localAnams[idx].respostas,
            };
            localStorage.setItem('dental-system-anamneses', JSON.stringify(localAnams));
          }
        } catch (e) {
          console.warn('Erro ao atualizar localStorage:', e);
        }

        return { ok: true };
      }
    },
    [targetId, token, paciente]
  );

  useEffect(() => {
    // Função auxiliar para popular os campos da anamnese no estado
    const popularDados = (anamneseData: any, pacienteData?: any) => {
      setAnamnese(anamneseData);
      if (pacienteData) {
        setPaciente({
          nome: pacienteData.nome || 'Paciente',
          telefone: pacienteData.telefone,
          cpf: pacienteData.cpf,
          email: pacienteData.email,
        });
      }
      setQueixaPrincipal(anamneseData.queixaPrincipal || anamneseData.queixa_principal || '');
      setHistoriaAtual(anamneseData.historiaAtual || anamneseData.historia_atual || '');
      setHistoriaFamiliar(anamneseData.historiaFamiliar || anamneseData.historia_familiar || '');
      setHistoriaMedica(anamneseData.historiaMedica || anamneseData.historia_medica || '');
      setAlergias(anamneseData.alergias || '');
      setMedicamentos(anamneseData.medicamentos || '');
      setHabitosViciosPositivos(
        anamneseData.habitosViciosPositivos || anamneseData.habitos_vicios_positivos || ''
      );
      setHabitosViciosNegativos(
        anamneseData.habitosViciosNegativos ||
          anamneseData.habitos_vicios_negativos ||
          anamneseData.habitos ||
          ''
      );
      setObservacoes(anamneseData.observacoes || '');

      const resp = anamneseData.respostas || {};
      if (typeof resp === 'object' && resp !== null) {
        setTriagem({ ...resp });
      }
    };

    // 1. Tenta decodificar o payload seguro da URL
    if (encodedData) {
      const payload = decodificarAnamnesePayload(encodedData);
      if (payload) {
        popularDados(payload, {
          nome: payload.pacienteNome,
          telefone: payload.telefone,
          cpf: payload.cpf,
          email: payload.email,
        });

        if (payload.modo) {
          setModoVisualizacao(payload.modo);
        }

        const bloqueada =
          isAnamneseBloqueada(payload.id, payload.token) ||
          payload.status === 'completo' ||
          payload.status === 'paciente_assinado';

        if (bloqueada) {
          setStatus('blocked');
          return;
        }

        if (payload.expiracao && new Date(payload.expiracao).getTime() < Date.now()) {
          setStatus('expired');
          return;
        }

        setStatus('valid');
        return;
      }
    }

    if (!targetId) {
      setStatus('invalid');
      return;
    }

    // 2. Busca anamnese via API / Supabase / LocalStorage
    (async () => {
      try {
        const data = await call('get');
        if (!data || data.error) {
          // Tenta ler do cache local antes de declarar expirado/inválido
          try {
            const localAnams = JSON.parse(localStorage.getItem('dental-system-anamneses') || '[]');
            const localMatch = localAnams.find((a: any) => a.id === targetId);
            const cachedPayload = localStorage.getItem(`anamnese_payload_${targetId}`)
              ? JSON.parse(localStorage.getItem(`anamnese_payload_${targetId}`)!)
              : null;
            const match = localMatch || cachedPayload;
            if (match) {
              popularDados(match, { nome: match.pacienteNome || match.nome || (match as any).paciente?.nome });
              if (match.assinaturaPaciente || isAnamneseBloqueada(targetId, token)) {
                setStatus('blocked');
              } else {
                setStatus('valid');
              }
              return;
            }
          } catch (_) {}

          setStatus(data?.error === 'expired' ? 'expired' : 'invalid');
          return;
        }

        popularDados(data.anamnese, data.paciente);
        if (data.clinica?.telefone) {
          setTelefoneClinica(data.clinica.telefone);
        }
        if (data.clinica?.nome) {
          setNomeClinica(data.clinica.nome);
        }

        if (data.anamnese?.jaAssinado || isAnamneseBloqueada(targetId, token)) {
          setStatus('blocked');
          return;
        }

        setStatus('valid');
      } catch (err: any) {
        // Tenta ler fallback de cache
        try {
          const localAnams = JSON.parse(localStorage.getItem('dental-system-anamneses') || '[]');
          const localMatch = localAnams.find((a: any) => a.id === targetId);
          const cachedPayload = localStorage.getItem(`anamnese_payload_${targetId}`)
            ? JSON.parse(localStorage.getItem(`anamnese_payload_${targetId}`)!)
            : null;
          const match = localMatch || cachedPayload;
          if (match) {
            popularDados(match, { nome: match.pacienteNome || match.nome || (match as any).paciente?.nome });
            if (match.assinaturaPaciente || isAnamneseBloqueada(targetId, token)) {
              setStatus('blocked');
            } else {
              setStatus('valid');
            }
            return;
          }
        } catch (_) {}

        if (effectiveSlug || targetId) {
          const nomePaciente = effectiveSlug ? unslugifyNome(effectiveSlug) : 'Paciente';
          setPaciente({ nome: nomePaciente });
          setAnamnese({
            id: targetId,
            pacienteNome: nomePaciente,
            data: new Date().toISOString(),
          });
          setStatus('valid');
          return;
        }
        setStatus(String(err?.message || '').includes('410') ? 'expired' : 'invalid');
      }
    })();
  }, [targetId, token, encodedData, call, effectiveSlug]);

  const handleSignature = async (signatureData: SignatureData) => {
    try {
      setSalvando(true);
      const dataHoraIso = new Date().toISOString();

      const assinaturaCompleta: any = {
        signature: signatureData.signature,
        signerName: signatureData.signerName || paciente?.nome || 'Paciente',
        signerRole: 'paciente',
        timestamp: dataHoraIso,
      };

      // Atualiza o estado da anamnese em memória
      setAnamnese((prev: any) => ({
        ...prev,
        assinaturaPaciente: assinaturaCompleta,
        statusAssinatura: 'paciente_assinado',
      }));

      // Salva snapshot local completo para visualização offline ou pós-bloqueio
      try {
        localStorage.setItem(`anamnese_payload_${targetId}`, JSON.stringify({
          id: targetId,
          pacienteNome: paciente?.nome,
          cpf: paciente?.cpf,
          telefone: paciente?.telefone,
          queixaPrincipal: queixaPrincipal.trim(),
          historiaAtual: historiaAtual.trim(),
          historiaFamiliar: historiaFamiliar.trim(),
          alergias: alergias.trim(),
          medicamentos: medicamentos.trim(),
          historiaMedica: historiaMedica.trim(),
          habitosViciosPositivos: habitosViciosPositivos.trim(),
          habitosViciosNegativos: habitosViciosNegativos.trim(),
          observacoes: observacoes.trim(),
          respostas: triagem,
          assinaturaPaciente: assinaturaCompleta,
          status: 'paciente_assinado',
          data: dataHoraIso,
        }));
      } catch (_) {}

      // Bloqueia permanentemente o link no dispositivo contra novas edições
      marcarAnamneseBloqueada(targetId, token, {
        dataHora: dataHoraIso,
        pacienteNome: paciente?.nome,
      });

      try {
        await call('sign', {
          signature: signatureData.signature,
          signerName: signatureData.signerName,
          respostasAtualizadas: {
            queixaPrincipal: queixaPrincipal.trim(),
            historiaAtual: historiaAtual.trim(),
            historiaFamiliar: historiaFamiliar.trim(),
            alergias: alergias.trim(),
            medicamentos: medicamentos.trim(),
            historiaMedica: historiaMedica.trim(),
            habitosViciosPositivos: habitosViciosPositivos.trim(),
            habitosViciosNegativos: habitosViciosNegativos.trim(),
            observacoes: observacoes.trim(),
            respostas: triagem,
          },
        });
      } catch (err) {
        console.warn('Tentativa de gravação remota finalizada:', err);
      }

      setStatus('blocked');
      setShowSignature(false);
      toast.success('Ficha de anamnese respondida e assinada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao registrar assinatura:', err);
      toast.error('Erro ao registrar assinatura. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (status === 'loading') {
    return (
      <Shell>
        <Card className="p-12 text-center border-border shadow-md">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Carregando Ficha de Anamnese...</h2>
          <p className="text-xs text-muted-foreground mt-1">Aguarde um instante enquanto preparamos os dados.</p>
        </Card>
      </Shell>
    );
  }

  // TELA VISUALIZADOR DA FICHA PREENCHIDA / BLOQUEADA (Mobile-Friendly & Completa)
  if (status === 'blocked') {
    const dataFormatada = anamnese?.data
      ? new Date(anamnese.data).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');
    const assinaturaData = anamnese?.assinaturaPaciente;
    const respostasTriagem = anamnese?.respostas || triagem;

    return (
      <Shell>
        <div className="w-full max-w-2xl mx-auto space-y-4 print:max-w-none print:w-full print:m-0 print:space-y-2">
          <Card className="border-border shadow-lg overflow-hidden print:border-0 print:shadow-none print:rounded-none print:overflow-visible">
            {/* Header da Clínica */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-5 sm:p-6 text-white text-center print:bg-emerald-900 print:text-white print:p-3.5 print:rounded-lg print:break-inside-avoid">
              <div className="h-14 w-14 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center mx-auto mb-2 shadow-inner print:h-10 print:w-10 print:mb-1">
                <ShieldCheck className="h-8 w-8 text-white print:h-6 print:w-6" />
              </div>
              <Badge className="bg-emerald-500/30 text-white border-white/20 text-xs mb-2 print:mb-1 print:text-[10px] print:py-0">
                Documento Clínico Preenchido e Assinado
              </Badge>
              <h1 className="text-xl sm:text-2xl font-bold print:text-lg">Ficha de Anamnese Odontológica</h1>
              <p className="text-xs text-emerald-100 mt-1 print:text-[11px] print:mt-0.5">
                Dra. Rosangela Santos • Odontologia Especializada
              </p>
            </div>

            <CardContent className="p-4 sm:p-6 space-y-4 print:p-0 print:pt-2.5 print:space-y-2">
              {/* Informações do Paciente */}
              <div className="p-3.5 rounded-xl bg-muted/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs print:p-2.5 print:rounded-lg print:border-slate-300 print:bg-slate-50/80 print:break-inside-avoid">
                <div>
                  <span className="text-muted-foreground uppercase font-semibold text-[10px]">Paciente</span>
                  <p className="text-base font-bold text-foreground print:text-sm">{paciente?.nome || 'Paciente'}</p>
                  {paciente?.cpf && <p className="text-muted-foreground print:text-[11px]">CPF: {paciente.cpf}</p>}
                </div>
                <div className="sm:text-right">
                  <span className="text-muted-foreground uppercase font-semibold text-[10px]">Data do Preenchimento</span>
                  <p className="font-semibold text-foreground print:text-xs">{dataFormatada}</p>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px] mt-0.5">
                    <CheckCircle className="h-3.5 w-3.5" /> Assinado Digitalmente
                  </span>
                </div>
              </div>

              {/* Seções com as Respostas Preenchidas */}
              <div className="space-y-3 pt-1 print:space-y-2 print:pt-0">
                {/* 1. Queixa Principal */}
                <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-sm print:text-xs">
                    <ClipboardList className="h-4 w-4 text-primary print:h-3.5 print:w-3.5" />
                    1. Queixa Principal
                  </span>
                  <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 font-medium print:text-[11px] print:pl-4">
                    {queixaPrincipal || anamnese?.queixaPrincipal || 'Avaliação clínica odontológica'}
                  </p>
                </div>

                {/* 2. História da Queixa Atual */}
                {(historiaAtual || anamnese?.historiaAtual) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm print:text-xs">
                      <Clock className="h-4 w-4 text-blue-500 print:h-3.5 print:w-3.5" />
                      2. História da Doença / Queixa Atual
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 print:text-[11px] print:pl-4">
                      {historiaAtual || anamnese?.historiaAtual}
                    </p>
                  </div>
                )}

                {/* 3. Triagem Rápida Odontológica (Sim/Não) */}
                {Object.keys(respostasTriagem).length > 0 && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-2 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm print:text-xs">
                      <HeartPulse className="h-4 w-4 text-rose-500 print:h-3.5 print:w-3.5" />
                      3. Triagem Rápida de Saúde
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1 pt-1 print:gap-1.5 print:pl-0 print:pt-0">
                      {ITENS_TRIAGEM.map((item) => {
                        const resposta = respostasTriagem[item.id];
                        if (!resposta) return null;
                        const isSim = resposta === 'sim';
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "p-2 rounded-md border text-[11px] flex items-center justify-between gap-2 print:p-1.5 print:border-slate-300 print:break-inside-avoid",
                              isSim && item.alertaSeSim
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 print:bg-amber-50"
                                : "bg-muted/40 border-border text-foreground print:bg-slate-50"
                            )}
                          >
                            <span className="truncate pr-1 print:text-[10px]">{item.titulo.replace('?', '')}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] shrink-0 font-bold print:text-[9px] print:py-0",
                                isSim
                                  ? item.alertaSeSim
                                    ? "bg-amber-500 text-white border-amber-500"
                                    : "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {isSim ? 'SIM' : 'NÃO'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Alergias e Medicamentos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:gap-2 print:break-inside-avoid">
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300">
                    <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-sm print:text-xs">
                      <AlertTriangle className="h-4 w-4 text-amber-500 print:h-3.5 print:w-3.5" />
                      Alergias e Restrições
                    </span>
                    <p className="text-foreground text-xs sm:text-sm pl-5 pt-0.5 font-medium print:text-[11px] print:pl-4">
                      {alergias || anamnese?.alergias || 'Nenhuma alergia informada'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300">
                    <span className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 text-sm print:text-xs">
                      <Pill className="h-4 w-4 text-blue-500 print:h-3.5 print:w-3.5" />
                      Medicamentos em Uso
                    </span>
                    <p className="text-foreground text-xs sm:text-sm pl-5 pt-0.5 font-medium print:text-[11px] print:pl-4">
                      {medicamentos || anamnese?.medicamentos || 'Nenhum medicamento informado'}
                    </p>
                  </div>
                </div>

                {/* 5. Histórico Médico e Familiar */}
                {(historiaMedica || anamnese?.historiaMedica) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm print:text-xs">
                      <Stethoscope className="h-4 w-4 text-red-500 print:h-3.5 print:w-3.5" />
                      Histórico Médico Pregresso
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 print:text-[11px] print:pl-4">
                      {historiaMedica || anamnese?.historiaMedica}
                    </p>
                  </div>
                )}

                {(historiaFamiliar || anamnese?.historiaFamiliar) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm print:text-xs">
                      <Users className="h-4 w-4 text-indigo-500 print:h-3.5 print:w-3.5" />
                      Histórico Familiar
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 print:text-[11px] print:pl-4">
                      {historiaFamiliar || anamnese?.historiaFamiliar}
                    </p>
                  </div>
                )}

                {/* 6. Hábitos Bucais e Nocivos */}
                {(habitosViciosPositivos || anamnese?.habitosViciosPositivos) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 text-sm print:text-xs">
                      <Smile className="h-4 w-4 text-emerald-500 print:h-3.5 print:w-3.5" />
                      Hábitos de Higiene Bucal
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 print:text-[11px] print:pl-4">
                      {habitosViciosPositivos || anamnese?.habitosViciosPositivos}
                    </p>
                  </div>
                )}

                {(habitosViciosNegativos || anamnese?.habitosViciosNegativos) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm print:text-xs">
                      <Flame className="h-4 w-4 text-purple-500 print:h-3.5 print:w-3.5" />
                      Hábitos Nocivos / Vícios
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 print:text-[11px] print:pl-4">
                      {habitosViciosNegativos || anamnese?.habitosViciosNegativos}
                    </p>
                  </div>
                )}

                {/* 7. Observações Gerais */}
                {(observacoes || anamnese?.observacoes) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1 print:p-2.5 print:border-slate-300 print:break-inside-avoid">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm print:text-xs">
                      <ClipboardList className="h-4 w-4 text-slate-500 print:h-3.5 print:w-3.5" />
                      Observações Adicionais
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 print:text-[11px] print:pl-4">
                      {observacoes || anamnese?.observacoes}
                    </p>
                  </div>
                )}
              </div>

              {/* Bloco de Assinatura Digital e Validação */}
              <div className="mt-4 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3 print:mt-2.5 print:p-2.5 print:border print:border-emerald-700/40 print:bg-emerald-50/20 print:rounded-lg print:break-inside-avoid">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2 print:pb-1">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide print:text-[11px]">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 print:h-3.5 print:w-3.5" />
                    Assinatura Eletrônica Registrada
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[10px] print:text-[9px] print:py-0">Autêntico</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs print:gap-1.5">
                  <div>
                    <span className="text-muted-foreground block text-[11px] print:text-[10px]">Assinado por:</span>
                    <span className="font-semibold text-foreground print:text-[11px]">
                      {assinaturaData?.signerName || paciente?.nome || 'Paciente'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] print:text-[10px]">Data e Hora da Assinatura:</span>
                    <span className="font-semibold text-foreground print:text-[11px]">
                      {assinaturaData?.timestamp ? new Date(assinaturaData.timestamp).toLocaleString('pt-BR') : dataFormatada}
                    </span>
                  </div>
                </div>

                {assinaturaData?.signature && (
                  <div className="pt-2 print:pt-1">
                    <span className="text-[11px] text-muted-foreground block mb-1 print:text-[10px]">Traço Digital Coletado:</span>
                    <div className="p-2 border rounded-md bg-white max-w-xs shadow-xs print:p-1.5 print:max-w-[200px] print:border-slate-300">
                      <img
                        src={assinaturaData.signature}
                        alt="Traço da Assinatura"
                        className="h-16 w-auto object-contain mx-auto print:h-11"
                      />
                    </div>
                  </div>
                )}

                <div className="p-2.5 rounded bg-background/80 border text-[11px] text-muted-foreground flex items-start gap-2 print:p-1.5 print:text-[10px] print:border-slate-200">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 print:h-3 print:w-3" />
                  <span>
                    Ficha finalizada e bloqueada para novas alterações em conformidade com a LGPD e normas de prontuário eletrônico odontológico.
                  </span>
                </div>
              </div>

              {/* Botões de Ação na Tela (Ocultos na Impressão/PDF) */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-3 print:hidden">
                <Button
                  type="button"
                  onClick={() => window.print()}
                  variant="outline"
                  className="w-full sm:w-auto text-xs h-9 gap-1.5 cursor-pointer"
                >
                  <ClipboardList className="h-4 w-4" />
                  Imprimir / Salvar PDF
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    const nomePaciente = paciente?.nome || 'Paciente';
                    const msg = `Olá, ${nomeClinica || 'Dra. Rosangela'}! Sou ${nomePaciente} e acabei de assinar digitalmente a minha Ficha de Anamnese. Estou com o comprovante em mãos. Obrigado!`;
                    openWhatsApp(telefoneClinica || DEFAULT_CLINICA_WHATSAPP, msg);
                  }}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                >
                  <MessageCircle className="h-4 w-4" />
                  Falar com a Clínica no WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Shell>
    );
  }

  if (status === 'invalid') {
    return (
      <Shell>
        <Card className="w-full max-w-md mx-auto border-border shadow-md text-center p-6">
          <CardContent className="pt-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Link Inválido</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Este link de anamnese não foi encontrado ou expirou. Por favor, entre em contato com a clínica para solicitar um novo link atualizado.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => {
                  const msg = `Olá, ${nomeClinica || 'Dra. Rosangela'}! Meu link de acesso à Ficha de Anamnese deu como inválido ou não foi encontrado. Poderia me enviar um novo link, por favor?`;
                  openWhatsApp(telefoneClinica || DEFAULT_CLINICA_WHATSAPP, msg);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com a Clínica no WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (status === 'expired') {
    return (
      <Shell>
        <Card className="w-full max-w-md mx-auto border-border shadow-md text-center p-6">
          <CardContent className="pt-4 space-y-4">
            <div className="h-14 w-14 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto">
              <Clock className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Link Expirado</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Por motivos de segurança, este link de preenchimento expirou após o prazo limite. Solicite um novo link à equipe do consultório.
              </p>
            </div>
            <div className="pt-2">
              <Button
                type="button"
                onClick={() => {
                  const msg = `Olá, ${nomeClinica || 'Dra. Rosangela'}! Meu link de acesso à Ficha de Anamnese expirou. Poderia me enviar um novo link atualizado, por favor?`;
                  openWhatsApp(telefoneClinica || DEFAULT_CLINICA_WHATSAPP, msg);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                Falar com a Clínica no WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (showSignature) {
    return (
      <Shell>
        <div className="w-full max-w-2xl mx-auto">
          <DigitalSignature
            title="Assinatura da Ficha de Anamnese"
            signerName={paciente?.nome || 'Paciente'}
            signerRole="paciente"
            documentType="anamnese"
            initialEmail={paciente?.email || ''}
            initialCpf={paciente?.cpf || ''}
            onSignatureComplete={handleSignature}
            onCancel={() => setShowSignature(false)}
          />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Cabeçalho Oficial */}
      <Card className="border-border shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-900 dark:to-indigo-950 p-5 text-white">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-white/10 backdrop-blur-xs text-white">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  {modoVisualizacao === 'assinar'
                    ? 'Assinatura da Ficha de Anamnese'
                    : 'Preenchimento e Assinatura da Anamnese'}
                </h1>
                <p className="text-xs text-blue-100 mt-0.5">
                  Dra. Rosangela Santos • Odontologia Especializada
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-white/30 text-white bg-white/10 text-xs">
              {modoVisualizacao === 'assinar' ? 'Modo Assinatura' : 'Modo Preenchimento'}
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {/* Dados do Paciente */}
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <User className="h-4 w-4 text-primary shrink-0" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Paciente:</span>
                <span className="font-bold text-foreground text-sm">{paciente?.nome || 'Paciente'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <span className="text-muted-foreground block text-[11px]">Data de Emissão:</span>
                <span className="font-semibold text-foreground">
                  {anamnese?.data ? new Date(anamnese.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          {modoVisualizacao === 'assinar' ? (
            /* Modo 2: Apenas Assinar (Visualização Limpa do Resumo) */
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs text-sky-900 dark:text-sky-200 flex items-start justify-between gap-3">
                <div className="leading-relaxed">
                  <strong>Conferência Pré-Assinatura:</strong> As informações clínicas da sua anamnese constam abaixo. Confira o resumo e assine no final da página para confirmação legal.
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoVisualizacao('preencher')}
                  className="text-xs h-7 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/60 shrink-0 font-medium"
                >
                  Editar Respostas
                </Button>
              </div>

              <div className="grid gap-2.5">
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    1. Queixa Principal / Motivo da Consulta
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {queixaPrincipal || anamnese?.queixaPrincipal || 'Avaliação Inicial Odontológica'}
                  </p>
                </div>

                {(historiaAtual || anamnese?.historiaAtual) && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      2. História Atual da Queixa
                    </span>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {historiaAtual || anamnese?.historiaAtual}
                    </p>
                  </div>
                )}

                {Object.keys(triagem).length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                      3. Triagem de Saúde (Sim / Não)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {ITENS_TRIAGEM.map((item) => {
                        const resposta = triagem[item.id];
                        if (!resposta) return null;
                        return (
                          <div
                            key={item.id}
                            className="p-1.5 rounded bg-background border text-[11px] flex items-center justify-between"
                          >
                            <span className="truncate pr-1">{item.titulo.replace('?', '')}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold shrink-0",
                                resposta === 'sim'
                                  ? item.alertaSeSim
                                    ? "bg-amber-500 text-white border-amber-500"
                                    : "bg-primary text-primary-foreground border-primary"
                                  : "bg-muted text-muted-foreground border-border"
                              )}
                            >
                              {resposta === 'sim' ? 'SIM' : 'NÃO'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    4. Alergias Conhecidas (Medicamentos / Anestésicos / Materiais)
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {alergias || anamnese?.alergias || 'Nenhuma alergia relatada'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    5. Medicamentos em Uso Contínuo
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {medicamentos || anamnese?.medicamentos || 'Nenhum medicamento informado'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    6. Histórico Médico Pregresso
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {historiaMedica || anamnese?.historiaMedica || 'Sem histórico médico prévio relevante'}
                  </p>
                </div>

                {(historiaFamiliar || anamnese?.historiaFamiliar) && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      7. Histórico Familiar
                    </span>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {historiaFamiliar || anamnese?.historiaFamiliar}
                    </p>
                  </div>
                )}

                {(habitosViciosPositivos || habitosViciosNegativos) && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      8. Hábitos de Higiene e Vícios
                    </span>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {[habitosViciosPositivos, habitosViciosNegativos].filter(Boolean).join(' • ') || 'Nenhum hábito prejudicial informado'}
                    </p>
                  </div>
                )}

                {observacoes && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      9. Observações Adicionais
                    </span>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {observacoes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Modo 1: Preencher e Assinar (Formulário Clínico Completo) */
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Por favor, responda com atenção às perguntas de saúde abaixo. Suas respostas são indispensáveis para garantir procedimentos seguros.
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoVisualizacao('assinar')}
                  className="text-xs h-7 text-muted-foreground hover:text-foreground shrink-0"
                >
                  Ver Resumo
                </Button>
              </div>

              {/* Questionário Clínico Estruturado */}
              <div className="space-y-6 text-xs sm:text-sm">
                {/* Seção 1: Motivo da Consulta */}
                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3.5 shadow-xs">
                  <div className="border-b border-border pb-2 flex items-center gap-2 text-primary font-bold text-sm">
                    <ClipboardList className="h-4 w-4" />
                    <span>1. Motivo da Consulta & Queixa Atual</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                      Qual é a sua Queixa Principal ou motivo do atendimento? *
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Ex: Dor de dente, limpeza e avaliação geral, restauração, clareamento, troca de prótese..."
                      value={queixaPrincipal}
                      onChange={(e) => setQueixaPrincipal(e.target.value)}
                      className="text-xs sm:text-sm bg-background border-border"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      História Atual da Queixa (Quando começou? Sente dor contínua ou ao mastigar/gelado?)
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Ex: Começou há 3 dias, dói quando tomo água gelada, piora à noite..."
                      value={historiaAtual}
                      onChange={(e) => setHistoriaAtual(e.target.value)}
                      className="text-xs sm:text-sm bg-background border-border"
                    />
                  </div>
                </div>

                {/* Seção 2: Triagem Rápida Odontológica (Perguntas Objetivas Sim / Não) */}
                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3.5 shadow-xs">
                  <div className="border-b border-border pb-2 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                      <Activity className="h-4 w-4 text-emerald-600" />
                      <span>2. Triagem Rápida de Saúde (Marque Sim ou Não)</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Segurança Clínica
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Estas informações são vitais para evitar hemorragias, interações medicamentosas ou choques alérgicos durante o atendimento.
                  </p>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {ITENS_TRIAGEM.map((item) => (
                      <PerguntaSimNao
                        key={item.id}
                        titulo={item.titulo}
                        descricao={item.descricao}
                        valor={triagem[item.id]}
                        onChange={(val) => handleTriagemChange(item.id, val)}
                        alertaSeSim={item.alertaSeSim}
                      />
                    ))}
                  </div>
                </div>

                {/* Seção 3: Alergias e Medicamentos */}
                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3.5 shadow-xs">
                  <div className="border-b border-border pb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                    <ShieldAlert className="h-4 w-4" />
                    <span>3. Alergias e Medicamentos em Uso Contínuo</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        Possui alguma Alergia Conhecida?
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Ex: Dipirona, Penicilina, Anti-inflamatórios, Iodo, Látex (ou informe 'Não possuo')"
                        value={alergias}
                        onChange={(e) => setAlergias(e.target.value)}
                        className="text-xs sm:text-sm bg-background border-border"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                        <Pill className="h-3.5 w-3.5 text-blue-500" />
                        Medicamentos que você toma regularmente
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Ex: Remédios de pressão, anticoncepcional, insulina, calmantes, AAS (ou 'Nenhum')"
                        value={medicamentos}
                        onChange={(e) => setMedicamentos(e.target.value)}
                        className="text-xs sm:text-sm bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 4: Histórico Médico e Familiar */}
                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3.5 shadow-xs">
                  <div className="border-b border-border pb-2 flex items-center gap-2 text-foreground font-bold text-sm">
                    <Stethoscope className="h-4 w-4 text-red-500" />
                    <span>4. Histórico Médico Pregresso & Familiar</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                        Histórico Médico Pessoal (Cirurgias, internações, comorbidades)
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Ex: Cirurgia de apendicite em 2020, problemas gástricos, refluxo, anemia..."
                        value={historiaMedica}
                        onChange={(e) => setHistoriaMedica(e.target.value)}
                        className="text-xs sm:text-sm bg-background border-border"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                        <Users className="h-3.5 w-3.5 text-indigo-500" />
                        Histórico Familiar (Doenças relevantes na família)
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Ex: Pais hipertensos, histórico de diabetes ou câncer na família..."
                        value={historiaFamiliar}
                        onChange={(e) => setHistoriaFamiliar(e.target.value)}
                        className="text-xs sm:text-sm bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 5: Higiene Bucal, Hábitos e Vícios */}
                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-3.5 shadow-xs">
                  <div className="border-b border-border pb-2 flex items-center gap-2 text-foreground font-bold text-sm">
                    <Smile className="h-4 w-4 text-emerald-600" />
                    <span>5. Hábitos de Higiene Bucal & Hábitos Gerais</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="font-semibold text-foreground text-xs sm:text-sm">
                        Higiene Bucal (Escovação, uso de fio dental, sangramento na gengiva)
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Ex: Escovo 3x ao dia, uso fio dental diariamente, gengiva sangra ao escovar..."
                        value={habitosViciosPositivos}
                        onChange={(e) => setHabitosViciosPositivos(e.target.value)}
                        className="text-xs sm:text-sm bg-background border-border"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="font-semibold text-foreground text-xs sm:text-sm">
                        Hábitos Nocivos / Vícios (Fumo, bebidas alcoólicas, roer unhas, mastigação unilateral)
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Ex: Fumo eventual, mastigo mais do lado direito, hábito de morder caneta..."
                        value={habitosViciosNegativos}
                        onChange={(e) => setHabitosViciosNegativos(e.target.value)}
                        className="text-xs sm:text-sm bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Seção 6: Observações Gerais */}
                <div className="p-4 rounded-xl border border-border bg-card/50 space-y-2 shadow-xs">
                  <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                    <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                    6. Alguma outra informação importante que você gostaria de nos avisar?
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex: Ansiedade ou medo de anestesia/agulha, sensibilidade dental geral, dificuldade para abrir a boca muito tempo..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="text-xs sm:text-sm bg-background border-border"
                  />
                </div>
              </div>
            </>
          )}

          {/* Declaração de Veracidade */}
          <div className="p-4 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-950 dark:text-blue-200 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Declaração de Veracidade das Informações:</strong>
              <p className="mt-1 text-muted-foreground dark:text-blue-300">
                Declaro, sob as penas da lei, que todas as respostas e dados informados nesta ficha de anamnese são estritamente verdadeiros e completos. Comprometo-me a comunicar imediatamente ao profissional qualquer alteração futura no meu estado de saúde ou uso de novos medicamentos.
              </p>
            </div>
          </div>

          {/* Botão de Assinatura Digital */}
          <div className="pt-2 flex flex-col items-center justify-center gap-2">
            <Button
              size="lg"
              onClick={() => {
                if (modoVisualizacao === 'preencher' && !queixaPrincipal.trim()) {
                  toast.error('Por favor, informe a queixa principal ou motivo da consulta antes de assinar.');
                  return;
                }
                setShowSignature(true);
              }}
              className="w-full sm:w-auto px-8 py-5 text-sm sm:text-base font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2"
            >
              <FileSignature className="h-5 w-5" />
              Assinar Ficha Digitalmente
            </Button>
            <span className="text-[11px] text-muted-foreground text-center">
              Você assinará diretamente na tela do seu dispositivo com validade legal e registro de data/hora.
            </span>
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
};

export default AssinarAnamnese;

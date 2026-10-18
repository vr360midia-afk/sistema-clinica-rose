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

const Shell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-start py-8 px-3 sm:px-6">
    <div className="w-full max-w-3xl space-y-6">{children}</div>
  </div>
);

const AssinarAnamnese = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || searchParams.get('t') || '';
  const modoUrl = searchParams.get('modo') || searchParams.get('m');
  const encodedData = searchParams.get('d') || searchParams.get('data') || searchParams.get('c');
  const idFromQuery = searchParams.get('id');
  const targetId = idFromQuery || id || slug || '';

  const [status, setStatus] = useState<Status>('loading');
  const [anamnese, setAnamnese] = useState<any>(null);
  const [paciente, setPaciente] = useState<any>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modoVisualizacao, setModoVisualizacao] = useState<'preencher' | 'assinar'>(
    modoUrl === 'assinar' ? 'assinar' : 'preencher'
  );

  // Campos preenchíveis/editáveis pelo paciente
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [alergias, setAlergias] = useState('');
  const [medicamentos, setMedicamentos] = useState('');
  const [historiaMedica, setHistoriaMedica] = useState('');
  const [historiaAtual, setHistoriaAtual] = useState('');
  const [habitos, setHabitos] = useState('');
  const [observacoes, setObservacoes] = useState('');

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
          if (r.historiaMedica !== undefined) updatePayload.historia_medica = r.historiaMedica;
          if (r.alergias !== undefined) updatePayload.alergias = r.alergias;
          if (r.medicamentos !== undefined) updatePayload.medicamentos = r.medicamentos;
          if (r.habitos !== undefined) updatePayload.habitos_vicios_positivos = r.habitos;
          if (r.observacoes !== undefined) updatePayload.observacoes = r.observacoes;
        }

        // Tenta atualizar no Supabase direto com apenas as colunas suportadas no schema
        try {
          const supabasePayload: any = {
            status_assinatura: 'paciente_assinado',
          };
          if (updatePayload.queixa_principal !== undefined) supabasePayload.queixa_principal = updatePayload.queixa_principal;
          if (updatePayload.historia_medica !== undefined) supabasePayload.historia_medica = updatePayload.historia_medica;
          if (updatePayload.alergias !== undefined) supabasePayload.alergias = updatePayload.alergias;
          if (updatePayload.medicamentos !== undefined) supabasePayload.medicamentos = updatePayload.medicamentos;

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
              alergias: updatePayload.alergias || localAnams[idx].alergias,
              medicamentos: updatePayload.medicamentos || localAnams[idx].medicamentos,
              historiaMedica: updatePayload.historia_medica || localAnams[idx].historiaMedica,
              historiaAtual: updatePayload.historia_atual || localAnams[idx].historiaAtual,
              observacoes: updatePayload.observacoes || localAnams[idx].observacoes,
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
      setAlergias(anamneseData.alergias || '');
      setMedicamentos(anamneseData.medicamentos || '');
      setHistoriaMedica(anamneseData.historiaMedica || anamneseData.historia_medica || '');
      setHistoriaAtual(anamneseData.historiaAtual || anamneseData.historia_atual || '');
      const hab = [
        anamneseData.habitos,
        anamneseData.habitosViciosPositivos || anamneseData.habitos_vicios_positivos,
        anamneseData.habitosViciosNegativos || anamneseData.habitos_vicios_negativos,
      ].filter(Boolean).join(', ');
      setHabitos(hab);
      setObservacoes(anamneseData.observacoes || '');
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

        if (slug || targetId) {
          const nomePaciente = slug ? unslugifyNome(slug) : 'Paciente';
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
  }, [targetId, token, encodedData, call, slug]);

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
          alergias: alergias.trim(),
          medicamentos: medicamentos.trim(),
          historiaMedica: historiaMedica.trim(),
          historiaAtual: historiaAtual.trim(),
          habitos: habitos.trim(),
          observacoes: observacoes.trim(),
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
            alergias: alergias.trim(),
            medicamentos: medicamentos.trim(),
            historiaMedica: historiaMedica.trim(),
            historiaAtual: historiaAtual.trim(),
            habitos: habitos.trim(),
            observacoes: observacoes.trim(),
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

  // TELA VISUALIZADOR DA FICHA PREENCHIDA / BLOQUEADA (Mobile-Friendly)
  if (status === 'blocked') {
    const dataFormatada = anamnese?.data
      ? new Date(anamnese.data).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');
    const assinaturaData = anamnese?.assinaturaPaciente;

    return (
      <Shell>
        <div className="w-full max-w-2xl mx-auto space-y-4">
          <Card className="border-border shadow-lg overflow-hidden">
            {/* Header da Clínica */}
            <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-5 sm:p-6 text-white text-center">
              <div className="h-14 w-14 rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center mx-auto mb-2 shadow-inner">
                <ShieldCheck className="h-8 w-8 text-white" />
              </div>
              <Badge className="bg-emerald-500/30 text-white border-white/20 text-xs mb-2">
                Documento Clínico Preenchido e Assinado
              </Badge>
              <h1 className="text-xl sm:text-2xl font-bold">Ficha de Anamnese Odontológica</h1>
              <p className="text-xs text-emerald-100 mt-1">
                Dra. Rosangela Santos • Odontologia Especializada
              </p>
            </div>

            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Informações do Paciente */}
              <div className="p-3.5 rounded-xl bg-muted/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                <div>
                  <span className="text-muted-foreground uppercase font-semibold text-[10px]">Paciente</span>
                  <p className="text-base font-bold text-foreground">{paciente?.nome || 'Paciente'}</p>
                  {paciente?.cpf && <p className="text-muted-foreground">CPF: {paciente.cpf}</p>}
                </div>
                <div className="sm:text-right">
                  <span className="text-muted-foreground uppercase font-semibold text-[10px]">Data do Preenchimento</span>
                  <p className="font-semibold text-foreground">{dataFormatada}</p>
                  <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-[11px] mt-0.5">
                    <CheckCircle className="h-3.5 w-3.5" /> Assinado Digitalmente
                  </span>
                </div>
              </div>

              {/* Seções com as Respostas Preenchidas */}
              <div className="space-y-3 pt-1">
                <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1">
                  <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    1. Queixa Principal
                  </span>
                  <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5 font-medium">
                    {queixaPrincipal || anamnese?.queixaPrincipal || 'Avaliação clínica odontológica'}
                  </p>
                </div>

                {(historiaAtual || anamnese?.historiaAtual) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <Clock className="h-4 w-4 text-blue-500" />
                      2. História da Doença / Queixa Atual
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5">
                      {historiaAtual || anamnese?.historiaAtual}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1">
                    <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 text-sm">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Alergias e Restrições
                    </span>
                    <p className="text-foreground text-xs sm:text-sm pl-5 pt-0.5 font-medium">
                      {alergias || anamnese?.alergias || 'Nenhuma alergia informada'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1">
                    <span className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1.5 text-sm">
                      <Pill className="h-4 w-4 text-blue-500" />
                      Medicamentos em Uso
                    </span>
                    <p className="text-foreground text-xs sm:text-sm pl-5 pt-0.5 font-medium">
                      {medicamentos || anamnese?.medicamentos || 'Nenhum medicamento informado'}
                    </p>
                  </div>
                </div>

                {(historiaMedica || anamnese?.historiaMedica) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <HeartPulse className="h-4 w-4 text-red-500" />
                      3. Histórico Médico e Doenças Pregressas
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5">
                      {historiaMedica || anamnese?.historiaMedica}
                    </p>
                  </div>
                )}

                {(habitos || anamnese?.habitosViciosPositivos || anamnese?.habitosViciosNegativos) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <User className="h-4 w-4 text-purple-500" />
                      4. Hábitos e Vícios
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5">
                      {habitos || [anamnese?.habitosViciosPositivos, anamnese?.habitosViciosNegativos].filter(Boolean).join(', ')}
                    </p>
                  </div>
                )}

                {(observacoes || anamnese?.observacoes) && (
                  <div className="p-3.5 rounded-lg border bg-card text-xs space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5 text-sm">
                      <ClipboardList className="h-4 w-4 text-slate-500" />
                      5. Observações Gerais
                    </span>
                    <p className="text-muted-foreground text-xs sm:text-sm pl-5 pt-0.5">
                      {observacoes || anamnese?.observacoes}
                    </p>
                  </div>
                )}
              </div>

              {/* Bloco de Assinatura Digital e Validação */}
              <div className="mt-4 p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                  <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5 uppercase tracking-wide">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Assinatura Eletrônica Registrada
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Autêntico</Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Assinado por:</span>
                    <span className="font-semibold text-foreground">
                      {assinaturaData?.signerName || paciente?.nome || 'Paciente'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Data e Hora da Assinatura:</span>
                    <span className="font-semibold text-foreground">
                      {assinaturaData?.timestamp ? new Date(assinaturaData.timestamp).toLocaleString('pt-BR') : dataFormatada}
                    </span>
                  </div>
                </div>

                {assinaturaData?.signature && (
                  <div className="pt-2">
                    <span className="text-[11px] text-muted-foreground block mb-1">Traço Digital Coletado:</span>
                    <div className="p-2 border rounded-md bg-white max-w-xs shadow-xs">
                      <img
                        src={assinaturaData.signature}
                        alt="Traço da Assinatura"
                        className="h-16 w-auto object-contain mx-auto"
                      />
                    </div>
                  </div>
                )}

                <div className="p-2.5 rounded bg-background/80 border text-[11px] text-muted-foreground flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span>
                    Ficha finalizada e bloqueada para novas alterações em conformidade com a LGPD e normas de prontuário eletrônico odontológico.
                  </span>
                </div>
              </div>

              {/* Botões de Ação na Tela */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-3">
                <Button
                  type="button"
                  onClick={() => window.print()}
                  variant="outline"
                  className="w-full sm:w-auto text-xs h-9 gap-1.5"
                >
                  <ClipboardList className="h-4 w-4" />
                  Imprimir / Salvar PDF
                </Button>

                <Button
                  type="button"
                  onClick={() => {
                    const msg = `Olá, Dra. Rosangela! Estou com o comprovante da minha anamnese assinada em mãos. Obrigado!`;
                    openWhatsApp('', msg);
                  }}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 gap-1.5"
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

                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    2. Alergias Conhecidas (Medicamentos / Anestésicos / Materiais)
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {alergias || anamnese?.alergias || 'Nenhuma alergia relatada'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    3. Medicamentos em Uso Contínuo
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {medicamentos || anamnese?.medicamentos || 'Nenhum medicamento informado'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    4. Histórico Médico Geral
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {historiaMedica || anamnese?.historiaMedica || 'Sem comorbidades ou histórico médico adverso registrado'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    5. Hábitos e Vícios
                  </span>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {habitos || 'Nenhum hábito prejudicial informado'}
                  </p>
                </div>

                {observacoes && (
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      6. Observações Adicionais
                    </span>
                    <p className="text-sm font-medium text-foreground mt-0.5">
                      {observacoes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Modo 1: Preencher e Assinar (Formulário Completo) */
            <>
              <div className="flex items-center justify-between">
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

              {/* Questionário Clínico */}
              <div className="space-y-4 text-xs sm:text-sm">
                {/* Queixa Principal */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                    <HeartPulse className="h-4 w-4 text-blue-600" />
                    1. Qual é a sua Queixa Principal ou motivo da consulta?
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex: Avaliação de rotina, dor no dente, limpeza, tratamento estético..."
                    value={queixaPrincipal}
                    onChange={(e) => setQueixaPrincipal(e.target.value)}
                    className="text-xs sm:text-sm bg-background border-border"
                  />
                </div>

                {/* Alergias */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    2. Possui alguma Alergia a medicamentos, anestésicos locais ou materiais?
                  </Label>
                  <Input
                    placeholder="Ex: Não possui alergias conhecidas OU Dipirona, Penicilina, Látex..."
                    value={alergias}
                    onChange={(e) => setAlergias(e.target.value)}
                    className="text-xs sm:text-sm bg-background border-border"
                  />
                </div>

                {/* Medicamentos em Uso */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                    <Pill className="h-4 w-4 text-emerald-600" />
                    3. Faz uso contínuo de algum Medicamento no momento?
                  </Label>
                  <Input
                    placeholder="Ex: Nenhum OU Losartana, anticoncepcional, anticoagulante, insulina..."
                    value={medicamentos}
                    onChange={(e) => setMedicamentos(e.target.value)}
                    className="text-xs sm:text-sm bg-background border-border"
                  />
                </div>

                {/* Histórico Médico Geral */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground flex items-center gap-1.5 text-xs sm:text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    4. Histórico Médico (Pressão alta, diabetes, problemas cardíacos, gestação, etc.)
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="Ex: Pressão controlada, sem outras comorbidades..."
                    value={historiaMedica}
                    onChange={(e) => setHistoriaMedica(e.target.value)}
                    className="text-xs sm:text-sm bg-background border-border"
                  />
                </div>

                {/* Hábitos e Vícios */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground text-xs sm:text-sm">
                    5. Hábitos e Vícios (Fumo, bruxismo/apertamento de dentes, etc.):
                  </Label>
                  <Input
                    placeholder="Ex: Não fuma, aperta os dentes durante o sono..."
                    value={habitos}
                    onChange={(e) => setHabitos(e.target.value)}
                    className="text-xs sm:text-sm bg-background border-border"
                  />
                </div>

                {/* Observações Gerais */}
                <div className="space-y-1.5">
                  <Label className="font-semibold text-foreground text-xs sm:text-sm">
                    6. Alguma outra informação ou observação que o dentista deva saber?
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="Alguma cirurgia recente, medo de dentista, histórico de sangramentos..."
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
              onClick={() => setShowSignature(true)}
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

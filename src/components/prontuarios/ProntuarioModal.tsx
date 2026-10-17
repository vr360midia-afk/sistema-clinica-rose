import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Calendar, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDentalSystem } from '@/context/DentalSystemContext';
import PatientSelector from '@/components/anamnese/PatientSelector';
import ProcedimentoSelector from './ProcedimentoSelector';
import { DictationTextarea } from '@/components/common/DictationTextarea';
import { useProcedimentos } from '@/hooks/useProcedimentos';
import { formatMoney } from '@/utils/exportCsv';
import type { AvaliacaoRestauracoesPreexistentes } from '@/types/shared';

interface ProntuarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  preSelectedPatient?: string;
  prontuario?: any;
}

const calcularDataSemestral = (dataBase: string) => {
  try {
    const d = new Date(`${dataBase}T12:00:00`);
    if (isNaN(d.getTime())) return '';
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split('T')[0];
  } catch (_) {
    return '';
  }
};

const ProntuarioModal = ({ isOpen, onClose, onSave, preSelectedPatient, prontuario }: ProntuarioModalProps) => {
  const { addProntuario, updateProntuario } = useDentalSystem();
  const { procedimentos } = useProcedimentos();
  const [selectedPatient, setSelectedPatient] = useState(preSelectedPatient || '');
  const [dataEvento, setDataEvento] = useState(new Date().toISOString().split('T')[0]);
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [historiaDoenca, setHistoriaDoenca] = useState('');
  const [exameClinico, setExameClinico] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [planoTratamento, setPlanoTratamento] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [selectedProcedimentos, setSelectedProcedimentos] = useState<string[]>([]);
  const [precosLivres, setPrecosLivres] = useState<Record<string, number>>({});

  // Novos campos: Restaurações Preexistentes, Condições Ocultas e Manutenção Semestral
  const [possuiPreexistentes, setPossuiPreexistentes] = useState(false);
  const [tipoRestauracao, setTipoRestauracao] = useState('');
  const [dentesEnvolvidos, setDentesEnvolvidos] = useState('');
  const [remocaoPrevista, setRemocaoPrevista] = useState(false);
  const [condicoesAposRemocao, setCondicoesAposRemocao] = useState('');
  const [necessidadeTratamentoAdicional, setNecessidadeTratamentoAdicional] = useState(false);
  const [orcamentoComplementar, setOrcamentoComplementar] = useState<string | number>('');
  const [aprovacaoPaciente, setAprovacaoPaciente] = useState<string>('Pendente de aprovação');
  const [dataProximaManutencaoSemestral, setDataProximaManutencaoSemestral] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (prontuario) {
        setSelectedPatient(prontuario.pacienteId);
        const dataStr = prontuario.data instanceof Date 
          ? prontuario.data.toISOString().split('T')[0]
          : typeof prontuario.data === 'string'
            ? prontuario.data.split('T')[0]
            : new Date().toISOString().split('T')[0];
        setDataEvento(dataStr);
        setQueixaPrincipal(prontuario.queixaPrincipal || '');
        setHistoriaDoenca(prontuario.historiaDoenca || '');
        setExameClinico(prontuario.exameClinico || '');
        setDiagnostico(prontuario.diagnostico || '');
        setPlanoTratamento(prontuario.planoTratamento || '');
        setObservacoes(prontuario.observacoes || '');
        setSelectedProcedimentos(prontuario.procedimentosRealizados || []);

        const rp = prontuario.restauracoesPreexistentes;
        if (rp) {
          setPossuiPreexistentes(Boolean(rp.possuiPreexistentes));
          setTipoRestauracao(rp.tipoRestauracao || '');
          setDentesEnvolvidos(rp.dentesEnvolvidos || '');
          setRemocaoPrevista(Boolean(rp.remocaoPrevista));
          setCondicoesAposRemocao(rp.condicoesAposRemocao || '');
          setNecessidadeTratamentoAdicional(Boolean(rp.necessidadeTratamentoAdicional));
          setOrcamentoComplementar(rp.orcamentoComplementar ?? '');
          setAprovacaoPaciente(rp.aprovacaoPaciente || 'Pendente de aprovação');
          setDataProximaManutencaoSemestral(rp.dataProximaManutencaoSemestral || calcularDataSemestral(dataStr));
        } else {
          setPossuiPreexistentes(false);
          setTipoRestauracao('');
          setDentesEnvolvidos('');
          setRemocaoPrevista(false);
          setCondicoesAposRemocao('');
          setNecessidadeTratamentoAdicional(false);
          setOrcamentoComplementar('');
          setAprovacaoPaciente('Pendente de aprovação');
          setDataProximaManutencaoSemestral(calcularDataSemestral(dataStr));
        }
      } else {
        const hojeStr = new Date().toISOString().split('T')[0];
        setSelectedPatient(preSelectedPatient || '');
        setDataEvento(hojeStr);
        setQueixaPrincipal('');
        setHistoriaDoenca('');
        setExameClinico('');
        setDiagnostico('');
        setPlanoTratamento('');
        setObservacoes('');
        setSelectedProcedimentos([]);
        setPrecosLivres({});

        setPossuiPreexistentes(false);
        setTipoRestauracao('');
        setDentesEnvolvidos('');
        setRemocaoPrevista(false);
        setCondicoesAposRemocao('');
        setNecessidadeTratamentoAdicional(false);
        setOrcamentoComplementar('');
        setAprovacaoPaciente('Pendente de aprovação');
        setDataProximaManutencaoSemestral(calcularDataSemestral(hojeStr));
      }
    }
  }, [isOpen, prontuario, preSelectedPatient]);

  const calcularValorTotal = () => {
    return selectedProcedimentos.reduce((total, nome) => {
      const procedimento = procedimentos.find(
        (p) => p.nome.toLowerCase() === nome.toLowerCase()
      );
      return total + (procedimento?.preco ?? precosLivres[nome] ?? 0);
    }, 0);
  };

  const handleSave = async () => {
    if (!selectedPatient) {
      toast.error('Selecione um paciente');
      return;
    }

    try {
      const valorTotal = calcularValorTotal();
      const procedimentosRealizados = [...selectedProcedimentos];

      const restauracoesPreexistentes: AvaliacaoRestauracoesPreexistentes = {
        possuiPreexistentes,
        tipoRestauracao: possuiPreexistentes ? tipoRestauracao.trim() : undefined,
        dentesEnvolvidos: possuiPreexistentes ? dentesEnvolvidos.trim() : undefined,
        remocaoPrevista: possuiPreexistentes ? remocaoPrevista : false,
        condicoesAposRemocao: possuiPreexistentes ? condicoesAposRemocao.trim() : undefined,
        necessidadeTratamentoAdicional: possuiPreexistentes ? necessidadeTratamentoAdicional : false,
        orcamentoComplementar: possuiPreexistentes && orcamentoComplementar ? orcamentoComplementar : undefined,
        aprovacaoPaciente: possuiPreexistentes ? aprovacaoPaciente : undefined,
        dataProximaManutencaoSemestral: possuiPreexistentes && dataProximaManutencaoSemestral ? dataProximaManutencaoSemestral : (dataProximaManutencaoSemestral || undefined),
      };

      // Registro estruturado da evolução clínica e autorização para o plano de tratamento
      let planoTratamentoFinal = planoTratamento.trim();
      if (possuiPreexistentes) {
        const registroEvolucao = [
          `[AVALIAÇÃO DE RESTAURAÇÕES PREEXISTENTES E EVOLUÇÃO CLÍNICA]`,
          `• Restaurações preexistentes identificadas: Sim (${tipoRestauracao.trim() || 'Lentes/Facetas em Resina'})`,
          `• Dentes envolvidos: ${dentesEnvolvidos.trim() || 'Ver exame clínico'}`,
          `• Remoção clínica prevista: ${remocaoPrevista ? 'Sim' : 'Não'}`,
          condicoesAposRemocao.trim() ? `• Condições identificadas pós-remoção: ${condicoesAposRemocao.trim()}` : null,
          `• Necessidade de tratamento adicional: ${necessidadeTratamentoAdicional ? 'Sim' : 'Não'}`,
          orcamentoComplementar ? `• Orçamento complementar: R$ ${orcamentoComplementar} | Status de aprovação: ${aprovacaoPaciente}` : null,
          dataProximaManutencaoSemestral ? `• Data prevista para a próxima manutenção semestral preventiva: ${new Date(`${dataProximaManutencaoSemestral}T12:00:00`).toLocaleDateString('pt-BR')}` : null,
        ].filter(Boolean).join('\n');

        if (!planoTratamentoFinal.includes('[AVALIAÇÃO DE RESTAURAÇÕES PREEXISTENTES')) {
          planoTratamentoFinal = planoTratamentoFinal ? `${planoTratamentoFinal}\n\n${registroEvolucao}` : registroEvolucao;
        }
      }

      const prontuarioData = {
        pacienteId: selectedPatient,
        data: new Date(`${dataEvento}T12:00:00`),
        queixaPrincipal: queixaPrincipal.trim(),
        historiaDoenca: historiaDoenca.trim(),
        exameClinico: exameClinico.trim(),
        diagnostico: diagnostico.trim(),
        planoTratamento: planoTratamentoFinal,
        procedimentosRealizados,
        observacoes: observacoes.trim(),
        restauracoesPreexistentes,
      };

      if (prontuario?.id) {
        if (updateProntuario) {
          await updateProntuario(prontuario.id, prontuarioData);
        } else {
          console.error('updateProntuario não está definido no DentalSystemContext');
        }
      } else {
        await addProntuario(prontuarioData);
      }
      
      onSave({ ...prontuarioData, valorTotal });
      onClose();
    } catch (error) {
      console.error('Erro ao salvar prontuário:', error);
      toast.error('Erro ao salvar prontuário');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prontuario ? 'Editar Prontuário' : 'Novo Prontuário'}</DialogTitle>
        </DialogHeader>

        <Tabs key={preSelectedPatient ? 'proc' : 'dados'} defaultValue={preSelectedPatient ? 'procedimentos' : 'dados'} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="dados">Dados Clínicos</TabsTrigger>
            <TabsTrigger value="restauracoes" className="gap-1.5 flex items-center text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="truncate">Lentes & Restaurações</span>
              {possuiPreexistentes && (
                <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">
                  Ativo
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="procedimentos">Procedimentos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dados" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {!preSelectedPatient && !prontuario && (
                <div>
                  <Label>Paciente</Label>
                  <PatientSelector value={selectedPatient} onChange={setSelectedPatient} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="dataEvento">Data do Prontuário (Útil para Histórico Passado)</Label>
                <Input 
                  id="dataEvento" 
                  type="date" 
                  value={dataEvento}
                  onChange={(e) => {
                    setDataEvento(e.target.value);
                    if (!dataProximaManutencaoSemestral || dataProximaManutencaoSemestral === calcularDataSemestral(dataEvento)) {
                      setDataProximaManutencaoSemestral(calcularDataSemestral(e.target.value));
                    }
                  }}
                />
              </div>
            </div>

            {/* Banner de atalho para Restaurações Preexistentes */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <span>
                  {possuiPreexistentes ? (
                    <strong className="text-amber-700 dark:text-amber-400">
                      Restaurações Preexistentes declaradas: {tipoRestauracao || 'Sim'} ({dentesEnvolvidos || 'Dentes a definir'})
                    </strong>
                  ) : (
                    <span className="text-muted-foreground">
                      Paciente possui lentes, facetas, coroas ou restaurações preexistentes? Registre na aba <strong>Lentes & Restaurações</strong>.
                    </span>
                  )}
                </span>
              </div>
              {possuiPreexistentes && (
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                  Manutenção Semestral: {dataProximaManutencaoSemestral ? new Date(`${dataProximaManutencaoSemestral}T12:00:00`).toLocaleDateString('pt-BR') : 'A definir'}
                </Badge>
              )}
            </div>

            <DictationTextarea
              id="queixa"
              label="Queixa Principal"
              placeholder="Descreva a queixa principal do paciente..."
              value={queixaPrincipal}
              onChange={setQueixaPrincipal}
            />

            <DictationTextarea
              id="historia"
              label="História da Doença"
              placeholder="Descreva a história da doença atual..."
              value={historiaDoenca}
              onChange={setHistoriaDoenca}
            />

            <DictationTextarea
              id="exame"
              label="Exame Clínico"
              placeholder="Descreva os achados do exame clínico..."
              value={exameClinico}
              onChange={setExameClinico}
            />

            <DictationTextarea
              id="diagnostico"
              label="Diagnóstico"
              placeholder="Diagnóstico clínico..."
              value={diagnostico}
              onChange={setDiagnostico}
            />

            <DictationTextarea
              id="plano"
              label="Plano de Tratamento"
              placeholder="Descreva o plano de tratamento..."
              value={planoTratamento}
              onChange={setPlanoTratamento}
            />

            <DictationTextarea
              id="observacoes"
              label="Observações"
              placeholder="Observações adicionais..."
              value={observacoes}
              onChange={setObservacoes}
            />
          </TabsContent>

          {/* ABA 2: LENTES, RESTAURAÇÕES PREEXISTENTES E MANUTENÇÃO SEMESTRAL */}
          <TabsContent value="restauracoes" className="space-y-4">
            <div className="p-4 bg-card rounded-lg border border-border shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Avaliação Clínica de Restaurações Preexistentes e Lentes
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Registro de salvaguarda clínica e respaldo para as cláusulas de manutenção preventiva semestral e condições ocultas pós-remoção.
                  </p>
                </div>
                <Badge variant={possuiPreexistentes ? 'default' : 'outline'} className="text-[11px] shrink-0">
                  {possuiPreexistentes ? 'Declarado: Sim' : 'Não possui'}
                </Badge>
              </div>

              {/* 1. Paciente possui lentes, facetas, coroas ou restaurações preexistentes? */}
              <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md border border-border">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor="possuiPreexistentesSwitch" className="text-xs font-semibold cursor-pointer">
                    Paciente possui lentes, facetas, coroas ou restaurações preexistentes?
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Ative caso existam materiais restauradores prévios na arcada do(a) paciente que possam limitar o exame radiográfico ou clínico subjacente.
                  </p>
                </div>
                <Switch
                  id="possuiPreexistentesSwitch"
                  checked={possuiPreexistentes}
                  onCheckedChange={(checked) => {
                    setPossuiPreexistentes(checked);
                    if (checked && !dataProximaManutencaoSemestral) {
                      setDataProximaManutencaoSemestral(calcularDataSemestral(dataEvento));
                    }
                  }}
                />
              </div>

              {possuiPreexistentes && (
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 2. Tipo de restauração preexistente */}
                    <div className="space-y-1.5">
                      <Label htmlFor="tipoRestauracao" className="text-xs font-medium">
                        Tipo de restauração preexistente:
                      </Label>
                      <Input
                        id="tipoRestauracao"
                        value={tipoRestauracao}
                        onChange={(e) => setTipoRestauracao(e.target.value)}
                        placeholder="Ex: Lentes em resina composta, facetas, coroas..."
                        className="h-9 text-xs"
                        list="tipos-restauracao-list"
                      />
                      <datalist id="tipos-restauracao-list">
                        <option value="Lentes em resina composta" />
                        <option value="Facetas em resina composta" />
                        <option value="Lentes em cerâmica / porcelana" />
                        <option value="Facetas cerâmicas" />
                        <option value="Coroas protéticas / prótese fixa" />
                        <option value="Restaurações extensas em resina composta" />
                      </datalist>
                    </div>

                    {/* 3. Dentes envolvidos */}
                    <div className="space-y-1.5">
                      <Label htmlFor="dentesEnvolvidos" className="text-xs font-medium">
                        Dentes envolvidos:
                      </Label>
                      <Input
                        id="dentesEnvolvidos"
                        value={dentesEnvolvidos}
                        onChange={(e) => setDentesEnvolvidos(e.target.value)}
                        placeholder="Ex: 11, 12, 13, 21, 22, 23"
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 4. Remoção prevista? */}
                    <div className="space-y-1.5">
                      <Label htmlFor="remocaoPrevista" className="text-xs font-medium">
                        Remoção prevista?
                      </Label>
                      <Select
                        value={remocaoPrevista ? 'sim' : 'nao'}
                        onValueChange={(v) => setRemocaoPrevista(v === 'sim')}
                      >
                        <SelectTrigger id="remocaoPrevista" className="h-9 text-xs">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sim">Sim (Remoção indicada/planejada)</SelectItem>
                          <SelectItem value="nao">Não (Manutenção ou reparo superficial)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 6. Necessidade de tratamento adicional? */}
                    <div className="space-y-1.5">
                      <Label htmlFor="necessidadeTratamentoAdicional" className="text-xs font-medium">
                        Necessidade de tratamento adicional?
                      </Label>
                      <Select
                        value={necessidadeTratamentoAdicional ? 'sim' : 'nao'}
                        onValueChange={(v) => setNecessidadeTratamentoAdicional(v === 'sim')}
                      >
                        <SelectTrigger id="necessidadeTratamentoAdicional" className="h-9 text-xs">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao">Não (Apenas o planejamento original)</SelectItem>
                          <SelectItem value="sim">Sim (Procedimentos adicionais identificados)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 5. Condições identificadas após a remoção */}
                  <div className="space-y-1.5">
                    <Label htmlFor="condicoesAposRemocao" className="text-xs font-medium">
                      Condições identificadas após a remoção:
                    </Label>
                    <DictationTextarea
                      id="condicoesAposRemocao"
                      placeholder="Descreva se foram encontradas lesões de cárie, infiltrações, fraturas, trincas ou alterações na estrutura dentária..."
                      value={condicoesAposRemocao}
                      onChange={setCondicoesAposRemocao}
                      className="min-h-[70px] text-xs"
                    />
                  </div>

                  {/* 7 e 8: Orçamento Complementar e Aprovação da Paciente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-muted/30 rounded-md border border-border">
                    <div className="space-y-1.5">
                      <Label htmlFor="orcamentoComplementar" className="text-xs font-medium">
                        Orçamento complementar (R$):
                      </Label>
                      <Input
                        id="orcamentoComplementar"
                        value={orcamentoComplementar}
                        onChange={(e) => setOrcamentoComplementar(e.target.value)}
                        placeholder="Ex: 450,00"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="aprovacaoPaciente" className="text-xs font-medium">
                        Aprovação da paciente:
                      </Label>
                      <Select
                        value={aprovacaoPaciente}
                        onValueChange={setAprovacaoPaciente}
                      >
                        <SelectTrigger id="aprovacaoPaciente" className="h-9 text-xs">
                          <SelectValue placeholder="Status da aprovação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Aprovado expressamente">✓ Aprovado expressamente</SelectItem>
                          <SelectItem value="Pendente de aprovação">⏳ Pendente de aprovação</SelectItem>
                          <SelectItem value="Não aprovado">✕ Não aprovado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* 9. Data prevista da próxima manutenção semestral */}
                  <div className="p-3 bg-primary/5 rounded-md border border-primary/20 space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <Label htmlFor="dataProximaManutencaoSemestral" className="text-xs font-semibold flex items-center gap-1.5 text-primary">
                          <Calendar className="h-3.5 w-3.5" />
                          Data prevista da próxima manutenção semestral:
                        </Label>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Recomendação clínica a cada 6 meses (integridade, polimento, avaliação marginal e profilaxia).
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1 shrink-0"
                        onClick={() => setDataProximaManutencaoSemestral(calcularDataSemestral(dataEvento))}
                      >
                        Calcular +6 meses
                      </Button>
                    </div>
                    <Input
                      id="dataProximaManutencaoSemestral"
                      type="date"
                      value={dataProximaManutencaoSemestral}
                      onChange={(e) => setDataProximaManutencaoSemestral(e.target.value)}
                      className="h-9 text-xs max-w-xs bg-background"
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="procedimentos" className="space-y-4">
            <div>
              <Label className="text-base font-medium">Procedimentos Realizados</Label>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione os procedimentos que foram realizados nesta consulta:
              </p>
              <ProcedimentoSelector
                selectedProcedimentos={selectedProcedimentos}
                onSelectionChange={setSelectedProcedimentos}
                valorTotal={calcularValorTotal()}
                precosLivres={precosLivres}
                onPrecoLivreChange={(nome, preco) =>
                  setPrecosLivres((prev) => ({ ...prev, [nome]: preco }))
                }
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="sticky bottom-0 z-10 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3 pb-1 border-t bg-background/95 backdrop-blur-md mt-4">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            {selectedProcedimentos.length > 0 && (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Total: {formatMoney(calcularValorTotal())}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={handleSave} className="flex-1 sm:flex-none font-bold bg-primary text-primary-foreground">
              {prontuario ? 'Atualizar Prontuário' : 'Salvar Prontuário'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProntuarioModal;

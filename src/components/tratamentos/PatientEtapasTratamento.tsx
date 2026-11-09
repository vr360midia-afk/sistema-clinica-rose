import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  Award,
  AlertCircle,
  FileCheck,
  Plus,
} from 'lucide-react';
import { useTratamentos } from '@/hooks/useTratamentos';
import { useOrcamentos } from '@/hooks/useOrcamentos';
import { ProcedimentoTratamentoCard } from './ProcedimentoTratamentoCard';
import { StatusProcedimentoTratamento } from '@/types/tratamento';

interface Props {
  patient: any;
}

export const PatientEtapasTratamento: React.FC<Props> = ({ patient }) => {
  const {
    procedimentos,
    isLoading,
    isSyncing,
    recarregar,
    sincronizarOrcamento,
    atualizarStatusProcedimento,
    adicionarSessao,
    reagendarSessao,
    marcarSessaoRealizada,
    gerarLinkConfirmacao,
    concluirProcedimento,
    reabrirProcedimento,
  } = useTratamentos(patient?.id);

  const { orcamentos } = useOrcamentos(patient?.id);

  const [busca, setBusca] = useState<string>('');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [orcamentoFiltro, setOrcamentoFiltro] = useState<string>('todos');

  // Filtra apenas orçamentos aprovados do paciente
  const orcamentosAprovados = useMemo(() => {
    return (orcamentos || []).filter(o => o.status === 'aprovado');
  }, [orcamentos]);

  // Procedimentos filtrados
  const procedimentosFiltrados = useMemo(() => {
    return procedimentos.filter(p => {
      const matchBusca = p.procedimento_nome.toLowerCase().includes(busca.toLowerCase());
      const matchStatus = statusFiltro === 'todos' || p.status === statusFiltro;
      const matchOrcamento = orcamentoFiltro === 'todos' || p.orcamento_id === orcamentoFiltro;
      return matchBusca && matchStatus && matchOrcamento;
    });
  }, [procedimentos, busca, statusFiltro, orcamentoFiltro]);

  // Métricas de acompanhamento
  const totalProcedimentos = procedimentos.length;
  const emTratamento = procedimentos.filter(p => p.status === 'em_tratamento').length;
  const concluidos = procedimentos.filter(p => p.status === 'concluido').length;
  const todasSessoes = procedimentos.flatMap(p => p.sessoes || []);
  const sessoesRealizadas = todasSessoes.filter(
    s => s.status === 'realizada' || s.status === 'confirmada' || s.status === 'aguardando_confirmacao'
  ).length;
  const confirmacoesPendentes = todasSessoes.filter(s => s.status === 'aguardando_confirmacao').length;

  const handleSincronizarTodos = async () => {
    if (orcamentosAprovados.length === 0) {
      alert('Nenhum orçamento com status "aprovado" localizado para este paciente.');
      return;
    }
    for (const orc of orcamentosAprovados) {
      await sincronizarOrcamento(orc.id);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Cards de Métricas do Tratamento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5">
        <Card className="border-border shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">Procedimentos</p>
              <p className="text-base sm:text-xl font-bold text-foreground">{totalProcedimentos}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center justify-center shrink-0">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">Em Andamento</p>
              <p className="text-base sm:text-xl font-bold text-emerald-600">{emTratamento}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center shrink-0">
              <Award className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">Concluídos</p>
              <p className="text-base sm:text-xl font-bold text-purple-600">{concluidos}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-2xs">
          <CardContent className="p-3 sm:p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center justify-center shrink-0">
              <FileCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">Aguardando Assinatura</p>
              <p className="text-base sm:text-xl font-bold text-amber-600">{confirmacoesPendentes}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Ações e Filtros */}
      <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar procedimento clínico..."
              className="pl-8 text-xs h-9"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filtro de Orçamento */}
            {orcamentosAprovados.length > 1 && (
              <Select value={orcamentoFiltro} onValueChange={setOrcamentoFiltro}>
                <SelectTrigger className="h-9 text-xs w-[180px]">
                  <SelectValue placeholder="Orçamento de Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Orçamentos</SelectItem>
                  {orcamentosAprovados.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      Orçamento #{o.id.substring(0, 8)} (R$ {Number(o.total).toLocaleString('pt-BR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Filtro de Status */}
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="h-9 text-xs w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Status</SelectItem>
                <SelectItem value="nao_iniciado">Não Iniciado</SelectItem>
                <SelectItem value="em_tratamento">Em Tratamento</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="concluido">Concluído</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            {/* Botão Sincronizar Procedimentos */}
            <Button
              variant="outline"
              size="sm"
              disabled={isSyncing || orcamentosAprovados.length === 0}
              onClick={handleSincronizarTodos}
              className="h-9 text-xs gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 font-medium"
              title="Importar automaticamente procedimentos de orçamentos aprovados descartando taxas de maquininha"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Orçamentos'}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Procedimentos */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-muted-foreground/60" />
          <p>Carregando etapas do tratamento...</p>
        </div>
      ) : procedimentosFiltrados.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-3">
            <Activity className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm">
                {procedimentos.length === 0
                  ? 'Nenhum procedimento clínico cadastrado para este paciente'
                  : 'Nenhum procedimento encontrado para os filtros selecionados'}
              </p>
              <p className="max-w-md mx-auto text-muted-foreground">
                {procedimentos.length === 0 && orcamentosAprovados.length > 0
                  ? 'Clique no botão "Sincronizar Orçamentos" acima para importar automaticamente os procedimentos clínicos do orçamento aprovado.'
                  : procedimentos.length === 0
                  ? 'Este paciente não possui orçamentos com status "aprovado". Aprove um orçamento para gerar o plano de etapas do tratamento.'
                  : 'Tente alterar os termos da busca ou selecionar outro status.'}
              </p>
            </div>
            {procedimentos.length === 0 && orcamentosAprovados.length > 0 && (
              <Button
                onClick={handleSincronizarTodos}
                disabled={isSyncing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Sincronizar Agora
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3.5">
          {procedimentosFiltrados.map(proc => (
            <ProcedimentoTratamentoCard
              key={proc.id}
              procedimento={proc}
              pacienteTelefone={patient?.telefone}
              onAdicionarSessao={adicionarSessao}
              onMarcarRealizada={marcarSessaoRealizada}
              onReagendarSessao={reagendarSessao}
              onGerarLinkConfirmacao={gerarLinkConfirmacao}
              onConcluirProcedimento={concluirProcedimento}
              onReabrirProcedimento={reabrirProcedimento}
              onAtualizarStatusProcedimento={atualizarStatusProcedimento}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PatientEtapasTratamento;

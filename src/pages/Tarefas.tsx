import React, { useState, useMemo } from 'react';
import Layout from '@/components/layout/Layout';
import {
  useTarefasInternas,
  TarefaInterna,
  TipoTarefa,
  TIPO_TAREFA_INFO,
} from '@/hooks/useTarefasInternas';
import { CalendarioTarefasView } from '@/components/tarefas/CalendarioTarefasView';
import { ListaTarefasView } from '@/components/tarefas/ListaTarefasView';
import { KanbanTarefasView } from '@/components/tarefas/KanbanTarefasView';
import { ModalNovaTarefa } from '@/components/tarefas/ModalNovaTarefa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Search,
  CalendarCheck2,
  Calendar as CalendarIcon,
  ListTodo,
  Columns3,
  PhoneCall,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Tarefas() {
  const {
    tarefas,
    loading,
    metricas,
    adicionarTarefa,
    atualizarTarefa,
    alternarConcluida,
    removerTarefa,
    recarregar,
  } = useTarefasInternas();

  const hojeStr = new Date().toISOString().split('T')[0];

  // Visualização ativa: 'calendario' | 'lista' | 'kanban'
  const [visao, setVisao] = useState<'calendario' | 'lista' | 'kanban'>('calendario');

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'hoje' | 'atrasadas' | 'concluidas'>('todos');
  const [dataSelecionada, setDataSelecionada] = useState<string>(hojeStr);

  // Modal de Criação / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tarefaEmEdicao, setTarefaEmEdicao] = useState<TarefaInterna | null>(null);
  const [dataParaNovaTarefa, setDataParaNovaTarefa] = useState<string | undefined>(undefined);

  const handleOpenNovaTarefa = (dataDefault?: string) => {
    setTarefaEmEdicao(null);
    setDataParaNovaTarefa(dataDefault || dataSelecionada || hojeStr);
    setIsModalOpen(true);
  };

  const handleEditTarefa = (tarefa: TarefaInterna) => {
    setTarefaEmEdicao(tarefa);
    setIsModalOpen(true);
  };

  const handleSaveModal = async (dados: Omit<TarefaInterna, 'id' | 'criadoEm' | 'updatedAt'>) => {
    if (tarefaEmEdicao) {
      return await atualizarTarefa(tarefaEmEdicao.id, dados);
    } else {
      return await adicionarTarefa(dados);
    }
  };

  // Filtragem das tarefas
  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter((t) => {
      // Busca por texto
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchTitulo = t.titulo.toLowerCase().includes(termo);
        const matchDesc = t.descricao?.toLowerCase().includes(termo);
        const matchLead = t.leadNome?.toLowerCase().includes(termo);
        const matchPac = t.pacienteNome?.toLowerCase().includes(termo);
        const matchResp = t.responsavel?.toLowerCase().includes(termo);
        if (!matchTitulo && !matchDesc && !matchLead && !matchPac && !matchResp) {
          return false;
        }
      }

      // Filtro de Categoria/Tipo
      if (filtroTipo !== 'todos' && t.tipo !== filtroTipo) {
        return false;
      }

      // Filtro de Status
      if (filtroStatus === 'pendentes' && t.status === 'concluida') return false;
      if (filtroStatus === 'concluidas' && t.status !== 'concluida') return false;
      if (filtroStatus === 'hoje' && (t.data !== hojeStr || t.status === 'concluida')) return false;
      if (filtroStatus === 'atrasadas' && (t.data >= hojeStr || t.status === 'concluida')) return false;

      return true;
    });
  }, [tarefas, busca, filtroTipo, filtroStatus, hojeStr]);

  return (
    <Layout>
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                <CalendarCheck2 className="h-6 w-6" />
              </div>
              Calendário de Tarefas da Equipe
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Organize follow-up de leads, orçamentos, confirmações de consultas e tarefas internas da recepção.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => recarregar()}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              title="Atualizar tarefas"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>

            <Button
              size="sm"
              onClick={() => handleOpenNovaTarefa()}
              className="h-9 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </Button>
          </div>
        </div>

        {/* Cards de Métricas e KPIs no Topo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div
            onClick={() => setFiltroStatus((prev) => (prev === 'hoje' ? 'todos' : 'hoje'))}
            className={`p-3 rounded-xl border bg-card shadow-xs transition-all cursor-pointer hover:border-primary/50 ${
              filtroStatus === 'hoje' ? 'ring-2 ring-primary border-transparent' : ''
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Para Hoje</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-black text-foreground mt-1">
              {metricas.hoje}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metricas.hoje === 1 ? '1 tarefa agendada' : `${metricas.hoje} tarefas agendadas`}
            </div>
          </div>

          <div
            onClick={() => setFiltroStatus((prev) => (prev === 'atrasadas' ? 'todos' : 'atrasadas'))}
            className={`p-3 rounded-xl border bg-card shadow-xs transition-all cursor-pointer hover:border-rose-500/50 ${
              filtroStatus === 'atrasadas' ? 'ring-2 ring-rose-500 border-transparent' : ''
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Atrasadas</span>
              <AlertCircle className="h-4 w-4 text-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
              {metricas.atrasadas}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metricas.atrasadas === 0 ? 'Tudo em dia!' : 'Necessitam de atenção'}
            </div>
          </div>

          <div
            onClick={() => setFiltroTipo((prev) => (prev === 'chamar_lead' ? 'todos' : 'chamar_lead'))}
            className={`p-3 rounded-xl border bg-card shadow-xs transition-all cursor-pointer hover:border-emerald-500/50 ${
              filtroTipo === 'chamar_lead' ? 'ring-2 ring-emerald-500 border-transparent' : ''
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Chamar Leads</span>
              <PhoneCall className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metricas.leads}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              WhatsApp / Prospecção
            </div>
          </div>

          <div
            onClick={() => setFiltroStatus((prev) => (prev === 'concluidas' ? 'todos' : 'concluidas'))}
            className={`p-3 rounded-xl border bg-card shadow-xs transition-all cursor-pointer hover:border-primary/50 ${
              filtroStatus === 'concluidas' ? 'ring-2 ring-primary border-transparent' : ''
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Concluídas</span>
              <CheckCircle2 className="h-4 w-4 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-foreground mt-1">
              {metricas.concluidas}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {metricas.total === 0 ? '0%' : `${Math.round((metricas.concluidas / metricas.total) * 100)}% concluído`}
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Alternância de Visualização */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card p-3 rounded-xl border shadow-xs">
          {/* Alternador de Visão (Tabs) */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setVisao('calendario')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                visao === 'calendario'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              Calendário Mensal
            </button>

            <button
              type="button"
              onClick={() => setVisao('lista')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                visao === 'lista'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ListTodo className="h-3.5 w-3.5" />
              Lista & Hoje
            </button>

            <button
              type="button"
              onClick={() => setVisao('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                visao === 'kanban'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Columns3 className="h-3.5 w-3.5" />
              Kanban
            </button>
          </div>

          {/* Campo de Busca */}
          <div className="relative w-full md:w-64">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Buscar tarefa, lead ou paciente..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Pílulas de Filtro por Categoria */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setFiltroTipo('todos')}
            className={cn(
              'px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap transition-colors',
              filtroTipo === 'todos'
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            Todas as Categorias
          </button>

          {Object.entries(TIPO_TAREFA_INFO).map(([key, info]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltroTipo((prev) => (prev === key ? 'todos' : key))}
              className={cn(
                'px-2.5 py-1 rounded-full border text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1',
                filtroTipo === key
                  ? 'ring-2 ring-primary ' + info.badgeClass
                  : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              <span>{info.icon}</span>
              <span>{info.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Visualização Principal Renderizada */}
        {visao === 'calendario' && (
          <CalendarioTarefasView
            tarefas={tarefasFiltradas}
            onOpenNovaTarefa={handleOpenNovaTarefa}
            onEditTarefa={handleEditTarefa}
            onToggleConcluida={alternarConcluida}
            dataSelecionada={dataSelecionada}
            onSelectData={setDataSelecionada}
          />
        )}

        {visao === 'lista' && (
          <ListaTarefasView
            tarefas={tarefasFiltradas}
            onOpenNovaTarefa={() => handleOpenNovaTarefa()}
            onEditTarefa={handleEditTarefa}
            onToggleConcluida={alternarConcluida}
            onRemoverTarefa={removerTarefa}
          />
        )}

        {visao === 'kanban' && (
          <KanbanTarefasView
            tarefas={tarefasFiltradas}
            onOpenNovaTarefa={() => handleOpenNovaTarefa()}
            onEditTarefa={handleEditTarefa}
            onUpdateStatus={(id, novoStatus) => atualizarTarefa(id, { status: novoStatus })}
          />
        )}

        {/* Modal de Nova Tarefa / Editar */}
        <ModalNovaTarefa
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveModal}
          tarefaToEdit={tarefaEmEdicao}
          initialDate={dataParaNovaTarefa}
        />
      </div>
    </Layout>
  );
}

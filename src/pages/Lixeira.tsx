import React, { useMemo, useState } from 'react';
import Layout from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw, Search, Trash } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { useLixeira, ENTIDADE_LABELS, diasRestantes, ItemLixeira } from '@/hooks/useLixeira';
import { useSecurityGate } from '@/context/SecurityContext';
import { useDentalSystem } from '@/context/DentalSystemContext';

const Lixeira = () => {
  const { itens, loading, restaurar, excluirDefinitivo, esvaziar } = useLixeira();
  const { requireMasterPassword } = useSecurityGate();
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const termo = busca.toLowerCase();
    return itens.filter(
      (i) =>
        (i.titulo || '').toLowerCase().includes(termo) ||
        (ENTIDADE_LABELS[i.entidade] || i.entidade).toLowerCase().includes(termo)
    );
  }, [itens, busca]);

  const handleExcluir = async (item: ItemLixeira) => {
    const ok = await requireMasterPassword('Esta exclusão é definitiva e não poderá ser desfeita.');
    if (ok) await excluirDefinitivo(item);
  };

  const handleEsvaziar = async () => {
    const ok = await requireMasterPassword('Todos os itens da lixeira serão apagados definitivamente.');
    if (ok) await esvaziar();
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">Lixeira</h1>
              <p className="text-sm text-muted-foreground">
                Itens excluídos ficam guardados por 30 dias antes de sumir de vez.
              </p>
            </div>
          </div>
          {itens.length > 0 && (
            <Button variant="destructive" onClick={handleEsvaziar} className="w-full sm:w-auto">
              <Trash className="h-4 w-4 mr-2" />
              Esvaziar lixeira
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Itens excluídos ({itens.length})</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar na lixeira..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex justify-center">
                <LoadingSpinner size="lg" text="Carregando lixeira..." />
              </div>
            ) : filtrados.length === 0 ? (
              <EmptyState
                icon={Trash2}
                title="Lixeira vazia"
                description="Nada foi excluído recentemente."
              />
            ) : (
              <div className="space-y-2">
                {filtrados.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 border border-border rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">{ENTIDADE_LABELS[item.entidade] || item.entidade}</Badge>
                        <span className="font-medium truncate">{item.titulo || 'Registro sem título'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Excluído em {new Date(item.excluido_em).toLocaleString('pt-BR')}
                        {item.excluido_por ? ` por ${item.excluido_por}` : ''} • expira em {diasRestantes(item.expira_em)} dia(s)
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => restaurar(item)}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restaurar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleExcluir(item)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Lixeira;

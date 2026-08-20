import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { definirSenhaMestre, getSenhaMestreHash, verificarSenhaMestre } from '@/lib/senhaMestre';

const SenhaMestreManager = () => {
  const [temSenha, setTemSenha] = useState(false);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    getSenhaMestreHash().then((h) => setTemSenha(!!h));
  }, []);

  const salvar = async () => {
    if (nova.length < 4) {
      toast.error('A senha mestre precisa ter pelo menos 4 caracteres.');
      return;
    }
    if (nova !== confirmacao) {
      toast.error('A confirmação não confere.');
      return;
    }
    setSalvando(true);
    try {
      if (temSenha) {
        const ok = await verificarSenhaMestre(atual);
        if (!ok) {
          toast.error('Senha mestre atual incorreta.');
          return;
        }
      }
      await definirSenhaMestre(nova);
      setTemSenha(true);
      setAtual('');
      setNova('');
      setConfirmacao('');
      toast.success('Senha mestre atualizada!');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar a senha mestre.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" />
          Senha mestre de exclusão
          <Badge variant={temSenha ? 'default' : 'secondary'}>{temSenha ? 'Configurada' : 'Não configurada'}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Exigida para excluir pacientes ou qualquer informação do sistema. Os itens excluídos vão para a Lixeira e ficam
          disponíveis por 30 dias.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {temSenha && (
            <div>
              <Label htmlFor="sm-atual">Senha atual</Label>
              <Input id="sm-atual" type="password" value={atual} onChange={(e) => setAtual(e.target.value)} />
            </div>
          )}
          <div>
            <Label htmlFor="sm-nova">Nova senha</Label>
            <Input id="sm-nova" type="password" value={nova} onChange={(e) => setNova(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sm-conf">Confirmar senha</Label>
            <Input id="sm-conf" type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} />
          </div>
        </div>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando...' : temSenha ? 'Alterar senha mestre' : 'Definir senha mestre'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SenhaMestreManager;

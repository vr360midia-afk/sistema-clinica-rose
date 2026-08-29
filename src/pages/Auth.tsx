
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, CalendarCheck, ShieldCheck, MessageCircle } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);

        if (error) {
          toast({
            title: "Erro ao entrar",
            description: error.message === "Invalid login credentials"
              ? "Email ou senha incorretos."
              : error.message,
            variant: "destructive"
          });
          return;
        }

        navigate('/');
        return;
      }

      if (password.length < 6) {
        toast({
          title: "Senha muito curta",
          description: "A senha precisa ter pelo menos 6 caracteres.",
          variant: "destructive"
        });
        return;
      }

      const { error, session, user } = await signUp(email, password, nome);

      if (error) {
        toast({
          title: "Erro ao criar conta",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: session || user
          ? "Conta criada com sucesso! Você já está logado."
          : "Conta criada! Verifique seu email para confirmar."
      });

      if (session || user) {
        navigate('/');
      }
    } catch (err) {
      toast({
        title: "Erro",
        description: "Algo deu errado. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const destaques = [
    { icon: CalendarCheck, texto: 'Agenda inteligente com confirmação automática' },
    { icon: MessageCircle, texto: 'Lembretes e conversas por WhatsApp' },
    { icon: ShieldCheck, texto: 'Prontuário, financeiro e documentos seguros' },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Painel lateral (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-card border-r border-border flex-col justify-between p-12">
        <div
          className="absolute inset-0 opacity-60 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 10%, hsl(var(--primary) / 0.18), transparent 70%)' }}
        />
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight">DentalRose</span>
        </div>
        <div className="relative space-y-8">
          <h1 className="text-4xl font-bold tracking-tight leading-tight">
            A gestão completa<br />do seu consultório.
          </h1>
          <ul className="space-y-4">
            {destaques.map(({ icon: Icon, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-muted-foreground">
                <span className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-primary" />
                </span>
                <span className="text-sm">{texto}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted-foreground">Seus dados sincronizados e protegidos na nuvem.</p>
      </div>

      {/* Formulário */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2 text-center lg:text-left">
            <div className="lg:hidden mx-auto h-12 w-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isLogin ? 'Entre para acessar seu consultório.' : 'Comece a organizar sua clínica em minutos.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required={!isLogin}
                  className="h-11"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@clinica.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary font-medium hover:underline"
            >
              {isLogin ? 'Criar uma' : 'Entrar'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;

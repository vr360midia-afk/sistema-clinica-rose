
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  clinicaId: string | null;
  session: Session | null;
  signUp: (email: string, password: string, nome?: string) => Promise<{ error: any; user: User | null;
  clinicaId: string | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicaId, setClinicaId] = useState<string | null>(null);

  useEffect(() => {
    // Atualiza apenas quando o usuário realmente muda (evita re-render/reload
    // ao trocar de aba, quando o Supabase dispara TOKEN_REFRESHED/SIGNED_IN)
    const applySession = async (newSession: Session | null) => {
      setSession(prev => {
        if (prev?.user?.id === newSession?.user?.id) return prev;
        return newSession;
      });
      setUser(prev => {
        if (prev?.id === newSession?.user?.id) return prev;
        return newSession?.user ?? null;
      });
      if (newSession?.user?.id) {
        const { data, error } = await supabase.rpc('clinica_id');
        setClinicaId(data && !error ? (data as string) : newSession.user.id);
      } else {
        setClinicaId(null);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        applySession(session);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);


  const signUp = async (email: string, password: string, nome?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          nome: nome || ''
        }
      }
    });

    return {
      error,
      user: data.user ?? null,
      session: data.session ?? null,
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    signUp,
    signIn,
    signOut,
    loading, clinicaId };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};



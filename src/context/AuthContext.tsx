
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
    // Atualiza a sessão e garante que tokens renovados sejam aplicados,
    // renovando proativamente caso o access_token esteja expirado.
    const applySession = async (incomingSession: Session | null) => {
      let activeSession = incomingSession;

      const now = Math.floor(Date.now() / 1000);
      if (activeSession && activeSession.expires_at && activeSession.expires_at <= now) {
        try {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshed?.session) {
            activeSession = refreshed.session;
          } else {
            console.warn('[AuthContext] Sessão expirada e não foi possível renovar:', refreshError);
            activeSession = null;
          }
        } catch (err) {
          console.warn('[AuthContext] Erro ao tentar refreshSession:', err);
          activeSession = null;
        }
      }

      setSession(activeSession);
      setUser((prevUser) => {
        if (!activeSession?.user) return null;
        if (
          prevUser &&
          prevUser.id === activeSession.user.id &&
          prevUser.email === activeSession.user.email &&
          prevUser.updated_at === activeSession.user.updated_at
        ) {
          return prevUser; // Preserva a mesma referência de objeto se nada mudou no usuário!
        }
        return activeSession.user;
      });

      if (activeSession?.user?.id) {
        const cacheClinicaKey = `dental_clinica_id_${activeSession.user.id}`;
        const cachedClinica = localStorage.getItem(cacheClinicaKey);
        if (cachedClinica) {
          setClinicaId(cachedClinica);
        } else {
          try {
            const { data, error } = await supabase.rpc('clinica_id');
            const finalId = data && !error ? (data as string) : activeSession.user.id;
            localStorage.setItem(cacheClinicaKey, finalId);
            setClinicaId(finalId);
          } catch {
            setClinicaId(activeSession.user.id);
          }
        }
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



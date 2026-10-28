import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SessionContext = createContext<{ userId: string | null; ready: boolean }>({ userId: null, ready: false });
export const useRadarSession = () => useContext(SessionContext);

export function RadarSession({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ userId: null as string | null, ready: false });
  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => {
      if (live) setState({ userId: data.session?.user.id ?? null, ready: true });
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setState({ userId: session?.user.id ?? null, ready: true });
      }
    });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}
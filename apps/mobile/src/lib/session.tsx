import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getLocalItem, setLocalItem } from './storage';

type Session = { token: string; email: string; expiresAt: string };
type State = { session: Session | null; ready: boolean; save: (s: Session | null) => Promise<void> };
const Context = createContext<State>({ session: null, ready: false, save: async () => {} });
let active: Session | null = null;
export const currentSession = () => active;
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { getLocalItem('session').then(raw => {
    if (raw) { const stored: Session = JSON.parse(raw); if (new Date(stored.expiresAt) > new Date()) { active = stored; setSession(stored); } }
  }).catch(() => {}).finally(() => setReady(true)); }, []);
  const save = useCallback(async (value: Session | null) => {
    await setLocalItem('session', value ? JSON.stringify(value) : null);
    active = value; setSession(value);
  }, []);
  return <Context.Provider value={{ session, ready, save }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);

import { createContext, useContext } from 'react';
export const SessionContext = createContext<{ email: string | null; setEmail: (email: string | null) => void; displayName: string; setDisplayName: (name: string) => void }>({ email: null, setEmail: () => {}, displayName: '', setDisplayName: () => {} });
export const useSession = () => useContext(SessionContext);

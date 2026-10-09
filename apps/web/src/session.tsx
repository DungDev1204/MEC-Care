import { createContext, useContext } from 'react';
export type AccessStatus = 'active' | 'pending' | 'expired';
export type Session = { email: string; displayName: string; isAdmin: boolean; username?: string; activeUntil?: string | null; subscriptionEnabled: boolean; canUseApp: boolean; accessStatus: AccessStatus };
export const SessionContext = createContext<{ email: string | null; setEmail: (email: string | null) => void; displayName: string; setDisplayName: (name: string) => void; isAdmin: boolean; setIsAdmin: (value: boolean) => void; canUseApp: boolean; accessStatus: AccessStatus; setAccess: (canUse: boolean, status: AccessStatus) => void; refreshSession: () => Promise<void> }>({ email: null, setEmail: () => {}, displayName: '', setDisplayName: () => {}, isAdmin: false, setIsAdmin: () => {}, canUseApp: false, accessStatus: 'pending', setAccess: () => {}, refreshSession: async () => {} });
export const useSession = () => useContext(SessionContext);

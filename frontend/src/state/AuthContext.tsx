import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loginRequest, meRequest } from "../api/auth";
import { setAuthToken } from "../api/client";
import type { UserProfile } from "../types/auth";

type AuthState = { isBooting: boolean; isAuthenticated: boolean; user: UserProfile | null; login: (identifier: string, password: string) => Promise<void>; logout: () => void };
const AuthContext = createContext<AuthState | null>(null);
const TOKEN_KEY = "support_chat_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isBooting, setIsBooting] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const logout = useCallback(() => { localStorage.removeItem(TOKEN_KEY); setAuthToken(null); setUser(null); }, []);
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setIsBooting(false); return; }
    setAuthToken(token);
    meRequest().then((result) => setUser(result.data.user)).catch(logout).finally(() => setIsBooting(false));
  }, [logout]);
  const login = useCallback(async (identifier: string, password: string) => {
    const result = await loginRequest(identifier, password);
    if (!result.success || !result.data?.token) throw new Error(result.message || "Login failed");
    localStorage.setItem(TOKEN_KEY, result.data.token);
    setAuthToken(result.data.token);
    const profile = await meRequest();
    setUser(profile.data.user);
  }, []);
  const value = useMemo(() => ({ isBooting, isAuthenticated: Boolean(user), user, login, logout }), [isBooting, user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

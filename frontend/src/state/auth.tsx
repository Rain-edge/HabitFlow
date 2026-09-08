import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const LOCAL_USER: User = {
  id: 1,
  email: "local@habitflow",
  username: "我",
  timezone: "Asia/Shanghai",
  is_active: true,
  created_at: new Date().toISOString(),
};

function loadProfile(): User {
  try {
    const raw = localStorage.getItem("hf-profile");
    if (raw) {
      const p = JSON.parse(raw);
      return { ...LOCAL_USER, ...p };
    }
  } catch {
    /* ignore */
  }
  return LOCAL_USER;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(loadProfile());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (_email: string, _password: string) => {
    setUser(loadProfile());
  };

  const register = async (_email: string, username: string, _password: string) => {
    const p = { ...LOCAL_USER, username: username || LOCAL_USER.username };
    localStorage.setItem("hf-profile", JSON.stringify(p));
    setUser(p);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

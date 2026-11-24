import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  apiClient,
  setAuthToken,
  setUnauthorizedHandler,
  type UserAccount,
} from "./api-client";

const STORAGE_KEY = "projetositps_auth";

interface StoredSession {
  token: string;
  expiresAt: number;
  user: UserAccount;
}

interface AuthContextValue {
  user: UserAccount | null;
  token: string | null;
  expiresAt: number | null;
  ready: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canEdit: boolean;
  sessionMessage: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
  clearSessionMessage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.token !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !parsed.user ||
      typeof parsed.user.id !== "string"
    ) {
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function saveStoredSession(session: StoredSession | null): void {
  if (typeof window === "undefined") return;
  if (!session) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const logout = useCallback((reason?: string) => {
    setAuthToken(null);
    saveStoredSession(null);
    setToken(null);
    setExpiresAt(null);
    setUser(null);
    setSessionMessage(reason ?? null);
  }, []);

  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  // Registra interceptador global para derrubar a sessão ao receber 401 da API.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout("Sua sessão expirou. Faça login novamente.");
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Restaura e valida a sessão persistida no navegador antes de liberar rotas protegidas.
  useEffect(() => {
    let active = true;
    const stored = readStoredSession();
    if (!stored) {
      setReady(true);
      return;
    }

    if (Date.now() >= stored.expiresAt) {
      logout("Sua sessão expirou. Faça login novamente.");
      setReady(true);
      return;
    }

    setAuthToken(stored.token);
    apiClient
      .me()
      .then((freshUser) => {
        if (!active) return;
        const nextSession: StoredSession = {
          token: stored.token,
          expiresAt: stored.expiresAt,
          user: freshUser,
        };
        saveStoredSession(nextSession);
        setToken(stored.token);
        setExpiresAt(stored.expiresAt);
        setUser(freshUser);
      })
      .catch(() => {
        if (!active) return;
        logout("Sua sessão expirou. Faça login novamente.");
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [logout]);

  // Agenda o redirecionamento automático exatamente quando o token de 1 hora expirar.
  useEffect(() => {
    if (!token || !expiresAt) return;

    const expireSession = () => {
      logout("Sua sessão expirou após 1 hora. Faça login novamente.");
    };

    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      expireSession();
      return;
    }

    const timer = window.setTimeout(expireSession, remainingMs);

    // Revalida ao retornar para a aba caso o computador tenha entrado em suspensão.
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() >= expiresAt) {
        expireSession();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [token, expiresAt, logout]);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiClient.login(username, password);
    const parsedExp = Date.parse(response.expires_at);
    const computedExpiresAt = Number.isFinite(parsedExp)
      ? parsedExp
      : Date.now() + response.expires_in * 1000;

    setAuthToken(response.access_token);
    const session: StoredSession = {
      token: response.access_token,
      expiresAt: computedExpiresAt,
      user: response.user,
    };
    saveStoredSession(session);
    setToken(session.token);
    setExpiresAt(session.expiresAt);
    setUser(session.user);
    setSessionMessage(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        expiresAt,
        ready,
        isAuthenticated: Boolean(user && token),
        isAdmin: user?.role === "admin",
        canEdit: user?.role === "admin" || user?.role === "editor",
        sessionMessage,
        login,
        logout,
        clearSessionMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("AuthProvider não encontrado na árvore de componentes.");
  }
  return ctx;
}

import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { clearToken, loadToken, saveToken } from "../lib/auth-storage";
import { ApiError, setAuthToken } from "../lib/api-client";
import { api, type AuthResult, type OAuthInput, type SignupInput } from "../lib/api";

// needs-profile: signed in, profile setup not finished yet.
type AuthStatus = "loading" | "signed-out" | "needs-profile" | "signed-in";

interface AuthValue {
  status: AuthStatus;
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  oauth: (input: OAuthInput) => Promise<void>;
  /** Call after profile setup is saved. */
  profileCompleted: () => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    loadToken().then(async (token) => {
      if (!token) return setStatus("signed-out");
      setAuthToken(token);
      try {
        const me = await api.getMe();
        setStatus(me.needsProfile ? "needs-profile" : "signed-in");
      } catch (err) {
        // An expired or revoked session (or a deleted account) means signing in again.
        if (err instanceof ApiError && err.status === 401) {
          await clearToken();
          setAuthToken(null);
          setStatus("signed-out");
        } else {
          setStatus("signed-in"); // offline — let screens show their own errors
        }
      }
    });
  }, []);

  async function start(result: AuthResult) {
    await saveToken(result.token);
    setAuthToken(result.token);
    setStatus(result.needsProfile ? "needs-profile" : "signed-in");
  }

  async function logout() {
    await clearToken();
    setAuthToken(null);
    setStatus("signed-out");
  }

  const value: AuthValue = {
    status,
    signup: async (input) => start(await api.signup(input)),
    login: async (email, password) => start(await api.login(email, password)),
    oauth: async (input) => start(await api.oauth(input)),
    profileCompleted: () => setStatus("signed-in"),
    logout,
    deleteAccount: async () => {
      await api.deleteAccount();
      await logout();
    },
  };

  // Render nothing until the saved session is loaded, so no request goes out without it.
  return <AuthContext.Provider value={value}>{status === "loading" ? null : children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

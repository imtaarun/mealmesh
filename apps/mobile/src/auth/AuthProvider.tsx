import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { clearToken, loadToken, saveToken } from "../lib/auth-storage";
import { setAuthToken } from "../lib/api-client";
import { api, type OnboardingInput, type SignupInput } from "../lib/api";

type AuthStatus = "loading" | "signed-out" | "signed-in";

interface AuthValue {
  status: AuthStatus;
  householdId: string | null;
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  onboard: (input: OnboardingInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [householdId, setHouseholdId] = useState<string | null>(null);

  useEffect(() => {
    loadToken().then((token) => {
      if (token) {
        setAuthToken(token);
        // householdId isn't persisted separately; it's only needed for display and
        // every screen fetches it fresh from /api/meal-plans/current or similar, so a
        // restored session doesn't need to know it up front.
        setStatus("signed-in");
      } else {
        setStatus("signed-out");
      }
    });
  }, []);

  async function signup(input: SignupInput) {
    const result = await api.signup(input);
    await saveToken(result.token);
    setAuthToken(result.token);
    setHouseholdId(result.householdId);
    setStatus("signed-in");
  }

  async function login(email: string, password: string) {
    const result = await api.login(email, password);
    await saveToken(result.token);
    setAuthToken(result.token);
    setHouseholdId(result.householdId);
    setStatus("signed-in");
  }

  async function onboard(input: OnboardingInput) {
    await api.onboard(input);
  }

  async function logout() {
    await clearToken();
    setAuthToken(null);
    setHouseholdId(null);
    setStatus("signed-out");
  }

  return (
    <AuthContext.Provider value={{ status, householdId, signup, login, onboard, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

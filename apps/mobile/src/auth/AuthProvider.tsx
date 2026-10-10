import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { clearToken, isAgeBlocked, loadToken, markAgeBlocked, saveToken } from "../lib/auth-storage";
import { ApiError, setAuthToken } from "../lib/api-client";
import { api, type AuthResult, type Me, type OAuthInput, type SignupInput } from "../lib/api";

// needs-age: an account from before the age check, asked for a date of birth before anything else.
// needs-profile: signed in, profile setup not finished yet.
type AuthStatus = "loading" | "signed-out" | "needs-age" | "needs-profile" | "signed-in";

const statusOf = (me: Pick<Me, "needsAgeConfirmation" | "needsProfile">): AuthStatus =>
  me.needsAgeConfirmation ? "needs-age" : me.needsProfile ? "needs-profile" : "signed-in";

interface AuthValue {
  status: AuthStatus;
  /** Someone under the minimum age tried this phone; sign-up isn't offered again. */
  ageBlocked: boolean;
  signup: (input: SignupInput) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  oauth: (input: OAuthInput) => Promise<void>;
  confirmAge: (dateOfBirth: string) => Promise<void>;
  /** Call after profile setup is saved. */
  profileCompleted: () => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [ageBlocked, setAgeBlocked] = useState(false);

  useEffect(() => {
    isAgeBlocked().then(setAgeBlocked);
    loadToken().then(async (token) => {
      if (!token) return setStatus("signed-out");
      setAuthToken(token);
      try {
        const me = await api.getMe();
        setStatus(statusOf(me));
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
    setStatus(statusOf(result));
  }

  async function signOutHere() {
    await clearToken();
    setAuthToken(null);
    setStatus("signed-out");
  }

  async function logout() {
    await api.logout().catch(() => {}); // offline still signs out on this phone
    await signOutHere();
  }

  // An under-age answer: the server has already refused or deleted the account.
  async function guardAge(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      if (err instanceof ApiError && err.code === "UNDER_AGE") {
        await markAgeBlocked();
        setAgeBlocked(true);
        await signOutHere();
      }
      throw err;
    }
  }

  const value: AuthValue = {
    status,
    ageBlocked,
    signup: (input) => guardAge(async () => start(await api.signup(input))),
    login: async (email, password) => start(await api.login(email, password)),
    oauth: (input) => guardAge(async () => start(await api.oauth(input))),
    confirmAge: (dateOfBirth) => guardAge(async () => setStatus(statusOf(await api.confirmAge(dateOfBirth)))),
    profileCompleted: () => setStatus("signed-in"),
    logout,
    deleteAccount: async () => {
      await api.deleteAccount();
      await signOutHere();
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

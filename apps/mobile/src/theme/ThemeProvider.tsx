import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";
import { colors, type ColorTokens, type ThemeMode } from "./colors";
import { spacing, radius } from "./spacing";
import { typography } from "./typography";

interface ThemeValue {
  mode: ThemeMode;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const mode: ThemeMode = systemScheme === "dark" ? "dark" : "light";

  const value = useMemo<ThemeValue>(
    () => ({ mode, colors: colors[mode], spacing, radius, typography }),
    [mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { palettes, type ColorTokens, type PaletteName, type ThemeMode } from "./colors";
import { hairline, minTouch, radius, spacing } from "./spacing";
import { typography } from "./typography";

const PALETTE_KEY = "mealmesh.palette";

interface ThemeValue {
  mode: ThemeMode;
  palette: PaletteName;
  setPalette: (palette: PaletteName) => void;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  minTouch: number;
  hairline: number;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const mode: ThemeMode = useColorScheme() === "dark" ? "dark" : "light";
  const [palette, setPaletteState] = useState<PaletteName>("forest");

  useEffect(() => {
    SecureStore.getItemAsync(PALETTE_KEY)
      .then((saved) => saved && saved in palettes && setPaletteState(saved as PaletteName))
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      mode,
      palette,
      setPalette: (next) => {
        setPaletteState(next);
        SecureStore.setItemAsync(PALETTE_KEY, next).catch(() => {});
      },
      colors: palettes[palette][mode],
      spacing,
      radius,
      typography,
      minTouch,
      hairline,
    }),
    [mode, palette],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

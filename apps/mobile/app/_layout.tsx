import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "@/theme";
import { AuthProvider } from "@/auth/AuthProvider";

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="recipe-picker" options={{ presentation: "modal" }} />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}

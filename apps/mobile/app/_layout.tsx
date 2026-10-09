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
          <Stack.Screen name="welcome" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="history" />
          <Stack.Screen name="my-data" />
          <Stack.Screen name="recipe/[id]" />
          <Stack.Screen name="cook/[id]" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
          <Stack.Screen name="recipe-picker" options={{ presentation: "modal" }} />
          <Stack.Screen name="pantry-item" options={{ presentation: "modal" }} />
          <Stack.Screen name="optimize" />
          <Stack.Screen name="deals" />
        </Stack>
      </ThemeProvider>
    </AuthProvider>
  );
}

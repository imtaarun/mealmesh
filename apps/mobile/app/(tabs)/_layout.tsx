import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme";
import { useAuth } from "@/auth/AuthProvider";
import { Glass } from "@/components/ui/Glass";

// Signed-out → /welcome; new accounts finish profile setup first.
export default function TabsLayout() {
  const { colors, spacing } = useTheme();
  const { status } = useAuth();
  const insets = useSafeAreaInsets();
  const android = Platform.OS === "android";

  if (status === "loading") {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }
  if (status === "signed-out") {
    return <Redirect href="/welcome" />;
  }
  if (status === "needs-profile") {
    return <Redirect href="/profile-setup" />;
  }

  return (
    <Tabs
      safeAreaInsets={android ? undefined : { bottom: 0 }}
      screenOptions={{
        headerShown: false,
        animation: "fade",
        tabBarActiveTintColor: colors.brandAccent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: android
          ? { backgroundColor: colors.surfaceElevated, borderTopWidth: 0, elevation: 3, height: 80, paddingTop: 8, paddingBottom: 12 }
          : {
              // A floating glass capsule over scrolling content.
              position: "absolute",
              bottom: Math.max(insets.bottom - spacing.sm, spacing.md),
              marginHorizontal: spacing.md,
              height: 64,
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm,
              backgroundColor: "transparent",
              borderTopWidth: 0,
              elevation: 0,
            },
        tabBarBackground: android ? undefined : () => <Glass style={{ flex: 1 }} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: "Week",
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarIcon: ({ color, size }) => <Ionicons name="cart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: "Pantry",
          tabBarIcon: ({ color, size }) => <Ionicons name="file-tray-stacked-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

import { Redirect, Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme";
import { useAuth } from "@/auth/AuthProvider";

// Signed-out → /welcome; new accounts finish profile setup first.
export default function TabsLayout() {
  const { colors, hairline } = useTheme();
  const { status } = useAuth();

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
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandAccent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: Platform.select({
          // iOS: frosted glass over scrolling content.
          ios: { position: "absolute", backgroundColor: "transparent", borderTopWidth: hairline, borderTopColor: colors.border },
          default: { backgroundColor: colors.surfaceElevated, borderTopWidth: 0, elevation: 3, height: 80, paddingTop: 8, paddingBottom: 12 },
        }),
        tabBarBackground: Platform.OS === "ios" ? () => <BlurView tint="systemUltraThinMaterial" intensity={100} style={StyleSheet.absoluteFill} /> : undefined,
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

import { useEffect, useState } from "react";
import { Platform, Pressable, Text } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/theme";

// Lets the Google sign-in browser tab hand its result back to the app on web.
WebBrowser.maybeCompleteAuthSession();

// Each provider hands the app an ID token (a signed statement of who the user is);
// the backend checks its signature before trusting it (apps/backend OAuthVerifier).
export interface SocialResult {
  provider: "google" | "apple";
  idToken: string;
  name?: string;
}

const GOOGLE_CLIENT_IDS = {
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

/** True when Google sign-in has a client ID for this platform (docs/oauth-setup.md). */
export const googleConfigured = Boolean(GOOGLE_CLIENT_IDS[Platform.OS as keyof typeof GOOGLE_CLIENT_IDS]);

export function GoogleSignInButton({ onResult, onError }: { onResult: (r: SocialResult) => void; onError: (message: string) => void }) {
  const { colors, spacing, radius, typography } = useTheme();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    ...(GOOGLE_CLIENT_IDS.ios ? { iosClientId: GOOGLE_CLIENT_IDS.ios } : {}),
    ...(GOOGLE_CLIENT_IDS.android ? { androidClientId: GOOGLE_CLIENT_IDS.android } : {}),
    ...(GOOGLE_CLIENT_IDS.web ? { webClientId: GOOGLE_CLIENT_IDS.web } : {}),
  });

  useEffect(() => {
    if (response?.type === "success" && response.params.id_token) {
      onResult({ provider: "google", idToken: response.params.id_token });
    } else if (response?.type === "error") {
      onError("Google sign-in didn't finish. Please try again.");
    }
  }, [response]);

  return (
    <Pressable
      disabled={!request}
      onPress={() => promptAsync()}
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: radius.pill,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
      }}
    >
      <Ionicons name="logo-google" size={18} color={colors.text} />
      <Text style={{ ...typography.bodyStrong, color: colors.text }}>Continue with Google</Text>
    </Pressable>
  );
}

/** Apple's own button (its design rules require it), shown only where Apple sign-in exists — iPhone and iPad. */
export function AppleSignInButton({ onResult, onError }: { onResult: (r: SocialResult) => void; onError: (message: string) => void }) {
  const { radius, spacing } = useTheme();
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") AppleAuthentication.isAvailableAsync().then(setAvailable);
  }, []);
  if (!available) return null;

  async function signIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) return onError("Apple didn't send a sign-in token. Please try again.");
      // Apple shares the name only on the very first sign-in, and only with the app.
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
      onResult({ provider: "apple", idToken: credential.identityToken, ...(name ? { name } : {}) });
    } catch (err) {
      if ((err as { code?: string }).code !== "ERR_REQUEST_CANCELED") onError("Apple sign-in didn't finish. Please try again.");
    }
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.pill}
      style={{ height: 50, marginBottom: spacing.sm }}
      onPress={signIn}
    />
  );
}

import * as SecureStore from "expo-secure-store";

// The session token is a credential: Keychain/Keystore, not AsyncStorage.
const TOKEN_KEY = "mealmesh.session_token";

export async function saveToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// Set when someone under the minimum age tries to sign up, so this phone doesn't offer sign-up again.
const AGE_BLOCK_KEY = "mealmesh.age_blocked";

export async function markAgeBlocked(): Promise<void> {
  await SecureStore.setItemAsync(AGE_BLOCK_KEY, "1");
}

export async function isAgeBlocked(): Promise<boolean> {
  return (await SecureStore.getItemAsync(AGE_BLOCK_KEY)) === "1";
}

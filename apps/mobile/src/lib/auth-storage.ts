import * as SecureStore from "expo-secure-store";

// The session token is a bearer credential (docs/architecture.md "Cross-cutting /
// Auth") — SecureStore backs onto Keychain/Keystore, not plain AsyncStorage, because
// this is equivalent to a password in value.
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

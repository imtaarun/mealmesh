# Setting up Google and Apple sign-in

The code is done and tested (`apps/backend/test/oauth-verifier.test.ts`, plus an
end-to-end run against locally signed tokens). What's missing is the real keys,
which only the app's owner can create. Until they're set, the Google button stays
hidden and the backend answers "Google sign-in isn't set up yet"; email sign-in always
works.

How it works: the app opens Google's or Apple's own sign-in sheet, which hands the
app an **ID token**, a signed statement of who the user is. The app sends only that
to `POST /api/auth/oauth`. The backend checks the signature against the provider's
published keys, and that the token was issued *to our app* (its audience is one of our
client IDs) and hasn't expired. Passwords and access tokens never touch our server.

## Google (free)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project
   (or pick one) and set up the **OAuth consent screen**: app name "MealMesh",
   support email, scopes `openid`, `email`, `profile`. Publish it when you launch;
   while it's in testing, only listed test users can sign in.
2. Under **Credentials → Create credentials → OAuth client ID**, create one client per
   platform:
   - **iOS**: bundle ID `com.mealmesh.app`.
   - **Android**: package `com.mealmesh.app` plus the SHA-1 of your signing key (EAS
     shows it under `eas credentials`).
   - **Web**: only needed if you run the app in a browser.
3. Mobile, in `apps/mobile/.env`:
   ```
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios client id>
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android client id>
   ```
4. Backend, in `apps/backend/.env`: every client ID whose tokens we accept,
   comma-separated:
   ```
   GOOGLE_CLIENT_IDS=<ios client id>,<android client id>
   ```

Google sign-in needs a **development build** (`eas build --profile development`); it
doesn't work inside Expo Go, because Google ties the client to your app's own bundle
ID.

## Apple ($99/year Apple Developer Program)

1. In [Apple Developer](https://developer.apple.com/account/) → Certificates,
   Identifiers & Profiles → Identifiers, open (or create) the App ID
   `com.mealmesh.app` and tick **Sign in with Apple**. `app.json` already sets
   `ios.usesAppleSignIn` and the `expo-apple-authentication` plugin.
2. Backend, `apps/backend/.env`:
   ```
   APPLE_CLIENT_IDS=com.mealmesh.app
   ```
   Testing in Expo Go? Its tokens are issued to Expo Go's own bundle ID, so add
   `host.exp.Exponent` for local development only, never in production.

Apple's App Store rules say an app offering Google sign-in must also offer Sign in
with Apple, and an app that creates accounts must let people delete them in the app.
Both are built: the Apple button shows on iPhone and iPad, and Profile → Your data →
Delete my account.

## Testing without real keys

`GOOGLE_JWKS_URL` and `APPLE_JWKS_URL` point the backend at a different key server.
The tests use them to serve a key they control and sign their own tokens. Never set
them in production.

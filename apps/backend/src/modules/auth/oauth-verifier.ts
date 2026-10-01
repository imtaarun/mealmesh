import { BadRequestException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export type OAuthProvider = "google" | "apple";

export interface VerifiedIdentity {
  provider: OAuthProvider;
  subject: string; // the provider's stable user id — never changes, unlike email
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

// Where each provider publishes its signing keys and what it puts in `iss`. The
// accepted audiences are our own client IDs — a token Google issued to some other
// app must not sign anyone in here. See docs/oauth-setup.md for where they come from.
const PROVIDERS: Record<OAuthProvider, { issuers: string[]; jwksUrl: string; audiencesEnv: string; jwksUrlEnv: string }> = {
  google: {
    issuers: ["https://accounts.google.com", "accounts.google.com"],
    jwksUrl: "https://www.googleapis.com/oauth2/v3/certs",
    audiencesEnv: "GOOGLE_CLIENT_IDS",
    jwksUrlEnv: "GOOGLE_JWKS_URL",
  },
  apple: {
    issuers: ["https://appleid.apple.com"],
    jwksUrl: "https://appleid.apple.com/auth/keys",
    audiencesEnv: "APPLE_CLIENT_IDS",
    jwksUrlEnv: "APPLE_JWKS_URL",
  },
};

/**
 * Checks a Google or Apple ID token the app got from the provider's sign-in sheet:
 * signature against the provider's published keys, issuer, audience (our client IDs),
 * and expiry. The app never sends us a password or an access token — only this
 * signed statement of who the user is.
 */
@Injectable()
export class OAuthVerifier {
  private readonly keySets = new Map<OAuthProvider, JWTVerifyGetKey>();

  async verify(provider: OAuthProvider, idToken: string): Promise<VerifiedIdentity> {
    const config = PROVIDERS[provider];
    if (!config) throw new BadRequestException(`Unknown sign-in provider "${provider}"`);

    const audiences = (process.env[config.audiencesEnv] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (audiences.length === 0) {
      throw new ServiceUnavailableException(`${provider === "google" ? "Google" : "Apple"} sign-in isn't set up yet`);
    }

    let payload;
    try {
      ({ payload } = await jwtVerify(idToken, this.keySet(provider), { issuer: config.issuers, audience: audiences }));
    } catch {
      throw new UnauthorizedException("That sign-in didn't check out — please try again");
    }
    if (!payload.sub) throw new UnauthorizedException("That sign-in didn't include an account id");

    return {
      provider,
      subject: payload.sub,
      email: typeof payload.email === "string" ? payload.email.toLowerCase() : null,
      // Google sends a boolean; Apple has sent both a boolean and the string "true".
      emailVerified: payload.email_verified === true || payload.email_verified === "true",
      name: typeof payload.name === "string" ? payload.name : null,
    };
  }

  private keySet(provider: OAuthProvider): JWTVerifyGetKey {
    let keySet = this.keySets.get(provider);
    if (!keySet) {
      const config = PROVIDERS[provider];
      // The env override exists for local end-to-end testing against keys we control.
      keySet = createRemoteJWKSet(new URL(process.env[config.jwksUrlEnv] ?? config.jwksUrl));
      this.keySets.set(provider, keySet);
    }
    return keySet;
  }
}

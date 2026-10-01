import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type KeyLike } from "jose";
import { OAuthVerifier } from "../src/modules/auth/oauth-verifier.js";

// A local stand-in for Google's and Apple's published key endpoints, serving a key
// this test controls — so every check (signature, issuer, audience, expiry) runs for
// real without network access or real client IDs.
let server: Server;
let goodKey: KeyLike;
let strangerKey: KeyLike;

beforeAll(async () => {
  const good = await generateKeyPair("RS256");
  goodKey = good.privateKey;
  strangerKey = (await generateKeyPair("RS256")).privateKey;
  const jwks = JSON.stringify({ keys: [{ ...(await exportJWK(good.publicKey)), kid: "test", alg: "RS256", use: "sig" }] });
  server = createServer((_req, res) => res.writeHead(200, { "content-type": "application/json" }).end(jwks));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/keys`;
  process.env.GOOGLE_JWKS_URL = url;
  process.env.APPLE_JWKS_URL = url;
});

afterAll(() => server.close());

beforeEach(() => {
  process.env.GOOGLE_CLIENT_IDS = "ios-client.apps.googleusercontent.com, web-client.apps.googleusercontent.com";
  process.env.APPLE_CLIENT_IDS = "com.mealmesh.app";
});

function token(claims: Record<string, unknown>, opts: { key?: KeyLike; iss?: string; aud?: string; exp?: string } = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("user-123")
    .setIssuer(opts.iss ?? "https://accounts.google.com")
    .setAudience(opts.aud ?? "ios-client.apps.googleusercontent.com")
    .setIssuedAt()
    .setExpirationTime(opts.exp ?? "10m")
    .sign(opts.key ?? goodKey);
}

describe("OAuthVerifier", () => {
  it("accepts a Google token for one of our client IDs and reads who it is", async () => {
    const idToken = await token({ email: "Sam@Example.com", email_verified: true, name: "Sam" }, { aud: "web-client.apps.googleusercontent.com" });
    await expect(new OAuthVerifier().verify("google", idToken)).resolves.toEqual({
      provider: "google",
      subject: "user-123",
      email: "sam@example.com",
      emailVerified: true,
      name: "Sam",
    });
  });

  it("accepts Apple's string \"true\" for email_verified", async () => {
    const idToken = await token({ email: "x@privaterelay.appleid.com", email_verified: "true" }, { iss: "https://appleid.apple.com", aud: "com.mealmesh.app" });
    const identity = await new OAuthVerifier().verify("apple", idToken);
    expect(identity.emailVerified).toBe(true);
    expect(identity.name).toBeNull();
  });

  it("treats a missing email_verified as unverified", async () => {
    const identity = await new OAuthVerifier().verify("google", await token({ email: "a@b.com" }));
    expect(identity.emailVerified).toBe(false);
  });

  it.each([
    ["issued to another app", { aud: "someone-elses-app.apps.googleusercontent.com" }],
    ["from the wrong issuer", { iss: "https://evil.example.com" }],
    ["expired", { exp: "-1m" }],
  ])("rejects a token %s", async (_label, opts) => {
    await expect(new OAuthVerifier().verify("google", await token({ email: "a@b.com" }, opts))).rejects.toThrow("didn't check out");
  });

  it("rejects a token signed with a key the provider never published", async () => {
    await expect(new OAuthVerifier().verify("google", await token({}, { key: strangerKey }))).rejects.toThrow("didn't check out");
  });

  it("rejects an Apple token presented as Google", async () => {
    const appleToken = await token({}, { iss: "https://appleid.apple.com", aud: "com.mealmesh.app" });
    await expect(new OAuthVerifier().verify("google", appleToken)).rejects.toThrow("didn't check out");
  });

  it("says plainly when a provider isn't configured yet", async () => {
    process.env.APPLE_CLIENT_IDS = "";
    await expect(new OAuthVerifier().verify("apple", "anything")).rejects.toThrow("Apple sign-in isn't set up yet");
  });
});

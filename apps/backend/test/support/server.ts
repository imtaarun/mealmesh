import { spawn, type ChildProcess } from "node:child_process";

/** Starts the built API (`dist/main.js`) on `port` against the database in .env. */
export async function startServer(port: number, env: Record<string, string> = {}) {
  const server: ChildProcess = spawn("node", ["dist/main.js"], { env: { ...process.env, ...env, PORT: String(port) }, stdio: "ignore" });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 60; i++) {
    if (await fetch(`${url}/api/recipes`).then(() => true, () => false)) return { url, stop: () => server.kill() };
    await new Promise((r) => setTimeout(r, 250));
  }
  server.kill();
  throw new Error("API didn't start");
}

export function client(url: string) {
  return async function call(method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(url + path, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
}

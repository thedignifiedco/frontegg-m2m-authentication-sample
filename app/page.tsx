"use client";
import { useState } from "react";

type ProtectedData = {
  message: string;
  now: string;
  subject: string | null;
  scopes: string[];
};

export default function Home() {
  const [result, setResult] = useState<ProtectedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function runDemo() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      // Get token from our backend (cached server-side)
      const tokenRes = await fetch("/api/token");
      const { access_token } = await tokenRes.json();
      if (!access_token) throw new Error("Failed to get token");

      // Call protected API with token
      const res = await fetch("/api/private/data", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1>Frontegg M2M Demo</h1>
      <p>
        Click the button to fetch an M2M access token (cached on the server)
        and call a protected API that requires a scope.
      </p>
      <button onClick={runDemo} disabled={loading} style={{ padding: 12 }}>
        {loading ? "Running…" : "Run Demo"}
      </button>
      {error && (
        <pre style={{ color: "crimson", marginTop: 16 }}>{error}</pre>
      )}
      {result && (
        <pre style={{ marginTop: 16 }}>{JSON.stringify(result, null, 2)}</pre>
      )}
    </main>
  );
}

// lib/frontegg.ts
let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let cachedVendorToken: { token: string; expiresAt: number } | null = null;

function shouldDebug(): boolean {
  return process.env.DEBUG_FRONTEGG === '1';
}

async function fetchVendorToken(base: string, clientId: string, secret: string): Promise<{ token: string; expiresIn?: number }> {
  const url = `https://api.frontegg.com/auth/vendor/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, secret }),
  });
  if (shouldDebug()) {
    console.log('[frontegg] vendor token response', {
      url,
      status: res.status,
      ok: res.ok,
    });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vendor auth failed: ${res.status} ${text}`);
  }
  return (await res.json()) as { token: string; expiresIn?: number };
}

function normalizeApiTokenUrl(base: string): string {
  const trimmed = base.replace(/\/$/, '');
  if (trimmed.endsWith('/identity/resources')) {
    return `${trimmed}/auth/v2/api-token`;
  }
  return `${trimmed}/identity/resources/auth/v2/api-token`;
}

async function fetchM2MToken(base: string, vendorToken: string, clientId: string, secret: string): Promise<{ accessToken: string; expiresIn: number }> {
  const url = normalizeApiTokenUrl(base);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${vendorToken}`,
    },
    body: JSON.stringify({ clientId, secret }),
  });
  if (shouldDebug()) {
    console.log('[frontegg] api token response', {
      url,
      status: res.status,
      ok: res.ok,
    });
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`M2M token exchange failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  if (shouldDebug()) {
    const topLevelKeys = data && typeof data === 'object' ? Object.keys(data as Record<string, unknown>) : [];
    console.log('[frontegg] api token response body keys', topLevelKeys);
  }
  const { token, accessToken, expiresIn } = parseApiTokenResponse(data);
  return { accessToken: accessToken ?? token!, expiresIn };
}

function parseApiTokenResponse(json: unknown): { token?: string; accessToken?: string; expiresIn: number } {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid API token response');
  }
  const obj = json as Record<string, unknown>;
  // Common shapes
  const directAccessToken = typeof obj.accessToken === 'string' ? (obj.accessToken as string) : undefined;
  const directToken = typeof obj.token === 'string' ? (obj.token as string) : undefined;
  const snakeAccessToken = typeof obj.access_token === 'string' ? (obj.access_token as unknown as string) : undefined;
  const snakeToken = typeof obj.token === 'string' ? (obj.token as string) : undefined;

  // Nested under data
  const data = obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : undefined;
  const dataAccessToken = data && typeof data.accessToken === 'string' ? (data.accessToken as string) : undefined;
  const dataToken = data && typeof data.token === 'string' ? (data.token as string) : undefined;

  const token = directAccessToken || directToken || snakeAccessToken || snakeToken || dataAccessToken || dataToken;

  // expires
  let expiresIn: number | undefined;
  if (typeof obj.expiresIn === 'number') expiresIn = obj.expiresIn as number;
  if (typeof obj.expires_in === 'number') expiresIn = obj.expires_in as unknown as number;
  if (!expiresIn && data && typeof data.expiresIn === 'number') expiresIn = data.expiresIn as number;
  if (!expiresIn && data && typeof data.expires_in === 'number') expiresIn = data.expires_in as unknown as number;
  if (!expiresIn) {
    // Default 5 minutes if not provided, to avoid caching forever
    expiresIn = 300;
  }

  return { token, accessToken: directAccessToken ?? dataAccessToken ?? snakeAccessToken, expiresIn };
}

export async function getEnvToken(): Promise<string> {
  const base = process.env.FRONTEGG_API_BASE!; // e.g. https://api.frontegg.com/identity/resources
  // Vendor credentials (used to obtain vendor token)
  const vendorClientId = process.env.FRONTEGG_VENDOR_CLIENT_ID!;
  const vendorSecret = process.env.FRONTEGG_VENDOR_SECRET!;
  // API (M2M) credentials (used to exchange vendor token for API token)
  const apiClientId = process.env.FRONTEGG_CLIENT_ID!;
  const apiSecret = process.env.FRONTEGG_API_KEY!;

  if (!base) throw new Error('Missing FRONTEGG_API_BASE');
  if (!vendorClientId || !vendorSecret) throw new Error('Missing vendor credentials (FRONTEGG_VENDOR_CLIENT_ID/FRONTEGG_VENDOR_SECRET)');
  if (!apiClientId || !apiSecret) throw new Error('Missing API credentials (FRONTEGG_CLIENT_ID/FRONTEGG_API_KEY)');

  // if cached and not expired (30s early), return cached
  if (cachedToken && cachedToken.expiresAt - 30_000 > Date.now()) {
    return cachedToken.accessToken;
  }

  // Step 1: vendor token
  const hasValidCachedVendor = cachedVendorToken && cachedVendorToken.expiresAt - 30_000 > Date.now();
  let vendorTokenForExchange: string;
  if (hasValidCachedVendor) {
    vendorTokenForExchange = cachedVendorToken!.token;
  } else {
    const fresh = await fetchVendorToken(base, vendorClientId, vendorSecret);
    const vendorExpiresMs = (fresh.expiresIn ? fresh.expiresIn : 300) * 1000;
    cachedVendorToken = {
      token: fresh.token,
      expiresAt: Date.now() + vendorExpiresMs,
    };
    vendorTokenForExchange = fresh.token;
  }

  // Step 2: exchange for M2M token
  const m2m = await fetchM2MToken(base, vendorTokenForExchange, apiClientId, apiSecret);

  if (!m2m.accessToken || m2m.accessToken.trim() === '') {
    throw new Error('Received empty access token from API token endpoint');
  }

  cachedToken = {
    accessToken: m2m.accessToken,
    expiresAt: Date.now() + m2m.expiresIn * 1000,
  };
  return cachedToken.accessToken;
}

export function clearTokenCache() {
  cachedToken = null;
  cachedVendorToken = null;
}
  
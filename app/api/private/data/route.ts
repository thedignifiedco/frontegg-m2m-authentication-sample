import { NextRequest, NextResponse } from 'next/server';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

const requiredScope = process.env.REQUIRED_SCOPE || 'read:demo';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return null;
  return auth.slice(7).trim();
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
    }

    const jwksUrl = process.env.FRONTEGG_JWKS_URL!;
    const issuer = process.env.FRONTEGG_ISSUER;

    const JWKS = createRemoteJWKSet(new URL(jwksUrl));
    const { payload } = await jwtVerify(token, JWKS, issuer ? { issuer } : {});

    // scopes could be space-delimited string in 'scope', or array in 'scopes'
    const scopes = getScopes(payload);
    if (!scopes.has(requiredScope)) {
      return NextResponse.json({ error: 'Forbidden: insufficient scope' }, { status: 403 });
    }

    // Return protected data
    return NextResponse.json({
      message: 'Success: protected data',
      now: new Date().toISOString(),
      subject: payload.sub ?? null,
      scopes: Array.from(scopes),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

function getScopes(payload: JWTPayload): Set<string> {
  const set = new Set<string>();
  const permissions = (payload as Record<string, unknown>).permissions;
  if (Array.isArray(permissions)) {
    for (const value of permissions) {
      if (typeof value === 'string' && value) set.add(value);
    }
  }
  return set;
}



import { NextResponse } from 'next/server';
import { getEnvToken } from '@/lib/frontegg';

export async function GET() {
  try {
    const token = await getEnvToken();
    const body = { access_token: token, token };
    if (process.env.DEBUG_FRONTEGG === '1') {
      console.log('[frontegg] /api/token response keys', Object.keys(body));
    }
    return NextResponse.json(body);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}



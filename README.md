# Frontegg M2M Demo

This demo shows a simple Machine-to-Machine (M2M) flow using Frontegg.

## How it works

- `GET /api/token` (server):
  - Fetches a vendor token using `FRONTEGG_VENDOR_CLIENT_ID`/`FRONTEGG_VENDOR_SECRET`.
  - Exchanges it for an API (M2M) token using `FRONTEGG_CLIENT_ID`/`FRONTEGG_API_KEY`.
  - Caches both vendor and API tokens until expiry.
- Frontend page calls `/api/token`, then calls `GET /api/private/data` with the API token as `Authorization: Bearer <token>`.
- `GET /api/private/data` verifies the JWT via tenant JWKS and checks scope from the token `permissions` claim (e.g. contains `read:demo`).

## Prerequisites

- Enable M2M authentication in your Frontegg Vendor Account by following the guide: https://developers.frontegg.com/guides/authentication/m2m/management
- Generate client credentials (clientId and secret) for a user either via API or Admin Portal:
  - API: https://developers.frontegg.com/api/identity/personal-tokens/userapitokensv1controller_createtenantapitoken
  - Admin Portal: https://developers.frontegg.com/guides/admin-portal/personal-modules
- Configure permissions (RBAC) so your token includes the required permission like `read:demo`: https://developers.frontegg.com/guides/authorization/rbac/permissions

## Required env variables

Create `.env.local` with:

```
FRONTEGG_API_BASE=https://api.frontegg.com
# Vendor credentials (to get vendor token)
FRONTEGG_VENDOR_CLIENT_ID=your_vendor_client_id
FRONTEGG_VENDOR_SECRET=your_vendor_secret

# API (M2M) credentials used with vendor token to get API token
FRONTEGG_CLIENT_ID=your_api_client_id
FRONTEGG_API_KEY=your_api_client_secret

# JWKS config (use your tenant domain as issuer)
FRONTEGG_JWKS_URL=https://YOUR-TENANT.frontegg.com/.well-known/jwks.json
FRONTEGG_ISSUER=https://YOUR-TENANT.frontegg.com

# Scope required by /api/private/data
REQUIRED_SCOPE=read:demo
```

## Run

```
pnpm install
pnpm run dev
```

Open the app and click "Run Demo".

## Endpoints

- `GET /api/token` → returns `{ access_token, token }` (API token)
- `GET /api/private/data` → verifies JWT (tenant JWKS) and requires `REQUIRED_SCOPE` in `permissions`

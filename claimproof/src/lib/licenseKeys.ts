import { BRAND } from '../config/brand';

/* ES256 public key for offline license JWT verification.
 * The matching PRIVATE key never ships in the app — it lives only in the Supabase
 * Edge Function secret store (production) or scripts/.license-dev-keys.json (local dev).
 * Rotate with `npm run gen:keys`, then redeploy the function. */

export const LICENSE_JWT_KID = 'cp-dev-1';

export const LICENSE_JWT_PUBLIC_JWK: JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: '-QTAa8SSqlW7XKMzlBBnXtFNWWIFvL98LO9rcUqocCU',
  y: 'xMz_FMuwRLHBZG9rF3VuNvH2XUPSf6EbgTPz4L9tA3Q'
};

export const LICENSE_ISSUER = BRAND.licenseIssuer;

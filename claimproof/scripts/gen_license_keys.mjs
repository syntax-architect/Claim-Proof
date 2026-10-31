/* Generates the ES256 (P-256) keypair used for offline-verifiable license JWTs.
 * - Public JWK  -> embedded in src/lib/licenseKeys.ts (shipped in the app).
 * - Private JWK -> scripts/.license-dev-keys.json (LOCAL DEV ONLY — never ship in production;
 *   in production the private key lives only in the Supabase Edge Function secret store).
 *
 * Run: node scripts/gen_license_keys.mjs */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });

writeFileSync(
  new URL('./.license-dev-keys.json', import.meta.url),
  JSON.stringify({ pub, priv }, null, 2)
);

console.log(
  JSON.stringify(
    {
      kid: 'cp-dev-1',
      alg: 'ES256',
      note: 'Embed the publicJwk below into src/lib/licenseKeys.ts. Keep the private key out of the shipped app.',
      publicJwk: pub
    },
    null,
    2
  )
);

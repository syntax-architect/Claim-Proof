#!/usr/bin/env node
/* ClaimProof Suite — Offline ES256 License Key Generator (Admin CLI)
 *
 * Reads the P-256 private key from environment variable:
 *   - LICENSE_SIGNING_KEY_JWK_B64 (Base64-encoded JWK) OR
 *   - LICENSE_PRIVATE_KEY (JSON string or base64)
 *   - Local fallback: scripts/.license-dev-keys.json (development only)
 *
 * Usage:
 *   node scripts/issue_license.mjs --cid cust_12345 --plan claimradar [--days 365] [--name "Store Name"]
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return Buffer.from(bin, 'binary')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }
  return parsed;
}

function loadPrivateKey() {
  // 1. Check LICENSE_SIGNING_KEY_JWK_B64
  const b64 = process.env.LICENSE_SIGNING_KEY_JWK_B64;
  if (b64) {
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch (e) {
      console.error('Failed to parse LICENSE_SIGNING_KEY_JWK_B64:', e.message);
    }
  }

  // 2. Check LICENSE_PRIVATE_KEY
  const rawKey = process.env.LICENSE_PRIVATE_KEY;
  if (rawKey) {
    try {
      if (rawKey.trim().startsWith('{')) {
        return JSON.parse(rawKey);
      }
      const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e) {
      console.error('Failed to parse LICENSE_PRIVATE_KEY:', e.message);
    }
  }

  // 3. Fallback to local dev keys file
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const devKeyPath = join(__dirname, '.license-dev-keys.json');
  if (existsSync(devKeyPath)) {
    try {
      const fileContent = JSON.parse(readFileSync(devKeyPath, 'utf8'));
      if (fileContent.priv) return fileContent.priv;
    } catch {
      // ignore
    }
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(`
ClaimProof License Key Generator
Usage:
  node scripts/issue_license.mjs --cid <customerId> [options]

Options:
  --cid <id>        Customer ID / Account ID (required)
  --plan <plan>     Plan: starter | claimradar | warehouse (default: claimradar)
  --days <days>     Validity in days (default: 365)
  --name <name>     Customer / Business name (optional)
  --seats <num>     Workstation seats (default: 3 for warehouse, 1 for others)
  --fp <fp>         Device fingerprint to bind to (optional)
  --kid <kid>       Key ID (default: cp-dev-1)
  --help, -h        Show help
    `);
    process.exit(0);
  }

  const customerId = args.cid || args.sub;
  if (!customerId) {
    console.error('Error: --cid <customerId> is required.');
    console.error('Example: node scripts/issue_license.mjs --cid cust_1001 --plan starter');
    process.exit(1);
  }

  const plan = args.plan || 'claimradar';
  const VALID_PLANS = ['starter', 'claimradar', 'warehouse'];
  if (!VALID_PLANS.includes(plan)) {
    console.error(`Error: Unknown plan "${plan}". Must be one of: ${VALID_PLANS.join(', ')}`);
    process.exit(1);
  }

  const days = Number(args.days) || 365;
  const seats = Number(args.seats) || (plan === 'warehouse' ? 3 : 1);
  const kid = args.kid || process.env.LICENSE_JWT_KID || 'cp-dev-1';

  const privJwk = loadPrivateKey();
  if (!privJwk) {
    console.error('Error: No signing key found.');
    console.error('Set LICENSE_SIGNING_KEY_JWK_B64 or LICENSE_PRIVATE_KEY environment variable.');
    process.exit(1);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + days * 24 * 3600;

  const header = {
    alg: 'ES256',
    typ: 'JWT',
    kid
  };

  const payload = {
    iss: 'https://claimproof.in',
    sub: String(customerId),
    cid: String(customerId),
    plan,
    seats,
    iat: nowSec,
    exp: expSec,
    jti: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  };

  if (args.name) payload.name = String(args.name);
  if (args.fp) payload.fp = String(args.fp);
  if (args.devices) {
    payload.devices = String(args.devices).split(',').map((s) => s.trim()).filter(Boolean);
  }

  const headerB64 = b64url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = b64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    privJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    Buffer.from(signingInput)
  );

  const sigB64 = b64url(new Uint8Array(sig));
  const token = `${signingInput}.${sigB64}`;

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          token,
          customerId,
          plan,
          seats,
          expiresAt: new Date(expSec * 1000).toISOString(),
          header,
          payload
        },
        null,
        2
      )
    );
  } else {
    console.log(token);
  }
}

main().catch((err) => {
  console.error('Fatal error issuing license:', err);
  process.exit(1);
});


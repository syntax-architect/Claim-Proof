#!/usr/bin/env node
/* SABOOT Suite — Node.js Version Guard
 * Strictly requires Node.js >= 24 (Node 24 is required by @zxing/library and SABOOT Suite).
 * Halts installation with a clear, actionable error message if executed on older Node runtimes.
 */

const [major] = process.versions.node.split('.').map(Number);

if (major < 24) {
  const red = '\x1b[31m';
  const yellow = '\x1b[33m';
  const green = '\x1b[32m';
  const bold = '\x1b[1m';
  const reset = '\x1b[0m';

  console.error(`\n${red}${bold}════════════════════════════════════════════════════════════════════════════════════${reset}`);
  console.error(`${red}${bold} [ERROR] INCOMPATIBLE NODE.JS VERSION DETECTED${reset}`);
  console.error(`${red}${bold}════════════════════════════════════════════════════════════════════════════════════${reset}\n`);
  console.error(`  SABOOT requires ${bold}Node.js version 24.0.0 or higher${reset}.`);
  console.error(`  Reason: ${yellow}@zxing/library${reset} and SABOOT Suite rely on Node 24 runtime features.`);
  console.error(`  Current version in use: ${yellow}${process.version}${reset}\n`);
  console.error(`  ${green}To resolve this, please switch to Node.js 24:${reset}`);
  console.error(`    ${bold}nvm use 24${reset}     (or: ${bold}nvm install 24 && nvm use 24${reset})`);
  console.error(`    ${bold}fnm use 24${reset}     (if using Fast Node Manager)\n`);
  console.error(`${red}${bold}════════════════════════════════════════════════════════════════════════════════════${reset}\n`);

  process.exit(1);
}

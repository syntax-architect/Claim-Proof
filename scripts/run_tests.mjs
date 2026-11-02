import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);

// Forward CLI arguments (e.g. --coverage) to claimproof tests
const cpRes = spawnSync('npm', ['--prefix', 'claimproof', 'test', '--', ...args], {
  stdio: 'inherit',
  shell: true,
});

if (cpRes.status !== 0) {
  process.exit(cpRes.status ?? 1);
}

// Run site tests
const siteRes = spawnSync('npm', ['--prefix', 'site', 'test'], {
  stdio: 'inherit',
  shell: true,
});

if (siteRes.status !== 0) {
  process.exit(siteRes.status ?? 1);
}


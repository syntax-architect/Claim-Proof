const path = require('node:path');

module.exports = {
  'claimproof/src/**/*.{ts,tsx}': (filenames) => {
    const escaped = filenames.map((f) => `"${f}"`).join(' ');
    return [
      `npx --prefix claimproof eslint --config claimproof/eslint.config.js --fix ${escaped}`,
      'npm --prefix claimproof run typecheck'
    ];
  },
  'src/**/*.{ts,tsx}': (filenames) => {
    const escaped = filenames.map((f) => `"${f}"`).join(' ');
    return [
      `npx eslint --fix ${escaped}`,
      'npm run typecheck'
    ];
  }
};

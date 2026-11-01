module.exports = {
  'src/**/*.{ts,tsx}': (filenames) => {
    const escaped = filenames.map((f) => `"${f}"`).join(' ');
    return [
      `npx eslint --fix ${escaped}`,
      'npm run typecheck'
    ];
  }
};

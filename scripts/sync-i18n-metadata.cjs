const fs = require('fs');
const path = require('path');
const ts = require(path.resolve(__dirname, '../claimproof/node_modules/typescript'));

const enPath = path.resolve(__dirname, '../claimproof/src/locales/en.ts');
const hiPath = path.resolve(__dirname, '../claimproof/src/locales/hi.ts');
const metaPath = path.resolve(__dirname, '../claimproof/src/locales/translation-metadata.json');

function extractObjectProperties(filePath, varName) {
  const code = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
  const result = {};

  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(sourceFile) === varName) {
      if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        for (const prop of node.initializer.properties) {
          if (ts.isPropertyAssignment(prop)) {
            let key = prop.name.getText(sourceFile);
            if ((key.startsWith("'") && key.endsWith("'")) || (key.startsWith('"') && key.endsWith('"'))) {
              key = key.slice(1, -1);
            }
            let val = prop.initializer.getText(sourceFile);
            if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"')) || (val.startsWith('`') && val.endsWith('`'))) {
              val = val.slice(1, -1);
            }
            result[key] = val;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

const en = extractObjectProperties(enPath, 'en');
const hi = extractObjectProperties(hiPath, 'hi');

const metadata = {
  version: '1.0.0',
  description: 'AI translation review registry for SABOOT Suite. All AI translations marked needs-review for native speaker sign-off.',
  lastUpdated: '2026-11-03',
  translations: Object.keys(en).map((key) => ({
    key,
    en: en[key] || '',
    hi: hi[key] || '',
    status: 'needs-review',
    reviewedBy: null,
    domain: key.split('.')[0]
  }))
};

fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');
console.log(`TypeScript AST extracted and synced ${metadata.translations.length} translations to translation-metadata.json`);

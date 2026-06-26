const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'test-results.json'), 'utf8'));
function walk(suite, parentTitle = '') {
  const title = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
  if (suite.specs) {
    suite.specs.forEach(spec => {
      if (spec.title === 'A5: Logout clears session' || spec.title.includes('A5: Logout clears session')) {
        console.log(JSON.stringify({suite: title, spec}, null, 2));
      }
    });
  }
  if (suite.suites) suite.suites.forEach(child => walk(child, title));
}
if (Array.isArray(data.suites)) data.suites.forEach(root => walk(root));

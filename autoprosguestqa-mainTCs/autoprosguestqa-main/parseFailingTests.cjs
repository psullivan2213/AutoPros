const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'test-results.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const failed = [];
function walk(suite, parentTitle = '') {
  const currentTitle = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
  if (suite.specs) {
    suite.specs.forEach(spec => {
      if (!spec.ok) {
        failed.push({suite: currentTitle, title: spec.title, file: spec.file, line: spec.line});
      }
    });
  }
  if (suite.suites) {
    suite.suites.forEach(child => walk(child, currentTitle));
  }
}
if (Array.isArray(data.suites)) {
  data.suites.forEach(rootSuite => walk(rootSuite));
}
console.log(JSON.stringify({failedCount: failed.length, failed}, null, 2));

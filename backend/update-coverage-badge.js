// update-coverage-badge.js
// Updates the coverage badge in backend/README.md based on coverage/coverage-summary.json

const fs = require('fs');
const path = require('path');

const coveragePath = path.join(__dirname, 'coverage', 'coverage-summary.json');
const readmePath = path.join(__dirname, 'README.md');

function getCoveragePercent() {
  if (!fs.existsSync(coveragePath)) {
    const help = [
      'coverage-summary.json not found.',
      'To generate it, run:',
      '  npm run test:coverage',
      'from the backend directory (do not add -- src/).',
      'This will create coverage/coverage-summary.json for the badge updater.'
    ].join('\n');
    throw new Error(help);
  }
  const summary = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
  // Use statements or lines coverage (choose one)
  const percent = summary.total.statements.pct || summary.total.lines.pct;
  return Math.round(percent);
}

function updateReadmeBadge(percent) {
  let readme = fs.readFileSync(readmePath, 'utf8');
  const badgeRegex = /(<img src="https:\/\/img\.shields\.io\/badge\/coverage-)(\d+)%25(-brightgreen" alt="Coverage"\/>)/;
  readme = readme.replace(badgeRegex, `$1${percent}%25$3`);
  fs.writeFileSync(readmePath, readme);
  console.log(`Updated coverage badge to ${percent}%`);
}

try {
  const percent = getCoveragePercent();
  updateReadmeBadge(percent);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

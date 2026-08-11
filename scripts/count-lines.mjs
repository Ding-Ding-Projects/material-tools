import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function git(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout;
}

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean).sort();
const rows = new Map();
const exclusions = new Map([
  ['package-lock.json', 'Lockfile'],
]);

function categoryFor(file) {
  if (exclusions.has(file)) return `Excluded: ${exclusions.get(file)}`;
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file)) return 'Tests';
  if (file.startsWith('src/')) return 'Source';
  if (file.startsWith('scripts/') || /\.bat$/i.test(file)) return 'Build and tooling';
  if (file.startsWith('.github/')) return 'Automation';
  if (file.startsWith('docs/') || /^(README|ROADMAP|HANDOFF|AGENTS|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|THIRD_PARTY_NOTICES)\.md$/i.test(file)) return 'Documentation';
  if (/\.(css|html|svg|xml)$/i.test(file)) return 'Styles and markup';
  return 'Project metadata';
}

function lineStats(file) {
  const content = readFileSync(file, 'utf8');
  if (content.length === 0) return { total: 0, nonblank: 0 };
  const lines = content.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  return { total: lines.length, nonblank: lines.filter((line) => line.trim().length > 0).length };
}

for (const file of tracked) {
  const category = categoryFor(file);
  const stats = lineStats(file);
  const current = rows.get(category) ?? { files: 0, total: 0, nonblank: 0 };
  current.files += 1;
  current.total += stats.total;
  current.nonblank += stats.nonblank;
  rows.set(category, current);
}

let agentLines = 0;
let peopleLines = 0;
for (const file of tracked.filter((candidate) => !categoryFor(candidate).startsWith('Excluded:'))) {
  const blame = spawnSync('git', ['blame', '--line-porcelain', '--root', 'HEAD', '--', file], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (blame.status !== 0) continue;
  let author = '';
  for (const line of blame.stdout.split(/\r?\n/)) {
    if (line.startsWith('author ')) author = line.slice(7);
    if (line.startsWith('\t')) {
      if (/Claude Fable 5|\[bot\]|automation/i.test(author)) agentLines += 1;
      else peopleLines += 1;
    }
  }
}

const sortedRows = [...rows.entries()].sort(([left], [right]) => left.localeCompare(right));
const projectRows = sortedRows.filter(([name]) => !name.startsWith('Excluded:'));
const projectTotal = projectRows.reduce((sum, [, value]) => sum + value.total, 0);
const projectNonblank = projectRows.reduce((sum, [, value]) => sum + value.nonblank, 0);
const grandTotal = sortedRows.reduce((sum, [, value]) => sum + value.total, 0);
const grandNonblank = sortedRows.reduce((sum, [, value]) => sum + value.nonblank, 0);

console.log('| Category | Files | Total lines | Non-blank lines |');
console.log('|---|---:|---:|---:|');
for (const [name, value] of sortedRows) console.log(`| ${name} | ${value.files} | ${value.total} | ${value.nonblank} |`);
console.log(`| **Project total** | **${projectRows.reduce((sum, [, value]) => sum + value.files, 0)}** | **${projectTotal}** | **${projectNonblank}** |`);
console.log(`| **Grand total including excluded rows** | **${tracked.length}** | **${grandTotal}** | **${grandNonblank}** |`);
console.log('');
console.log('| Surviving-line attribution | Lines |');
console.log('|---|---:|');
console.log(`| Agent-authored | ${agentLines} |`);
console.log(`| People-authored | ${peopleLines} |`);
console.log(`| **Attribution total** | **${agentLines + peopleLines}** |`);
console.log('');
console.log('Excluded: dependency lockfiles, installed dependencies, build output, generated output, and vendored third-party trees. Attribution uses surviving `git blame` lines; `Claude Fable 5`, bot, and automation authors count as agent-authored.');

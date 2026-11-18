import { execFileSync } from 'node:child_process';
// 사건 로그를 git show 로 통째로 읽는다. 기본 상한(1 MiB)을 넘으면 실행이 멈추므로 넉넉히 둔다.
const GIT_MAX_BUFFER = 1024 * 1024 * 1024;
const [base, head] = process.argv.slice(2);
if (![base, head].every((x) => x && !x.startsWith('-'))) throw new Error('base and head required');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
for (const commit of git('rev-list', `${base}..${head}`).trim().split('\n').filter(Boolean)) {
  if (!git('log', '-1', '--format=%s', commit).startsWith('tick:')) continue;
  const files = git('diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', commit).split('\0').filter(Boolean);
  const invalid = files.filter((f) => !/^(data|derived)\//.test(f));
  if (invalid.length) throw new Error(`Tick ${commit} changed forbidden paths: ${JSON.stringify(invalid)}`);
}
console.log('Tick paths verified (Unicode-safe).');

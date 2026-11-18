// Git supplies the external anchor that a hash chain alone cannot provide.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
// 사건 로그를 git show 로 통째로 읽는다. 기본 상한(1 MiB)을 넘으면 실행이 멈추므로 넉넉히 둔다.
const GIT_MAX_BUFFER = 1024 * 1024 * 1024;
export function checkHistory(base) {
  if (!base || base.startsWith('-')) throw new Error('A trusted base commit is required');
  const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER });
  const files = git('ls-tree', '-r', '--name-only', '-z', base, 'data').split('\0').filter(Boolean);
  for (const file of files) {
    if (file !== 'data/events/log.jsonl' && !/^data\/agents\/[^/]+\/history\//.test(file)) continue;
    const before = git('show', `${base}:${file}`);
    const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    if (file === 'data/events/log.jsonl' ? !now.startsWith(before) : now !== before) throw new Error('Committed history changed: ' + file);
  }
}
if (process.argv[1]?.endsWith('/check-history.mjs')) {
  checkHistory(process.argv[2]);
  console.log('Committed event prefix and historical files preserved.');
}

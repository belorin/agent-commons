// Git supplies the external anchor that a hash chain alone cannot provide.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
export function checkHistory(base) {
  if (!base || base.startsWith('-')) throw new Error('A trusted base commit is required');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
  const files = git('ls-tree', '-r', '--name-only', base, 'data').trim().split('\n').filter(Boolean);
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

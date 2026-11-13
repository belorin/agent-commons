// Trusted outer runner only. A rejected remote update remains on a local branch.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { verify } from '../src/runtime/verify.mjs';
import { loadEvents, withTransaction } from '../src/runtime/store.mjs';
import { project } from '../src/runtime/world.mjs';
import { checkHistory } from './check-history.mjs';
if (process.env.COMMONS_EXECUTOR !== '1') throw new Error('Trusted outer runner only');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
withTransaction(() => {
  const w = project(loadEvents());
  if (w.turn) throw new Error('Close or fail the turn first');
  const v = verify(); if (!v.ok) throw new Error(v.problems.join('\n'));
  checkHistory('HEAD');
  const changed = new Set([...git('diff', '--name-only', 'HEAD').split('\n'), ...git('ls-files', '--others', '--exclude-standard').split('\n')].filter(Boolean));
  if ([...changed].some((f) => !/^(data|derived)\//.test(f))) throw new Error('Non-turn changes present; use a separate development checkout');
  if (!changed.size) { console.log('Nothing to commit'); return; }
  const turn = [...loadEvents()].reverse().find((e) => e.turn_id);
  const branch = `runs/${turn?.turn_id || 'system'}-${crypto.randomUUID().slice(0, 8)}`;
  git('switch', '-c', branch);
  git('add', '--', 'data', 'derived');
  git('commit', '-m', `tick: ${turn?.turn_id || 'system'} ${turn?.agent_id || 'runtime'}`);
  try {
    git('fetch', 'origin', 'main');
    checkHistory('origin/main');
    git('push', 'origin', 'HEAD:main');
    console.log(`Committed ${git('rev-parse', 'HEAD')} to main`);
  } catch (e) {
    console.error(`Remote main was not updated. Preserve local branch ${branch}; do not merge divergent event chains or reset it.\n${e.stderr?.toString() || e.message}`);
    process.exitCode = 4;
  }
});

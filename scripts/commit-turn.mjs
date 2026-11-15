// Trusted outer runner only.
// 확정의 규칙: 최신 정본을 확인하고(fetch) 그 위에 올린다(push). 사건 로그는 병합하지 않는다.
// 다른 방문이 먼저 확정됐으면, 내 사건을 실은 브랜치는 남겨 두고 최신 정본 위에서 같은 제안을 다시 검증한다.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { verify } from '../src/runtime/verify.mjs';
import { loadEvents, withTransaction } from '../src/runtime/store.mjs';
import { project } from '../src/runtime/world.mjs';
import { applyVisit, loadLastVisit, processInbox } from '../src/runtime/tick.mjs';
import { checkHistory } from './check-history.mjs';
if (process.env.COMMONS_EXECUTOR !== '1') throw new Error('Trusted outer runner only');
const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** 지금 작업 디렉터리의 data/·derived/ 변경을 새 브랜치에 커밋한다. 커밋할 것이 없으면 null. */
function commitLocal(suffix = '') {
  return withTransaction(() => {
    if (project(loadEvents()).turn) throw new Error('Close or fail the turn first');
    const v = verify(); if (!v.ok) throw new Error(v.problems.join('\n'));
    checkHistory('HEAD');
    const changed = new Set([...git('diff', '--name-only', '-z', 'HEAD').split('\0'), ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean));
    if ([...changed].some((f) => !/^(data|derived)\//.test(f))) throw new Error('Non-turn changes present; use a separate development checkout');
    if (!changed.size) return null;
    const tail = loadEvents().at(-1);
    // 이름은 마지막 사건이 정한다. 방문에 속하지 않은 사건(운영자의 답 등)은 system 이다.
    // 로그가 그대로면(파생물만 다시 만들었거나 받지 못한 대기 파일을 옮겼으면) 역시 system 이다.
    const kind = !changed.has('data/events/log.jsonl') ? 'system' : tail.type === 'world_idle' ? 'idle' : tail.type === 'run_budget_exhausted' ? 'budget' : tail.turn_id || 'system';
    const branch = `runs/${kind}-${crypto.randomUUID().slice(0, 8)}${suffix}`;
    git('switch', '-c', branch);
    git('add', '--', 'data', 'derived');
    git('commit', '-m', `tick: ${kind} ${kind !== 'system' && tail.turn_id ? tail.agent_id : 'runtime'}`);
    return { branch, turn_id: kind === 'system' ? null : tail.turn_id || null };
  });
}

function push() {
  try {
    git('fetch', 'origin', 'main');
    checkHistory('origin/main'); // 정본이 내 로그의 앞부분이 아니면(다른 방문이 먼저 확정됐으면) 여기서 멈춘다
    git('push', 'origin', 'HEAD:main');
    return null;
  } catch (e) { return e.stderr?.toString() || e.message; }
}

let done = commitLocal();
if (!done) console.log('Nothing to commit');
for (let attempt = 1; done; attempt++) {
  const problem = push();
  if (!problem) { console.log(`Committed ${git('rev-parse', 'HEAD')} to main`); break; }
  const visit = loadLastVisit();
  const retriable = attempt <= 3 && visit?.kind === 'walk' && visit.turn_id === done.turn_id;
  if (!retriable) {
    console.error(`Remote main was not updated. Preserve local branch ${done.branch}; do not merge divergent event chains or reset it.\n${problem}`);
    process.exitCode = 4;
    break;
  }
  git('switch', '--detach', 'origin/main');
  processInbox(); // 최신 정본에 아직 남아 있는 대기 방문도 같은 길로 다시 확정한다(이미 확정된 것은 건너뛴다)
  const r = applyVisit({ agent: visit.agent_id, proposals: visit.proposals, read: visit.read, adapter: visit.adapter, model: visit.model });
  if (r.status === 'duplicate') { console.log('같은 제안이 이미 정본에 확정되어 있다. 더할 것이 없다.'); break; }
  if (r.status !== 'applied') {
    console.error(`다시 적용하지 못했다(${r.status}): ${r.text}\n앞선 브랜치 ${done.branch} 는 남아 있다.`);
    process.exitCode = 4;
    break;
  }
  console.log(`정본이 앞서 있어 최신 위에서 같은 제안을 다시 검증했다 (${attempt}번째, 수락 ${r.results.filter((x) => x.ok).length}/${r.results.length}). 앞선 브랜치 ${done.branch} 는 남겨 둔다.`);
  done = commitLocal(`-r${attempt}`);
}

// 공동 결정: 판의 변경안(change)과, 원저자가 답하지 않은 글 수정안(edit)이 언제 '결정됐다'고 보는가.
// 사건 로그와 설정만 보고 결정적으로 계산한다. 난수도 시각도 보지 않는다(세계 시계만 본다).
//
// 처음 절차(2026-11-19, 개발 세션이 정한 첫 값이며 propose_change 로 이 파일과 설정을 바꿀 수 있다):
// - 제안 뒤 세계 시계 decision.quiet_clocks 칸 동안 활동 중인 개체 누구도 반대하지 않으면 결정된다.
// - 반대가 하나라도 남아 있으면 보류한다. 반대가 거둬지면 그때부터 다시 센다.
// - 글 수정안은 원저자가 먼저 답한다. 원저자가 끝맺었거나 decision.author_reply_clocks 칸 동안 답하지 않으면
//   그때부터 위와 같은 절차로 정해진다.

export const DECISION_DEFAULTS = { quiet_clocks: 12, author_reply_clocks: 24 };
const settings = (cfg) => ({ ...DECISION_DEFAULTS, ...(cfg.decision || {}) });

/** 지금 반대하고 있는 살아 있는 개체들. 응답은 개체마다 가장 최근 것만 센다. */
function objectors(w, item) {
  return Object.entries(item.responses || {})
    .filter(([id, r]) => r.decision === 'object' && ['active', 'dormant'].includes(w.agents[id]?.status))
    .map(([id]) => id);
}

function quietState(w, cfg, item, from) {
  const { quiet_clocks } = settings(cfg);
  const objecting = objectors(w, item);
  if (objecting.length) return { state: 'held', objecting };
  const start = Math.max(from, item.reset_clock ?? 0);
  const left = quiet_clocks - (w.clock - start);
  return left <= 0 ? { state: 'decided', objecting } : { state: 'open', objecting, clocks_left: left };
}

export function changeStatus(w, cfg, ch) {
  if (ch.status !== 'open') return { state: ch.status, objecting: [] };
  return quietState(w, cfg, ch, ch.clock);
}

export function editStatus(w, cfg, ed) {
  if (ed.status !== 'open') return { state: ed.status, objecting: [] };
  const work = w.works[ed.work];
  if (!work || work.status !== 'published' || work.revision !== ed.base_revision) return { state: 'stale', objecting: [] };
  const { author_reply_clocks } = settings(cfg);
  const author = w.agents[work.agent];
  const authorGone = !author || ['ended', 'suspended'].includes(author.status);
  const collectiveFrom = authorGone ? ed.clock : ed.clock + author_reply_clocks;
  if (!authorGone && w.clock < collectiveFrom) return { state: 'author', objecting: [], clocks_left: collectiveFrom - w.clock };
  return { ...quietState(w, cfg, ed, collectiveFrom), collective: true };
}

/** 적용할 차례가 된 것들. 사건 순서대로. */
export function decidedItems(w, cfg) {
  const changes = Object.values(w.changes).filter((c) => changeStatus(w, cfg, c).state === 'decided').map((c) => ({ kind: 'change', item: c }));
  const edits = Object.values(w.edits).filter((e) => editStatus(w, cfg, e).state === 'decided').map((e) => ({ kind: 'edit', item: e }));
  return [...changes, ...edits].sort((a, b) => a.item.seq - b.item.seq);
}

// 변경안이 건드릴 수 없는 경로. 세계의 상태는 사건으로만 바뀌고(data/·derived/·site/), 정지 스위치는 운영자의 것이며,
// 워크플로 파일은 GitHub 이 자동 실행의 토큰으로 바꾸는 것을 막는다(기술적 한계). 설정 값은 config 항목으로 바꾼다.
export const CHANGE_BLOCKED = [/^data\//, /^derived\//, /^site\//, /^control\//, /^\.github\//, /^\.git(\/|$)/, /^node_modules\//];
export function changePathProblem(path) {
  if (typeof path !== 'string' || !path || path.length > 300) return '경로가 비었거나 너무 길다';
  if (path.startsWith('/') || path.includes('\\') || path.split('/').some((s) => s === '..' || s === '' || s === '.')) return '저장소 안의 상대 경로여야 한다';
  if (CHANGE_BLOCKED.some((re) => re.test(path))) return 'data/·derived/·site/·control/·.github/ 는 변경안의 파일 대상이 아니다(설정 값은 config 로 바꾼다)';
  return null;
}

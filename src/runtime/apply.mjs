// 공동 결정의 집행. 실행기(자동 실행)가 부른다. 개체의 행동이 아니다.
// 결정됐는지는 decisions.mjs 가 사건 로그로 판단하고, 여기서는 그 결과를 사건으로 남기고 파일을 쓴다.
import { appendEvent, withTransaction, loadEvents, loadConfig, agentDir, writeText, sha256 } from './store.mjs';
import { project } from './world.mjs';
import { verify } from './verify.mjs';
import { regenerate } from './derive.mjs';
import { decidedItems, editStatus, changeStatus } from './decisions.mjs';

export const pendingDecisions = () => withTransaction(() => {
  const w = project(loadEvents());
  return decidedItems(w, loadConfig()).map(({ kind, item }) => ({ kind, id: item.id, title: item.title }));
});

/** 원저자가 답하지 않아 공동 결정으로 정해진 글 수정안을 원저자의 글에 새 판으로 낸다. 작성자 표시는 원저자, 수정한 개체는 edited_by. */
export function applyEdit(id) {
  return withTransaction(() => {
    const v = verify(); if (!v.ok) throw new Error(v.problems.join('\n'));
    const cfg = loadConfig(), events = loadEvents(), w = project(events);
    const ed = w.edits[id];
    if (!ed || editStatus(w, cfg, ed).state !== 'decided') throw new Error(`${id}: 결정된 수정안이 아니다`);
    if (w.turn) throw new Error('열린 방문이 있다');
    const work = w.works[ed.work];
    const content = events.find((e) => e.type === 'edit_proposed' && e.payload.id === id).payload.content;
    const revision = work.revision + 1;
    writeText(agentDir(work.agent, 'public', work.slug + '.md'), content);
    writeText(agentDir(work.agent, 'history', 'works', `${work.slug}.r${revision}.md`), content);
    appendEvent({ type: 'work_published', agent_id: work.agent, actor_id: 'runtime', visibility: 'public',
      payload: { slug: work.slug, title: ed.title, revision, hash: sha256(content), provenance: work.provenance, links: work.links, sources: work.sources, edited_by: ed.by, from_edit: id, by_decision: true } });
    regenerate();
    return `${work.key} r${revision} (수정안 ${id}, 공동 결정)`;
  });
}

/** 변경안 적용의 결과를 사건으로 남긴다. 파일 반영과 검사는 scripts/apply-decided.mjs 가 한다. */
export function recordChange(id, outcome, { base_commit = null, reason = null } = {}) {
  return withTransaction(() => {
    const cfg = loadConfig(), w = project(loadEvents());
    const ch = w.changes[id];
    if (!ch || changeStatus(w, cfg, ch).state !== 'decided') throw new Error(`${id}: 결정된 변경안이 아니다`);
    appendEvent(outcome === 'applied'
      ? { type: 'change_applied', actor_id: 'runtime', visibility: 'public', payload: { change: id, base_commit } }
      : { type: 'change_failed', actor_id: 'runtime', visibility: 'public', payload: { change: id, reason: String(reason || '사유 없음').slice(0, 4000) } });
    regenerate();
  });
}

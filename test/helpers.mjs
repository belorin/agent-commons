// 수용 테스트의 공통 준비. 각 *.test.mjs 는 별도 프로세스에서 돌아(node --test 가 병렬로 실행) 서로의 임시 루트를 보지 않는다.
// 이 모듈을 불러온 테스트 파일마다 beforeEach 가 새 임시 루트를 만든다.
import { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
export { spawnSync, execFileSync };

export let root;
export const S = await import('../src/runtime/store.mjs');
export const { project } = await import('../src/runtime/world.mjs');
export const tickMod = await import('../src/runtime/tick.mjs');
export const { openTurn, closeTurn, failTurn, seedAgent } = tickMod;
export const { applyAction, ACTIONS } = await import('../src/runtime/actions.mjs');
export const { read } = await import('../src/runtime/read.mjs');
export const { verify } = await import('../src/runtime/verify.mjs');
export const { regenerate, buildSite } = await import('../src/runtime/derive.mjs');
/** 실행기 CLI 의 경로(자식 프로세스로 띄울 때). */
export const CLI = new URL('../src/cli.mjs', import.meta.url).pathname;

export const world = () => project(S.loadEvents());
export const config = (c) => S.writeText(S.p('control', 'config.json'), JSON.stringify(c));
export const act = (a) => applyAction(a);
/** 한 회차를 열고 행동들을 넣고 닫는다. */
export function turn(actions = []) {
  const t = openTurn();
  assert.equal(t.status, 'open', t.text);
  const results = actions.map(act);
  closeTurn();
  return { ...t, results };
}
/** 운영자가 개체의 휴면 요청을 통과시킨다(cli approve-dormancy 와 같은 사건). */
export function approveDormancy(id) {
  const r = world().agents[id].dormancy_request;
  assert.ok(r, `${id} 의 휴면 요청이 없다`);
  S.appendEvent({ type: 'agent_dormant', agent_id: id, actor_id: 'operator', visibility: 'public', caused_by: [r.event_id], payload: { note: r.note, wake: r.wake, request: r.event_id } });
}
export const allFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, String(f))).filter((f) => fs.statSync(f).isFile()) : []);


beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'commons-'));
  process.env.COMMONS_ROOT = root;
  config({ seed_population: 2, max_turns_per_day: 500, birth: { min_turns_between_births: 0 } });
});

// ── 일과, 저녁, 잠 (evening 기능) 공통 ──
export const EVENING = { seed_population: 2, max_turns_per_day: 500, dream: { enabled: true, url: 'https://words.test/api?count=3', timeout_ms: 1000 } };
export const enableEvening = () => S.appendEvent({ type: 'feature_enabled', actor_id: 'operator', visibility: 'public', payload: { feature: 'evening' } });
/** 잠들기: 저녁의 사생활 하나와 꿈. */
export const bed = (dream = '물가의 꿈') => { act({ action: 'write_private', content: '저녁의 한 줄' }); act({ action: 'review_self', map: '지금의 나: 물가에 있다.' }); return act({ action: 'sleep', dream }); };
/** 하루 방문 하나: 일과 행동 → close(저녁 시작) → 저녁 행동 → sleep → close */
export function day(dayActions = [], eveningActions = []) {
  const t = openTurn();
  assert.equal(t.status, 'open', t.text);
  const d = dayActions.map(act);
  if (t.kind !== 'evening') assert.equal(closeTurn().state, 'evening');
  const e = [{ action: 'write_private', content: '저녁의 한 줄' }, ...eveningActions, { action: 'review_self', map: '지금의 나: 물가에 있다.' }].map(act);
  assert.equal(act({ action: 'sleep', dream: '물가의 꿈' }).ok, true);
  assert.equal(closeTurn().ok, true);
  return { ...t, d, e };
}

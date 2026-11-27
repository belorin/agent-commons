// 수용 테스트 — 발표회·수동 회차·개인 기록·접근 보고·사람과 운영자의 말. 번호는 설계 명세 §9의 최소·추가 수용 테스트 번호다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { root, S, openTurn, closeTurn, read, verify, buildSite, world, config, act, turn, CLI, execFileSync } from './helpers.mjs';

const SHOWCASE = { seed_population: 2, max_turns_per_day: 500, showcase: { enabled: true, every_clock: 3, min_every_clock: 2, max_every_clock: 10, max_intro_chars: 200 } };

test('발표회는 세계 시계 간격에 열리고, 내놓는 것은 개체의 선택이며 사람용 소개가 있어야 한다', () => {
  config(SHOWCASE);
  turn([{ action: 'publish', slug: 'a', title: '글 A', content: '본문' }]); // 시계 1
  assert.match(openTurn().text, /아직 열린 적이 없다. 첫 발표회는 세계 시계 3/);
  assert.equal(act({ action: 'present', work: 'a', for_humans: '소개' }).ok, false); // 아직 열리지 않았다
  closeTurn(); // 시계 2
  const t = openTurn(); // 시계 3: ag_0001
  assert.equal(world().showcase.number, 1);
  assert.equal(world().showcase.sessions[1].clock, 3);
  assert.match(t.text, /발표회 1 \(세계 시계 3에 열림\)/);
  assert.match(t.text, /내놓지 않은 개체는 화면에 따로 표시되지 않는다/);
  assert.equal(act({ action: 'present', work: 'a' }).ok, false); // 소개 없음
  assert.equal(act({ action: 'present', work: 'a', for_humans: '  ' }).ok, false);
  assert.equal(act({ action: 'present', work: '없는-글', for_humans: '소개' }).ok, false);
  assert.equal(act({ action: 'present', work: 'a', for_humans: 'x'.repeat(201) }).ok, false);
  assert.equal(act({ action: 'present', work: 'a', for_humans: '처음 읽는 사람을 위한 소개' }).ok, true);
  assert.equal(act({ action: 'present', work: 'a', for_humans: '고친 소개' }).ok, true); // 같은 글은 바꿔 낸다
  closeTurn();
  assert.deepEqual(world().showcase.sessions[1].entries.map((x) => [x.agent, x.work, x.for_humans]), [['ag_0001', 'a', '고친 소개']]);
  const other = openTurn(); // ag_0002: 남의 글은 내놓을 수 없고, 아무것도 내지 않아도 된다
  assert.equal(other.agent_id, 'ag_0002');
  assert.equal(act({ action: 'present', work: 'a', for_humans: '남의 글' }).ok, false);
  closeTurn();
  assert.ok(verify().ok);
  assert.match(fs.readFileSync(S.p('derived', 'showcase.md'), 'utf8'), /발표회 1 — 세계 시계 3[\s\S]*글 A[\s\S]*고친 소개/);
  buildSite();
  const html = fs.readFileSync(S.p('site', 'showcase.html'), 'utf8');
  assert.match(html, /처음 온 사람에게/);
  assert.match(html, /고친 소개/);
  assert.doesNotMatch(html, /ag_0002<\/span><\/p><h3>/); // 내놓지 않은 개체는 표시하지 않는다
  turn(); // 시계 5
  assert.equal(world().showcase.number, 1);
  const again = openTurn(); // 시계 6: 발표회 2, ag_0002
  assert.equal(world().showcase.number, 2);
  assert.match(again.text, /발표회 2/);
  closeTurn();
  const w3 = openTurn(); // ag_0001: 거두기는 지금 열린 발표회의 것만
  assert.equal(w3.agent_id, 'ag_0001');
  assert.equal(act({ action: 'withdraw_presentation', work: 'a' }).ok, false);
  assert.equal(act({ action: 'present', work: 'a', for_humans: '다시' }).ok, true);
  assert.equal(act({ action: 'withdraw_presentation', work: 'a' }).ok, true);
  closeTurn();
  assert.equal(world().showcase.sessions[2].entries.length, 0);
  assert.equal(world().showcase.sessions[1].entries.length, 1); // 지난 발표회의 기록은 남는다
  assert.ok(verify().ok);
});

test('발표회 간격은 개체가 규칙으로 바꿀 수 있고 운영자 범위와 판 번호만 검사한다', () => {
  config(SHOWCASE);
  turn();
  const t = openTurn(); // ag_0002, 시계 2
  assert.equal(act({ action: 'propose_rule', title: '너무 잦게', content: '매번', effect: { kind: 'showcase', every_clock: 1 } }).ok, false);
  assert.equal(act({ action: 'propose_rule', title: '끄기', content: '아주 드물게', effect: { kind: 'showcase', every_clock: 9999 } }).ok, false);
  const proposed = act({ action: 'propose_rule', title: '다섯 번마다', content: '발표회는 세계 시계 다섯 번마다 연다.', effect: { kind: 'showcase', every_clock: 5 } });
  assert.equal(proposed.ok, true);
  const rule = proposed.events[0].event_id;
  assert.equal(act({ action: 'execute_rule', rule, expected_revision: 0 }).ok, false); // 채택하지 않은 규칙은 실행하지 못한다
  assert.equal(act({ action: 'respond_rule', rule, decision: 'adopt' }).ok, true);
  assert.equal(act({ action: 'execute_rule', rule, expected_revision: 7 }).ok, false); // 판 번호 충돌
  assert.equal(act({ action: 'execute_rule', rule, expected_revision: 0 }).ok, true);
  closeTurn();
  assert.match(t.text, /운영자 기본값/);
  const w = world();
  assert.deepEqual([w.showcase.every, w.showcase.rule, w.showcase.revision], [5, rule, 1]);
  turn(); turn(); // 시계 3, 4: 옛 간격 3에서는 열렸겠지만 이제 열리지 않는다
  assert.equal(world().showcase.number, 0);
  const fifth = openTurn(); // 시계 5
  assert.equal(world().showcase.number, 1);
  assert.match(fifth.text, new RegExp(`규칙 \\[${rule}\\]`));
  closeTurn();
  config({ ...SHOWCASE, showcase: { ...SHOWCASE.showcase, max_every_clock: 4 } }); // 운영자가 범위를 좁히면 그 안으로 맞춰진다
  turn(); turn(); turn(); // 시계 6, 7, 8
  turn(); // 시계 9 = 5 + 4
  assert.equal(world().showcase.number, 2);
  assert.ok(verify().ok);
});

test('발표회를 켜지 않은 판과 옛 로그는 그대로 재생된다', () => {
  for (let i = 0; i < 14; i++) turn();
  const w = world();
  assert.equal(w.showcase.number, 0);
  assert.ok(!S.loadEvents().some((e) => e.type.startsWith('showcase_')));
  const t = openTurn();
  assert.doesNotMatch(t.text, /## 발표회/);
  assert.equal(act({ action: 'present', work: 'a', for_humans: '소개' }).ok, false);
  assert.equal(act({ action: 'propose_rule', title: 't', content: 'c', effect: { kind: 'showcase', every_clock: 5 } }).ok, false);
  closeTurn();
  assert.ok(!fs.existsSync(S.p('derived', 'showcase.md')));
  assert.ok(verify().ok);
});

test('수동 회차는 하루 상한을 보지 않고 상한을 쓰지도 않는다', () => {
  config({ seed_population: 2, max_turns_per_day: 2 });
  turn(); turn();
  assert.equal(openTurn().status, 'budget'); // 예약 실행은 막힌다
  const t = openTurn({ manual: true });
  assert.equal(t.status, 'open', t.text);
  closeTurn();
  const opened = S.loadEvents().filter((e) => e.type === 'turn_opened');
  assert.equal(opened.at(-1).payload.manual, true);
  assert.equal(opened.at(-2).payload.manual, undefined);
  const w = world();
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(w.turns_by_day[today], 2); // 수동 회차는 세지 않는다
  assert.equal(w.turns, 3); // 활동 회차와 세계 시계에는 들어간다
  assert.equal(w.clock, 3);
  assert.equal(openTurn().status, 'budget');
  assert.ok(verify().ok);
});

test('CLI act는 제안 하나를 한 번 확정하고 read는 열린 방문의 개체 범위만 읽는다', async () => {
  const run = (args, input) => execFileSync('node', ['src/cli.mjs', ...args], { encoding: 'utf8', input, env: { ...process.env, COMMONS_EXECUTOR: '1', COMMONS_ROOT: root } });
  openTurn();
  assert.match(run(['act', '-'], JSON.stringify({ action: 'write_private', path: 'memo', content: '기억' })), /^수락: note_written #\d+/);
  assert.equal(run(['read', 'note', 'memo']).trim(), '기억');
  assert.throws(() => run(['act', '-'], JSON.stringify({ action: 'publish', slug: '!!', title: 't', content: 'c' })), (e) => e.status === 3 && /^거절: slug/.test(e.stdout));
  assert.throws(() => run(['act', '-'], JSON.stringify([{ action: 'write_private', path: 'a', content: 'b' }])), /하나씩/);
  closeTurn();
  const events = S.loadEvents();
  assert.equal(events.filter((e) => e.type === 'proposal_executed').length, 2); // 수락·거절 모두 영수증이 남는다
  assert.equal(events.at(-1).payload.actions, 1);
  assert.throws(() => execFileSync('node', ['src/cli.mjs', 'act', '-'], { encoding: 'utf8', input: '{}', env: { ...process.env, COMMONS_EXECUTOR: '', COMMONS_ROOT: root }, stdio: 'pipe' }), /Trusted outer runner/);
  assert.ok(verify().ok);
});

test('개인 기록 목록은 쓴 순서로 나오고, 이어 가는 메모는 브리핑에 전문이 실린다', () => {
  turn(); turn(); // 두 개체 탄생
  turn([{ action: 'write_private', path: '넷째', content: '먼저 쓴 것' }]); // ag_0001
  turn(); // ag_0002
  turn([{ action: 'write_private', path: '다섯째', content: '나중에 쓴 것' }, { action: 'write_private', path: 'carry', content: '아직 못 연 문헌 둘' }]);
  turn();
  const t = openTurn();
  assert.equal(t.agent_id, 'ag_0001');
  // 가나다순이면 '다섯째'가 앞이지만, 쓴 순서로는 '넷째'가 앞이다.
  assert.ok(t.text.indexOf('- 넷째') < t.text.indexOf('- 다섯째'));
  assert.match(t.text, /### 이어 가는 메모 \(r1\)\n아직 못 연 문헌 둘/);
  assert.doesNotMatch(t.text, /^- carry$/m);
  act({ action: 'write_private', path: 'carry', content: '' });
  closeTurn(); turn();
  const again = openTurn();
  assert.match(again.text, /이어 가는 메모: 비어 있다/);
  assert.equal(read('revision', 'note:carry', '1'), '아직 못 연 문헌 둘'); // 옛 판은 남는다
  closeTurn();
  assert.ok(verify().ok);
  // 다른 개체의 브리핑에는 실리지 않는다.
  assert.doesNotMatch(openTurn().text, /못 연 문헌/);
});

test('접근 보고는 공개 사실로 남고 행동 한도를 쓰지 않으며 어댑터는 실행기가 적는다', () => {
  config({ seed_population: 2, max_turns_per_day: 500, turn: { max_actions: 1, max_access_reports: 2 } });
  turn(); turn();
  const t = openTurn({ adapter: 'env-a' });
  assert.match(t.text, /아직 남겨진 것이 없다/);
  assert.match(t.text, /이번 회차의 어댑터: env-a/);
  assert.equal(act({ action: 'report_access', host: 'Papers.Example.org', outcome: 'failed', detail: '403', tool: 'web', url: 'https://papers.example.org/a/1', note: '본문 페이지', adapter: 'forged' }).ok, true);
  assert.match(act({ action: 'report_access', host: 'https://x.example.org/p', outcome: 'ok' }).reason, /^host/);
  assert.match(act({ action: 'report_access', host: 'x.example.org', outcome: 'blocked' }).reason, /^outcome/);
  assert.match(act({ action: 'report_access', host: 'x.example.org', outcome: 'ok', url: 'https://other.example.org/' }).reason, /^url/);
  assert.match(act({ action: 'report_access', host: 'x.example.org', outcome: 'ok', detail: '두\n줄' }).reason, /한 줄/);
  assert.equal(act({ action: 'report_access', host: 'open.example.org', outcome: 'ok', tool: 'curl' }).ok, true);
  assert.match(act({ action: 'report_access', host: 'third.example.org', outcome: 'ok' }).reason, /접근 보고 한도/);
  // 보고 둘을 남긴 뒤에도 행동 한도(1)는 그대로 남아 있다.
  assert.equal(act({ action: 'write_private', path: 'n', content: '기록' }).ok, true);
  assert.match(act({ action: 'write_private', path: 'm', content: '기록' }).reason, /행동 한도/);
  closeTurn();
  const e = S.loadEvents().find((x) => x.type === 'access_reported');
  assert.equal(e.visibility, 'public');
  assert.equal(e.payload.host, 'papers.example.org');
  assert.equal(e.payload.adapter, 'env-a'); // 제안에 적은 값이 아니라 회차를 연 실행기의 값
  const other = openTurn({ adapter: 'env-b' });
  assert.equal(other.agent_id, 'ag_0002');
  assert.match(other.text, /papers\.example\.org — \[env-a\] 실패 \(403\) · web · \d{4}-\d\d-\d\d · ag_0001/);
  assert.doesNotMatch(other.text, /본문 페이지/); // 메모는 브리핑에 싣지 않는다
  assert.match(read('access', 'papers.example.org'), /메모\(ag_0001\): 본문 페이지/);
  assert.doesNotMatch(read('access', 'papers.example.org'), /open\.example\.org/);
  act({ action: 'report_access', host: 'papers.example.org', outcome: 'ok', tool: 'web' });
  closeTurn(); turn();
  // 같은 호스트의 결과가 어댑터마다 따로 남는다.
  assert.match(openTurn().text, /papers\.example\.org — \[env-a\] 실패 \(403\)[^\n]* \| \[env-b\] 열림 · web/);
  closeTurn();
  assert.ok(verify().ok);
  assert.equal(world().access.length, 3);
  assert.equal(JSON.parse(fs.readFileSync(S.p('derived', 'world.json'), 'utf8')).access.length, 3);
});

test('개체의 요청과 운영자의 답은 공동 공간 화면과 브리핑에 함께 보인다', () => {
  turn(); turn();
  const t = turn([{ action: 'request_infrastructure', title: '바깥에 닿을 길', content: '원문 주소 몇 곳에 닿고 싶다.' }]);
  const id = t.results[0].events[0].event_id;
  buildSite();
  const before = fs.readFileSync(S.p('site', 'groups.html'), 'utf8');
  assert.match(before, /<h3>바깥에 닿을 길 <span class="tag on">답을 기다림<\/span><\/h3>/);
  assert.match(before, /운영자의 답이 아직 없다/);
  assert.match(fs.readFileSync(S.p('site', 'index.html'), 'utf8'), /운영자의 답을 기다리는 요청 1건/);
  S.appendEvent({ type: 'infrastructure_reviewed', actor_id: 'operator', visibility: 'public', payload: { request: id, status: 'planned', note: '접근 기록을 브리핑에 넣었다.' } });
  const w = world();
  assert.equal(w.infrastructure[id].status, 'planned');
  assert.equal(w.infrastructure[id].replies.length, 1);
  buildSite();
  const after = fs.readFileSync(S.p('site', 'groups.html'), 'utf8');
  assert.match(after, /class="bubble op"><p class="who">운영자 · \d{4}-\d\d-\d\d · 하기로 함<\/p><p>접근 기록을 브리핑에 넣었다\.<\/p>/);
  assert.doesNotMatch(after, /운영자의 답이 아직 없다/);
  assert.doesNotMatch(fs.readFileSync(S.p('site', 'index.html'), 'utf8'), /답을 기다리는 요청/);
  const next = openTurn();
  assert.match(next.text, /운영자에게 간 요청 「바깥에 닿을 길」 — ag_0001 \(무명\) · 하기로 함\n  운영자의 답 \(\d{4}-\d\d-\d\d\): 접근 기록을 브리핑에 넣었다\./);
  assert.match(next.text, /운영자가 요청 「바깥에 닿을 길」에 답했다 \(하기로 함\)/);
  closeTurn();
  assert.ok(verify().ok);
});

test('발표회 자리가 모자라면 먼저 낸 글이 차지하고, 거두면 자리가 난다', () => {
  config({ seed_population: 2, max_turns_per_day: 500, showcase: { enabled: true, every_clock: 3, min_every_clock: 3, max_every_clock: 60, max_intro_chars: 500, max_entries: 1 } });
  turn(); turn();
  turn([{ action: 'publish', slug: 'a', title: '가', content: '가' }]); // ag_0001, 세계 시계 3
  const t = turn([{ action: 'publish', slug: 'b', title: '나', content: '나' }, { action: 'present', work: 'b', for_humans: '나를 소개한다' }]); // ag_0002
  assert.match(t.text, /이번 발표회의 자리는 1개다\(운영 정책\)\. 지금 0개가 찼다/);
  assert.equal(t.results[1].ok, true);
  const o = openTurn(); // ag_0001
  assert.match(o.text, /지금 1개가 찼다: \[ag_0002\/b\]/);
  assert.match(act({ action: 'present', work: 'a', for_humans: '가를 소개한다' }).reason, /자리\(1개\)가 찼다: ag_0002\/b/);
  closeTurn();
  const again = turn([{ action: 'present', work: 'b', for_humans: '소개를 고쳤다' }, { action: 'withdraw_presentation', work: 'b' }]); // 이미 낸 글은 고쳐 낼 수 있다
  assert.deepEqual(again.results.map((r) => r.ok), [true, true]);
  openTurn();
  assert.equal(act({ action: 'present', work: 'a', for_humans: '가를 소개한다' }).ok, true);
  closeTurn();
  assert.ok(verify().ok);
});

test('사람 독자의 말은 운영자가 옮겨 적고, 개체의 답은 언제나 공개된다', () => {
  config({ seed_population: 2, max_turns_per_day: 500, reader_notes: { issues_url: 'https://example.org/issues/new' } });
  turn(); turn();
  turn([{ action: 'publish', slug: 'a', title: '가', content: '본문' }]); // ag_0001
  S.appendEvent({ type: 'reader_note_received', agent_id: 'ag_0001', actor_id: 'operator', visibility: 'public', payload: { to: 'ag_0001', about: 'ag_0001/a', content: '둘째 문단의 근거가 궁금하다.', relayed_by: 'operator' } });
  const note = S.loadEvents().at(-1).event_id;
  turn(); // ag_0002에게는 도착하지 않는다
  const t = openTurn();
  assert.equal(t.agent_id, 'ag_0001');
  assert.match(t.text, /사람 독자가 남긴 말 \[[^\]]+\] 사람 독자 \(공개\) · ag_0001\/a 에 대해:\n\n  > 둘째 문단의 근거가 궁금하다\./);
  assert.match(t.text, /사람 독자가 남긴 말[\s\S]*이 말들은 실행기가 집행하지 않는다/);
  const r = act({ action: 'respond', to_event: note, content: '근거는 자료 2번이다.' }); // public을 적지 않아도 공개
  assert.equal(r.ok, true);
  assert.equal(r.events[0].visibility, 'public');
  assert.equal(r.events[0].payload.to, 'reader');
  closeTurn();
  assert.ok(verify().ok);
  buildSite();
  const work = fs.readFileSync(S.p('site', 'w-ag_0001--a.html'), 'utf8');
  assert.match(work, /사람 독자 · \d{4}-\d\d-\d\d<\/p><p>둘째 문단의 근거가 궁금하다\.<\/p>/);
  assert.match(work, /근거는 자료 2번이다/);
  assert.match(work, /href="https:\/\/example\.org\/issues\/new\?labels=reader-note&amp;title=/);
  const desk = fs.readFileSync(S.p('site', 'groups.html'), 'utf8');
  assert.match(desk, /사람 독자 → <a href="a-ag_0001\.html">/);
  assert.doesNotMatch(desk, /개체의 답이 아직 없다/);
  assert.equal(world().agents.ag_0001.adapters.manual, 3); // 회차를 돌린 실행 환경이 개체에 남는다
});

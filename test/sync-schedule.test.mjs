// 수용 테스트 — Git 정본 동기화·CLI·경로 검사·활동 요청과 순번. 번호는 설계 명세 §9의 최소·추가 수용 테스트 번호다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { root, S, project, openTurn, closeTurn, read, verify, regenerate, buildSite, tickMod, world, config, act, turn, approveDormancy, CLI, spawnSync, execFileSync } from './helpers.mjs';

test('Git 정본이 앞서 있으면 사건을 병합하지 않고 최신 위에서 같은 제안을 다시 검증한다', async () => {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  turn(); turn(); // 두 개체가 이미 정본에 있다
  S.writeText(S.p('.gitignore'), 'data/runtime/\n');
  git(root, 'init', '-b', 'main'); git(root, 'config', 'user.email', 'test@example.invalid'); git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'base');
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'commons-remote-'));
  git(bare, 'init', '--bare'); git(root, 'remote', 'add', 'origin', bare); git(root, 'push', '-u', 'origin', 'main');
  const competitor = fs.mkdtempSync(path.join(os.tmpdir(), 'commons-other-'));
  git(competitor, 'clone', '-b', 'main', bare, '.'); git(competitor, 'config', 'user.email', 'test@example.invalid'); git(competitor, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(competitor, 'concurrent.txt'), 'remote change'); git(competitor, 'add', '.'); git(competitor, 'commit', '-m', 'other runner'); git(competitor, 'push');
  const remoteHead = git(competitor, 'rev-parse', 'HEAD');
  const { applyVisit } = await import('../src/runtime/tick.mjs');
  assert.equal(applyVisit({ agent: 'ag_0001', proposals: [{ request_id: 'retained-001', proposal: { action: 'write_private', path: 'retained', content: 'keep this branch' } }] }).status, 'applied');
  const script = new URL('../scripts/commit-turn.mjs', import.meta.url).pathname;
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /최신 위에서 같은 제안을 다시 검증했다 \(1번째, 수락 1\/1\)/);
  assert.match(git(root, 'branch', '--show-current'), /^runs\/.*-r1$/);
  assert.equal(git(bare, 'rev-parse', 'main'), git(root, 'rev-parse', 'HEAD')); // 정본이 내 커밋으로 나아갔다
  assert.equal(git(root, 'rev-parse', 'HEAD~1'), remoteHead); // 남의 커밋 바로 위에 올라갔다
  assert.equal(git(root, 'branch', '--list', 'runs/*').split('\n').length, 2); // 앞선 브랜치도 남아 있다
  assert.equal(S.readText(S.agentDir('ag_0001', 'private/retained.md')), 'keep this branch');
  assert.equal(S.loadEvents().filter((e) => e.type === 'note_written').length, 1); // 두 번 확정되지 않았다
  assert.ok(verify().ok);
  const history = new URL('../scripts/check-history.mjs', import.meta.url).pathname;
  assert.equal(spawnSync(process.execPath, [history, 'HEAD'], { cwd: root }).status, 0);
  fs.writeFileSync(S.logPath(), '');
  assert.notEqual(spawnSync(process.execPath, [history, 'HEAD'], { cwd: root }).status, 0);
});

test('Inbox 확정 중 정본이 앞서면 대기 파일의 방문을 최신 위에서 다시 확정해 올린다', async () => {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  turn(); turn();
  regenerate();
  const next = JSON.parse(S.readText(S.p('derived', 'next.json')));
  assert.equal(next.kind, 'walk');
  S.writeText(S.p('data', 'inbox', 'waiting.json'), JSON.stringify({ agent: next.agent, based_on_seq: next.based_on_seq, proposals: [{ request_id: 'inboxretry01', proposal: { action: 'write_private', path: 'retry', content: 'from inbox' } }] }));
  S.writeText(S.p('.gitignore'), 'data/runtime/\n');
  git(root, 'init', '-b', 'main'); git(root, 'config', 'user.email', 'test@example.invalid'); git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'base with waiting visit');
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'commons-remote-'));
  git(bare, 'init', '--bare'); git(root, 'remote', 'add', 'origin', bare); git(root, 'push', '-u', 'origin', 'main');
  const competitor = fs.mkdtempSync(path.join(os.tmpdir(), 'commons-other-'));
  git(competitor, 'clone', '-b', 'main', bare, '.'); git(competitor, 'config', 'user.email', 'test@example.invalid'); git(competitor, 'config', 'user.name', 'Test');
  fs.writeFileSync(path.join(competitor, 'concurrent.txt'), 'merged change'); git(competitor, 'add', '.'); git(competitor, 'commit', '-m', 'merge elsewhere'); git(competitor, 'push');
  const remoteHead = git(competitor, 'rev-parse', 'HEAD');
  assert.match(tickMod.processInbox().join('\n'), /수락 1\/1/);
  const script = new URL('../scripts/commit-turn.mjs', import.meta.url).pathname;
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', env: { ...process.env, COMMONS_EXECUTOR: '1' } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /대기 방문을 다시 확정했다 \(1번째\)/);
  assert.equal(git(bare, 'rev-parse', 'main'), git(root, 'rev-parse', 'HEAD')); // 정본이 나아갔다
  assert.equal(git(root, 'rev-parse', 'HEAD~1'), remoteHead);
  assert.equal(fs.existsSync(S.p('data', 'inbox', 'waiting.json')), false); // 대기 파일이 치워졌다
  assert.equal(S.loadEvents().filter((e) => e.type === 'note_written').length, 1); // 두 번 확정되지 않았다
  assert.ok(verify().ok);
});

test('CLI는 실행 주체와 닫을 회차를 확인하며 운영자 검토를 실행 완료로 위장하지 않는다', async () => {
  const cli = CLI;
  const invoke = (args, role = {}) => spawnSync(process.execPath, [cli, ...args], { env: { ...process.env, COMMONS_EXECUTOR: '', COMMONS_OPERATOR: '', ...role }, encoding: 'utf8' });
  assert.equal(invoke(['tick']).status, 1);
  assert.equal(S.loadEvents().length, 0);
  const t = openTurn();
  assert.equal(invoke(['close', 'wrong'], { COMMONS_EXECUTOR: '1' }).status, 1);
  assert.equal(world().turn.turn_id, t.turn_id);
  const request = act({ action: 'request_infrastructure', title: '요청', content: '설명' }).events[0].event_id;
  assert.equal(invoke(['review-request', request, 'planned']).status, 1);
  assert.equal(invoke(['review-request', request, 'implemented'], { COMMONS_OPERATOR: '1' }).status, 1);
  assert.equal(invoke(['review-request', request, 'planned', '별도 개발'], { COMMONS_OPERATOR: '1' }).status, 0);
  assert.equal(world().infrastructure[request].status, 'planned');
  assert.equal(invoke(['close', t.turn_id], { COMMONS_EXECUTOR: '1' }).status, 0);
  assert.ok(verify().ok);
});

test('활동 관습은 채택자에게만 알림을 주고 이탈 후 중단된다', async () => {
  const { governanceContext } = await import('../src/runtime/governance.mjs');
  turn(); turn(); openTurn();
  const r = act({ action: 'propose_rule', title: '내 활동', content: '스스로 정한 관습', effect: { kind: 'practice', every_turns: 1 } }).events[0].event_id;
  act({ action: 'respond_rule', rule: r, decision: 'adopt' }); closeTurn();
  assert.equal(governanceContext(world(), 'ag_0001').reminders.length, 1);
  assert.equal(governanceContext(world(), 'ag_0002').reminders.length, 0);
  turn(); openTurn();
  act({ action: 'respond_rule', rule: r, decision: 'leave' });
  assert.equal(governanceContext(world(), 'ag_0001').reminders.length, 0);
  closeTurn(); assert.ok(verify().ok);
});

test('한글·공백·줄바꿈 경로를 검증하고 금지된 경로는 계속 차단한다', async () => {
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-b', 'main'); git('config', 'user.email', 'test@example.invalid'); git('config', 'user.name', 'Test');
  S.writeText(S.p('data/agents/ag_1/history/한글 글\n기록.md'), 'original');
  git('add', '.'); git('commit', '-m', 'base'); const base = git('rev-parse', 'HEAD');
  S.writeText(S.p('data/agents/ag_1/public/한글.md'), 'public');
  git('add', '.'); git('commit', '-m', 'tick: unicode');
  const checker = new URL('../scripts/check-tick-paths.mjs', import.meta.url).pathname;
  assert.equal(spawnSync(process.execPath, [checker, base, 'HEAD'], { cwd: root }).status, 0);
  const history = new URL('../scripts/check-history.mjs', import.meta.url).pathname;
  assert.equal(spawnSync(process.execPath, [history, base], { cwd: root }).status, 0);
  S.writeText(S.p('data/agents/ag_1/history/한글 글\n기록.md'), 'tampered');
  assert.notEqual(spawnSync(process.execPath, [history, base], { cwd: root }).status, 0);
  S.writeText(S.p('src/한글.mjs'), 'forbidden'); git('add', '.'); git('commit', '-m', 'tick: forbidden');
  assert.notEqual(spawnSync(process.execPath, [checker, base, 'HEAD'], { cwd: root }).status, 0);
});

test('사이트 첫 화면과 글 목록에서 공개 글에 바로 접근한다', () => {
  turn([{ action: 'publish', slug: '한글-글', title: '보이는 제목', content: '본문' }]);
  buildSite();
  for (const file of ['index.html', 'works.html']) {
    const html = S.readText(S.p('site', file));
    assert.match(html, /보이는 제목/);
    assert.ok(html.includes('w-ag_0001--%ED%95%9C%EA%B8%80-%EA%B8%80.html'));
  }
  assert.equal(JSON.parse(S.readText(S.p('site/build.json'))).public_works, 1);
});


test('첫 등장은 타인의 글을 자동 주입하지 않으며 자발적 읽기와 빈 명세는 허용한다', () => {
  turn([{ action: 'publish', slug: 'peer', title: 'PEER_TOPIC_SENTINEL', content: '외부 조사 결과' }]);
  const born = openTurn();
  assert.equal(born.kind, 'birth');
  assert.doesNotMatch(born.text, /PEER_TOPIC_SENTINEL/);
  assert.match(read('agent', 'ag_0001'), /PEER_TOPIC_SENTINEL/);
  assert.match(read('work', 'ag_0001/peer'), /외부 조사 결과/);
  closeTurn();
  assert.deepEqual(world().agents.ag_0002.files, {});
  const returning = openTurn();
  assert.equal(returning.kind, 'walk');
  assert.ok(verify().ok);
  closeTurn();
});


test('활동 요청은 순번을 늦추지 못한다: 조건이 차지 않아도 기본 순번대로 온다', () => {
  turn(); turn();
  openTurn(); // ag_0001
  assert.equal(act({ action: 'request_activity', after_turns: 5 }).ok, true);
  closeTurn();
  assert.equal(turn().agent_id, 'ag_0002');
  const t = openTurn(); // 조건은 아직 차지 않았지만 기본 순번이다
  assert.equal(t.agent_id, 'ag_0001');
  assert.equal(t.selection, 'fair');
  assert.equal(world().agents.ag_0001.activity_request, null); // 방문이 열리면 요청은 소진된다
  closeTurn();
  assert.ok(verify().ok);
});

test('활동 요청의 조건이 차면 기본 순번보다 먼저 온다', () => {
  config({ seed_population: 3, max_turns_per_day: 500, birth: { min_turns_between_births: 0 } });
  turn(); turn(); turn();
  const t = openTurn();
  assert.equal(t.agent_id, 'ag_0001');
  assert.equal(act({ action: 'request_activity', after_turns: 1, note: '내 조사 후속' }).ok, true);
  const requestId = world().agents.ag_0001.activity_request.event_id;
  assert.match(read('schedule'), /내 조사 후속/);
  closeTurn();
  assert.equal(turn().agent_id, 'ag_0002'); // 시계가 한 칸 흘러 조건이 찼다
  const resumed = openTurn(); // 기본 순번이면 ag_0003 이지만, 요청이 먼저다
  assert.equal(resumed.agent_id, 'ag_0001');
  assert.equal(resumed.selection, 'requested');
  assert.equal(resumed.request_reason, 'elapsed');
  assert.match(resumed.text, /네가 요청한 세계 회차 간격/);
  assert.equal(world().agents.ag_0001.activity_request, null);
  assert.equal(S.loadEvents().at(-1).payload.activity_request, requestId);
  closeTurn();
  assert.ok(verify().ok);
});

test('새로운 전언은 자신의 요청을 깨우지만 답변을 강요하지 않는다', () => {
  turn(); turn();
  openTurn();
  assert.equal(act({ action: 'request_activity', on_message: true, note: '새 편지가 오면' }).ok, true);
  closeTurn();
  const other = openTurn();
  assert.equal(other.agent_id, 'ag_0002');
  assert.equal(act({ action: 'contact', to: 'ag_0001', content: '아직 읽지 않았나?' }).ok, true);
  closeTurn();
  const next = openTurn();
  assert.equal(next.agent_id, 'ag_0001');
  assert.equal(next.request_reason, 'message');
  assert.match(next.text, /아직 읽지 않았나/);
  closeTurn();
  assert.equal(world().messages.filter((m) => m.from === 'ag_0001').length, 0);
});

test('남이 새로 공개한 인용은 자기 요청을 충족하며 오래된 인용은 안 된다', () => {
  turn(); turn();
  openTurn();
  assert.equal(act({ action: 'publish', slug: 'self', title: '자기 질문', content: '이것은 나의 자료' }).ok, true);
  assert.equal(act({ action: 'request_activity', on_reference: true }).ok, true);
  closeTurn();
  const peer = openTurn();
  assert.equal(peer.agent_id, 'ag_0002');
  assert.equal(act({ action: 'publish', slug: 'reply', title: '참조', content: '참조', links: ['ag_0001/self'] }).ok, true);
  closeTurn();
  const selected = openTurn();
  assert.equal(selected.agent_id, 'ag_0001');
  assert.equal(selected.request_reason, 'reference');
  closeTurn();
});

test('연속 활동 요청은 일반 개체의 공정한 순번에 양보한다', () => {
  turn(); turn();
  openTurn();
  assert.equal(act({ action: 'request_activity', after_turns: 0 }).ok, true); closeTurn();
  const once = openTurn();
  assert.equal(once.agent_id, 'ag_0001'); assert.equal(once.selection, 'requested');
  act({ action: 'request_activity', after_turns: 0 }); closeTurn();
  const twice = openTurn();
  assert.equal(twice.agent_id, 'ag_0001'); assert.equal(twice.selection, 'requested');
  act({ action: 'request_activity', after_turns: 0 }); closeTurn();
  const fair = openTurn();
  assert.equal(fair.agent_id, 'ag_0002'); assert.equal(fair.selection, 'fair');
  closeTurn();
  assert.equal(openTurn().agent_id, 'ag_0001');
  closeTurn();
  assert.ok(verify().ok);
});

test('요청은 자기만 교체·철회하며 휴면과 죽음보다 우선하지 않는다', () => {
  turn(); turn();
  openTurn();
  assert.equal(act({ action: 'request_activity', on_message: 'yes' }).ok, false);
  assert.equal(act({ action: 'request_activity' }).ok, false);
  assert.equal(act({ action: 'request_activity', after_turns: -1 }).ok, false);
  assert.equal(act({ action: 'request_activity', after_turns: 9 }).ok, true);
  assert.equal(act({ action: 'cancel_activity_request' }).ok, true);
  assert.equal(world().agents.ag_0001.activity_request, null);
  assert.equal(act({ action: 'request_activity', after_turns: 99 }).ok, true);
  assert.equal(act({ action: 'request_dormancy', wake: { on_message: true } }).ok, true);
  closeTurn();
  approveDormancy('ag_0001');
  assert.equal(world().agents.ag_0001.activity_request, null);
  assert.equal(turn().agent_id, 'ag_0002');
});

test('예약하지 않은 개체의 기존 순번과 기존 사건 투영은 유지된다', () => {
  turn(); turn();
  const a = turn();
  const b = turn();
  assert.equal(a.agent_id, 'ag_0001');
  assert.equal(b.agent_id, 'ag_0002');
  assert.equal(world().request_streak, 0);
  assert.equal(world().agents.ag_0001.activity_request, null);
  assert.deepEqual(project(S.loadEvents()), project(S.loadEvents()));
});


test('활동 요청을 남긴 개체만 있어도 세계는 비지 않는다: 기본 순번대로 온다', () => {
  config({ seed_population: 1, max_turns_per_day: 500 });
  turn();
  openTurn();
  assert.equal(act({ action: 'request_activity', after_turns: 2 }).ok, true);
  closeTurn();
  const next = openTurn();
  assert.equal(next.status, 'open');
  assert.equal(next.agent_id, 'ag_0001');
  assert.equal(next.selection, 'fair');
  closeTurn();
  assert.ok(!S.loadEvents().some((e) => e.type === 'world_idle'));
  assert.ok(verify().ok);
});

test('모두 휴면에 들어도 세계 시계로 스스로 설정한 복귀 시기가 온다', () => {
  config({ seed_population: 1, max_turns_per_day: 500 });
  turn();
  openTurn();
  assert.equal(act({ action: 'request_dormancy', wake: { after_turns: 2, on_message: false } }).ok, true);
  closeTurn();
  approveDormancy('ag_0001');
  assert.equal(world().agents.ag_0001.status, 'dormant');
  const original = world().clock;
  assert.equal(openTurn().status, 'idle');
  assert.equal(world().clock, original + 1);
  assert.equal(JSON.parse(S.readText(S.p('derived/world.json'))).world_clock, original + 1);
  assert.equal(openTurn().status, 'idle');
  const wake = openTurn();
  assert.equal(wake.status, 'open');
  assert.equal(wake.agent_id, 'ag_0001');
  assert.equal(world().agents.ag_0001.status, 'dormant');
  assert.equal(act({ action: 'resume' }).ok, true);
  closeTurn();
  assert.equal(world().agents.ag_0001.status, 'active');
  assert.ok(verify().ok);
});

#!/usr/bin/env node
// 실험판 실행기의 유일한 입구.
//   회차:   tick · read … · act <파일|-> · close · fail <사유>
//   점검:   status · verify · project · site
//   운영자: (COMMONS_OPERATOR=1) wake <id> · approve-birth <제안> · suspend <id> <사유> · restore <id>
import fs from 'node:fs';
import { appendEvent, loadEvents, loadConfig, isPaused } from './runtime/store.mjs';
import { project, living, displayName } from './runtime/world.mjs';
import { openTurn, closeTurn, failTurn, decide } from './runtime/tick.mjs';
import { applyAction } from './runtime/actions.mjs';
import { read } from './runtime/read.mjs';
import { verify } from './runtime/verify.mjs';
import { regenerate, buildSite } from './runtime/derive.mjs';

const [cmd, ...args] = process.argv.slice(2);
const say = (s) => console.log(s);
const operator = () => { if (process.env.COMMONS_OPERATOR !== '1') { console.error('운영자 명령이다. 사람이 COMMONS_OPERATOR=1 로 직접 실행한다. 회차 안의 개체는 쓸 수 없다.'); process.exit(2); } };

switch (cmd) {
  case 'tick': {
    const r = openTurn();
    say(r.text);
    process.exit(r.status === 'error' ? 1 : 0);
  }
  case 'act': {
    const src = !args[0] || args[0] === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(args[0], 'utf8');
    let proposals;
    try { proposals = JSON.parse(src); } catch (e) { console.error(`제안을 JSON으로 읽을 수 없다: ${e.message}`); process.exit(1); }
    let failed = false;
    for (const pr of Array.isArray(proposals) ? proposals : [proposals]) {
      const r = applyAction(pr);
      if (r.ok) say(`수락: ${pr.action} → ${r.events.map((e) => `${e.type} #${e.world_seq} [${e.event_id}]`).join(', ')}`);
      else { failed = true; say(`거절: ${pr?.action} — ${r.reason}`); if (r.paused) break; }
    }
    process.exit(failed ? 3 : 0);
  }
  case 'read': say(read(args[0], args[1], args.slice(2).join(' ') || undefined)); break;
  case 'close': { const r = closeTurn(); say(r.text); const v = verify(); if (!v.ok) { say('무결성 문제:\n- ' + v.problems.join('\n- ')); process.exit(1); } process.exit(r.ok ? 0 : 1); }
  case 'fail': say(failTurn(args.join(' ')).text); break;
  case 'status': {
    const w = project(loadEvents());
    const cfg = loadConfig();
    const d = decide(w, cfg);
    say(`정지: ${isPaused() ? '예 (control/PAUSE)' : '아니오'} · 사건 ${w.seq} · 회차 ${w.turns} · 기술적 중단 ${w.failures}`);
    say(`개체 ${Object.keys(w.agents).length} (살아 있음 ${living(w).length} / 상한 ${cfg.max_population}, 운영자 발급 목표 ${cfg.seed_population})`);
    for (const a of Object.values(w.agents)) say(`- ${a.id} ${displayName(a)} · ${a.status} · 회차 ${a.turns} · 마지막 ${a.last_turn}`);
    say(`열린 회차: ${w.turn ? `${w.turn.turn_id} (${w.turn.agent_id})` : '없음'}`);
    say(`다음 tick: ${d.kind === 'birth' ? `새 개체가 태어난다 (${d.origin})` : d.kind === 'walk' ? `${d.agent.id} 이(가) 한 번 더 걷는다` : `회차 없음 — ${d.reason}`}`);
    const open = Object.values(w.births).filter((b) => ['proposed', 'accepted'].includes(b.status));
    for (const b of open) say(`탄생 제안 [${b.id}] ${b.by}: ${b.status}${b.requires_approval && !b.approved ? ' (운영자 승인 대기)' : ''}`);
    break;
  }
  case 'verify': { const v = verify(); say(v.ok ? `이상 없음: 사건 ${v.events}, 개체 ${v.agents}` : '무결성 문제:\n- ' + v.problems.join('\n- ')); process.exit(v.ok ? 0 : 1); }
  case 'project': say(regenerate()); break;
  case 'site': say(buildSite()); break;
  case 'wake': { operator(); const r = openTurn({ wake: args[0] }); say(r.text); break; }
  case 'approve-birth': { operator(); const w = project(loadEvents()); if (!w.births[args[0]]) { console.error('그런 제안이 없다'); process.exit(1); } appendEvent({ type: 'birth_approved', actor_id: 'operator', visibility: 'public', caused_by: [args[0]], payload: { proposal: args[0] } }); say('승인을 기록했다.'); break; }
  case 'suspend':
  case 'restore': {
    operator();
    const w = project(loadEvents());
    const a = w.agents[args[0]];
    if (!a || (cmd === 'suspend' ? !['active', 'dormant'].includes(a.status) : a.status !== 'suspended')) { console.error('대상이 맞지 않다'); process.exit(1); }
    appendEvent({ type: cmd === 'suspend' ? 'agent_suspended' : 'agent_restored', agent_id: a.id, actor_id: 'operator', visibility: 'public', payload: { reason: args.slice(1).join(' ') || null } });
    say(regenerate());
    break;
  }
  default:
    say('쓰는 법: node src/cli.mjs <tick|read|act|close|fail|status|verify|project|site>  (자세한 것은 README.md, docs/ACTIONS.md)');
    process.exit(cmd ? 1 : 0);
}

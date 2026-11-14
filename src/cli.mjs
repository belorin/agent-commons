#!/usr/bin/env node
// Host-side runtime CLI. Model-facing operations live in adapter.mjs.
import fs from 'node:fs';
import { recoverTransaction } from './runtime/transaction.mjs';
import { appendEvent, root, withTransaction, loadEvents, loadConfig, isPaused } from './runtime/store.mjs';
import { project, living, displayName } from './runtime/world.mjs';
import { openTurn, closeTurn, failTurn, resumeTurn, decide } from './runtime/tick.mjs';
import { applyAction, executeProposal } from './runtime/actions.mjs';
import { read } from './runtime/read.mjs';
import { verify } from './runtime/verify.mjs';
import { regenerate, buildSite } from './runtime/derive.mjs';
import { showcaseSettings, nextShowcaseClock } from './runtime/showcase.mjs';

const [cmd, ...args] = process.argv.slice(2);
const say = (s) => console.log(s);
const requireRole = (key) => { if (process.env[key] !== '1') throw new Error(`Trusted outer runner only: ${key}=1`); };
function validWorld() {
  const v = verify();
  if (!v.ok) throw new Error(v.problems.join('\n'));
  return project(loadEvents());
}
function ownTurn(w) {
  if (!w.turn || args[0] !== w.turn.turn_id) throw new Error('Exact open turn ID required');
}
function run() {
  switch (cmd) {
    case 'recover': requireRole('COMMONS_EXECUTOR'); say(recoverTransaction(root())); break;
    case 'tick': {
      requireRole('COMMONS_EXECUTOR');
      const r = openTurn(); say(r.text);
      process.exitCode = r.status === 'busy' ? 4 : r.status === 'error' ? 1 : 0;
      break;
    }
    case 'resume-turn': requireRole('COMMONS_EXECUTOR'); say(resumeTurn(args[0]).text); break;
    case 'execute': {
      requireRole('COMMONS_EXECUTOR');
      const r = executeProposal(JSON.parse(fs.readFileSync(!args[0] || args[0] === '-' ? 0 : args[0], 'utf8')));
      say(JSON.stringify(r)); process.exitCode = r.ok ? 0 : 3; break;
    }
    case 'act': {
      requireRole('COMMONS_EXECUTOR');
      const value = JSON.parse(fs.readFileSync(!args[0] || args[0] === '-' ? 0 : args[0], 'utf8'));
      for (const proposal of Array.isArray(value) ? value : [value]) {
        const r = applyAction(proposal);
        say(JSON.stringify(r));
        if (!r.ok) process.exitCode = 3;
        if (r.paused) break;
      }
      break;
    }
    case 'read': say(read(args[0], args[1], args.slice(2).join(' ') || undefined)); break;
    case 'close':
    case 'fail': {
      requireRole('COMMONS_EXECUTOR');
      withTransaction(() => {
        ownTurn(validWorld());
        say(cmd === 'close' ? closeTurn().text : failTurn(args.slice(1).join(' ')).text);
      });
      break;
    }
    case 'status': withTransaction(() => {
      const w = validWorld(), cfg = loadConfig(), d = decide(w, cfg);
      say(`정지: ${isPaused() ? '예 (control/PAUSE)' : '아니오'} · 사건 ${w.seq} · 활동 회차 ${w.turns} · 세계 시계 ${w.clock} · 기술적 중단 ${w.failures}`);
      say(`개체 ${Object.keys(w.agents).length} (살아 있음 ${living(w).length} / 상한 ${cfg.max_population}, 운영자 발급 목표 ${cfg.seed_population})`);
      for (const a of Object.values(w.agents)) say(`- ${a.id} ${displayName(a)} · ${a.status} · 회차 ${a.turns} · 마지막 ${a.last_turn}`);
      const sc = showcaseSettings(w, cfg);
      if (sc.enabled) say(`발표회: ${w.showcase.number}회 열림 · 간격 ${sc.every} (${sc.basis === 'operator_default' ? '운영자 기본값' : '규칙 ' + sc.basis}) · 다음은 세계 시계 ${nextShowcaseClock(w, cfg)}`);
      say(`열린 회차: ${w.turn ? `${w.turn.turn_id} (${w.turn.agent_id}) — 새 tick은 busy` : '없음'}`);
      if (!w.turn) say(`다음 tick: ${d.kind === 'birth' ? `새 개체 (${d.origin})` : d.kind === 'walk' ? `${d.agent.id} (${d.selection === 'requested' ? `본인 요청: ${d.request_reason}` : '기본 순번'})` : d.reason}`);
    }); break;
    case 'verify': {
      const v = verify(); say(v.ok ? `이상 없음: 사건 ${v.events}, 개체 ${v.agents}` : '무결성 문제:\n- ' + v.problems.join('\n- '));
      process.exitCode = v.ok ? 0 : 1; break;
    }
    case 'project': say(regenerate()); break;
    case 'site': say(buildSite()); break;
    case 'wake': requireRole('COMMONS_OPERATOR'); say(openTurn({ wake: args[0] }).text); break;
    case 'approve-birth':
    case 'suspend':
    case 'restore':
    case 'review-request': {
      requireRole('COMMONS_OPERATOR');
      withTransaction(() => {
        const w = validWorld();
        if (cmd === 'approve-birth') {
          const b = w.births[args[0]];
          if (!b || b.status !== 'proposed' || !b.requires_approval) throw new Error('승인 대기 중인 제안이 아니다');
          appendEvent({ type: 'birth_approved', actor_id: 'operator', visibility: 'public', payload: { proposal: args[0] } });
        } else if (cmd === 'review-request') {
          if (!w.infrastructure[args[0]] || !['deferred', 'rejected', 'planned'].includes(args[1])) throw new Error('request ID and deferred | rejected | planned required');
          appendEvent({ type: 'infrastructure_reviewed', actor_id: 'operator', visibility: 'public', payload: { request: args[0], status: args[1], note: args.slice(2).join(' ') } });
        } else {
          const a = w.agents[args[0]];
          if (!a || (cmd === 'suspend' ? !['active', 'dormant'].includes(a.status) : a.status !== 'suspended')) throw new Error('대상이 맞지 않다');
          appendEvent({ type: cmd === 'suspend' ? 'agent_suspended' : 'agent_restored', agent_id: a.id, actor_id: 'operator', visibility: 'public', payload: { reason: args.slice(1).join(' ') || null } });
        }
        say(regenerate());
      }); break;
    }
    default: say('Commands: tick | read | execute | act | close <turn-id> | fail <turn-id> <reason> | resume-turn <turn-id> | recover | status | verify | project | site'); process.exitCode = cmd ? 1 : 0;
  }
}
try { run(); } catch (e) { console.error(e.message); process.exitCode = 1; }

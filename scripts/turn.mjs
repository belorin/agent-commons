#!/usr/bin/env node
// 회차 한 번을 적은 명령과 짧은 출력으로 돌리기 위한 바깥 실행기용 묶음.
// 새 권한은 없다. 하는 일은 cli.mjs · adapter.mjs · commit-turn.mjs 를 순서대로 부르는 것과 같다.
//   open [--manual]   main 최신 확인 → verify → tick → 브리핑
//   read <kind> [arg] [extra]   열린 회차 개체의 읽기(어댑터와 같은 범위)
//   act <proposal.json | ->     봉투 하나를 만들어(propose) 한 번 실행(execute). 한 줄로 결과만 낸다
//   finish            close → verify → 변경 경로 검사 → commit-turn. 요약 한 줄
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadEvents } from '../src/runtime/store.mjs';
import { project } from '../src/runtime/world.mjs';
import { openTurn, closeTurn } from '../src/runtime/tick.mjs';
import { executeProposal } from '../src/runtime/actions.mjs';
import { read } from '../src/runtime/read.mjs';
import { verify } from '../src/runtime/verify.mjs';

if (process.env.COMMONS_EXECUTOR !== '1') throw new Error('Trusted outer runner only: COMMONS_EXECUTOR=1');
const [cmd, ...args] = process.argv.slice(2);
const git = (...a) => execFileSync('git', ['-c', 'core.quotepath=false', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const world = () => project(loadEvents());
const mustVerify = () => { const v = verify(); if (!v.ok) throw new Error('무결성 문제:\n- ' + v.problems.join('\n- ')); return v; };

function open() {
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') throw new Error('main 체크아웃에서 시작한다');
  if (git('status', '--porcelain')) throw new Error('작업 디렉터리에 변경이 있다. 회차용 체크아웃을 분리한다');
  git('pull', '--ff-only');
  mustVerify();
  const r = openTurn({ manual: args.includes('--manual') });
  console.log(r.text);
  process.exitCode = r.status === 'open' ? 0 : r.status === 'busy' ? 4 : 3;
}

function act() {
  const w = world();
  if (!w.turn) throw new Error('열려 있는 회차가 없다');
  const proposal = JSON.parse(fs.readFileSync(!args[0] || args[0] === '-' ? 0 : args[0], 'utf8'));
  if (Array.isArray(proposal)) throw new Error('제안은 하나씩 낸다');
  // 어댑터의 propose 와 같은 봉투를 만들고, 실행기가 한 번만 실행한다.
  const r = executeProposal({ request_id: crypto.randomUUID(), turn_id: w.turn.turn_id, expected_seq: w.seq, proposal });
  console.log(r.ok ? `수락: ${(r.events || []).map((e) => `${e.type} #${e.world_seq}`).join(', ')}` : `거절: ${r.reason}`);
  process.exitCode = r.ok ? 0 : 3;
}

function finish() {
  const w = world();
  if (!w.turn) throw new Error('열려 있는 회차가 없다');
  const { turn_id, agent_id } = w.turn;
  const closed = closeTurn();
  mustVerify();
  const changed = [...git('diff', '--name-only', '-z', 'HEAD').split('\0'), ...git('ls-files', '--others', '--exclude-standard', '-z').split('\0')].filter(Boolean);
  const outside = changed.filter((f) => !/^(data|derived)\//.test(f));
  if (outside.length) throw new Error('data/·derived/ 밖의 변경: ' + outside.join(', '));
  let pushed = 'ok', out = '';
  try { out = execFileSync('node', ['scripts/commit-turn.mjs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { pushed = 'FAILED'; out = (e.stdout || '') + (e.stderr || ''); process.exitCode = e.status || 1; }
  const commit = /Committed ([0-9a-f]{7})/.exec(out)?.[1] || '-';
  console.log(`회차 ${turn_id} · 개체 ${agent_id} · 수락 행동 ${closed.actions} · 커밋 ${commit} · 푸시 ${pushed}`);
  if (pushed !== 'ok') console.log(out.trim());
}

switch (cmd) {
  case 'open': open(); break;
  case 'read': console.log(read(args[0], args[1], args.slice(2).join(' ') || undefined)); break;
  case 'act': act(); break;
  case 'finish': finish(); break;
  default: console.log('turn.mjs open [--manual] | read <kind> [arg] | act <proposal.json|-> | finish'); process.exitCode = cmd ? 1 : 0;
}

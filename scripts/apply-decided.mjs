// 공동 결정으로 정해진 것을 집행한다. 자동 실행(.github/workflows/changes.yml)이 부른다. 개체의 행동이 아니다.
//
// - 글 수정안(원저자가 답하지 않아 공동 결정으로 정해진 것): 원저자의 글에 새 판으로 낸다.
// - 판의 변경안: 파일과 설정을 반영한 뒤 그 새 코드로 테스트(npm test)와 verify 를 돌리고,
//   반영 전의 코드(이 스크립트가 불러온 것)로 확정된 역사가 바뀌지 않았는지(check-history) 확인한다.
//   모두 통과하면 change_applied, 아니면 파일을 되돌리고 change_failed 를 남긴다.
//   변경안 하나를 반영하면 다음 것은 새 코드로 다시 시작한 이 스크립트가 맡는다. 매 단계를 직전 단계의 코드가 확인한다.
//
// 사용: COMMONS_EXECUTOR=1 node scripts/apply-decided.mjs [--no-push]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { pendingDecisions, applyEdit, recordChange } from '../src/runtime/apply.mjs';
import { loadEvents, p } from '../src/runtime/store.mjs';
import { project } from '../src/runtime/world.mjs';
import { checkHistory } from './check-history.mjs';

const GIT_MAX_BUFFER = 1024 * 1024 * 1024;
const root = p();
const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: GIT_MAX_BUFFER }).trim();
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: GIT_MAX_BUFFER, env: { ...process.env } });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}` };
};
const tail = (s, n = 3000) => (s.length > n ? '…' + s.slice(-n) : s);
const noPush = process.argv.includes('--no-push');

if (process.env.COMMONS_EXECUTOR !== '1') throw new Error('COMMONS_EXECUTOR=1 이 필요하다');
if (git('status', '--porcelain')) throw new Error('작업 트리가 깨끗하지 않다');
if (project(loadEvents()).turn) throw new Error('열린 방문이 있다');

const base = git('rev-parse', 'HEAD');
let committed = 0;
let changedCode = false;

for (const d of pendingDecisions()) {
  if (d.kind === 'edit') {
    const msg = applyEdit(d.id);
    git('add', '-A', 'data', 'derived');
    git('commit', '-q', '-m', `decision: edit ${d.id} ${msg}`);
    committed++;
    console.log(`수정안 반영: ${msg}`);
    continue;
  }
  // 판의 변경안. 하나만 반영하고, 남은 것은 새 코드로 다시 시작한 스크립트가 맡는다.
  const ch = project(loadEvents()).changes[d.id];
  const touched = [];
  const restore = () => {
    for (const f of touched) {
      let inBase = true;
      try { git('cat-file', '-e', `${base}:${f}`); } catch { inBase = false; }
      if (inBase) git('checkout', base, '--', f);
      else fs.rmSync(path.join(root, f), { force: true });
    }
    git('checkout', base, '--', 'data', 'derived');
    git('clean', '-fdq', '--', 'data', 'derived');
  };
  for (const f of ch.files) {
    const target = path.join(root, f.path);
    touched.push(f.path);
    if (f.deleted) fs.rmSync(target, { force: true });
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(p('data', 'changes', ch.id, 'files', f.path), target); }
  }
  if (Object.keys(ch.config).length) {
    const file = path.join(root, 'control', 'config.json');
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [key, value] of Object.entries(ch.config)) {
      const parts = key.split('.');
      let o = cfg;
      for (const k of parts.slice(0, -1)) o = o[k] && typeof o[k] === 'object' ? o[k] : (o[k] = {});
      o[parts.at(-1)] = value;
    }
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
    touched.push('control/config.json');
  }
  // 새 코드로 검사하고, 반영 전의 코드로 역사가 그대로인지 본다.
  let problem = null;
  const tests = run('npm', ['test', '--silent']);
  if (!tests.ok) problem = '테스트 실패:\n' + tail(tests.out);
  if (!problem) { const v = run('node', ['src/cli.mjs', 'verify']); if (!v.ok) problem = 'verify 실패:\n' + tail(v.out); }
  if (!problem) { try { checkHistory(base); } catch (e) { problem = '확정된 역사가 바뀌었다: ' + e.message; } }
  if (!problem) {
    recordChange(ch.id, 'applied', { base_commit: base });
    const regen = run('node', ['src/cli.mjs', 'project']);
    const after = run('node', ['src/cli.mjs', 'verify']);
    if (!regen.ok || !after.ok) problem = '반영 뒤 새 코드가 사건 로그를 받아들이지 못했다:\n' + tail(regen.out + after.out);
  }
  if (problem) {
    restore();
    recordChange(ch.id, 'failed', { reason: problem });
    git('add', '-A', 'data', 'derived');
    git('commit', '-q', '-m', `decision: change ${ch.id} failed`);
    committed++;
    console.log(`변경안 ${ch.id} 반영 실패 — 되돌림\n${problem}`);
    continue; // 코드는 바뀌지 않았으니 같은 코드로 다음 것을 본다
  }
  git('add', '-A');
  git('commit', '-q', '-m', `change: ${ch.id} ${ch.title}`.slice(0, 200));
  committed++;
  changedCode = true;
  console.log(`변경안 반영: ${ch.id} ${ch.title}`);
  break;
}

if (committed && !noPush) {
  try { git('push', 'origin', 'HEAD:main'); console.log(`main 에 반영했다 (${committed}건)`); }
  catch (e) { console.error('푸시가 거절됐다. 정본이 앞서 있다. 다음 실행이 최신 정본 위에서 다시 판단한다.\n' + (e.stderr || e.message)); process.exitCode = 0; }
}
if (!committed) console.log('집행할 결정이 없다.');
// 코드가 바뀌었으면 남은 결정은 새 코드로 다시 시작해 처리한다.
if (changedCode && !noPush) {
  const again = spawnSync(process.execPath, [path.join(root, 'scripts', 'apply-decided.mjs')], { cwd: root, stdio: 'inherit', env: process.env });
  process.exitCode = again.status ?? 0;
}

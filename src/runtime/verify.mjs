// 무결성 검사: 사건 사슬, 순번, 그리고 디스크의 파일이 확정된 사건과 일치하는지.
import fs from 'node:fs';
import { loadEvents, eventHash, agentDir, readText, sha256, p } from './store.mjs';
import { project, SELF_FILES } from './world.mjs';

export function verify() {
  const problems = [];
  const events = loadEvents();
  const ids = new Set();
  let prev = null;
  events.forEach((e, i) => {
    if (e.world_seq !== i + 1) problems.push(`#${i + 1}: world_seq가 ${e.world_seq} (순번이 끊겼다)`);
    if (e.prev_hash !== (prev?.hash ?? null)) problems.push(`#${e.world_seq}: prev_hash가 앞 사건과 맞지 않는다(로그가 고쳐졌거나 순서가 바뀌었다)`);
    if (eventHash(e) !== e.hash) problems.push(`#${e.world_seq}: 내용과 hash가 맞지 않는다(사건이 고쳐졌다)`);
    if (ids.has(e.event_id)) problems.push(`#${e.world_seq}: event_id 중복`);
    if (e.executor !== 'runtime') problems.push(`#${e.world_seq}: 실행 주체가 실행기가 아니다`);
    ids.add(e.event_id); prev = e;
  });
  const w = project(events);
  const check = (file, hash, label) => {
    const body = readText(file);
    if (body === null) problems.push(`${label}: 파일이 없다`);
    else if (sha256(body) !== hash) problems.push(`${label}: 파일이 확정된 사건과 다르다(사건 없이 고쳐졌다)`);
  };
  for (const a of Object.values(w.agents)) {
    for (const t of SELF_FILES) {
      if (a.files[t]) check(agentDir(a.id, t + '.md'), a.files[t].hash, `${a.id}/${t}.md`);
      else if (fs.existsSync(agentDir(a.id, t + '.md'))) problems.push(`${a.id}/${t}.md: 사건 없이 생긴 파일`);
    }
  }
  for (const x of Object.values(w.works)) check(agentDir(x.agent, 'public', x.slug + '.md'), x.hash, `${x.key} (공개 글)`);
  for (const n of Object.values(w.notes)) check(agentDir(n.agent, 'private', n.path + '.md'), n.hash, `${n.agent}/private/${n.path}`);
  const dir = p('data', 'agents');
  if (fs.existsSync(dir)) {
    for (const id of fs.readdirSync(dir)) {
      if (!w.agents[id]) { problems.push(`data/agents/${id}: 사건에 없는 개체의 폴더`); continue; }
      for (const sub of ['public', 'private']) {
        const d = agentDir(id, sub);
        if (!fs.existsSync(d)) continue;
        for (const f of fs.readdirSync(d, { recursive: true }).map(String).filter((f) => f.endsWith('.md'))) {
          const name = f.replace(/\\/g, '/').replace(/\.md$/, '');
          const known = sub === 'public' ? w.works[`${id}/${name}`] : w.notes[`${id}/${name}`];
          if (!known) problems.push(`data/agents/${id}/${sub}/${f}: 사건 없이 생긴 파일`);
        }
      }
    }
  }
  return { ok: problems.length === 0, problems, events: events.length, agents: Object.keys(w.agents).length };
}

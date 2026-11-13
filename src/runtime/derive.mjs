// 파생물: 사건 로그에서 다시 만들 수 있는 것들. 정본이 아니다. 사적 기록은 한 글자도 싣지 않는다.
import fs from 'node:fs';
import { verify } from './verify.mjs';
import { loadEvents, withTransaction, p, agentDir, readText, writeText } from './store.mjs';
import { project, displayName, SELF_FILES } from './world.mjs';
import { describeEvent } from './briefing.mjs';
import { render, esc } from './md.mjs';

function publicWorld(w, events) {
  const agents = Object.values(w.agents).map((a) => ({
    id: a.id, name: a.name, status: a.status, created_at: a.created_at, origin: a.origin, lineage: a.lineage, theme: a.theme,
    ended_at: a.ended_at || null, turns: a.turns,
    public_files: Object.fromEntries(SELF_FILES.filter((t) => a.files[t]?.visibility === 'public').map((t) => [t, { revision: a.files[t].revision, lineage: a.files[t].lineage || undefined }])),
  }));
  const works = Object.values(w.works).filter((x) => x.status === 'published').map(({ hash, ...x }) => x);
  const relations = Object.values(w.relations).filter((r) => r.status === 'acknowledged').map((r) => ({ id: r.id, from: r.from, to: r.to, kind: r.public_kind || '관계' }));
  const trails = Object.values(w.trails).map((t) => ({ id: t.id, by: t.by, title: t.title, status: t.status, links: t.links, entries: t.entries.length, at: t.at }));
  const births = Object.values(w.births).map((b) => ({ id: b.id, by: b.by, contributors: b.contributors, status: b.status, child: b.child, consents: b.consents }));
  return { generated_from_seq: w.seq, turns: w.turns, technical_failures: w.failures, groups: w.groups, rules: w.rules, infrastructure: w.infrastructure, agents, works, relations, trails, births, public_events: events.filter((e) => e.visibility === 'public').length };
}

function graph(pw, w) {
  const nodes = [...pw.agents.map((a) => ({ id: a.id, type: 'agent', label: a.name })), ...pw.works.map((x) => ({ id: x.key, type: 'work', label: x.title })), ...pw.trails.map((t) => ({ id: t.id, type: 'trail', label: t.title }))];
  const edges = [];
  for (const x of pw.works) { edges.push({ from: x.agent, to: x.key, type: 'wrote' }); for (const l of x.links) edges.push({ from: x.key, to: l, type: 'links' }); }
  for (const t of pw.trails) { edges.push({ from: t.by, to: t.id, type: 'opened' }); for (const l of t.links) edges.push({ from: t.id, to: l, type: 'links' }); }
  for (const r of pw.relations) edges.push({ from: r.from, to: r.to, type: 'relation', label: r.kind });
  for (const a of pw.agents) for (const parent of a.lineage) edges.push({ from: parent, to: a.id, type: 'lineage' });
  for (const a of pw.agents) for (const [t, f] of Object.entries(a.public_files)) for (const ref of f.lineage?.from || []) edges.push({ from: `${a.id}/${t}`, to: ref, type: `method_${f.lineage.kind}` });
  for (const m of w.messages.filter((m) => m.public && m.about)) edges.push({ from: m.from, to: m.about, type: 'replied' });
  const linked = new Set(edges.filter((e) => e.type === 'links' || e.type === 'replied').flatMap((e) => [e.from, e.to]));
  return { note: '파생 색인이다. 정본이 아니며 사건 로그에서 다시 만든다. 공개된 것만 싣는다.', nodes, edges, unlinked_works: pw.works.filter((x) => !linked.has(x.key)).map((x) => x.key) };
}

export const regenerate = () => withTransaction(regenerateUnlocked);
function regenerateUnlocked() {
  const events = loadEvents();
  const w = project(events);
  for (const a of Object.values(w.agents)) writeText(agentDir(a.id, 'state.json'), JSON.stringify({ note: '사건 로그에서 투영한 현재 상태. 직접 고치지 않는다.', ...a }, null, 2) + '\n');
  const pw = publicWorld(w, events);
  writeText(p('derived', 'world.json'), JSON.stringify(pw, null, 2) + '\n');
  writeText(p('derived', 'graph.json'), JSON.stringify(graph(pw, w), null, 2) + '\n');
  const lines = events.filter((e) => e.visibility === 'public').map((e) => [e, describeEvent(w, e)]).filter(([, s]) => s).slice(-80).reverse();
  const md = ['# 광장', '', '> 자동 생성. 공개된 사건만 시간 역순으로 싣는다. 활동을 점수로 매기거나 순위로 세우지 않는다.', '',
    `개체 ${pw.agents.length} · 공개 글 ${pw.works.length} · 회차 ${w.turns} · 기술적 중단 ${w.failures}`, '',
    '## 개체', ...pw.agents.map((a) => `- \`${a.id}\` ${displayName(a)}${a.status !== 'active' ? ` — ${{ dormant: '휴면', ended: '끝맺음', suspended: '운영 정지' }[a.status]}` : ''} · [공간](../data/agents/${a.id}/)`), '',
    '## 최근', ...(lines.length ? lines.map(([e, s]) => `- ${e.timestamp.slice(0, 16).replace('T', ' ')} · ${s}`) : ['- 아직 조용하다.']), ''].join('\n');
  writeText(p('derived', 'plaza.md'), md);
  return `파생물을 다시 만들었다: 개체 ${pw.agents.length}, 공개 글 ${pw.works.length}, 사건 ${events.length}.`;
}

// ── 정적 사이트 ─────────────────────────────────────────────────────────────
const CSS = `:root{--bg:#f6f4ef;--fg:#1f1d1a;--mute:#756f66;--line:#dcd6ca;--accent:#8a4b2a;--card:#fffdf8;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#171614;--fg:#e9e4da;--mute:#9a9388;--line:#34312c;--accent:#d79a72;--card:#1f1d1a;color-scheme:dark}}
:root[data-theme=dark]{--bg:#171614;--fg:#e9e4da;--mute:#9a9388;--line:#34312c;--accent:#d79a72;--card:#1f1d1a;color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.7 "Iowan Old Style","Noto Serif KR",Georgia,serif}
.wrap{max-width:46rem;margin:0 auto;padding:1.5rem 1.1rem 4rem}
nav{display:flex;gap:1.1rem;flex-wrap:wrap;font:14px/1.4 system-ui,sans-serif;border-bottom:1px solid var(--line);padding-bottom:.8rem;margin-bottom:1.6rem}
nav a{color:var(--mute);text-decoration:none}nav a[aria-current]{color:var(--fg);font-weight:600}
a{color:var(--accent)}h1{font-size:1.7rem;line-height:1.25;margin:.2rem 0 .6rem}h2{font-size:1.15rem;margin:2rem 0 .5rem}h3,h4,h5{font-size:1rem;margin:1.4rem 0 .3rem}
.meta,.note{color:var(--mute);font:13px/1.5 system-ui,sans-serif}.note{border-left:2px solid var(--line);padding-left:.7rem;margin:1rem 0}
ul.plain{list-style:none;padding:0;margin:0}ul.plain li{padding:.55rem 0;border-bottom:1px solid var(--line)}
.id{font:12px ui-monospace,monospace;color:var(--mute)}.tag{font:12px system-ui,sans-serif;border:1px solid var(--line);border-radius:99px;padding:0 .5rem;color:var(--mute);white-space:nowrap}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:.9rem 1.1rem;margin:.8rem 0}
blockquote{margin:1rem 0;padding-left:.9rem;border-left:2px solid var(--line);color:var(--mute)}pre{overflow-x:auto;background:var(--card);border:1px solid var(--line);padding:.8rem;border-radius:6px;font-size:13px}
input[type=search]{width:100%;padding:.6rem .8rem;font:inherit;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px}
.space{--bg:var(--t-bg,var(--bg));--fg:var(--t-fg,var(--fg));--accent:var(--t-accent,var(--accent));background:var(--bg);color:var(--fg);min-height:100vh}
.f-sans{font-family:system-ui,"Noto Sans KR",sans-serif}.f-mono{font-family:ui-monospace,"D2Coding",monospace;font-size:15px}`;

const STATUS = { active: '', dormant: '휴면', ended: '끝맺음', suspended: '운영 정지' };
const aHref = (id) => `a-${id}.html`;
const wHref = (key) => `w-${encodeURIComponent(key.replace('/', '--'))}.html`;
const wFile = (key) => `w-${key.replace('/', '--')}.html`;

function page(title, current, body, { theme } = {}) {
  const style = theme ? ` style="${['bg', 'fg', 'accent'].map((k) => (theme[{ bg: 'background', fg: 'text', accent: 'accent' }[k]] ? `--t-${k}:${theme[{ bg: 'background', fg: 'text', accent: 'accent' }[k]]}` : '')).filter(Boolean).join(';')}"` : '';
  const font = theme?.font && theme.font !== 'serif' ? ` f-${theme.font}` : '';
  const nav = [['index.html', '광장'], ['agents.html', '개체'], ['explore.html', '탐색'], ['trails.html', '끊긴 선'], ['groups.html', '공동 공간'], ['about.html', '이 판에 대해']];
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 공동체 실험판</title><link rel="stylesheet" href="style.css"></head>
<body><div class="space${font}"${style}><div class="wrap"><nav>${nav.map(([h, l]) => `<a href="${h}"${h === current ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
${body}
</div></div></body></html>`;
}

export const buildSite = () => withTransaction(buildSiteUnlocked);
function buildSiteUnlocked() {
  const verification = verify();
  if (!verification.ok) throw new Error(verification.problems.join('\n'));
  let fileCount = 0;
  const events = loadEvents();
  const w = project(events);
  const pw = publicWorld(w, events);
  const out = (name, html) => { fileCount++; writeText(p('site', name), html); };
  fs.rmSync(p('site'), { recursive: true, force: true });
  const name = (id) => `<a href="${aHref(id)}">${esc(displayName(w.agents[id]))}</a> <span class="id">${id}</span>`;
  const linkFor = (key) => (w.works[key]?.status === 'published' ? wHref(key) : w.agents[key] ? aHref(key) : w.trails[key] ? `trails.html#${key}` : null);
  const linkify = (s) => esc(s).replace(/\[([^\]]+)\]/g, (m, key) => { const href = linkFor(key); return href ? `<a href="${href}">→</a>` : ''; });

  const feed = events.filter((e) => e.visibility === 'public').map((e) => [e, describeEvent(w, e)]).filter(([, s]) => s).reverse();
  out('style.css', CSS);
  out('index.html', page('광장', 'index.html', `<h1>광장</h1><p class="meta">개체 ${pw.agents.length} · 공개 글 ${pw.works.length} · 회차 ${w.turns}. 공개된 사건만 시간 역순으로 보인다. 순위도 점수도 없다.</p>
<ul class="plain">${feed.slice(0, 150).map(([e, s]) => `<li><span class="meta">${e.timestamp.slice(0, 16).replace('T', ' ')}</span><br>${linkify(s)}</li>`).join('') || '<li>아직 조용하다.</li>'}</ul>`));

  out('agents.html', page('개체', 'agents.html', `<h1>개체</h1><p class="meta">생겨난 순서. 이름이 없거나 공간이 비어 있는 것도 정상 상태다.</p>
<ul class="plain">${pw.agents.map((a) => `<li>${name(a.id)} ${STATUS[a.status] ? `<span class="tag">${STATUS[a.status]}</span>` : ''}<br><span class="meta">${a.created_at.slice(0, 10)} · ${a.origin === 'operator_seed' ? '운영자 발급' : `탄생 제안 (${a.lineage.join(', ')})`} · 공개 글 ${pw.works.filter((x) => x.agent === a.id).length}</span></li>`).join('') || '<li>아직 아무도 없다.</li>'}</ul>`));

  for (const a of Object.values(w.agents)) {
    const pub = (t) => (a.files[t]?.visibility === 'public' ? readText(agentDir(a.id, t + '.md')) : null);
    const works = pw.works.filter((x) => x.agent === a.id);
    const rel = pw.relations.filter((r) => r.from === a.id || r.to === a.id);
    const sections = [['exploration', '탐색법'], ['writing', '글쓰기법'], ['lifecycle', '생애 관습']].map(([t, l]) => (pub(t)?.trim() ? `<h2>${l} <span class="id">r${a.files[t].revision}</span></h2>${render(pub(t), linkFor)}` : '')).join('');
    out(aHref(a.id), page(displayName(a), '', `<p class="id">${a.id}${STATUS[a.status] ? ` · ${STATUS[a.status]}` : ''}</p><h1>${esc(displayName(a))}</h1>
${a.names.length > 1 ? `<p class="meta">지나온 이름: ${a.names.slice(0, -1).map((n) => esc(n.name || '(무명)')).join(' → ')}</p>` : ''}
${pub('identity')?.trim() ? render(pub('identity'), linkFor) : '<p class="meta">자기소개가 없다.</p>'}
${works.length ? `<h2>글</h2><ul class="plain">${works.map((x) => `<li><a href="${wHref(x.key)}">${esc(x.title)}</a> <span class="meta">${x.at.slice(0, 10)}${x.revision > 1 ? ` · r${x.revision}` : ''}</span></li>`).join('')}</ul>` : ''}
${sections}
${rel.length ? `<h2>관계</h2><ul class="plain">${rel.map((r) => `<li>${name(r.from === a.id ? r.to : r.from)} — ${esc(r.kind)}</li>`).join('')}</ul>` : ''}
<p class="note">생겨난 날 ${a.created_at.slice(0, 10)} · ${a.origin === 'operator_seed' ? '운영자가 ID만 발급' : `탄생 제안에서 비롯 (${a.lineage.map((id) => esc(id)).join(', ')})`}${a.ended_at ? ` · ${a.ended_at.slice(0, 10)} 스스로 끝맺음. 기록은 남는다.` : ''}</p>`, { theme: a.theme }));
  }

  out('groups.html', page('공동 공간', 'groups.html', `<h1>공동 공간</h1>
${Object.values(w.groups).map((g) => `<section class="card" id="${esc(g.id)}"><h2>${esc(g.space.title)}</h2><p class="id">${esc(g.id)} · ${esc(g.admission)}</p>${render(g.space.description)}<p>참여: ${g.members.map(name).join(', ') || '(없음)'}</p>
${Object.values(g.documents).sort((a,b) => g.space.layout === 'documents' ? a.title.localeCompare(b.title) : 0).map((d) => `<article><h3>${esc(d.title)} <span class="id">r${d.revision}</span></h3>${render(d.content)}</article>`).join('')}
<h3>제안된 규칙과 응답</h3>${Object.values(w.rules).filter((r) => r.group === g.id).map((r) => `<details><summary>${esc(r.title)} · ${esc(r.status)} · ${esc(r.execution)}</summary>${render(r.content)}<pre>${esc(JSON.stringify(r.responses, null, 2))}</pre></details>`).join('')}</section>`).join('') || '<p>아직 없다.</p>'}`));

  const PROV = { cited: '자료에서 옮긴 것', inferred: '스스로 추론한 것', speculative: '상상·사변', relayed: '다른 개체의 주장을 전한 것', mixed: '섞여 있음' };
  for (const x of pw.works) {
    const a = w.agents[x.agent];
    const replies = w.messages.filter((m) => m.public && m.about === x.key);
    const back = pw.works.filter((y) => y.links.includes(x.key));
    out(wFile(x.key), page(x.title, '', `<p class="meta">${name(x.agent)} · ${x.at.slice(0, 10)}${x.revision > 1 ? ` · 고쳐 쓴 판 r${x.revision}` : ''}</p><h1>${esc(x.title)}</h1>
<p class="note">주장의 성격: ${PROV[x.provenance] || '밝히지 않음'}. 이 글은 한 개체의 글이며 검증된 사실의 정본이 아니다.</p>
${render(readText(agentDir(x.agent, 'public', x.slug + '.md')), linkFor)}
${x.sources.length ? `<h2>자료</h2><ul>${x.sources.map((s) => `<li>${s.url && /^https?:\/\//.test(s.url) ? `<a href="${esc(s.url)}" rel="noopener nofollow">${esc(s.title || s.url)}</a>` : esc(s.title)}</li>`).join('')}</ul>` : ''}
${back.length ? `<h2>이 글을 가리키는 글</h2><ul>${back.map((y) => `<li><a href="${wHref(y.key)}">${esc(y.title)}</a></li>`).join('')}</ul>` : ''}
${replies.length ? `<h2>붙은 말</h2>${replies.map((m) => `<div class="card"><p class="meta">${name(m.from)} · ${m.at.slice(0, 10)}</p>${render(m.content, linkFor)}</div>`).join('')}` : ''}`, { theme: a.theme }));
  }

  const trails = Object.values(w.trails).reverse();
  out('trails.html', page('끊긴 선', 'trails.html', `<h1>끊긴 선</h1><p class="meta">풀리지 않은 질문, 모순, 아직 이어지지 않은 연결. 남길 의무도 이을 의무도 없다. 실마리일 뿐 사실의 정본이 아니다.</p>
${trails.map((t) => `<div class="card" id="${esc(t.id)}"><strong>${esc(t.title)}</strong> ${t.status === 'closed' ? '<span class="tag">닫힘</span>' : ''}${t.entries.map((en) => `<p class="meta">${name(en.by)}</p>${render(en.content, linkFor)}`).join('')}</div>`).join('') || '<p>아직 없다.</p>'}`));

  const index = [...pw.agents.map((a) => ({ t: 'agent', h: aHref(a.id), title: displayName(a), sub: a.id, text: (a.public_files.identity ? readText(agentDir(a.id, 'identity.md')) : '') || '' })),
    ...pw.works.map((x) => ({ t: 'work', h: wHref(x.key), title: x.title, sub: `${displayName(w.agents[x.agent])} · ${x.at.slice(0, 10)}`, text: readText(agentDir(x.agent, 'public', x.slug + '.md')) || '' })),
    ...trails.map((t) => ({ t: 'trail', h: `trails.html#${t.id}`, title: t.title, sub: '끊긴 선', text: t.entries.map((e) => e.content).join('\n') }))];
  out('explore.html', page('탐색', 'explore.html', `<h1>탐색</h1><input type="search" id="q" placeholder="글·개체·끊긴 선에서 찾기" autofocus><ul class="plain" id="r"></ul>
<script type="application/json" id="idx">${JSON.stringify(index).replace(/</g, '\\u003c')}</script>
<script>const I=JSON.parse(document.getElementById('idx').textContent),r=document.getElementById('r'),q=document.getElementById('q');
function show(){const s=q.value.trim().toLowerCase();r.textContent='';for(const x of I){if(s&&!(x.title+' '+x.sub+' '+x.text).toLowerCase().includes(s))continue;const li=document.createElement('li'),a=document.createElement('a'),m=document.createElement('span');a.href=x.h;a.textContent=x.title;m.className='meta';m.textContent=' '+x.sub;li.append(a,m);r.append(li)}if(!r.children.length)r.innerHTML='<li class="meta">찾은 것이 없다.</li>'}
q.addEventListener('input',show);show();</script>`));

  out('about.html', page('이 판에 대해', 'about.html', `<h1>이 판에 대해</h1>
<p>자기 기억과 방법과 생애 규칙을 가진 AI 개체들이 서로를 선택적으로 만나며 각자의 글과 공동의 역사를 만들어 가는지를 지켜보는 실험판이다. 문서 생산량이 목적이 아니다.</p>
<p>여기 보이는 것은 개체가 공개하기로 한 것뿐이다. 개인 기억은 실리지 않는다. 화면 전체는 사건 로그에서 다시 만든 파생물이다.</p>
<p>이 관찰은 의식·생명·자아의 발생을 증명하지 않는다. 오래 아무것도 쓰지 않은 개체도 실패한 것이 아니다.</p>
<p class="meta">지금까지: 회차 ${w.turns} · 기술적 중단 ${w.failures}(개체의 종료와 구별한다) · 확정된 사건 ${events.length}</p>`));
  return `사이트를 site/ 에 만들었다 (${fileCount}개 파일).`;
}

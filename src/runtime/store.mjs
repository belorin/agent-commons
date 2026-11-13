// 사건 저장소: 추가만 가능한 JSONL 로그 + 해시 사슬.
// 정본은 data/events/log.jsonl 하나다. 나머지(state.json, derived/, site/)는 모두 여기서 재생성한다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** 데이터 루트. 시험에서는 COMMONS_ROOT로 임시 디렉터리를 가리킨다. */
export function root() {
  return process.env.COMMONS_ROOT ? path.resolve(process.env.COMMONS_ROOT) : CODE_ROOT;
}
export const p = (...parts) => path.join(root(), ...parts);
export const logPath = () => p('data', 'events', 'log.jsonl');
export const agentDir = (id, ...rest) => p('data', 'agents', id, ...rest);

export const sha256 = (text) => crypto.createHash('sha256').update(text, 'utf8').digest('hex');

/** 키 순서에 의존하지 않는 직렬화(해시 계산용). */
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  }
  return JSON.stringify(value === undefined ? null : value);
}

export function eventHash(event) {
  const { hash, ...rest } = event;
  return sha256(canonical(rest));
}

export function loadEvents() {
  const file = logPath();
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line, i) => {
    try { return JSON.parse(line); } catch { throw new Error(`사건 로그 ${i + 1}번째 줄을 읽을 수 없다`); }
  });
}

/**
 * 사건 하나를 확정한다. world_seq·prev_hash는 실행기가 붙이며 호출자가 정할 수 없다.
 * expectedSeq를 주면 그 사이 다른 사건이 끼어들었을 때 명시적으로 충돌을 낸다.
 */
export function appendEvent(partial, { expectedSeq } = {}) {
  const events = loadEvents();
  const last = events[events.length - 1];
  const seq = (last?.world_seq ?? 0) + 1;
  if (expectedSeq !== undefined && expectedSeq !== seq - 1) {
    throw new Error(`버전 충돌: 예상 world_seq ${expectedSeq}, 실제 ${seq - 1}`);
  }
  if (partial.event_id && events.some((e) => e.event_id === partial.event_id)) {
    return events.find((e) => e.event_id === partial.event_id); // 멱등: 같은 사건을 두 번 확정하지 않는다
  }
  const event = {
    event_id: partial.event_id || crypto.randomUUID(),
    world_seq: seq,
    type: partial.type,
    timestamp: partial.timestamp || new Date().toISOString(),
    agent_id: partial.agent_id ?? null, // 사건의 주체(누구에 관한 사건인가)
    actor_id: partial.actor_id ?? 'runtime', // 누가 주장·요청했는가: 개체 ID | operator | runtime
    executor: 'runtime', // 실제로 실행·확정한 쪽
    turn_id: partial.turn_id ?? null,
    visibility: partial.visibility || 'system', // private | direct | public | system
    payload: partial.payload || {},
    caused_by: partial.caused_by || [],
    prev_hash: last?.hash ?? null,
  };
  event.hash = eventHash(event);
  fs.mkdirSync(path.dirname(logPath()), { recursive: true });
  fs.appendFileSync(logPath(), JSON.stringify(event) + '\n');
  return event;
}

export function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}
export function writeText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const DEFAULTS = {
  version: 1,
  seed_population: 3,
  max_population: 8,
  on_empty_world: 'reseed',
  max_turns_per_day: 12,
  turn: { max_actions: 8, max_publish: 2, max_messages: 4, max_chars: 20000 },
  birth: { min_turns_between_births: 3, requires_operator_approval: false },
  context: { recent_public_events: 15, candidates: 8 },
};

export function loadConfig() {
  const raw = readText(p('control', 'config.json'));
  const user = raw ? JSON.parse(raw) : {};
  const merged = { ...DEFAULTS, ...user };
  for (const k of ['turn', 'birth', 'context']) merged[k] = { ...DEFAULTS[k], ...(user[k] || {}) };
  return merged;
}

/** 운영자 정지 스위치. control/PAUSE 파일이 있으면 정지다. 개체 행동으로는 만들거나 지울 수 없다. */
export const isPaused = () => fs.existsSync(p('control', 'PAUSE'));

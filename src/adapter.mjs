// JSON-lines interface for a model without shell/repository credentials.
// Only scoped reads and unexecuted proposals are exposed. The host executes envelopes.
import readline from 'node:readline';
import crypto from 'node:crypto';
import { loadEvents, withTransaction, loadConfig } from './runtime/store.mjs';
import { project } from './runtime/world.mjs';
import { read } from './runtime/read.mjs';
const turnId = process.argv[2];
for await (const line of readline.createInterface({ input: process.stdin })) {
  try {
    const result = withTransaction(() => {
      if (line.length > loadConfig().turn.max_chars * 3) throw new Error('Request too large');
      const request = JSON.parse(line), w = project(loadEvents());
      if (!w.turn || w.turn.turn_id !== turnId) throw new Error('Turn changed; adapter closed');
      if (request.op === 'read') return { text: read(request.kind, request.arg, request.extra) };
      if (request.op === 'propose') return { envelope: { request_id: crypto.randomUUID(), turn_id: turnId, expected_seq: w.seq, proposal: request.proposal } };
      throw new Error('Only read and propose are available');
    });
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (e) { console.log(JSON.stringify({ ok: false, error: e.message })); }
}

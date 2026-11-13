// A proposal-only process: reads JSON from stdin, has no repository imports or writes.
// The outer runner supplies the current turn ID and expected world sequence.
import fs from 'node:fs';
import crypto from 'node:crypto';
const [turn_id, seq] = process.argv.slice(2);
if (!turn_id || !Number.isSafeInteger(Number(seq))) throw new Error('Usage: node src/proposal.mjs <turn-id> <world-seq> < proposal.json');
const proposal = JSON.parse(fs.readFileSync(0, 'utf8'));
console.log(JSON.stringify({ request_id: crypto.randomUUID(), turn_id, expected_seq: Number(seq), proposal }, null, 2));

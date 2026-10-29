import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFrame,
  initialStreamState,
  pseudonymousUserId,
  SseParser,
  StreamState,
  toGenkiFilters,
} from './genki';

function run(frames: string[]): StreamState {
  return frames.reduce(applyFrame, initialStreamState());
}

const delta = (content: string) => JSON.stringify({ choices: [{ delta: { content } }] });

test('SseParser joins events split across chunks and drops keep-alive comments', () => {
  const parser = new SseParser();
  assert.deepEqual(parser.push('data: {"a":'), []);
  assert.deepEqual(parser.push('1}\n\n: keep-alive\n\ndata: [DO'), ['{"a":1}']);
  assert.deepEqual(parser.push('NE]\n\n'), ['[DONE]']);
  assert.deepEqual(parser.flush(), []);
});

test('SseParser handles CRLF and a last event without a blank line', () => {
  const parser = new SseParser();
  assert.deepEqual(parser.push('data: one\r\n\r\ndata: two'), ['one']);
  assert.deepEqual(parser.flush(), ['two']);
});

test('text deltas accumulate', () => {
  const state = run([
    JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] }),
    delta('Rapporten '),
    delta('sier [1].'),
  ]);
  assert.equal(state.text, 'Rapporten sier [1].');
});

test('a retract frame drops the draft text', () => {
  const state = run([
    delta('draft [1]'),
    JSON.stringify({ choices: [{ delta: {} }], retract: true }),
    delta('Final [2].'),
  ]);
  assert.equal(state.text, 'Final [2].');
});

test('sources, finish reason and [DONE] are read', () => {
  const sources = [{ index: 2, title: 'T', url: 'https://docs.digdir.no/a.html' }];
  const state = run([
    delta('x'),
    JSON.stringify({ choices: [{ delta: {} }], citations: [sources[0].url], sources }),
    JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
    '[DONE]',
  ]);
  assert.deepEqual(state.sources, sources);
  assert.equal(state.finishReason, 'stop');
  assert.equal(state.done, true);
  assert.equal(state.error, null);
});

test('finish_reason error is an error, with the message when given', () => {
  assert.equal(
    run([JSON.stringify({ choices: [{ delta: {}, finish_reason: 'error' }] })]).error,
    'genki run failed',
  );
  assert.equal(
    run([
      JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'error' }],
        error: { message: 'model timeout' },
      }),
    ]).error,
    'model timeout',
  );
});

test('no_answer and notice are kept', () => {
  const state = run([
    JSON.stringify({ choices: [{ delta: {} }], no_answer: true, notice: 'Ingen treff' }),
  ]);
  assert.equal(state.noAnswer, true);
  assert.equal(state.notice, 'Ingen treff');
});

test('frames that are not JSON are ignored', () => {
  assert.equal(run([delta('a'), 'not json', delta('b')]).text, 'ab');
});

test('toGenkiFilters accepts the short map and the contract shape', () => {
  assert.deepEqual(toGenkiFilters({ product: ['Maskinporten'] }), {
    fields: [{ field: 'product', 'selected-options': ['Maskinporten'] }],
  });
  assert.deepEqual(toGenkiFilters({ product: 'product_notifications' }), {
    fields: [{ field: 'product', 'selected-options': ['product_notifications'] }],
  });
  const full = { fields: [{ field: 'product', 'selected-options': ['KRR'] }] };
  assert.deepEqual(toGenkiFilters(full), full);
  assert.equal(toGenkiFilters(null), undefined);
  assert.equal(toGenkiFilters({ product: [] }), undefined);
});

test('pseudonymousUserId is stable and does not contain the Slack ids', () => {
  const id = pseudonymousUserId('T123', 'U456');
  assert.equal(id, pseudonymousUserId('T123', 'U456'));
  assert.notEqual(id, pseudonymousUserId('T123', 'U457'));
  assert.match(id, /^[0-9a-f]{64}$/);
});

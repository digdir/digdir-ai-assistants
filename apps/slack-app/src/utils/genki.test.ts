import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import {
  applyFrame,
  askGenki,
  askGenkiWithFallback,
  isModelMissing,
  GenkiError,
  toGenkiTarget,
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

test('askGenki streams an answer, retrying once when genki is unavailable', async () => {
  const requests: any[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      requests.push({ headers: req.headers, body: JSON.parse(body) });
      if (requests.length === 1) {
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'genai-task': 'task-1' });
      const frames = [
        delta('utkast'),
        JSON.stringify({ choices: [{ delta: {} }], retract: true }),
        delta('Svar [1]'),
        JSON.stringify({ choices: [{ delta: {} }], sources: [{ index: 1, url: 'https://x.no' }] }),
        JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      ];
      res.write(': keep-alive\n\n');
      for (const frame of frames) res.write(`data: ${frame}\n\n`);
      res.end('data: [DONE]\n\n');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.GENKI_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  process.env.GENKI_API_KEY = 'test-key';
  process.env.GENKI_RETRY_MS = '10';

  const shown: string[] = [];
  try {
    const answer = await askGenki({
      model: 'docs-assistant__default',
      messages: [{ role: 'user', content: 'Hei' }],
      userId: 'pseudonym',
      filters: { fields: [{ field: 'product', 'selected-options': ['KRR'] }] },
      onText: (text) => shown.push(text),
    });
    assert.equal(answer.text, 'Svar [1]');
    assert.equal(answer.taskId, 'task-1');
    assert.deepEqual(answer.sources, [{ index: 1, url: 'https://x.no' }]);
    assert.equal(answer.finishReason, 'stop');
    assert.deepEqual(shown, ['utkast', '', 'Svar [1]']);
  } finally {
    server.close();
  }

  assert.equal(requests.length, 2);
  const { headers, body } = requests[1];
  assert.equal(headers['x-api-key'], 'test-key');
  assert.equal(headers['x-user-id'], 'pseudonym');
  assert.equal(body.stream, true);
  assert.equal(body.genai_stream, 'live');
  assert.deepEqual(body.filters, { fields: [{ field: 'product', 'selected-options': ['KRR'] }] });
});

test('toGenkiTarget defaults the model and normalises filters', () => {
  assert.deepEqual(
    toGenkiTarget({ filters: { product: ['product_notifications'] } }, 'd__default'),
    {
      model: 'd__default',
      filters: { fields: [{ field: 'product', 'selected-options': ['product_notifications'] }] },
    },
  );
  assert.equal(toGenkiTarget(null, 'd__default'), undefined);
});

test('isModelMissing matches only a 404 for an unknown model', () => {
  assert.equal(isModelMissing(new GenkiError('x', 404, 'agent_not_found')), true);
  assert.equal(isModelMissing(new GenkiError('x', 404, 'model_not_found')), true);
  assert.equal(isModelMissing(new GenkiError('x', 404, 'conversation_not_found')), false);
  assert.equal(isModelMissing(new GenkiError('x', 400, 'invalid_filters')), false);
});

test('askGenkiWithFallback asks the fallback when the variant is not published', async () => {
  const bodies: any[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      bodies.push(parsed);
      if (parsed.model === 'docs-assistant__altinn-notifications') {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Agent not found', code: 'agent_not_found' } }));
        return;
      }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'genai-task': 'task-2' });
      res.end(`data: ${delta('Svar')}\n\ndata: [DONE]\n\n`);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.GENKI_API_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const fallback = toGenkiTarget(
    { filters: { product: ['product_notifications'] } },
    'docs-assistant__default',
  );
  try {
    const answer = await askGenkiWithFallback(
      {
        model: 'docs-assistant__altinn-notifications',
        messages: [{ role: 'user', content: 'Hei' }],
        userId: 'p',
      },
      fallback,
    );
    assert.equal(answer.text, 'Svar');
    assert.equal(answer.model, 'docs-assistant__default');
    assert.deepEqual(answer.filters, fallback!.filters);
  } finally {
    server.close();
  }
  assert.deepEqual(
    bodies.map((b) => [b.model, b.filters?.fields?.[0]?.['selected-options']?.[0]]),
    [
      ['docs-assistant__altinn-notifications', undefined],
      ['docs-assistant__default', 'product_notifications'],
    ],
  );
});

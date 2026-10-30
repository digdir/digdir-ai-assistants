import { test } from 'node:test';
import assert from 'node:assert/strict';
import yaml from 'js-yaml';
import { mergeConfig, parseConfigRows } from './bot-config';
import { SlackApp, SlackContext } from './slack';

const app = new SlackApp({ app_id: 'UBOT', bot_name: 'docs' });
const context = (channel_id: string, team_id = 'T1') =>
  new SlackContext({ ts_date: 1, ts_time: 1, channel_id, team_id });

const rows = parseConfigRows(
  yaml.load(`
- slack_context: { channel_id: C-VARSEL }
  config:
    genki.filters: { product: [product_notifications] }
- slack_context: { team_id: T1 }
  config:
    genki.model: docs-assistant__default
    genki.filters: { product: [general] }
- config:
    ignoreWhenNotTagged: true
    genki.model: fallback__default
- slack_context: { team_id: T2 }
  config:
    genki.model: other__default
`),
);

test('a workspace row overrides the generic row', () => {
  assert.deepEqual(mergeConfig(rows, app, context('C-ALL')), {
    ignoreWhenNotTagged: true,
    'genki.model': 'docs-assistant__default',
    'genki.filters': { product: ['general'] },
  });
});

test('a channel row overrides the workspace row key by key', () => {
  assert.deepEqual(mergeConfig(rows, app, context('C-VARSEL')), {
    ignoreWhenNotTagged: true,
    'genki.model': 'docs-assistant__default',
    'genki.filters': { product: ['product_notifications'] },
  });
});

test('rows for another workspace do not apply', () => {
  assert.equal(mergeConfig(rows, app, context('C-ALL', 'T3'))['genki.model'], 'fallback__default');
  assert.equal(mergeConfig(rows, app, context('C-ALL', 'T2'))['genki.model'], 'other__default');
});

test('rows for another bot do not apply', () => {
  const other = parseConfigRows([{ slack_app: { bot_name: 'other' }, config: { x: 1 } }]);
  assert.deepEqual(mergeConfig(other, app, context('C-ALL')), {});
});

test('a malformed file is refused', () => {
  assert.throws(() => parseConfigRows([{ slack_context: { channel_id: 'C1' } }]));
});

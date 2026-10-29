import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSWER_EVENT_TYPE,
  answerMetadata,
  SlackThreadMessage,
  stripMentions,
  threadHasAnswer,
  threadToMessages,
} from './thread-history';

const BOT = 'UBOT';
const answerMeta = {
  event_type: ANSWER_EVENT_TYPE,
  event_payload: { task_id: 't-1', model: 'docs-assistant__default', asker_user_id: 'U1' },
};

const thread: SlackThreadMessage[] = [
  { ts: '100.000001', user: 'U1', text: '<@UBOT> Hva er Maskinporten?' },
  { ts: '100.000002', user: BOT, text: 'Leser dokumentasjonen...' },
  {
    ts: '100.000003',
    user: BOT,
    text: 'Maskinporten er [1] en tjeneste &amp; mer.',
    metadata: answerMeta,
  },
  { ts: '100.000004', user: 'U2', subtype: 'channel_join', text: 'joined' },
  { ts: '100.000005', user: 'U1', text: 'Og hva koster det?' },
];

test('a thread becomes alternating turns, without the bot placeholder', () => {
  const current = { ts: '100.000006', user: 'U1', text: '<@UBOT> og i test?' };
  assert.deepEqual(threadToMessages(thread, BOT, current), [
    { role: 'user', content: 'Hva er Maskinporten?' },
    { role: 'assistant', content: 'Maskinporten er [1] en tjeneste & mer.' },
    { role: 'user', content: 'Og hva koster det?\n\nog i test?' },
  ]);
});

test('the current message is added once even if the fetched thread has it', () => {
  const current = thread[4];
  const turns = threadToMessages(thread, BOT, current);
  assert.equal(turns[turns.length - 1].content, 'Og hva koster det?');
  assert.equal(turns.length, 3);
});

test('later messages than the current one are left out, and order follows ts', () => {
  const shuffled = [thread[4], thread[2], thread[0]];
  const current = { ts: '100.000003', user: 'U1', text: 'Mellom' };
  assert.deepEqual(threadToMessages(shuffled, BOT, current), [
    { role: 'user', content: 'Hva er Maskinporten?\n\nMellom' },
  ]);
});

test('history is capped and starts with a user turn', () => {
  const long: SlackThreadMessage[] = [];
  for (let i = 0; i < 30; i++) {
    long.push({ ts: `${200 + i * 2}.0`, user: 'U1', text: `q${i}` });
    long.push({ ts: `${201 + i * 2}.0`, user: BOT, text: `a${i}`, metadata: answerMeta });
  }
  const turns = threadToMessages(long, BOT, { ts: '999.0', user: 'U1', text: 'siste' }, 5);
  assert.equal(turns[0].role, 'user');
  assert.ok(turns.length <= 5);
  assert.equal(turns[turns.length - 1].content, 'siste');
});

test('threadHasAnswer only counts genki answers by the bot', () => {
  assert.equal(threadHasAnswer(thread, BOT), true);
  assert.equal(
    threadHasAnswer(
      thread.filter((m) => !m.metadata),
      BOT,
    ),
    false,
  );
  assert.equal(threadHasAnswer([{ ...thread[2], user: 'UOTHER' }], BOT), false);
});

test('answerMetadata reads the task id', () => {
  assert.equal(answerMetadata(thread[2])?.task_id, 't-1');
  assert.equal(answerMetadata(thread[1]), null);
});

test('stripMentions removes the bot mention only', () => {
  assert.equal(stripMentions('<@UBOT>  hei <@U2>', BOT), 'hei <@U2>');
});

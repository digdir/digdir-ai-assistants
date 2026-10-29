import { GenkiMessage } from './genki';

// Slack message metadata on every answer the bot posts. It carries the genki task id
// (for feedback) and marks the message as an answer when the thread is read back.
export const ANSWER_EVENT_TYPE = 'genki_answer';

export interface AnswerMetadata {
  task_id: string;
  model: string;
  asker_user_id: string;
}

export interface SlackThreadMessage {
  ts?: string;
  user?: string;
  bot_id?: string;
  subtype?: string;
  text?: string;
  metadata?: { event_type?: string; event_payload?: any };
}

// User messages that carry a question; everything else (joins, edits, bot posts) is skipped.
const USER_SUBTYPES = [undefined, 'thread_broadcast', 'file_share'];

export function stripMentions(text: string, botUserId: string): string {
  return text.split(`<@${botUserId}>`).join('').replace(/\s+/g, ' ').trim();
}

export function unescapeSlack(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function isAnswer(message: SlackThreadMessage, botUserId: string): boolean {
  return message.user === botUserId && message.metadata?.event_type === ANSWER_EVENT_TYPE;
}

export function answerMetadata(message: SlackThreadMessage): AnswerMetadata | null {
  if (message.metadata?.event_type !== ANSWER_EVENT_TYPE) return null;
  const payload = message.metadata.event_payload || {};
  return typeof payload.task_id === 'string' ? (payload as AnswerMetadata) : null;
}

export function threadHasAnswer(messages: SlackThreadMessage[], botUserId: string): boolean {
  return messages.some((message) => isAnswer(message, botUserId));
}

function isUserMessage(message: SlackThreadMessage, botUserId: string): boolean {
  return (
    !!message.user &&
    message.user !== botUserId &&
    !message.bot_id &&
    USER_SUBTYPES.includes(message.subtype)
  );
}

// The conversation so far, oldest first, ending with the `current` message (which
// the thread fetched from Slack may or may not include yet). The bot's own answers
// become assistant turns; its other posts are left out.
export function threadToMessages(
  thread: SlackThreadMessage[],
  botUserId: string,
  current: SlackThreadMessage,
  maxMessages: number = 20,
): GenkiMessage[] {
  const turns: GenkiMessage[] = [];
  const ordered = [
    ...thread
      .filter((message) => message.ts && Number(message.ts) < Number(current.ts))
      .sort((a, b) => Number(a.ts) - Number(b.ts)),
    current,
  ];

  for (const message of ordered) {
    let turn: GenkiMessage | null = null;
    if (isAnswer(message, botUserId)) {
      turn = { role: 'assistant', content: unescapeSlack(message.text || '').trim() };
    } else if (isUserMessage(message, botUserId)) {
      turn = { role: 'user', content: unescapeSlack(stripMentions(message.text || '', botUserId)) };
    }
    if (!turn || turn.content === '') continue;

    const last = turns[turns.length - 1];
    if (last && last.role === turn.role) {
      last.content += '\n\n' + turn.content;
    } else {
      turns.push(turn);
    }
  }

  const recent = turns.slice(-maxMessages);
  while (recent.length > 0 && recent[0].role !== 'user') {
    recent.shift();
  }
  return recent;
}

import { createHash } from 'crypto';
import { envVar } from './general';

// Client for genki's OpenAI-compatible /v1 API (see genki's frontend contract).

export interface GenkiExcerpt {
  chunk_id?: string;
  text?: string;
  position?: number;
}

export interface GenkiSource {
  index?: number;
  title?: string;
  url?: string;
  document_id?: string;
  excerpts?: GenkiExcerpt[];
}

export interface GenkiFilterField {
  field: string;
  type?: 'multiselect' | 'contains' | 'not-in-set';
  'value-type'?: 'string' | 'integer';
  'selected-options': Array<string | number>;
}

export interface GenkiFilters {
  fields: GenkiFilterField[];
}

// Filters from config, either in the contract's shape ({fields: [...]}) or as a short
// map from field to selected values ({product: ['Maskinporten']}).
export function toGenkiFilters(value: unknown): GenkiFilters | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const fields: GenkiFilterField[] = Array.isArray((value as any).fields)
    ? (value as any).fields
    : Object.entries(value as Record<string, unknown>).map(([field, selected]) => ({
        field,
        'selected-options': (Array.isArray(selected) ? selected : [selected]) as Array<
          string | number
        >,
      }));
  const nonEmpty = fields.filter((f) => f?.field && f['selected-options']?.length > 0);
  return nonEmpty.length > 0 ? { fields: nonEmpty } : undefined;
}

export interface GenkiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenkiAskParams {
  model: string;
  messages: GenkiMessage[];
  userId: string;
  filters?: GenkiFilters;
  // called with the whole answer text shown so far, after every change
  onText?: (text: string) => void;
}

export interface GenkiAnswer {
  text: string;
  sources: GenkiSource[];
  taskId: string;
  model: string;
  finishReason: string | null;
  noAnswer: boolean;
  notice: string;
  error: string | null;
}

export class GenkiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
    this.name = 'GenkiError';
  }
}

export function genkiApiUrl(): string {
  return (envVar('GENKI_API_URL', '') as string).replace(/\/+$/, '');
}

function genkiHeaders(userId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'X-API-Key': envVar('GENKI_API_KEY', ''),
  };
  if (userId) {
    headers['X-User-Id'] = userId;
  }
  return headers;
}

// genki needs a stable id per end user, but never the Slack ids themselves
export function pseudonymousUserId(teamId: string | undefined, userId: string | undefined): string {
  return createHash('sha256')
    .update(`${teamId || ''}:${userId || ''}`)
    .digest('hex');
}

// Splits a server-sent event stream into the payloads of its `data:` lines.
// Comment lines such as `: keep-alive` are dropped.
export class SseParser {
  private buffer = '';

  push(chunk: string): string[] {
    this.buffer += chunk;
    const events = this.buffer.split(/\r?\n\r?\n/);
    this.buffer = events.pop() || '';
    return events.map(dataOf).filter((data): data is string => data !== null);
  }

  flush(): string[] {
    const rest = dataOf(this.buffer);
    this.buffer = '';
    return rest === null ? [] : [rest];
  }
}

function dataOf(event: string): string | null {
  const lines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''));
  return lines.length > 0 ? lines.join('\n') : null;
}

export interface StreamState {
  text: string;
  sources: GenkiSource[];
  finishReason: string | null;
  noAnswer: boolean;
  notice: string;
  error: string | null;
  done: boolean;
}

export function initialStreamState(): StreamState {
  return {
    text: '',
    sources: [],
    finishReason: null,
    noAnswer: false,
    notice: '',
    error: null,
    done: false,
  };
}

// Applies one `data:` payload to the stream state.
export function applyFrame(state: StreamState, data: string): StreamState {
  if (data.trim() === '[DONE]') {
    return { ...state, done: true };
  }

  let frame: any;
  try {
    frame = JSON.parse(data);
  } catch (e) {
    console.warn(`genki: ignoring frame that is not JSON: ${data.substring(0, 200)}`);
    return state;
  }

  const next = { ...state };
  if (frame.retract === true) {
    // the platform replaced its draft: drop what was shown and start again
    next.text = '';
  }

  const choice = frame.choices?.[0];
  const content = choice?.delta?.content;
  if (typeof content === 'string') {
    next.text += content;
  }
  if (Array.isArray(frame.sources)) {
    next.sources = frame.sources;
  }
  if (frame.no_answer === true) {
    next.noAnswer = true;
  }
  if (typeof frame.notice === 'string') {
    next.notice = frame.notice;
  }
  if (choice?.finish_reason) {
    next.finishReason = choice.finish_reason;
  }
  if (frame.error) {
    next.error = frame.error.message || JSON.stringify(frame.error);
  }
  if (next.finishReason === 'error' && !next.error) {
    next.error = 'genki run failed';
  }
  return next;
}

async function errorFromResponse(response: Response): Promise<GenkiError> {
  let message = response.statusText;
  let code = '';
  try {
    const body: any = await response.json();
    // /v1 answers OpenAI's error shape, /api answers problem+json
    message = body?.error?.message || body?.detail || body?.title || message;
    code = body?.error?.code || body?.code || '';
  } catch (e) {
    // not JSON; keep the status text
  }
  return new GenkiError(`genki ${response.status}: ${message}`, response.status, code);
}

export async function askGenki(params: GenkiAskParams): Promise<GenkiAnswer> {
  const response = await fetch(`${genkiApiUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: genkiHeaders(params.userId),
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      ...(params.filters && params.filters.fields.length > 0 ? { filters: params.filters } : {}),
      stream: true,
      genai_stream: 'live',
    }),
    signal: AbortSignal.timeout(Number(envVar('GENKI_TIMEOUT_MS', 180000))),
  });

  if (!response.ok || !response.body) {
    throw await errorFromResponse(response);
  }

  const taskId = response.headers.get('genai-task') || '';
  const model = response.headers.get('genai-model') || params.model;

  let state = initialStreamState();
  const parser = new SseParser();
  const decoder = new TextDecoder();

  const apply = (payloads: string[]) => {
    for (const data of payloads) {
      const before = state.text;
      state = applyFrame(state, data);
      if (state.text !== before && params.onText) {
        params.onText(state.text);
      }
    }
  };

  const reader = response.body.getReader();
  while (!state.done) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    apply(parser.push(decoder.decode(value, { stream: true })));
  }
  apply(parser.flush());
  reader.cancel().catch(() => {});

  return {
    text: state.text,
    sources: state.sources,
    taskId,
    model,
    finishReason: state.finishReason,
    noAnswer: state.noAnswer,
    notice: state.notice,
    error: state.error,
  };
}

export async function sendGenkiFeedback(
  taskId: string,
  rating: 'up' | 'down',
  comment?: string,
): Promise<void> {
  const response = await fetch(`${genkiApiUrl()}/api/feedback`, {
    method: 'POST',
    headers: genkiHeaders(),
    body: JSON.stringify({ task: taskId, rating, ...(comment ? { comment } : {}) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw await errorFromResponse(response);
  }
}

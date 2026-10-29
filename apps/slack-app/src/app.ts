import express from 'express';
import path from 'path';
import { App, AppOptions, ExpressReceiver, LogLevel, GenericMessageEvent } from '@slack/bolt';
import { ChatUpdateResponse } from '@slack/web-api';
import { createServer } from 'http';
import {
  getEventContext,
  timeSecondsToMs,
  getReactionItemContext,
  getChatUpdateContext,
  getThreadResponseContext,
  SlackApp,
  SlackContext,
} from './utils/slack';
import { lookupConfig } from './utils/bot-config';
import { envVar, round, lapTimer, stripCodeBlockLang, isNullOrEmpty } from './utils/general';
import { botLog, BotLogEntry, updateReactions } from './utils/bot-log';
import {
  askGenkiWithFallback,
  GenkiAnswer,
  GenkiFilters,
  GenkiMessage,
  pseudonymousUserId,
  sendGenkiFeedback,
  toGenkiFilters,
  toGenkiTarget,
} from './utils/genki';
import {
  botTexts,
  escapeSlackLinkText,
  fitBlocks,
  linkCitations,
  looksNorwegian,
  sectionBlock,
  sourceBlocks,
  sourceLinks,
} from './utils/answer-format';
import {
  ANSWER_EVENT_TYPE,
  AnswerMetadata,
  answerMetadata,
  SlackThreadMessage,
  stripMentions,
  threadHasAnswer,
  threadToMessages,
} from './utils/thread-history';
import { markdownToBlocks } from '@bdb-dd/mack';

// Socket mode connects out to Slack (no public URL needed); otherwise Slack posts
// events to /bolt.
const socketMode = envVar('SLACK_SOCKET_MODE') == 'true';

const expressReceiver = socketMode
  ? null
  : new ExpressReceiver({
      signingSecret: envVar('SLACK_BOT_SIGNING_SECRET'),
    });

const appOptions: AppOptions = socketMode
  ? {
      token: envVar('SLACK_BOT_TOKEN'),
      appToken: envVar('SLACK_APP_TOKEN'),
      socketMode: true,
      logLevel: LogLevel.INFO,
    }
  : {
      token: envVar('SLACK_BOT_TOKEN'),
      signingSecret: envVar('SLACK_BOT_SIGNING_SECRET'),
      receiver: expressReceiver!,
      logLevel: LogLevel.INFO,
    };
const app = new App(appOptions);

const slackApp: SlackApp = new SlackApp({
  app_id: '',
  bot_name: 'docs',
});

// Message subtypes that carry a question from a person.
const QUESTION_SUBTYPES = [undefined, 'thread_broadcast', 'file_share'];

async function ensureBotContext() {
  if (slackApp.app_id == '') {
    const appInfo = await app.client.auth.test();
    slackApp.app_id = appInfo.user_id || '';
  }
  if (slackApp.app_id == '') {
    console.error(`app_id not set!`);
  }
}

// Details of recent answers for :stopwatch:, kept in memory only.
interface AnswerDetails {
  answer: GenkiAnswer;
  filters?: GenkiFilters;
  durations: Record<string, number>;
  turns: number;
}
const recentAnswers = new Map<string, AnswerDetails>();
const RECENT_ANSWERS_MAX = 500;

function rememberAnswer(taskId: string, details: AnswerDetails) {
  if (!taskId) return;
  recentAnswers.set(taskId, details);
  while (recentAnswers.size > RECENT_ANSWERS_MAX) {
    recentAnswers.delete(recentAnswers.keys().next().value!);
  }
}

async function fetchThread(channel: string, threadTs: string): Promise<SlackThreadMessage[]> {
  const replies = await app.client.conversations.replies({
    channel,
    ts: threadTs,
    include_all_metadata: true,
    limit: 200,
  });
  return (replies.messages || []) as SlackThreadMessage[];
}

async function fetchMessage(channel: string, ts: string): Promise<SlackThreadMessage | null> {
  const replies = await app.client.conversations.replies({
    channel,
    ts,
    latest: ts,
    oldest: ts,
    inclusive: true,
    limit: 1,
    include_all_metadata: true,
  });
  const found = (replies.messages || []).find((message) => message.ts === ts);
  return (found as SlackThreadMessage) || null;
}

// Listens to incoming messages
app.message(async ({ message, say }) => {
  if (envVar('DEBUG_SLACK') == 'true') {
    console.log('-- incoming slack message event payload --');
    console.log(JSON.stringify(message, null, 2));
  }

  await ensureBotContext();

  const genericMsg = message as GenericMessageEvent;

  if (!QUESTION_SUBTYPES.includes(genericMsg.subtype)) {
    // edits, deletions, joins and bot posts are not questions
    return;
  }

  if (genericMsg.user === slackApp.app_id || genericMsg.bot_id) {
    // never answer the bot's own posts
    return;
  }

  const rawText = (genericMsg.text || '').trim();
  const userInput = stripMentions(rawText, slackApp.app_id);

  if (isNullOrEmpty(userInput)) {
    console.log('Ignoring empty userInput.');
    return;
  }

  const mentioned = rawText.includes(`<@${slackApp.app_id}>`);
  const isDirectMessage = genericMsg.channel_type == 'im';
  const inThread = !isNullOrEmpty(genericMsg.thread_ts) && genericMsg.thread_ts !== genericMsg.ts;

  var srcEvtContext = await getEventContext(app.client, genericMsg);

  if (envVar('LOG_LEVEL') == 'debug') {
    console.log(`slackApp:\n${JSON.stringify(slackApp)}`);
    console.log(`slackContext:\n${JSON.stringify(srcEvtContext)}`);
  }

  let thread: SlackThreadMessage[] = [];
  if (inThread) {
    thread = await fetchThread(genericMsg.channel, genericMsg.thread_ts!);
    // in a channel: a follow-up in a thread the bot has answered, or when tagged
    const threadRepliesNeedMention = await lookupConfig(
      slackApp,
      srcEvtContext,
      'genki.threadRepliesNeedMention',
      false,
    );
    const followUp = threadHasAnswer(thread, slackApp.app_id);
    if (!mentioned && !isDirectMessage && (!followUp || threadRepliesNeedMention)) {
      return;
    }
  } else if (!mentioned && !isDirectMessage) {
    const ignoreWhenNotTagged = await lookupConfig(
      slackApp,
      srcEvtContext,
      'ignoreWhenNotTagged',
      true,
    );
    if (ignoreWhenNotTagged == true) {
      if (envVar('LOG_LEVEL') == 'debug') {
        console.log(
          'Bot was not mentioned in channel message and ignoreWhenNotTagged is true, ignoring message.',
        );
      }
      return;
    }
  }

  const model: string = await lookupConfig(
    slackApp,
    srcEvtContext,
    'genki.model',
    envVar('GENKI_MODEL', ''),
  );
  const filters = toGenkiFilters(
    await lookupConfig(slackApp, srcEvtContext, 'genki.filters', null),
  );
  const fallback = toGenkiTarget(
    await lookupConfig(slackApp, srcEvtContext, 'genki.fallback', null),
    envVar('GENKI_MODEL', ''),
  );
  const streamUpdateSec = Number(
    await lookupConfig(slackApp, srcEvtContext, 'genki.streamUpdateSec', 1.5),
  );

  const norwegianQuestion = looksNorwegian(userInput);
  const busyReadingMsg = norwegianQuestion
    ? await lookupConfig(
        slackApp,
        srcEvtContext,
        'docs.readingMessage.no',
        'Leser dokumentasjonen...',
      )
    : await lookupConfig(
        slackApp,
        srcEvtContext,
        'docs.readingMessage.en',
        'Reading the documentation...',
      );

  // #1 - Respond in the thread while genki works
  const threadTs = genericMsg.thread_ts || genericMsg.ts;
  let firstThreadTs: any = await say({
    text: busyReadingMsg,
    thread_ts: threadTs,
  });

  const messages: GenkiMessage[] = inThread
    ? threadToMessages(thread, slackApp.app_id, { ...genericMsg, text: rawText })
    : [{ role: 'user', content: userInput }];

  const languageCode = norwegianQuestion ? 'no' : 'en';
  botLog({
    slack_context: { ...srcEvtContext, user_type: 'human' },
    slack_app: slackApp,
    elapsed_ms: 0,
    step_name: 'genki_question',
    content: {
      bot_name: 'docs',
      original_user_query: userInput,
      english_user_query: userInput,
      user_query_language_code: languageCode,
      user_query_language_name: norwegianQuestion ? 'Norwegian' : 'English',
      content_category: '',
      thread_turns: messages.length,
    },
    content_type: 'docs_user_query',
  });

  const streamer = updateSlackMsgCallback(app, firstThreadTs, streamUpdateSec);

  const start = performance.now();
  let answer: GenkiAnswer | null = null;
  let genkiError: string | null = null;

  try {
    answer = await askGenkiWithFallback(
      {
        model,
        messages,
        filters,
        userId: pseudonymousUserId(srcEvtContext.team_id, srcEvtContext.user_id),
        onText: streamer.update,
      },
      fallback,
    );
    if (answer.error) {
      genkiError = answer.error;
    }
  } catch (e) {
    genkiError = e instanceof Error ? e.message : JSON.stringify(e);
  }
  await streamer.stop();
  const duration = round(lapTimer(start));
  const durations = { total: duration, generate: duration };

  if (genkiError || !answer) {
    console.log(`\n\nERROR running genki: ${genkiError}\n\n`);

    try {
      await app.client.chat.update({
        channel: firstThreadTs.channel,
        ts: firstThreadTs.ts,
        text: botTexts(norwegianQuestion).error,
        blocks: [],
      });
    } catch (e) {
      console.log(`Error attempting to update app reply ${e}`);
    }

    await botLog({
      slack_context: await getThreadResponseContext(app.client, srcEvtContext, firstThreadTs.ts),
      slack_app: slackApp,
      elapsed_ms: timeSecondsToMs(duration),
      durations,
      step_name: 'genki_answer',
      content: {
        bot_name: 'docs',
        original_user_query: userInput,
        error: genkiError,
        genki_task: answer?.taskId || '',
        model,
        rag_success: false,
      },
      content_type: 'docs_bot_error',
    });
    return;
  }

  if (answer.fallbackFrom) {
    // a mistyped or unpublished model id would otherwise go unnoticed
    console.warn(
      `WARNING genki model '${answer.fallbackFrom}' not found for channel ${srcEvtContext.channel_id} ` +
        `(${srcEvtContext.channel_name}); answered with fallback '${answer.model}'.`,
    );
  }

  rememberAnswer(answer.taskId, {
    answer,
    filters: answer.filters,
    durations,
    turns: messages.length,
  });

  const payload = {
    bot_name: 'docs',
    original_user_query: userInput,
    english_user_query: userInput,
    user_query_language_code: languageCode,
    user_query_language_name: norwegianQuestion ? 'Norwegian' : 'English',
    // genki answers in the question's language, so both views show the same text
    english_answer: answer.text,
    translated_answer: answer.text,
    search_queries: [],
    source_urls: answer.sources.map((source) => source.url || ''),
    source_documents: answer.sources.map((source) => ({
      index: source.index,
      title: source.title,
      url: source.url,
      document_id: source.document_id,
      page_content: (source.excerpts || []).map((excerpt) => excerpt.text || '').join('\n\n'),
    })),
    relevant_urls: sourceLinks(answer.text, answer.sources),
    not_loaded_urls: [],
    rag_success: !answer.noAnswer,
    genki_task: answer.taskId,
    model: answer.model,
    filters: answer.filters || null,
    fallback_from: answer.fallbackFrom || null,
    thread_turns: messages.length,
  };

  let finalizeError = null;
  let finalResponse: ChatUpdateResponse | undefined;

  try {
    finalResponse = await finalizeAnswer(app, answer, firstThreadTs, duration, {
      task_id: answer.taskId,
      model: answer.model,
      asker_user_id: genericMsg.user,
    });
  } catch (e) {
    finalizeError = e;
    console.error(`Error attempting to finalize app reply ${e}`);
  }

  let rag_logEntry: BotLogEntry | undefined;
  if (finalizeError != null) {
    rag_logEntry = {
      slack_context: await getThreadResponseContext(app.client, srcEvtContext, firstThreadTs.ts),
      slack_app: slackApp,
      elapsed_ms: timeSecondsToMs(duration),
      durations,
      step_name: 'genki_answer',
      content: { ...payload, error: `${finalizeError}` },
      content_type: 'docs_bot_error',
    };
  } else if (finalResponse != undefined) {
    rag_logEntry = {
      slack_context: await getChatUpdateContext(app.client, srcEvtContext, finalResponse),
      slack_app: slackApp,
      elapsed_ms: timeSecondsToMs(duration),
      durations,
      step_name: 'genki_answer',
      content: payload,
      content_type: 'docs_bot_reply',
    };
  }
  if (rag_logEntry != undefined) botLog(rag_logEntry);
});

function ratingForReaction(reaction: string): 'up' | 'down' | null {
  if (reaction === '+1' || reaction === 'thumbsup') return 'up';
  if (reaction === '-1' || reaction === 'thumbsdown') return 'down';
  return null;
}

async function handleReactionEvents(eventBody: any) {
  if (envVar('LOG_LEVEL') === 'debug-reactions') {
    console.log('handle reactions: eventBody: ', JSON.stringify(eventBody));
  }

  const event = eventBody?.body?.event;
  if (event?.item?.type !== 'message') {
    return;
  }

  await ensureBotContext();

  // only reactions on the bot's own messages count
  if (event.item_user !== slackApp.app_id) {
    if (envVar('LOG_LEVEL') === 'debug-reactions') {
      console.log(
        `Reaction was for something else, ignoring. Bot ID: ${slackApp.app_id}, reaction was on item with item_user: ${event.item_user}`,
      );
    }
    return;
  }

  const channel: string = event.item.channel;
  const ts: string = event.item.ts;
  let itemContext: SlackContext | null = null;
  let dbLog: BotLogEntry | null = null;

  try {
    itemContext = await getReactionItemContext(app.client, eventBody);
    const messageInfo = await app.client.reactions.get({ channel, timestamp: ts });
    const reactions = messageInfo?.message?.reactions || [];
    dbLog = await updateReactions(slackApp, itemContext, reactions);

    if (envVar('LOG_LEVEL') == 'info' || envVar('LOG_LEVEL') == 'debug') {
      console.log(
        `updated reactions:\ncontext: ${JSON.stringify(itemContext)}\nreactions: ${JSON.stringify(reactions)}`,
      );
    }
  } catch (e) {
    console.log(`Error updating reactions: ${e}`);
  }

  if (event.type !== 'reaction_added') {
    // genki feedback is an insert with no undo, so a removed reaction changes nothing there
    return;
  }

  const reaction = String(event.reaction || '').split('::')[0];
  const rating = ratingForReaction(reaction);
  if (!rating && reaction !== 'stopwatch') {
    return;
  }

  let meta: AnswerMetadata | null = null;
  try {
    const answerMessage = await fetchMessage(channel, ts);
    meta = answerMessage ? answerMetadata(answerMessage) : null;
  } catch (e) {
    console.log(`Error reading the answer message: ${e}`);
  }
  if (!meta) {
    // not a genki answer, e.g. a "Reading the documentation..." post or an older answer
    return;
  }

  if (rating) {
    const feedbackFromAnyone = await lookupConfig(
      slackApp,
      itemContext || new SlackContext({ ts_date: 0, ts_time: 0, channel_id: channel }),
      'genki.feedbackFromAnyone',
      false,
    );
    // genki takes the key's word for whose feedback it is, so only the asker rates
    if (!feedbackFromAnyone && event.user !== meta.asker_user_id) {
      console.log(`Not sending genki feedback: ${event.user} did not ask this question.`);
      return;
    }
    try {
      await sendGenkiFeedback(meta.task_id, rating);
      console.log(`Sent genki feedback '${rating}' for task ${meta.task_id}.`);
    } catch (e) {
      console.error(`Error sending genki feedback for task ${meta.task_id}: ${e}`);
    }
    return;
  }

  try {
    await app.client.chat.postEphemeral({
      channel,
      thread_ts: event.item.thread_ts || ts,
      user: event.user,
      text: 'Sources and timing',
      blocks: debugMessageBlocks(meta, recentAnswers.get(meta.task_id), dbLog),
    });
  } catch (e) {
    console.log(`Error posting debug message: ${e}`);
  }
}

app.event('reaction_added', async (event) => {
  await handleReactionEvents(event);
});

app.event('reaction_removed', async (event) => {
  await handleReactionEvents(event);
});

// Shows the answer in the Slack message while it streams. Updates are throttled to
// one per `intervalSec`; each one renders the whole text so far, so a retracted
// draft simply disappears with the next update.
function updateSlackMsgCallback(
  slackApp: App,
  threadTs: { channel?: string; ts?: string } | null,
  intervalSec: number,
): { update: (text: string) => void; stop: () => Promise<void> } {
  if (!threadTs?.channel || !threadTs.ts) {
    throw new Error('Slack message callback cannot be initialized without a valid channel or ts.');
  }
  const { channel, ts } = threadTs;

  let latest = '';
  let shown = '';
  let lastSent = 0;
  let timer: NodeJS.Timeout | null = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;

  const send = async () => {
    timer = null;
    if (stopped || latest === shown) return;
    const text = latest;
    lastSent = Date.now();
    try {
      const blocks = fitBlocks(await markdownToBlocks(stripCodeBlockLang(text || '…')), []);
      await slackApp.client.chat.update({ channel, ts, text: text || '…', blocks });
      shown = text;
    } catch (e) {
      console.log(`Error attempting to update Slack message ${e}`);
    }
    if (envVar('LOG_LEVEL') == 'debug') {
      console.log(`Partial response update for channel '${channel}' ts ${ts}, time: ${Date.now()}`);
    }
  };

  const schedule = () => {
    if (stopped || timer || inFlight) return;
    const wait = Math.max(0, lastSent + intervalSec * 1000 - Date.now());
    timer = setTimeout(() => {
      inFlight = send().finally(() => {
        inFlight = null;
        if (latest !== shown) schedule();
      });
    }, wait);
  };

  return {
    update: (text: string) => {
      latest = text;
      schedule();
    },
    stop: async () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
      if (inFlight) await inFlight;
    },
  };
}

async function finalizeAnswer(
  app: App,
  answer: GenkiAnswer,
  threadTs: { channel?: string; ts?: string } | null,
  duration: number,
  metadata: AnswerMetadata,
): Promise<ChatUpdateResponse> {
  if (!threadTs?.channel || !threadTs.ts) {
    throw new Error('Slack message callback cannot be initialized without a valid channel or ts.');
  }

  const texts = botTexts(looksNorwegian(answer.text));
  const body =
    answer.noAnswer || isNullOrEmpty(answer.text.trim())
      ? answer.notice || texts.noAnswer
      : answer.text;

  const answerBlocks = await markdownToBlocks(
    stripCodeBlockLang(linkCitations(body, answer.sources)),
  );
  const trailingBlocks = [
    ...sourceBlocks(sourceLinks(answer.text, answer.sources), texts.sourcesHeading),
    { type: 'context', elements: [{ type: 'mrkdwn', text: texts.footer(duration) }] },
  ];

  return await app.client.chat.update({
    channel: threadTs.channel,
    ts: threadTs.ts,
    // the plain answer, which is also what a thread follow-up reads back
    text: body,
    blocks: fitBlocks(answerBlocks, trailingBlocks),
    metadata: {
      event_type: ANSWER_EVENT_TYPE,
      event_payload: { ...metadata },
    },
  });
}

function debugMessageBlocks(
  meta: AnswerMetadata,
  details: AnswerDetails | undefined,
  dbLog: BotLogEntry | null,
): any[] {
  const sources = details?.answer.sources || (dbLog?.content as any)?.source_documents || [];
  const durations = details?.durations || dbLog?.durations || {};

  const lines = sources.map((source: any) => {
    const label = `${source.index !== undefined ? `[${source.index}] ` : ''}${escapeSlackLinkText(
      source.title || source.url || source.document_id || '',
    )}`;
    return `• ${source.url ? `<${source.url}|${label}>` : label}`;
  });

  const blocks: any[] = [
    sectionBlock(
      `*genki task* \`${meta.task_id}\`\n*Model* \`${meta.model}\`` +
        (details?.answer.fallbackFrom
          ? `\n*Fallback for* \`${details.answer.fallbackFrom}\` (not found)`
          : '') +
        (details?.filters ? `\n*Filters* \`${JSON.stringify(details.filters.fields)}\`` : '') +
        (details ? `\n*Turns sent* ${details.turns}` : ''),
    ),
  ];
  if (lines.length > 0) {
    blocks.push(sectionBlock(`*Sources*\n${lines.join('\n')}`.substring(0, 3000)));
  } else {
    blocks.push(sectionBlock('_The sources for this answer are no longer available._'));
  }
  blocks.push(
    sectionBlock(`Processing times (sec):\n\`\`\`\n${JSON.stringify(durations, null, 2)}\`\`\``),
  );
  return blocks;
}

(async () => {
  // check important envVars
  for (const name of ['GENKI_API_URL', 'GENKI_API_KEY']) {
    if (isNullOrEmpty(envVar(name))) {
      throw new Error(`${name} must be set.`);
    }
  }

  const rootApp = express();
  if (expressReceiver) {
    rootApp.use('/bolt', expressReceiver.app);
  }
  rootApp.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  rootApp.use('/', express.static(path.join(__dirname, '../../../admin/dist/')));

  const server = createServer(rootApp);

  server.listen(process.env.PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.PORT || 3000}`);
  });

  if (socketMode) {
    await app.start();
  }

  console.log(`⚡️ Bolt app is running${socketMode ? ' in socket mode' : ''}!`);
})();

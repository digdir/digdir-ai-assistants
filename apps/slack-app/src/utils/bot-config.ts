import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { z } from 'zod';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { envVar, isNullOrEmpty } from './general';
import { SlackApp, SlackAppSchema, SlackContext, SlackContextSchema } from './slack';

const BotConfigSchema = z.object({
  ignoreWhenNotTagged: z.boolean().optional(),
});
type BotConfig = z.infer<typeof BotConfigSchema>;

const BotConfigDbRowSchema = z.object({
  id: z.number().optional(),
  created_at: z.string().optional(),
  config: z.object(BotConfigSchema.shape).passthrough(),
  slack_context: z.object(SlackContextSchema.partial().shape).nullish(),
  slack_app: z.object(SlackAppSchema.partial().shape).nullish(),
});
export type BotConfigDbRow = z.infer<typeof BotConfigDbRowSchema>;

let cachedConfigDb: BotConfigDbRow[] | null = null;
let configFetchTimestamp: number | null = null;

let supabase: SupabaseClient | null = null;

// Config rows come from a local YAML file (BOT_CONFIG_FILE) or, when that is not set,
// from the Supabase `bot_config` table. Both hold the same rows.
function useSupabase(): boolean {
  return (
    isNullOrEmpty(envVar('BOT_CONFIG_FILE')) && !isNullOrEmpty(envVar('SLACK_APP_SUPABASE_API_URL'))
  );
}

export async function lookupConfig<T>(
  app: SlackApp,
  context: SlackContext,
  propName: string,
  defaultValue: T,
): Promise<T> {
  const rows = await fetchConfig();
  const merged = mergeConfig(rows || [], app, context);

  if (envVar('LOG_LEVEL') == 'debug-config') {
    console.log(`lookupConfig, merged result:\n${JSON.stringify(merged)}`);
  }
  if (propName in merged) {
    const configValue = merged[propName] as T;
    const result = configValue === undefined ? defaultValue : configValue;
    if (envVar('LOG_LEVEL') == 'debug-config') {
      console.log(`lookupConfig found ${propName}: ${JSON.stringify(result)}`);
    }
    return result;
  }
  return defaultValue;
}

// Merges every row that matches the app and context, generic rows first, so a
// channel row overrides a workspace row key by key.
export function mergeConfig(
  rows: BotConfigDbRow[],
  app: SlackApp,
  context: SlackContext,
): Record<string, any> {
  let merged: Record<string, any> = {};
  for (const row of matchingConfigDbRows(rows, app, context)) {
    if (envVar('LOG_LEVEL') == 'debug-config') {
      console.log(
        `before merge:\n${JSON.stringify(merged)}\nmerging with:\n${JSON.stringify(row)}`,
      );
    }
    merged = { ...merged, ...row.config };
  }
  return merged;
}

async function fetchConfig(): Promise<BotConfigDbRow[] | null> {
  try {
    if (
      !cachedConfigDb ||
      !configFetchTimestamp ||
      performance.now() - configFetchTimestamp > 10000
    ) {
      cachedConfigDb = useSupabase() ? await fetchSupabaseConfig() : readConfigFile();
      configFetchTimestamp = performance.now();

      if (envVar('LOG_LEVEL') == 'debug') {
        console.log(`config fetched. Here are all the rows:\n${JSON.stringify(cachedConfigDb)}`);
      }
    }
    return cachedConfigDb;
  } catch (error) {
    console.error('Unexpected error fetching bot_config:', error);
    return null;
  }
}

async function fetchSupabaseConfig(): Promise<BotConfigDbRow[] | null> {
  if (!supabase) {
    supabase = createClient(
      envVar('SLACK_APP_SUPABASE_API_URL'),
      envVar('SLACK_APP_SUPABASE_ANON_KEY'),
    );
  }
  const { data, error } = await supabase.from('bot_config').select('*');
  if (error) {
    console.error('Error fetching bot_config:', error);
    return null;
  }
  return data as BotConfigDbRow[];
}

function readConfigFile(): BotConfigDbRow[] {
  const file = envVar('BOT_CONFIG_FILE');
  if (isNullOrEmpty(file)) {
    return [];
  }
  return parseConfigRows(yaml.load(readFileSync(file, 'utf8')));
}

export function parseConfigRows(doc: unknown): BotConfigDbRow[] {
  return z.array(BotConfigDbRowSchema).parse(doc || []);
}

function matchingConfigDbRows(
  configDbRows: BotConfigDbRow[],
  app: SlackApp,
  context: SlackContext,
): BotConfigDbRow[] {
  let matching: BotConfigDbRow[] = [];

  if (envVar('LOG_LEVEL') == 'debug-config') {
    console.log(
      `matching config db rows for app: ${JSON.stringify(app)}, context: ${JSON.stringify(context)}`,
    );
  }

  for (let configDbRow of [...configDbRows].sort(sortBotConfig)) {
    const app_id_matches =
      isNullOrEmpty(configDbRow.slack_app?.app_id) || configDbRow.slack_app?.app_id == app.app_id;
    const channel_matches =
      isNullOrEmpty(configDbRow.slack_context?.channel_id) ||
      configDbRow.slack_context?.channel_id == context.channel_id;
    const team_matches =
      isNullOrEmpty(configDbRow.slack_context?.team_id) ||
      configDbRow.slack_context?.team_id == context.team_id;
    const bot_name_matches =
      isNullOrEmpty(configDbRow.slack_app?.bot_name) ||
      configDbRow.slack_app?.bot_name == app.bot_name;

    if (app_id_matches && channel_matches && team_matches && bot_name_matches) {
      matching.push(configDbRow);
      if (envVar('LOG_LEVEL') == 'debug-config') {
        console.log(
          `Matching ConfigDbRow ID: ${configDbRow.id}\n` +
            `->DB row: { \napp: ${JSON.stringify(configDbRow.slack_app, null, 2)}\n` +
            `     context: ${JSON.stringify(configDbRow.slack_context, null, 2)}}\n` +
            `--> config result:\n${JSON.stringify(configDbRow.config, null, 2)}`,
        );
      }
    }
  }

  return matching;
}

// A row with more match keys is more specific and is merged later; a channel key
// outweighs a team key, which outweighs the app keys.
function specificity(row: BotConfigDbRow): number {
  return [
    row.slack_app?.bot_name,
    row.slack_app?.app_id,
    row.slack_context?.team_id,
    row.slack_context?.channel_id,
  ]
    .map((value, i) => (isNullOrEmpty(value) ? 0 : 1 << i))
    .reduce((a, b) => a + b, 0);
}

function sortBotConfig(a: BotConfigDbRow, b: BotConfigDbRow) {
  return specificity(a) - specificity(b);
}

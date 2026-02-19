import { ConfigurationOptions } from 'typesense/lib/Typesense/Configuration.js';

type ConfigData = {
  TYPESENSE_CONFIG: ConfigurationOptions;
  TYPESENSE_DOCS_COLLECTION: string;
  TYPESENSE_DOCS_SEARCH_PHRASE_COLLECTION: string;
};

export function config(): ConfigData {
  const tls = process.env.TYPESENSE_API_DISABLE_TLS !== 'true';
  const hostEnv = process.env.TYPESENSE_API_HOST || '';
  if (/^https?:\/\//.test(hostEnv)) {
    console.warn(
      `TYPESENSE_API_HOST should not include a protocol prefix ("${hostEnv}"). Set TYPESENSE_API_DISABLE_TLS="true" to use plain HTTP.`,
    );
  }
  const stripped = hostEnv.replace(/^https?:\/\//, '');
  const colonIdx = stripped.indexOf(':');
  const host = colonIdx === -1 ? stripped : stripped.slice(0, colonIdx);
  const parsedPort = colonIdx === -1 ? NaN : parseInt(stripped.slice(colonIdx + 1), 10);
  const port = isNaN(parsedPort) ? (tls ? 443 : 80) : parsedPort;

  let configData = {
    TYPESENSE_CONFIG: {
      nodes: [
        {
          host,
          port,
          protocol: tls ? 'https' : 'http',
        },
      ],
      apiKey: process.env.TYPESENSE_API_KEY_ADMIN || '',
      connection_timeout_seconds: 2,
    },
    TYPESENSE_DOCS_COLLECTION: process.env.TYPESENSE_DOCS_COLLECTION || '',
    TYPESENSE_DOCS_SEARCH_PHRASE_COLLECTION:
      process.env.TYPESENSE_DOCS_SEARCH_PHRASE_COLLECTION || '',
  };

  return configData;
}

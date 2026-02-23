import { envVar } from "../general";

type TypesenseNodeConfig = {
  host: string;
  port: number;
  protocol: string;
};

type TypesenseServiceConfig = {
  nodes: TypesenseNodeConfig[];
  connectionTimeoutSec: number;
  apiKey: string;
  docsCollection: string;
  docsSearchPhraseCollection: string;
};

export function typesenseConfig(): TypesenseServiceConfig {
  const tls = envVar("TYPESENSE_API_DISABLE_TLS") !== "true";
  const hostEnv: string = envVar("TYPESENSE_API_HOST");
  if (/^https?:\/\//.test(hostEnv)) {
    console.warn(
      `TYPESENSE_API_HOST should not include a protocol prefix ("${hostEnv}"). Set TYPESENSE_API_DISABLE_TLS="true" to use plain HTTP.`,
    );
  }
  const stripped = hostEnv.replace(/^https?:\/\//, "");
  const colonIdx = stripped.indexOf(":");
  const host = colonIdx === -1 ? stripped : stripped.slice(0, colonIdx);
  const parsedPort =
    colonIdx === -1 ? NaN : parseInt(stripped.slice(colonIdx + 1), 10);
  const port = isNaN(parsedPort) ? (tls ? 443 : 80) : parsedPort;

  const cfg: TypesenseServiceConfig = {
    nodes: [
      {
        host,
        port,
        protocol: tls ? "https" : "http",
      },
    ],
    apiKey: envVar("TYPESENSE_API_KEY"),
    docsCollection: envVar("TYPESENSE_DOCS_COLLECTION"),
    docsSearchPhraseCollection: envVar(
      "TYPESENSE_DOCS_SEARCH_PHRASE_COLLECTION",
    ),
    connectionTimeoutSec: 2,
  };

  return cfg;
}

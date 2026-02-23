import { z } from "zod";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { AzureKeyCredential, OpenAIClient as AzureOpenAI } from "@azure/openai";

import { envVar, lapTimer } from "./general";
import { isNullOrEmpty } from "./markdown";
import { get_encoding } from "tiktoken";

const encoding = get_encoding("cl100k_base");

const JsonExtractionSchema = z.object({
  json_dict: z.record(z.any()),
  response_json_removed: z.string(),
});

type JsonExtraction = z.infer<typeof JsonExtractionSchema>;

export function extract_json_from_response(
  response: string,
  json_doc_keyword: string,
): JsonExtraction {
  if (response.toLowerCase().includes(json_doc_keyword.toLowerCase())) {
    const keyword_start = response
      .toLowerCase()
      .indexOf(json_doc_keyword.toLowerCase());
    const json_doc_start = keyword_start + json_doc_keyword.length;
    let json_str = response.substring(json_doc_start).trim();

    if (
      json_str.startsWith("```") &&
      json_str.endsWith("```") &&
      json_str.includes("\n")
    ) {
      json_str = json_str
        .substring(json_str.indexOf("\n"), json_str.length - 3)
        .trim();
    }

    const response_json_removed = response.substring(0, keyword_start).trim();
    console.log(`json_doc:\n${json_str}`);

    const json_dict = JSON.parse(json_str);
    return JsonExtractionSchema.parse({ json_dict, response_json_removed });
  }

  return JsonExtractionSchema.parse({
    json_dict: {},
    response_json_removed: response,
  });
}

export function extractCodeBlockContents(input: string): string {
  const blockMarker = "```";
  const json_doc_start = input.indexOf(blockMarker);

  if (json_doc_start < 0) {
    return input;
  }

  let codeBlockStart = input.indexOf("```");
  const newlineIndex = input.indexOf("\n", codeBlockStart + 3);
  if (newlineIndex >= 0) {
    codeBlockStart = newlineIndex;
  }
  let codeBlockEnd = input.indexOf("```", codeBlockStart);
  codeBlockEnd = codeBlockEnd > 0 ? codeBlockEnd : input.length; // ignore missing code block marker
  const generatedText = input.substring(codeBlockStart, codeBlockEnd).trim();
  return generatedText;
}

export function azureOpenAI() {
  const azureOpenAI = new AzureOpenAI(
    envVar("AZURE_OPENAI_API_URL"),
    new AzureKeyCredential(envVar("AZURE_OPENAI_API_KEY")),
    {
      endpoint: envVar("AZURE_OPENAI_API_URL"),
      apiVersion: envVar("AZURE_OPENAI_VERSION"),
    },
  );
  return azureOpenAI;
}

export function openaiClient(): OpenAI {
  if (envVar("USE_AZURE_OPENAI_API") === "true") {
    const endpoint = envVar("AZURE_OPENAI_API_ENDPOINT");
    const deployment = envVar("AZURE_OPENAI_DEPLOYMENT_NAME");
    const apiVersion = envVar("AZURE_OPENAI_API_VERSION");
    const apiKey = envVar("AZURE_OPENAI_API_KEY");
    console.warn("[openaiClient] Using Azure OpenAI:", {
      AZURE_OPENAI_API_ENDPOINT: endpoint,
      AZURE_OPENAI_DEPLOYMENT_NAME: deployment,
      AZURE_OPENAI_API_VERSION: apiVersion,
      AZURE_OPENAI_API_KEY: apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : "(not set)",
    });
    return new OpenAI({
      apiKey: apiKey,
      baseURL: `${endpoint}/openai/deployments/${deployment}`,
      defaultQuery: { "api-version": apiVersion },
      defaultHeaders: { "api-key": apiKey },
    });
  }
  console.warn("[openaiClient] Using OpenAI:", {
    OPENAI_API_URL: envVar("OPENAI_API_URL"),
    OPENAI_API_MODEL_NAME: envVar("OPENAI_API_MODEL_NAME"),
    OPENAI_API_KEY: envVar("OPENAI_API_KEY") ? "set" : "(not set)",
  });
  return new OpenAI({ apiKey: envVar("OPENAI_API_KEY") });
}

export function modelName(): string {
  if (envVar("USE_AZURE_OPENAI_API") === "true") {
    return envVar("AZURE_OPENAI_DEPLOYMENT_NAME");
  }
  return envVar("OPENAI_API_MODEL_NAME");
}

export function temperature(): number {
  const envVal =
    envVar("USE_AZURE_OPENAI_API") === "true"
      ? envVar("AZURE_OPENAI_TEMPERATURE")
      : envVar("OPENAI_TEMPERATURE");
  return envVal !== null ? parseFloat(envVal) : 0.1;
}

export async function chat_stream(
  messages: Array<ChatCompletionMessageParam>,
  callback: (arg0: string) => void,
  callback_interval_seconds = 2.0,
  max_tokens: number | null = null,
): Promise<string> {
  let content_so_far = "";
  let latest_chunk = "";
  let chunk_count = 0;
  let last_callback = performance.now();

  if (typeof callback !== "function") {
    throw new Error("Chat stream callback is not a function.");
  }

  console.log(`chat_stream - model: ${modelName()}`);
  const llm_client = openaiClient();
  const stream = await llm_client.chat.completions.create({
    model: modelName(),
    temperature: temperature(),
    messages: messages,
    ...(max_tokens !== null && { max_tokens }),
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk?.choices?.[0]?.delta?.content ?? null;

    if (!isNullOrEmpty(content)) {
      latest_chunk += content;
      content_so_far += content;
      chunk_count += 1;
    }

    if (
      lapTimer(last_callback) >= callback_interval_seconds ||
      (chunk &&
        chunk.choices &&
        chunk.choices.length > 0 &&
        chunk.choices[0].finish_reason === "stop")
    ) {
      last_callback = performance.now();
      callback(latest_chunk);
      latest_chunk = "";
    }
  }

  return content_so_far;
}

export function countTokens(text: string): number {
  const tokens = encoding.encode(text);

  return tokens.length ?? 0;
}

export async function findChunks(
  text: string,
  delim: string,
  minLength: number,
  maxLength: number,
): Promise<number[]> {
  const sectionLengths: number[] = [];
  const delimLen = delim.length;
  let start = 0;
  while (start < text.length) {
    let end = start + minLength;

    // Ensure the section is not longer than maxLength
    if (end > text.length) {
      end = text.length;
      sectionLengths.push(end);
      start = end;
    } else {
      // Find the next delimiter character within the maxLength limit
      while (
        end < text.length &&
        end - start <= maxLength &&
        text.substring(end, end + delimLen) !== delim
      ) {
        end++;
      }

      // If we reached the maxLength limit without finding a delimiter, backtrack to the last delimiter
      if (end - start > maxLength) {
        let tempEnd = end;
        while (
          tempEnd > start &&
          text.substring(tempEnd, tempEnd + delimLen) !== delim
        ) {
          tempEnd--;
        }
        if (tempEnd > start) {
          end = tempEnd;
        }
      }
      sectionLengths.push(end);
      // Move to the next section, skipping the delimiter
      start = end + delimLen;
    }
  }

  return sectionLengths;
}

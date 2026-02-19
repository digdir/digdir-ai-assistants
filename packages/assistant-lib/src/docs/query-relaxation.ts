import Instructor from "@instructor-ai/instructor";
import { z } from "zod";
import { openaiClient, modelName, temperature } from "../llm";
import { scopedEnvVar } from "../general";

const stage_name = "DOCS_QA_EXTRACT";
const envVar = scopedEnvVar(stage_name);

const openaiClientInstance = Instructor({
  client: openaiClient() as any,
  mode: "TOOLS",
  debug: envVar("DEBUG_INSTRUCTOR"),
});

const QueryRelaxationSchema = z.object({
  searchQueries: z.array(z.string()),
});

export type QueryRelaxation = z.infer<typeof QueryRelaxationSchema> | null;

export async function queryRelaxation(
  user_input: string,
  promptRagQueryRelax: string = "",
): Promise<QueryRelaxation> {
  let query_result: QueryRelaxation | null = null;

  const prompt = promptRagQueryRelax;

  console.log(`${stage_name} model name: ${modelName()}`);
  if (envVar("LOG_LEVEL") == "debug") {
    console.log(`prompt.rag.queryRelax: \n${prompt}`);
  }
  query_result = await openaiClientInstance.chat.completions.create({
    model: modelName(),
    response_model: {
      schema: QueryRelaxationSchema,
      name: "QueryRelaxation",
    },
    temperature: temperature(),
    max_retries: 0,
    messages: [
      {
        role: "system",
        content: prompt,
      },
      { role: "user", content: "[User query]\n" + user_input },
    ],
  });

  if (!query_result) {
    return null;
  }

  for (let i = 0; i < query_result.searchQueries.length; i++) {
    query_result.searchQueries[i] = query_result.searchQueries[i]
      .replace("GitHub", "")
      .trim();
  }

  return query_result;
}

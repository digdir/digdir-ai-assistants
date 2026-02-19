import Instructor from "@instructor-ai/instructor";
import { z } from "zod";

import { openaiClient, modelName, temperature } from "../llm";
import { scopedEnvVar } from "../general";
import { stage1_analyze_query } from "./prompts";

const stageName: string = "DOCS_QA_ANALYZE";
const envVar = scopedEnvVar(stageName);

const openaiClientInstance = Instructor({
  client: openaiClient() as any,
  mode: "TOOLS",
  debug: envVar("DEBUG_INSTRUCTOR"),
});

const UserQueryAnalysisSchema = z.object({
  userInputLanguageCode: z
    .string()
    .describe("ISO 639-1 language code for the user query"),
  userInputLanguageName: z
    .string()
    .describe("ISO 639-1 language name for the user query"),
  questionTranslatedToEnglish: z
    .string()
    .describe("The user's question, translated to English"),
  contentCategory: z
    .enum([
      "Support Request",
      "For Your Information",
      "Pull request announcement",
      "None of the above",
    ])
    .describe("One of the following categories"),
});

export type UserQueryAnalysis = z.infer<typeof UserQueryAnalysisSchema> | null;

export async function userInputAnalysis(
  userInput: string,
): Promise<UserQueryAnalysis> {
  let queryResult: UserQueryAnalysis | null = null;

  try {
    const model = modelName();
    if (!model) {
      throw new Error("OpenAI model name environment variable is not set");
    }

    const provider =
      envVar("USE_AZURE_OPENAI_API") === "true" ? "Azure OpenAI" : "OpenAI";
    console.log(`userInputAnalysis: calling ${provider} with model ${model}`);
    queryResult = await openaiClientInstance.chat.completions.create({
      model,
      response_model: {
        schema: UserQueryAnalysisSchema,
        name: "UserQueryAnalysis",
      },
      temperature: temperature(),
      messages: [
        { role: "system", content: stage1_analyze_query },
        { role: "user", content: `[USER INPUT]\n${userInput}` },
      ],
      max_retries: 2,
    });
    console.log(
      `userInputAnalysis: received result of type ${typeof queryResult}`,
    );
  } catch (error) {
    console.error(`userInputAnalysis failed:`, error);
    throw error; // Re-throw to be caught by the calling code
  }

  return queryResult;
}

import OpenAI from "openai";
import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const openaiClient = env.openAiApiKey ? new OpenAI({ apiKey: env.openAiApiKey }) : null;
const groqClient = env.groqApiKey ? new Groq({ apiKey: env.groqApiKey }) : null;

function getProvider() {
  if (openaiClient) {
    return { name: "openai", client: openaiClient, model: env.openAiModel };
  }
  if (groqClient) {
    return { name: "groq", client: groqClient, model: env.groqModel };
  }
  throw new AppError("No AI provider configured. Set OPENAI_API_KEY or GROQ_API_KEY.", 500);
}

export async function createJsonCompletion(prompt, temperature = 0.4) {
  const provider = getProvider();

  if (provider.name === "openai") {
    const response = await provider.client.responses.create({
      model: provider.model,
      input: [
        {
          role: "system",
          content: "You are a quiz generation engine. Return only valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature
    });

    return response.output_text || "";
  }

  const completion = await provider.client.chat.completions.create({
    model: provider.model,
    messages: [{ role: "user", content: prompt }],
    temperature
  });

  return completion?.choices?.[0]?.message?.content || "";
}

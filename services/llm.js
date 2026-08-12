import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is not configured.");
}

const openai = new OpenAI({
  apiKey
});

export async function generateAIResponse({
  message,
  business,
  knowledge
}) {
  if (!message) {
    throw new Error("AI message is required.");
  }

  return {
    ok: false,
    message,
    businessName: business?.name || "",
    knowledgeCount: Array.isArray(knowledge) ? knowledge.length : 0,
    provider: "openai",
    status: "not_implemented"
  };
}

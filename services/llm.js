import "dotenv/config";

const baseUrl = process.env.OLLAMA_BASE_URL;
const model = process.env.OLLAMA_MODEL || "gemma3:4b";

if (!baseUrl) {
  throw new Error("OLLAMA_BASE_URL is not configured.");
}

export async function generateAIResponse({
  message,
  business,
  knowledge
}) {
  if (!message) {
    throw new Error("AI message is required.");
  }

  const businessName = business?.name || "the business";

  const knowledgeContext = Array.isArray(knowledge)
    ? knowledge
        .filter((item) => item && item.active !== false)
        .map(
          (item) =>
            `Q: ${item.question || ""}\nA: ${item.answer || ""}`
        )
        .join("\n\n")
    : "";

  const prompt =
    `You are the AI receptionist for ${businessName}.\n` +
    "Answer clearly and professionally.\n" +
    "Use the supplied business knowledge as the source of truth.\n" +
    "Do not invent business-specific facts such as prices, hours, doctors, services, policies, or availability.\n" +
    "If the supplied information does not contain the answer, say that you do not have that information and suggest contacting the business.\n" +
    "Keep the response concise.\n\n" +
    `Customer message:\n${message}\n\n` +
    `Business knowledge:\n${
      knowledgeContext || "No business knowledge was supplied."
    }`;

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama request failed (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  const output = String(data.response || "").trim();

  if (!output) {
    throw new Error("Ollama returned an empty response.");
  }

  return {
    ok: true,
    reply: output,
    provider: "ollama",
    model
  };
}

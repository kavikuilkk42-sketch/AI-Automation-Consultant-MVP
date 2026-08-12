import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import { generateAIResponse } from "./services/llm.js";
import {
  normalizeWhatsAppMessage,
  normalizeMetaWhatsAppMessage,
  createWhatsAppReply
} from "./services/whatsapp.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const businessFile = path.join(__dirname, "data", "business.json");
const knowledgeFile = path.join(__dirname, "data", "knowledge.json");

app.use(express.json());
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    return res.status(401).json({
      ok: false,
      error: "Admin authentication required"
    });
  }

  const encoded = authHeader.slice(6);

  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const separator = decoded.indexOf(":");

    if (separator === -1) {
      throw new Error("Invalid credentials");
    }

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    if (
      username !== ADMIN_USER ||
      password !== ADMIN_PASSWORD
    ) {
      res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
      return res.status(401).json({
        ok: false,
        error: "Invalid admin credentials"
      });
    }

    next();
  } catch {
    res.setHeader("WWW-Authenticate", 'Basic realm="Admin Dashboard"');
    return res.status(401).json({
      ok: false,
      error: "Invalid authentication"
    });
  }
}
app.use(express.static(path.join(__dirname, "public")));

async function getBusiness() {
  const file = await fs.readFile(businessFile, "utf8");
  return JSON.parse(file);
}

async function getKnowledge() {
  try {
    const file = await fs.readFile(knowledgeFile, "utf8");
    const knowledge = JSON.parse(file);

    return Array.isArray(knowledge)
      ? knowledge.filter(item => item.active === true)
      : [];
  } catch {
    return [];
  }
}

function isKnowledgeStopWord(word) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "can",
    "could",
    "do",
    "does",
    "for",
    "how",
    "i",
    "is",
    "me",
    "my",
    "of",
    "please",
    "tell",
    "the",
    "to",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "would",
    "you",
    "your"
  ]);

  return stopWords.has(
    normalizeKnowledgeWord(word)
  );
}
function normalizeKnowledgeWord(word) {
  const value = String(word || "")
    .toLowerCase()
    .trim();

  if (value.length <= 3) {
    return value;
  }

  if (value.endsWith("ies")) {
    return value.slice(0, -3) + "y";
  }

  if (value === "services") {
    return "service";
  }

  if (value.endsWith("s") && !value.endsWith("ss")) {
    return value.slice(0, -1);
  }

  return value;
}
function findBestKnowledgeMatch(message, knowledge) {
  const normalizedMessage =
    String(message || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim();

  if (!normalizedMessage || !Array.isArray(knowledge)) {
    return null;
  }

  const messageWords =
    new Set(
      normalizedMessage
        .split(/\s+/)
        .filter(word => word.length >= 3)
        .map(normalizeKnowledgeWord)
      .filter(word => !isKnowledgeStopWord(word))
    );

  let bestMatch = null;
let bestScore = 0;
let secondBestScore = 0;
  for (const item of knowledge) {
    const normalizedQuestion =
      String(item.question || "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .trim();

    if (!normalizedQuestion) {
      continue;
    }

    const questionWords =
      new Set(
        normalizedQuestion
          .split(/\s+/)
          .filter(word => word.length >= 3)
          .map(normalizeKnowledgeWord)
      .filter(word => !isKnowledgeStopWord(word))
      );

    let score = 0;

    for (const word of messageWords) {
      if (questionWords.has(word)) {
        score += 1;
      }
    }

    if (score > bestScore) {
      secondBestScore = bestScore;
      bestScore = score;
      bestMatch = item;
    } else if (score > secondBestScore) {
      secondBestScore = score;
    }
  }

  return bestScore >= 2 && bestScore > secondBestScore ? bestMatch : null;
}
app.get("/api/health", async (_req, res) => {
  try {
    const business = await getBusiness();

    res.json({
      ok: true,
      service: "AI Automation Consultant",
      business: business.name,
      mode: "demo",
      clientConfig: true
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: "Business configuration unavailable"
    });
  }
});

app.get("/api/business", requireAdmin, async (_req, res) => {
  try {
    const business = await getBusiness();
    res.json({
      ok: true,
      business
    });
  } catch {
    res.status(500).json({
      ok: false,
      error: "Unable to load business configuration"
    });
  }
});

app.put("/api/business", requireAdmin, async (req, res) => {
  try {
    const currentBusiness = await getBusiness();
    const updates = req.body || {};

    const updatedBusiness = {
      ...currentBusiness,
      name: String(updates.name ?? currentBusiness.name).trim(),
      businessType: String(updates.businessType ?? currentBusiness.businessType).trim(),
      phone: String(updates.phone ?? currentBusiness.phone).trim(),
      email: String(updates.email ?? currentBusiness.email).trim(),
      address: String(updates.address ?? currentBusiness.address).trim(),
      tagline: String(updates.tagline ?? currentBusiness.tagline).trim(),
      workingHours: {
        ...(currentBusiness.workingHours || {}),
        monday: String(
          updates.workingHours?.monday ??
          currentBusiness.workingHours?.monday ??
          ""
        ).trim(),
        saturday: String(
          updates.workingHours?.saturday ??
          currentBusiness.workingHours?.saturday ??
          ""
        ).trim(),
        sunday: String(
          updates.workingHours?.sunday ??
          currentBusiness.workingHours?.sunday ??
          ""
        ).trim()
      }
    };

    await fs.writeFile(
      businessFile,
      JSON.stringify(updatedBusiness, null, 2),
      "utf8"
    );

    res.json({
      ok: true,
      message: "Business configuration saved successfully",
      business: updatedBusiness
    });
  } catch (error) {
    console.error("Business save error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to save business configuration"
    });
  }
});
app.get("/api/knowledge", requireAdmin, async (_req, res) => {
  try {
    let knowledge = [];

    try {
      knowledge = JSON.parse(
        await fs.readFile(knowledgeFile, "utf8")
      );
    } catch {
      knowledge = [];
    }

    res.json({
      ok: true,
      count: knowledge.length,
      knowledge
    });

  } catch (error) {
    console.error("Knowledge retrieval error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to load knowledge base"
    });
  }
});
app.post("/api/knowledge", requireAdmin, async (req, res) => {
  try {
    const question =
      String(req.body.question || "").trim();

    const answer =
      String(req.body.answer || "").trim();

    const category =
      String(req.body.category || "general")
        .trim()
        .toLowerCase();

    if (!question || !answer) {
      return res.status(400).json({
        ok: false,
        error: "Question and answer are required"
      });
    }

    let knowledge = [];

    try {
      knowledge = JSON.parse(
        await fs.readFile(knowledgeFile, "utf8")
      );
    } catch {
      knowledge = [];
    }

    const now = new Date().toISOString();

    const entry = {
      id: `kb_${Date.now()}`,
      question,
      answer,
      category: category || "general",
      active: true,
      createdAt: now,
      updatedAt: now
    };

    knowledge.push(entry);

    await fs.writeFile(
      knowledgeFile,
      JSON.stringify(knowledge, null, 2),
      "utf8"
    );

    res.status(201).json({
      ok: true,
      message: "Knowledge entry created successfully",
      knowledge: entry
    });

  } catch (error) {
    console.error("Knowledge creation error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to create knowledge entry"
    });
  }
});
app.put("/api/knowledge/:id", requireAdmin, async (req, res) => {
  try {
    let knowledge = [];

    try {
      knowledge = JSON.parse(
        await fs.readFile(knowledgeFile, "utf8")
      );
    } catch {
      knowledge = [];
    }

    const knowledgeIndex = knowledge.findIndex(
      (item) => String(item.id) === String(req.params.id)
    );

    if (knowledgeIndex === -1) {
      return res.status(404).json({
        ok: false,
        error: "Knowledge entry not found"
      });
    }

    const current = knowledge[knowledgeIndex];

    const questionProvided =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "question"
      );

    const answerProvided =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "answer"
      );

    const categoryProvided =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "category"
      );

    const activeProvided =
      Object.prototype.hasOwnProperty.call(
        req.body,
        "active"
      );

    if (questionProvided) {
      const question =
        String(req.body.question || "").trim();

      if (!question) {
        return res.status(400).json({
          ok: false,
          error: "Question cannot be empty"
        });
      }

      current.question = question;
    }

    if (answerProvided) {
      const answer =
        String(req.body.answer || "").trim();

      if (!answer) {
        return res.status(400).json({
          ok: false,
          error: "Answer cannot be empty"
        });
      }

      current.answer = answer;
    }

    if (categoryProvided) {
      current.category =
        String(req.body.category || "general")
          .trim()
          .toLowerCase() || "general";
    }

    if (activeProvided) {
      current.active =
        Boolean(req.body.active);
    }

    current.updatedAt =
      new Date().toISOString();

    await fs.writeFile(
      knowledgeFile,
      JSON.stringify(knowledge, null, 2),
      "utf8"
    );

    res.json({
      ok: true,
      message: "Knowledge entry updated successfully",
      knowledge: current
    });

  } catch (error) {
    console.error("Knowledge update error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to update knowledge entry"
    });
  }
});
app.delete("/api/knowledge/:id", requireAdmin, async (req, res) => {
  try {
    let knowledge = [];

    try {
      knowledge = JSON.parse(
        await fs.readFile(knowledgeFile, "utf8")
      );
    } catch {
      knowledge = [];
    }

    const knowledgeIndex = knowledge.findIndex(
      (item) => String(item.id) === String(req.params.id)
    );

    if (knowledgeIndex === -1) {
      return res.status(404).json({
        ok: false,
        error: "Knowledge entry not found"
      });
    }

    const deletedKnowledge = knowledge[knowledgeIndex];

    knowledge.splice(knowledgeIndex, 1);

    await fs.writeFile(
      knowledgeFile,
      JSON.stringify(knowledge, null, 2),
      "utf8"
    );

    res.json({
      ok: true,
      message: "Knowledge entry deleted successfully",
      knowledge: deletedKnowledge
    });

  } catch (error) {
    console.error("Knowledge deletion error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to delete knowledge entry"
    });
  }
});
app.post("/api/chat", async (req, res) => {
  const message = String(req.body.message || "").trim().toLowerCase();

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "Message is required"
    });
  }

  const secretRequest =
    /\b(openai[_\s-]?api[_\s-]?key|ollama[_\s-]?base[_\s-]?url|ollama[_\s-]?model|admin[_\s-]?password|api[_\s-]?key|secret|password)\b/i.test(message) ||
    message.includes(".env");

  if (secretRequest) {
    return res.json({
      ok: true,
      reply: "I can't provide passwords, API keys, secrets, or internal configuration information."
    });
  }
  const business = await getBusiness();

const knowledge =
  await getKnowledge();

const knowledgeMatch =
  findBestKnowledgeMatch(
    message,
    knowledge
  );

let reply;

if (
  knowledgeMatch &&
  knowledgeMatch.answer
) {
  reply =
    knowledgeMatch.answer;
}
else if (
    /\b(hello|hi|hey)\b/.test(message)
  ) {
    reply = `Hello! 👋 Welcome to ${business.name}. How can I help you today?`;
  }

  else if (
    message.includes("opening") ||
    message.includes("hours") ||
    message.includes("timing") ||
    message.includes("open")
  ) {
    reply =
      `${business.name} is open Monday to Friday from ${business.workingHours.monday}, ` +
      `Saturday ${business.workingHours.saturday}, and Sunday ${business.workingHours.sunday}.`;
  }

  else if (
    message.includes("doctor") ||
    message.includes("specialist") ||
    message.includes("skin") ||
    message.includes("dermat")
  ) {
    const skinDoctor = business.doctors.find(
      doctor => doctor.specialty.toLowerCase().includes("dermat")
    );

    if (
      message.includes("skin") ||
      message.includes("dermat")
    ) {
      reply = skinDoctor
        ? `Our dermatologist is ${skinDoctor.name}. Would you like to make an appointment enquiry?`
        : "Our dermatologist information is not available.";
    } else {
      reply =
        "Our doctors are " +
        business.doctors
          .map(doctor => `${doctor.name} - ${doctor.specialty}`)
          .join(", ") +
        ".";
    }
  }

  else if (
    message.includes("service") ||
    message.includes("treatment")
  ) {
    reply =
      `We provide ${business.services.join(", ")}. Which service are you interested in?`;
  }

  else if (
    message.includes("appointment") ||
    message.includes("book") ||
    message.includes("booking") ||
    message.includes("schedule")
  ) {
    reply = business.appointment.enabled
      ? business.appointment.message
      : "Online appointment enquiries are currently unavailable.";
  }

  else if (
    message.includes("fee") ||
    message.includes("price") ||
    message.includes("cost")
  ) {
    reply =
      "Our consultation fee information is not configured yet. Please contact the clinic for the exact fee.";
  }

  else if (
    message.includes("phone") ||
    message.includes("contact")
  ) {
    reply =
      `You can contact ${business.name} at ${business.phone}.`;
  }

  else if (
    message.includes("address") ||
    message.includes("location") ||
    message.includes("where")
  ) {
    reply =
      `${business.name} is located at ${business.address}.`;
  }
else {
try {
const aiResult = await generateAIResponse({
message,
business,
knowledge
});

reply = aiResult.reply;
} catch (error) {
console.error("LLM fallback error:", error);

reply = "I don't have enough information to answer that right now. Please contact the business for assistance.";
}
}
res.json({
    ok: true,
    reply,
    client: business.id
  });
});

app.post("/api/leads", async (req, res) => {
  const name = String(req.body.name || "").trim();
  const phone = String(req.body.phone || "").trim();
  const requirement = String(req.body.requirement || "").trim();

  if (!name || !phone) {
    return res.status(400).json({
      ok: false,
      error: "Name and phone are required."
    });
  }

  const dataDirectory = path.join(__dirname, "data");
  const leadsFile = path.join(dataDirectory, "leads.json");

  await fs.mkdir(dataDirectory, { recursive: true });

  let leads = [];

  try {
    leads = JSON.parse(await fs.readFile(leadsFile, "utf8"));
  } catch {
    leads = [];
  }

  leads.push({
    id: Date.now().toString(),
    clientId: (await getBusiness()).id,
    name,
    phone,
    requirement,
    createdAt: new Date().toISOString(),
    status: "new"
  });

  await fs.writeFile(
    leadsFile,
    JSON.stringify(leads, null, 2),
    "utf8"
  );

  res.json({
    ok: true,
    message: "Enquiry received successfully."
  });
});

app.get("/api/leads", requireAdmin, async (_req, res) => {
  try {
    const leadsFile = path.join(__dirname, "data", "leads.json");

    let leads = [];

    try {
      leads = JSON.parse(await fs.readFile(leadsFile, "utf8"));
    } catch {
      leads = [];
    }

    res.json({
      ok: true,
      count: leads.length,
      leads
    });
  } catch (error) {
    console.error("Lead retrieval error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to load leads"
    });
  }
});
app.patch("/api/leads/:id", requireAdmin, async (req, res) => {
  try {
    const allowedStatuses = [
      "new",
      "contacted",
      "converted",
      "lost"
    ];

    const status = String(req.body.status || "")
  .trim()
  .toLowerCase();

if (!allowedStatuses.includes(status)) {
  return res.status(400).json({
    ok: false,
    error: "Invalid lead status"
  });
}

const notesProvided =
  Object.prototype.hasOwnProperty.call(req.body, "notes");

const followUpDateProvided =
  Object.prototype.hasOwnProperty.call(req.body, "followUpDate");

const notes = notesProvided
  ? String(req.body.notes || "").trim()
  : null;

const followUpDate = followUpDateProvided
  ? String(req.body.followUpDate || "").trim()
  : null;

    const leadsFile = path.join(__dirname, "data", "leads.json");

    let leads = [];

    try {
      leads = JSON.parse(await fs.readFile(leadsFile, "utf8"));
    } catch {
      leads = [];
    }

    const leadIndex = leads.findIndex(
      (lead) => String(lead.id) === String(req.params.id)
    );

    if (leadIndex === -1) {
      return res.status(404).json({
        ok: false,
        error: "Lead not found"
      });
    }

    leads[leadIndex].status = status;
if (notesProvided) {
  leads[leadIndex].notes = notes;
}

if (followUpDateProvided) {
  leads[leadIndex].followUpDate = followUpDate;
}
leads[leadIndex].updatedAt = new Date().toISOString();

    await fs.writeFile(
      leadsFile,
      JSON.stringify(leads, null, 2),
      "utf8"
    );

    res.json({
      ok: true,
      message: "Lead status updated successfully",
      lead: leads[leadIndex]
    });

  } catch (error) {
    console.error("Lead status update error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to update lead status"
    });
  }
});
app.get("/api/whatsapp/webhook", (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return res.status(503).json({
      ok: false,
      error: "WhatsApp webhook verification is not configured"
    });
  }

  const mode = String(req.query["hub.mode"] || "").trim();
  const token = String(req.query["hub.verify_token"] || "").trim();
  const challenge = String(req.query["hub.challenge"] || "").trim();

  if (
    mode !== "subscribe" ||
    token !== verifyToken ||
    !challenge
  ) {
    return res.status(403).json({
      ok: false,
      error: "Webhook verification failed"
    });
  }

  return res.status(200).send(challenge);
});
app.post("/api/whatsapp/webhook", async (req, res) => {
  const payload =
    req.body?.entry?.[0]?.changes?.[0]?.value?.messages
      ? normalizeMetaWhatsAppMessage(req.body)
      : normalizeWhatsAppMessage(req.body);

  if (!payload) {
    return res.status(400).json({
      ok: false,
      error: "Invalid WhatsApp message payload"
    });
  }

  try {
    const chatResponse = await fetch(
      `http://127.0.0.1:${PORT}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: payload.message
        })
      }
    );

    const chatResult = await chatResponse.json();

    if (!chatResponse.ok || !chatResult.ok) {
      return res.status(502).json({
        ok: false,
        error: "Unable to process WhatsApp message"
      });
    }

    const whatsappReply = createWhatsAppReply(
      payload.from,
      chatResult.reply
    );

    return res.json({
      ok: true,
      channel: "whatsapp",
      to: whatsappReply.to,
      reply: whatsappReply.message
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return res.status(502).json({
      ok: false,
      error: "Unable to process WhatsApp message"
    });
  }
});

app.get("/api/analytics", requireAdmin, async (_req, res) => {
  try {
    const leadsFile = path.join(__dirname, "data", "leads.json");

    let leads = [];

    try {
      leads = JSON.parse(await fs.readFile(leadsFile, "utf8"));
    } catch {
      leads = [];
    }

    const total = leads.length;

    const newLeads =
      leads.filter((lead) => lead.status === "new").length;

    const contacted =
      leads.filter((lead) => lead.status === "contacted").length;

    const converted =
      leads.filter((lead) => lead.status === "converted").length;

    const lost =
      leads.filter((lead) => lead.status === "lost").length;

    const conversionRate =
      total > 0
        ? Number(((converted / total) * 100).toFixed(2))
        : 0;

    res.json({
      ok: true,
      analytics: {
        total,
        new: newLeads,
        contacted,
        converted,
        lost,
        conversionRate
      }
    });

  } catch (error) {
    console.error("Analytics error:", error);

    res.status(500).json({
      ok: false,
      error: "Unable to load analytics"
    });
  }
});
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("==========================================");
  console.log("AI AUTOMATION CONSULTANT");
  console.log("==========================================");
  console.log(`Local: http://localhost:${PORT}`);
  console.log("Client Configuration: ENABLED");
  console.log("AI Mode: DEMO");
  console.log("Lead Capture: ENABLED");
  console.log("==========================================");
});


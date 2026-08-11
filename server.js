import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const businessFile = path.join(__dirname, "data", "business.json");

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
app.post("/api/chat", async (req, res) => {
  const message = String(req.body.message || "").trim().toLowerCase();

  if (!message) {
    return res.status(400).json({
      ok: false,
      error: "Message is required"
    });
  }

  const business = await getBusiness();

  let reply;

  if (
    message.includes("hello") ||
    message.includes("hi") ||
    message.includes("hey")
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
    reply =
      `I can help you with ${business.services.join(", ")}, doctors, working hours and appointment enquiries. What would you like to know?`;
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







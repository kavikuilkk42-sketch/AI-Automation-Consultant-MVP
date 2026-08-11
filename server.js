import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const business = {
  name: "ABC Clinic",
  hours: "9:00 AM to 8:00 PM",
  services: [
    "General Consultation",
    "Dermatology",
    "Dental Consultation"
  ],
  doctors: [
    "Dr. Kumar - General Physician",
    "Dr. Priya - Dermatologist",
    "Dr. Arun - Dentist"
  ]
};

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "AI Business Assistant is running",
    mode: "demo"
  });
});

app.post("/api/chat", (req, res) => {
  const message = String(req.body.message || "").toLowerCase();

  let reply;

  if (
    message.includes("hello") ||
    message.includes("hi") ||
    message.includes("hey")
  ) {
    reply = "Hello! 👋 Welcome to ABC Clinic. How can I help you today?";
  } 
  else if (
    message.includes("opening") ||
    message.includes("hours") ||
    message.includes("timing") ||
    message.includes("open")
  ) {
    reply = `ABC Clinic is open from ${business.hours}.`;
  } 
  else if (
    message.includes("doctor") ||
    message.includes("specialist") ||
    message.includes("skin") ||
    message.includes("dermat")
  ) {
    if (message.includes("skin") || message.includes("dermat")) {
      reply =
        "Our dermatologist is Dr. Priya. Would you like to make an appointment enquiry?";
    } else {
      reply =
        "Our doctors are " + business.doctors.join(", ") + ".";
    }
  } 
  else if (
    message.includes("service") ||
    message.includes("treatment")
  ) {
    reply =
      "We provide General Consultation, Dermatology and Dental Consultation. Which service are you interested in?";
  } 
  else if (
    message.includes("appointment") ||
    message.includes("book") ||
    message.includes("booking")
  ) {
    reply =
      "Sure! I can help with an appointment enquiry. Please provide your name and phone number.";
  } 
  else if (
    message.includes("fee") ||
    message.includes("price") ||
    message.includes("cost")
  ) {
    reply =
      "The consultation fee has not been configured yet. Our clinic staff can confirm the exact fee.";
  } 
  else {
    reply =
      "I can help with doctors, services, opening hours and appointment enquiries. What would you like to know?";
  }

  res.json({
    ok: true,
    reply
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

  const dataDir = path.join(__dirname, "data");
  const leadsFile = path.join(dataDir, "leads.json");

  await fs.mkdir(dataDir, { recursive: true });

  let leads = [];

  try {
    leads = JSON.parse(await fs.readFile(leadsFile, "utf8"));
  } catch {
    leads = [];
  }

  leads.push({
    id: Date.now().toString(),
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
    message: "Lead saved successfully."
  });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("==========================================");
  console.log("AI AUTOMATION CONSULTANT");
  console.log("==========================================");
  console.log(`Local: http://localhost:${PORT}`);
  console.log("AI Mode: DEMO");
  console.log("Lead Capture: ENABLED");
  console.log("==========================================");
});

const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;
const FILE = path.join(__dirname, "leads.json");
const TEMP_FILE = `${FILE}.tmp`;
const SERVICES = ["Photography", "Videography", "Both", "Not sure yet"];

if (process.env.NODE_ENV === "production" && !ADMIN_KEY) {
  throw new Error("ADMIN_KEY environment variable is required in production.");
}

const effectiveAdminKey = ADMIN_KEY || "changeme";

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const readLeads = () => {
  if (!fs.existsSync(FILE)) return [];
  const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("leads.json must contain an array.");
  return parsed;
};

const writeLeads = (leads) => {
  fs.writeFileSync(TEMP_FILE, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
  fs.renameSync(TEMP_FILE, FILE);
};

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const isValidEmail = (email) =>
  email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidDate = (date) =>
  !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)));

const isAdmin = (req) =>
  req.get("x-admin-key") === effectiveAdminKey || req.query.key === effectiveAdminKey;

// The form on the website posts here
app.post("/api/leads", (req, res) => {
  const name = cleanText(req.body.name, 100);
  const email = cleanText(req.body.email, 150).toLowerCase();
  const phone = cleanText(req.body.phone, 30);
  const date = cleanText(req.body.date, 10);
  const location = cleanText(req.body.location, 150);
  const service = cleanText(req.body.service, 30);

  if (!name || !email || !location) {
    return res.status(400).json({ error: "Name, email, and event location are required." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "Enter a valid event date." });
  }

  const lead = {
    id: crypto.randomUUID(),
    name,
    email,
    phone,
    date,
    location,
    service: SERVICES.includes(service) ? service : "Not sure yet",
    createdAt: new Date().toISOString(),
  };
  const leads = readLeads();
  leads.push(lead);
  writeLeads(leads);
  res.status(201).json({
    id: lead.id,
    message: `Thanks, ${lead.name}! We'll contact you about your event in ${lead.location}.`,
  });
});

app.get("/api/leads", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Not allowed." });
  res.json(readLeads());
});

app.delete("/api/leads/:id", (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Not allowed." });

  const leads = readLeads();
  const remaining = leads.filter((lead) => lead.id !== req.params.id);
  if (remaining.length === leads.length) {
    return res.status(404).json({ error: "Lead not found." });
  }
  writeLeads(remaining);
  res.status(204).end();
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({ error: "Invalid JSON request." });
  }
  res.status(500).json({ error: "The server could not complete the request." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Velvet Vibes running at http://localhost:${PORT}`));
}

module.exports = app;

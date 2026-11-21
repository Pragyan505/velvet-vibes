const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { neon } = require("@neondatabase/serverless");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const FILE = path.join(__dirname, "leads.json");
const TEMP_FILE = `${FILE}.tmp`;
const SERVICES = ["Photography", "Videography", "Both", "Not sure yet"];

if (process.env.NODE_ENV === "production" && !ADMIN_KEY) {
  throw new Error("ADMIN_KEY environment variable is required in production.");
}
if (process.env.NODE_ENV === "production" && !DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required in production.");
}

const effectiveAdminKey = ADMIN_KEY || "changeme";
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;
let leadsTableReady;

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "public")));

const readLocalLeads = () => {
  if (!fs.existsSync(FILE)) return [];
  const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("leads.json must contain an array.");
  return parsed;
};

const writeLocalLeads = (leads) => {
  fs.writeFileSync(TEMP_FILE, `${JSON.stringify(leads, null, 2)}\n`, "utf8");
  fs.renameSync(TEMP_FILE, FILE);
};

const ensureLeadsTable = async () => {
  if (!sql) return;
  if (!leadsTableReady) {
    leadsTableReady = sql`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        event_date TEXT NOT NULL,
        location TEXT NOT NULL,
        service TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `.catch((error) => {
      leadsTableReady = undefined;
      throw error;
    });
  }
  await leadsTableReady;
};

const readLeads = async () => {
  if (!sql) return readLocalLeads();
  await ensureLeadsTable();
  const rows = await sql`
    SELECT id, name, email, phone, event_date, location, service, created_at
    FROM leads
    ORDER BY created_at ASC
  `;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    date: row.event_date,
    location: row.location,
    service: row.service,
    createdAt: new Date(row.created_at).toISOString(),
  }));
};

const saveLead = async (lead) => {
  if (!sql) {
    const leads = readLocalLeads();
    leads.push(lead);
    writeLocalLeads(leads);
    return;
  }
  await ensureLeadsTable();
  await sql`
    INSERT INTO leads (id, name, email, phone, event_date, location, service, created_at)
    VALUES (
      ${lead.id},
      ${lead.name},
      ${lead.email},
      ${lead.phone},
      ${lead.date},
      ${lead.location},
      ${lead.service},
      ${lead.createdAt}
    )
  `;
};

const deleteLead = async (id) => {
  if (!sql) {
    const leads = readLocalLeads();
    const remaining = leads.filter((lead) => lead.id !== id);
    if (remaining.length === leads.length) return false;
    writeLocalLeads(remaining);
    return true;
  }
  await ensureLeadsTable();
  const deleted = await sql`DELETE FROM leads WHERE id = ${id} RETURNING id`;
  return deleted.length > 0;
};

const cleanText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const isValidEmail = (email) =>
  email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidDate = (date) =>
  !date || (/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)));

const isAdmin = (req) =>
  req.get("x-admin-key") === effectiveAdminKey || req.query.key === effectiveAdminKey;

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// The form on the website posts here
app.post("/api/leads", asyncRoute(async (req, res) => {
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
  await saveLead(lead);
  res.status(201).json({
    id: lead.id,
    message: `Thanks, ${lead.name}! We'll contact you about your event in ${lead.location}.`,
  });
}));

app.get("/api/leads", asyncRoute(async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Not allowed." });
  res.json(await readLeads());
}));

app.delete("/api/leads/:id", asyncRoute(async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Not allowed." });

  if (!(await deleteLead(req.params.id))) {
    return res.status(404).json({ error: "Lead not found." });
  }
  res.status(204).end();
}));

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

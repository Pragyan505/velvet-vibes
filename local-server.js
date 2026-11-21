// BACK END: serves the website and saves booking requests to leads.json
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "changeme"; // change this before going live
const FILE = path.join(__dirname, "leads.json");
const SERVICES = ["Photography", "Videography", "Both", "Not sure yet"];

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const readLeads = () => (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : []);

// The form on the website posts here
app.post("/api/leads", (req, res) => {
  const { name, email, phone = "", date = "", location, service } = req.body;
  if (!name || !email || !location) {
    return res.status(400).json({ error: "Name, email, and event location are required." });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  const lead = {
    id: Date.now(),
    name: String(name).slice(0, 100),
    email: String(email).slice(0, 150),
    phone: String(phone).slice(0, 30),
    date: String(date).slice(0, 10),
    location: String(location).slice(0, 150),
    service: SERVICES.includes(service) ? service : "Not sure yet",
    createdAt: new Date().toISOString(),
  };
  const leads = readLeads();
  leads.push(lead);
  fs.writeFileSync(FILE, JSON.stringify(leads, null, 2));
  res.json({ message: `Thanks, ${lead.name}! We'll contact you about your event in ${lead.location}.` });
});

// Private: view saved requests at /api/leads?key=changeme
app.get("/api/leads", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(401).json({ error: "Not allowed." });
  res.json(readLeads());
});

app.listen(PORT, () => console.log(`Velvet Vibes running at http://localhost:${PORT}`));

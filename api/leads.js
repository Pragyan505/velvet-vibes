// BACK END on Vercel: receives the form, checks it, and emails it to you.
// Settings go in Vercel > Project > Settings > Environment Variables:
//   RESEND_API_KEY  (free key from resend.com)
//   LEAD_TO_EMAIL   (the email address that should receive requests)
const SERVICES = ["Photography", "Videography", "Both", "Not sure yet"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { name, email, phone = "", date = "", location, service } = req.body || {};
  if (!name || !email || !location) {
    return res.status(400).json({ error: "Name, email, and event location are required." });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const lead = {
    name: String(name).slice(0, 100),
    email: String(email).slice(0, 150),
    phone: String(phone).slice(0, 30),
    date: String(date).slice(0, 10),
    location: String(location).slice(0, 150),
    service: SERVICES.includes(service) ? service : "Not sure yet",
  };
  console.log("New lead:", JSON.stringify(lead)); // also visible in Vercel > Logs

  const { RESEND_API_KEY, LEAD_TO_EMAIL } = process.env;
  if (RESEND_API_KEY && LEAD_TO_EMAIL) {
    const text = Object.entries(lead).map(([k, v]) => `${k}: ${v}`).join("\n");
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Velvet Vibes <onboarding@resend.dev>",
        to: [LEAD_TO_EMAIL],
        reply_to: lead.email,
        subject: `New request from ${lead.name}`,
        text,
      }),
    });
    if (!r.ok) {
      console.error("Email failed:", await r.text());
      return res.status(500).json({ error: "Could not send your request. Please try again." });
    }
  }
  res.json({ message: `Thanks, ${lead.name}! We'll contact you about your event in ${lead.location}.` });
};

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = require("../server");

const leadsFile = path.join(__dirname, "..", "leads.json");

test("health endpoint responds successfully", async (t) => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("lead validation and creation", async (t) => {
  if (fs.existsSync(leadsFile)) fs.unlinkSync(leadsFile);

  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => {
    server.close();
    if (fs.existsSync(leadsFile)) fs.unlinkSync(leadsFile);
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const invalidResponse = await fetch(`${baseUrl}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "", email: "bad", location: "" }),
  });
  assert.equal(invalidResponse.status, 400);

  const validResponse = await fetch(`${baseUrl}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "test@example.com",
      phone: "555-1234",
      date: "2027-06-12",
      location: "Austin, TX",
      service: "Both",
    }),
  });
  assert.equal(validResponse.status, 201);
  const created = await validResponse.json();
  assert.equal(typeof created.id, "string");
  assert.match(created.message, /Thanks, Test User/);

  const unauthorizedResponse = await fetch(`${baseUrl}/api/leads`);
  assert.equal(unauthorizedResponse.status, 401);

  const leadsResponse = await fetch(`${baseUrl}/api/leads`, {
    headers: { "x-admin-key": "changeme" },
  });
  assert.equal(leadsResponse.status, 200);
  const leads = await leadsResponse.json();
  assert.equal(leads.length, 1);
  assert.equal(leads[0].email, "test@example.com");
});

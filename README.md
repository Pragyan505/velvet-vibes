# Velvet Vibes

## Run locally

Install dependencies with `npm install`, then start the server with `npm start`.
The site is available at `http://localhost:3000`.

Without `DATABASE_URL`, local development stores booking requests in
`leads.json`. On Vercel, configure `DATABASE_URL` with a Neon Postgres
connection string and set a secret `ADMIN_KEY`. The app creates its `leads`
table automatically when it first connects.

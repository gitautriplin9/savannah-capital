# Public hosting plan for Savannah Capital

This repository is now prepared for a public deployment without Azure dependency.

## Recommended hosting

- Frontend: Vercel
- API: Render
- Database: SQLite for a temporary simulated preview, or Postgres for persistent hosting

## 1) Deploy the backend on Render

1. Push this repo to GitHub.
2. Import the repo into Render.
3. Use the settings from `render.yaml`.
4. Set environment variables in the Render dashboard:
   - `PORT=10000`
   - `HOST=0.0.0.0`
   - `ACCESS_SECRET=<strong-value>`
   - `REFRESH_SECRET=<strong-value>`
   - `CORS_ORIGINS=https://your-vercel-app.vercel.app`
   - `DATABASE_FILE=/tmp/savannah-capital.sqlite`
5. Deploy the service.

Render will expose a public API URL such as:
https://savannah-capital-api.onrender.com

## 2) Deploy the frontend on Vercel

1. Import the repo into Vercel.
2. Set the project root to `frontend` so its Vite output and `frontend/vercel.json` SPA route fallback are used.
3. Add the customer-authentication variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Add the employee API variable:
   - `VITE_API_URL=https://savannah-capital-api.onrender.com`
5. Deploy the frontend.

The customer sign-in uses Supabase. The `/team/login` page uses the Render API and shows branch-agent, lending-officer, and manager access. Employee sign-in remains unavailable until the API is deployed and reachable at that URL.

## 3) Validate the live app

- Frontend URL: Vercel-generated domain
- API health check: `https://savannah-capital-api.onrender.com/api/health`

## 4) Notes

- The SQLite database is ephemeral on Render unless a persistent disk is configured. Use managed PostgreSQL for persistent hosted data.
- The production API requires explicit signing secrets and does not create local seeded accounts. Provision employee identities through a secure process; never enable default demo credentials in production.
- The application and all financial operations are simulations. Do not handle real funds or customer data.
- The interactive `/demo` preview uses browser-local sample data. Its payment flow and CSV statement export do not call the API.

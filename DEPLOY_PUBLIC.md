# Public hosting plan for Savannah Capital

This repository is now prepared for a public deployment without Azure dependency.

## Recommended hosting

- Frontend: Vercel
- API: Render
- Database: SQLite for a demo/public preview, or Postgres for a more production-like setup

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
2. Set the root directory to the project root.
3. Add environment variable:
   - `VITE_API_URL=https://savannah-capital-api.onrender.com`
4. Deploy the frontend.

The app will call the backend at that URL.

## 3) Validate the live app

- Frontend URL: Vercel-generated domain
- API health check: `https://savannah-capital-api.onrender.com/api/health`

## 4) Notes

- The existing `better-sqlite3` database is suitable for a demo/public preview, but for heavier real-world usage, a managed Postgres database is recommended.
- Replace demo-only secrets and demo credentials before broad external access.

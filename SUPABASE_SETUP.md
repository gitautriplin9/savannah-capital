# Customer Account Setup

Customer sign-in and profile management use Supabase. The interactive banking preview uses fictional, browser-local data only. It can demonstrate transfers and exports, but does not connect to a bank or move funds.

## Supabase

1. Create a Supabase project and run `backend/supabase-schema.sql` in its SQL editor.
2. In Authentication settings, enable email confirmations and configure Resend as the custom SMTP provider.
3. For phone OTP, obtain a Safaricom business SMS API account and approved sender ID. Supabase does not list Safaricom as a built-in SMS provider, so a custom Supabase SMS hook/adapter must be deployed before enabling phone authentication. Keep `VITE_PHONE_AUTH_ENABLED=false` until delivery is configured and tested.
4. Add the local and production app URLs to the Supabase redirect URL allowlist. Include `http://localhost:5173` for local development and `https://savannah-capital-uuly.vercel.app/` for production.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project settings in `frontend/.env.local` and Vercel's Production, Preview, and Development environments, then redeploy.

## Team workspaces

The employee sign-in is available at `/team/login`. It offers separate branch agent, lending officer, and manager workspaces. Staff sign-in requires the backend API configured through `VITE_API_URL`; the API validates each account's assigned role, and customer self-registration cannot create staff accounts. Do not enable employee access until the API is deployed, staff identities are provisioned securely, and its CORS allowlist includes the production frontend.

## Safaricom M-Pesa

Daraja M-Pesa Express is a merchant-initiated C2B payment prompt; it is not a bank-account, wallet-balance, or peer-to-peer transfer API. For sandbox testing, create a Daraja account and sandbox app to obtain a consumer key/secret and test data. Going live additionally requires a Safaricom-approved PayBill/Till shortcode, passkey, and business operator credentials. Keep all Daraja credentials server-side. Do not enable live payments until callbacks are verified, idempotency is implemented, and Safaricom approves the production app.

Only the public publishable/anon key belongs in frontend configuration. Never put a Supabase service-role key, Safaricom SMS credentials, or Daraja consumer secrets in a `VITE_` variable. Configure provider secrets in Supabase Edge Function secrets or a protected backend environment.

The demo's balances and transactions are fictional. Payment submissions only change the in-browser demo history; statement downloads contain demo data. Real-money transfers, card controls, lending, and customer banking records require a licensed provider and a separately reviewed integration.
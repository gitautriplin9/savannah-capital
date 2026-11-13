# Savannah Capital

Savannah Capital is a responsive simulated banking portal for local feature evaluation. Customer and staff accounts, balances, payments, loans, cards, and verification codes use local seeded data only. No real money is held or moved, and no external payment or banking integrations are connected.

## Run locally

Requires Node.js 22+ and npm:

```powershell
npm run setup
npm run seed
npm test
npm run dev
```

The API listens on `http://127.0.0.1:5000`; the web app listens on `http://127.0.0.1:5173` and proxies `/api` requests to the API. API documentation is at `http://127.0.0.1:5000/api/docs`. SQLite is created at `backend/data/savannah-capital.sqlite` and is initialized with local seeded data.

## Seeded accounts

| Role | Email | Password |
| --- | --- | --- |
| Customer | `salim@savannahcapital.example` | `Password123!` |
| Admin | `admin@savannahcapital.example` | `Admin123!` |
| Teller | `teller@savannahcapital.example` | `Teller123!` |
| Loan Officer | `loans@savannahcapital.example` | `Loan123!` |

These credentials are for local testing only. Do not expose them or the local default signing secrets in a public deployment.

## Portals and routes

- Customer: overview, accounts, transfers, bill payments, loans, statements, cards, notifications, profile, and settings.
- Teller: customer lookup, KYC review, and simulated cash services.
- Loan Officer: loan application review.
- Admin: management overview, audit ledger, customer freeze controls, loan queue, teller desk, configuration, and seeded-data reset.
- Authentication: `/login`, `/create-account`, and `/password-recovery`.

All portal pages require sign-in. Customer and staff navigation depends on the authenticated role.

## API

- Auth: `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/reset-password`, `POST /api/auth/refresh`, `GET /api/auth/me`
- Customer: `GET /api/accounts`, `GET /api/transactions`, `POST /api/transfers`, `GET|POST /api/beneficiaries`
- Loans and cards: `GET /api/loans`, `POST /api/loans/apply`, `POST /api/loans/:id/repay`, `POST /api/loans/:id/review`, `GET /api/cards`, `POST /api/cards/:id/freeze`
- Staff: `GET /api/staff/customers`, `POST /api/staff/deposit`, `POST /api/staff/withdraw`, `POST /api/staff/customers/:id/kyc`
- Admin: overview, transactions, customers, customer freeze, audit, settings, and simulated-data reset under `/api/management`
- Operations: `GET /api/health`; API docs at `/api/docs`

## Safety and scope

Balances and ledger entries are simulated. Payment rails, credit checks, identity verification, SMS, email, and external services are not connected. Verification codes are logged locally and shown in the interface for testing. Loan rules, fees, balances, and KYC outcomes are illustrative. This application is not a financial system of record and must not be used to process real customer data or funds.

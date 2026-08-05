# UnpackOS

UnpackOS is a Punjab crop-residue marketplace coordinating farmer onboarding, field operations, payments, dispatches, and industrial buyers.

## Run & Operate

Prerequisites: Node.js 24, pnpm, a PostgreSQL database exposed as `DATABASE_URL`, and Google OAuth web credentials. Copy `.env.example` to `.env`, set a strong `SESSION_SECRET`, and configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PUBLIC_BASE_URL`, and `BOOTSTRAP_ADMIN_EMAIL`.

1. Install dependencies: `pnpm install`
2. Push the database schema: `pnpm --filter @workspace/db run push`
3. Load the Sangrur demo records: `pnpm --filter @workspace/db run seed`
4. Start the API on port 5000: `PORT=5000 pnpm --filter @workspace/api-server run dev`
5. In another shell, start the web app: `PORT=5173 BASE_PATH=/ API_PORT=5000 pnpm --filter @workspace/stubblex run dev`

The Vite development server proxies `/api` to `API_PORT`, which defaults to port 5000.

Staff sign in with Google. Google returns a verified email and UnpackOS grants access only when that exact email belongs to an active record in the `users` table. The OAuth flow uses a short-lived state cookie and PKCE. Set the Google OAuth authorised redirect URI to `${PUBLIC_BASE_URL}/api/auth/google/callback`. `BOOTSTRAP_ADMIN_EMAIL` assigns the first seeded admin to your Google email; approved machine/logistics partners receive access through the Google email submitted in their application.

Applicant verification and notification SMS use MSG91's Flow API when `MSG91_AUTH_KEY` and the matching template ID are configured. Set `MSG91_OTP_TEMPLATE_ID` for public applicant phone verification, `MSG91_FARMER_TEMPLATE_ID` for paid-batch notifications, `MSG91_ONBOARDING_TEMPLATE_ID` for general application decisions, `MSG91_FARMER_APPROVAL_TEMPLATE_ID` for farmer acceptance and assigned-operator details, and `MSG91_QUANTITY_UPDATE_TEMPLATE_ID` for approved quantity increases. When MSG91 configuration is absent, complete messages are written to the API console for local demos. Staff login itself sends no SMS.

Seeded staff records (only the email configured as `BOOTSTRAP_ADMIN_EMAIL` is expected to be a real Google login; replace demo emails through approved onboarding or database administration):

- `9876500001` — Amandeep Singh, admin
- `9876500002` — Mehar Kaur, coordinator
- `9876500003` — Jagmeet Singh, operator
- `9876500004` — Simran Kaur, operator
- `9876500005` — Gursharan Singh, aggregator
- `9876500006` — Navjot Kaur, inspector

Useful checks and maintenance commands:

- `pnpm run typecheck` — typecheck every workspace package
- `pnpm run build` — typecheck and build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate the typed React client and Zod validators from OpenAPI
- `pnpm --filter @workspace/db run push` — apply the current Drizzle schema to PostgreSQL
- `pnpm --filter @workspace/db run seed` — idempotently seed 12 pilot batches, two yards, and eight market lots

## Stack

- pnpm workspace, Node.js 24, TypeScript 5.9
- React 19, Vite, Tailwind CSS, Wouter, and TanStack Query
- Express 5 API
- PostgreSQL with Drizzle ORM and Drizzle Zod
- OpenAPI with Orval-generated React Query hooks and Zod schemas
- esbuild for the API production bundle

## Where Things Live

- `artifacts/stubblex/src/pages/home.tsx` — public landing page
- `artifacts/stubblex/src/pages/farmer-receipt.tsx` — SMS-facing `/r/:batchId` farmer payment receipt
- `artifacts/stubblex/src/pages/dispatch.tsx` — authenticated dispatch dashboard with batch and order controls
- `artifacts/stubblex/src/components/FarmerQuantityPanel.tsx` — farmer quantity requests, approval controls, and audit history
- `artifacts/stubblex/src/pages/market.tsx` — public lots, purchase requests, commitments, and lot details
- `artifacts/stubblex/src/pages/login.tsx` — bilingual Google Sign-In page
- `artifacts/stubblex/src/components/LeadForm.tsx` — lead form connected to `POST /api/leads`
- `artifacts/stubblex/src/index.css` — UnpackOS colors, straw tokens, typography, and shared utilities
- `artifacts/api-server/src/routes` — Express auth, batch, marketplace, order, commitment, and lead handlers
- `artifacts/api-server/src/lib/session.ts` — signed 30-day session cookies and OTP hashing
- `artifacts/api-server/src/lib/sms.ts` — MSG91 delivery with console fallback
- `lib/db/src/schema/index.ts` — source of truth for PostgreSQL tables, enums, and relations
- `lib/db/src/seed.ts` — idempotent Sangrur pilot seed data and economics
- `lib/api-spec/openapi.yaml` — source of truth for the REST contract
- `lib/api-client-react/src/generated` — generated frontend client and React Query hooks
- `lib/api-zod/src/generated` — generated server-side request and response validators

## Farmer Quantity Workflow

- A farmer applies with name, phone, village, and approximate tonnes; no farmer login is created.
- An inspector records the field visit and verified estimate before approval.
- Approval requires an assigned cluster and field operator. The farmer receives that operator's name and phone by SMS.
- If supply increases, the farmer calls the operator. The operator records the previous tonnes, additional tonnes, source, reason, and an optional field photo in the `Farmer updates` dashboard tab.
- A coordinator or admin other than the requester approves or rejects the request. Approval updates the listed quantity, writes an audit event, and sends the farmer a confirmation SMS.
- Listed tonnes are planning data. The weighbridge measurement remains the final payable quantity.

## Architecture Decisions

- `/api/batches/id/:batchId` is public so a farmer receipt can open directly from SMS without authentication.
- `/dispatch` and `GET /api/batches` require an operator session; coordinators/admins see all batches, while operators/aggregators see only their assignments.
- The landing page, marketplace, and farmer receipts remain public and never redirect to login.
- API types and validators are generated from `lib/api-spec/openapi.yaml`; edit the spec and rerun codegen rather than editing generated files.
- The pilot economics are fixed at ₹400 per tonne paid to farmers and ₹1,700 per tonne sale price.
- Demo seeding is idempotent: clusters, farmers, yards, lots, and batches use stable unique keys.

## Product

- Registers farmer/FPO residue supply by Sangrur cluster.
- Tracks baling, weighbridge payment, delivery, distance, and buyer custody.
- Provides a simple dispatch dashboard with pilot totals and progress.
- Captures farmer, buyer, and logistics-operator leads from the landing page.
- Gives approved staff Google Sign-In access with an exact-email allowlist; farmers never receive accounts.
- Lets operators request farmer quantity increases and gives coordinators/admins a separate approval queue with audit history.
- Sends accepted farmers their assigned operator's contact details and confirms approved quantity increases by SMS.
- Sends the farmer a Punjabi payment confirmation when an assigned batch transitions to `paid`.
- Farmer-payment SMS links open `/r/:batchId?lang=pa`, bypassing the chooser and landing directly in Punjabi.
- Publishes eight Sangrur marketplace lots across two yards, including premium storage.
- Lets buyers request partial lots or pre-season volume commitments without creating an account.
- Lets coordinators confirm, reject, and fulfill orders.

## Gotchas

- `DATABASE_URL` is required before importing or starting database-backed API code.
- Production must set a stable, secret `SESSION_SECRET`; the development fallback resets sessions on server restart.
- A real MSG91 deployment needs approved OTP and farmer-payment template IDs in addition to `MSG91_AUTH_KEY`.
- Run the API and frontend on different ports during development; the frontend proxies `/api` to `API_PORT`.
- The Vite app requires both `PORT` and `BASE_PATH`.
- Keep the landing page, marketplace, receipts, and dispatch dashboard on the existing UnpackOS design tokens in `index.css`.

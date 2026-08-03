# StubbleX

StubbleX is a Punjab crop-residue marketplace that coordinates verified field-to-buyer dispatches and issues a Digital Product Passport for every batch.

## Run & Operate

Prerequisites: Node.js 24, pnpm, and a PostgreSQL database exposed as `DATABASE_URL`. Copy `.env.example` to `.env` and set a strong `SESSION_SECRET`.

1. Install dependencies: `pnpm install`
2. Push the database schema: `pnpm --filter @workspace/db run push`
3. Load the Sangrur demo records: `pnpm --filter @workspace/db run seed`
4. Start the API on port 5000: `PORT=5000 pnpm --filter @workspace/api-server run dev`
5. In another shell, start the web app: `PORT=5173 BASE_PATH=/ API_PORT=5000 pnpm --filter @workspace/stubblex run dev`

The Vite development server proxies `/api` to `API_PORT`, which defaults to port 5000.

OTP and notification SMS use MSG91's Flow API when `MSG91_AUTH_KEY` and the matching template ID are configured. Set `MSG91_OTP_TEMPLATE_ID` for login codes and `MSG91_FARMER_TEMPLATE_ID` for paid-batch notifications. When MSG91 configuration is absent, the complete OTP or farmer message is written to the API console for local demos.

Seeded demo logins (the OTP appears in the API console without MSG91):

- `9876500001` — Amandeep Singh, admin
- `9876500002` — Mehar Kaur, coordinator
- `9876500003` — Jagmeet Singh, operator
- `9876500004` — Simran Kaur, operator
- `9876500005` — Gursharan Singh, aggregator

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
- `artifacts/stubblex/src/pages/passport.tsx` — QR-facing `/p/:passportId` passport page
- `artifacts/stubblex/src/pages/farmer-receipt.tsx` — SMS-facing `/r/:batchId` farmer payment receipt
- `artifacts/stubblex/src/pages/dispatch.tsx` — authenticated dispatch dashboard with batch and order controls
- `artifacts/stubblex/src/pages/market.tsx` — public lots, purchase requests, commitments, and lot passport previews
- `artifacts/stubblex/src/pages/login.tsx` — bilingual phone OTP login
- `artifacts/stubblex/src/components/PassportMock.tsx` — landing-page passport illustration
- `artifacts/stubblex/src/components/LeadForm.tsx` — lead form connected to `POST /api/leads`
- `artifacts/stubblex/src/index.css` — StubbleX colors, straw tokens, typography, and shared utilities
- `artifacts/api-server/src/routes` — Express auth, batch, marketplace, order, commitment, and lead handlers
- `artifacts/api-server/src/lib/session.ts` — signed 30-day session cookies and OTP hashing
- `artifacts/api-server/src/lib/sms.ts` — MSG91 delivery with console fallback
- `lib/db/src/schema/index.ts` — source of truth for PostgreSQL tables, enums, and relations
- `lib/db/src/seed.ts` — idempotent Sangrur pilot seed data and economics
- `lib/api-spec/openapi.yaml` — source of truth for the REST contract
- `lib/api-client-react/src/generated` — generated frontend client and React Query hooks
- `lib/api-zod/src/generated` — generated server-side request and response validators

## Architecture Decisions

- `/api/batches/:passportId` is public so a physical-product QR can resolve without authentication.
- `/api/batches/id/:batchId` is public so a farmer receipt can open directly from SMS without authentication.
- `/dispatch` and `GET /api/batches` require an operator session; coordinators/admins see all batches, while operators/aggregators see only their assignments.
- The landing page and `/p/:passportId` remain public and never redirect to login.
- API types and validators are generated from `lib/api-spec/openapi.yaml`; edit the spec and rerun codegen rather than editing generated files.
- The pilot economics are fixed at ₹400 per tonne paid to farmers and ₹1,700 per tonne sale price.
- Demo seeding is idempotent: clusters, farmers, yards, lots, and batches use stable unique keys.

## Product

- Registers farmer/FPO residue supply by Sangrur cluster.
- Tracks baling, weighbridge payment, delivery, distance, moisture, and buyer custody.
- Publishes consumer-verifiable Digital Product Passports.
- Provides a simple dispatch dashboard with pilot totals and progress.
- Captures farmer, buyer, and logistics-operator leads from the landing page.
- Gives operators passwordless, phone-only OTP access; farmers never receive accounts.
- Sends the farmer a Punjabi payment confirmation when an assigned batch transitions to `paid`.
- Farmer-payment SMS links open `/r/:batchId?lang=pa`, bypassing the chooser and landing directly in Punjabi.
- Publishes eight Sangrur marketplace lots across two yards, including premium dry storage.
- Lets buyers request partial lots or pre-season volume commitments without creating an account.
- Lets coordinators confirm, reject, and fulfill orders; delivery writes the real buyer into every linked passport.

## Gotchas

- `DATABASE_URL` is required before importing or starting database-backed API code.
- Production must set a stable, secret `SESSION_SECRET`; the development fallback resets sessions on server restart.
- A real MSG91 deployment needs approved OTP and farmer-payment template IDs in addition to `MSG91_AUTH_KEY`.
- Run the API and frontend on different ports during development; the frontend proxies `/api` to `API_PORT`.
- The Vite app requires both `PORT` and `BASE_PATH`.
- Keep the landing page, passport page, and dispatch dashboard on the existing StubbleX design tokens in `index.css`.

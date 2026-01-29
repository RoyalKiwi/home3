# Homepage3: Technical Implementation Plan & Assessment

**Generated**: 2026-01-29
**Source Document**: [FullProjectPlan.md](./FullProjectPlan.md)
**Status**: Architecture approved, Phase 0 in progress

---

## TABLE OF CONTENTS

1. [Document Understanding](#1-document-understanding)
2. [Requirements Breakdown](#2-requirements-breakdown)
3. [Gaps, Ambiguities & Recommendations](#3-gaps-ambiguities--recommendations)
4. [Integration Architecture](#4-integration-architecture)
5. [Implementation Plan](#5-implementation-plan)
6. [Assumptions](#6-assumptions)

---

## 1. DOCUMENT UNDERSTANDING

### Project Purpose
A high-fidelity, self-hosted home server dashboard that transforms complex home lab environments into a visually stunning, organized command center. Solves the problem of difficult YAML-based dashboards and lack of automated branding/icon management. Emphasizes local-first operation, visual excellence ("Void" aesthetic), and dual-path UX (family-friendly vs admin control).

### Key Differentiators
- 100% local-network functional (no cloud dependencies for core features)
- Automated icon/color extraction and gradient generation
- Real-time monitoring via SSE (Server-Sent Events)
- Observation-only philosophy (no server control actions)
- Glassmorphic UI with 24px backdrop blur and breathing gradients
- Zero authentication for family view; JWT-protected admin routes

### Target Runtime
Docker container on private LAN, optimized for low-powered hardware (tablets/older phones).

---

## 2. REQUIREMENTS BREAKDOWN

### 2.1 FUNCTIONAL REQUIREMENTS

#### User Roles & Access Model
- **Family/Guest Users**: Unauthenticated access to Home grid view; can browse and click app cards
- **Admin Users**: JWT-authenticated access to admin routes; can manage dashboard, users, settings, monitoring
- **Superuser**: First admin account created during onboarding; can create/manage other admin accounts

#### Pages/Routes (Explicit + Implied)

| Route | Purpose | Auth Required | Identified From |
|-------|---------|---------------|-----------------|
| `/` | Family-facing home grid with categorized app cards | No | Section 2, 3 |
| `/onboarding` | First-run setup (superuser creation, initial config) | No (but only accessible if DB empty) | Section 3, 4 |
| `/admin` | Admin console overview + tactical ticker | Yes | Section 2, 3 |
| `/admin/dashboard` | Manage categories/subcategories/cards | Yes | Section 3 |
| `/admin/users` | User account management | Yes | Section 2, 3 |
| `/admin/api-settings` | Driver credentials and integration logs | Yes | Section 2, 3 |
| `/admin/monitoring` | Server health hub with telemetry | Yes | Section 2, 3 |
| `/api/auth/login` | Admin login endpoint | No | Section 4 (implied) |
| `/api/auth/logout` | Admin logout endpoint | Yes | Section 2 |
| `/api/stats/stream` | SSE endpoint for real-time telemetry | Conditional | Section 4 |
| `/api/cards` | CRUD operations for app cards | Yes | Section 3 (implied) |
| `/api/categories` | CRUD operations for categories | Yes | Section 3 (implied) |
| `/api/subcategories` | CRUD operations for subcategories | Yes | Section 3 (implied) |
| `/api/branding` | Icon fetch + color extraction | Yes | Section 3, 5 |
| `/api/settings` | Global settings (maintenance mode, notifications) | Yes | Section 3, 5 |
| `/api/notifications/test` | Test notification delivery | Yes | Section 7 |

#### Core Features

1. **Home Grid**:
   - Categorized layout with subcategory separators
   - 3 card sizes (Small 25%, Medium 50%, Large 25% width)
   - Real-time status heartbeats (green/amber/red pulse)
   - Static card support (disable heartbeat)
   - Text filter (real-time search by name/description)
   - Category collapse state persisted in LocalStorage
   - Cards open in new tab to preserve dashboard state

2. **Admin Dashboard Management**:
   - List-based interface (not visual grid)
   - Drag-and-drop reordering within subcategories
   - Modal-based add/edit for cards
   - Manual icon upload + automated icon fetch
   - Per-card status toggle (enable/disable monitoring)

3. **Branding Automation**:
   - Fetch highest-res icon from app manifests
   - Extract 2-3 dominant colors
   - Generate 4-color dynamic gradient
   - Local cache at `/data/cache`
   - Auto-cleanup on card deletion

4. **Real-Time Monitoring**:
   - SSE stream for status updates
   - Only push changed data
   - Admin tactical ticker (CPU/RAM/Storage aggregate)
   - Per-card heartbeat polling (2s timeout = online)
   - Fail-silent driver logic (UI remains functional)

5. **Notification Engine**:
   - Discord/Telegram/Pushover webhooks
   - Critical server alerts (temp, SMART, etc.)
   - User-defined thresholds
   - Flood control (1 alert per type per 30 min)
   - Global maintenance mode banner

6. **Onboarding**:
   - Mandatory superuser creation
   - Optional server name/branding config
   - Optional "Discovery Template" pre-load
   - Asset pre-fetch during setup

#### Integration Drivers (Implied APIs)
- **Server Health**: Unraid API, Proxmox API, Netdata stream, Uptime Kuma
- **Media**: Plex/Jellyfin sessions, Tautulli stats, *arr queue status
- **Network**: Pi-hole/AdGuard query stats, Tailscale node status, VPN state
- **Hardware**: NUT/APC UPS, SMART disk health, GPU telemetry (Nvidia/AMD)

### 2.2 DATA MODEL & STORAGE

#### Database Schema (Better-SQLite3)

**categories**
- `id` INTEGER PRIMARY KEY
- `name` TEXT NOT NULL
- `order_index` INTEGER NOT NULL

**subcategories**
- `id` INTEGER PRIMARY KEY
- `category_id` INTEGER NOT NULL (FK → categories)
- `name` TEXT NOT NULL
- `order_index` INTEGER NOT NULL
- `show_separator` BOOLEAN DEFAULT true
- `admin_only` BOOLEAN DEFAULT false

**cards**
- `id` INTEGER PRIMARY KEY
- `subcategory_id` INTEGER NOT NULL (FK → subcategories)
- `name` TEXT NOT NULL
- `subtext` TEXT NOT NULL (description)
- `url` TEXT NOT NULL
- `icon_url` TEXT (path to cached/uploaded icon)
- `gradient_colors` TEXT (JSON array of 4 colors)
- `size` TEXT CHECK(size IN ('small','medium','large'))
- `show_status` BOOLEAN DEFAULT true (enable/disable heartbeat)
- `order_index` INTEGER NOT NULL

**integrations**
- `id` INTEGER PRIMARY KEY
- `service_name` TEXT NOT NULL
- `credentials` TEXT (encrypted JSON)
- `poll_interval` INTEGER (milliseconds)
- `is_active` BOOLEAN DEFAULT true

**users**
- `id` INTEGER PRIMARY KEY
- `username` TEXT UNIQUE NOT NULL
- `password_hash` TEXT NOT NULL
- `role` TEXT CHECK(role IN ('superuser','admin'))

**widgets** (future scope but schema defined)
- `id` INTEGER PRIMARY KEY
- `widget_type` TEXT
- `config` TEXT (JSON)
- `grid_position` TEXT (JSON: x/y/w/h)

**settings**
- `key` TEXT PRIMARY KEY
- `value` TEXT

#### File Storage

| Path | Purpose | Lifecycle |
|------|---------|-----------|
| `/data/homepage.db` | SQLite database | Persistent, backed up |
| `/data/cache/` | Auto-fetched icons | Cleaned on card delete |
| `/data/uploads/` | User-uploaded icons/assets | Cleaned on card delete |

### 2.3 SECURITY & AUTHENTICATION

**Authentication Model:**
- **Family View**: No auth required (local LAN trust model)
- **Admin Routes**: JWT stored in HttpOnly cookies
- **Session Signing**: `JWT_SECRET` from environment
- **Library**: Jose (JWT)

**Authorization:**
- `/admin/**` routes: Server-side JWT validation middleware
- Role-based filtering: Cards marked "ADMIN ONLY" filtered from family view
- Data masking: API keys, IPs masked in admin UI

**Security Requirements:**
- Encrypted credentials in `integrations.credentials` field
- Secure redirect (302) to `/onboarding` if `users` table empty
- Logout redirects to family home view
- No external auth dependencies (local-first)

**Trust Assumptions:**
- LAN is trusted (no family user auth)
- Physical/network security handles perimeter
- HTTPS/reverse proxy managed externally (out-of-scope)

### 2.4 DEPLOYMENT & RUNTIME

**Container Strategy:**
- Single unified Docker image
- Next.js 15+ (App Router) + Node.js 22+ runtime
- Better-SQLite3 (no separate DB container needed)

**Environment Variables:**
- `JWT_SECRET`: Required (session signing)
- `DATA_PATH`: Optional, defaults to `/data`
- `NODE_ENV`: production/development
- `PORT`: Optional, defaults to 3000
- `LOG_LEVEL`: Optional, defaults to INFO

**Volumes:**
- `/data` → persistent volume for DB, cache, uploads

**Architecture Support:**
- Primary: x86_64
- Optional: ARM64 (multi-arch buildx)

**Performance Targets:**
- First meaningful paint: <500ms on LAN
- 60 FPS for animations on modern mobile
- Zero-lag interactions on low-powered hardware

**Backup/Recovery:**
- Entire state in `/data` directory
- Backup = archive `/data`
- Recovery = mount `/data` to fresh container

---

## 3. GAPS, AMBIGUITIES & RECOMMENDATIONS

### 3.1 Architecture & Technical Decisions

| Gap | Options | Recommendation | Rationale |
|-----|---------|----------------|-----------|
| **API routing model** | (a) `/api` routes in Next.js App Router<br>(b) Separate Express backend<br>(c) Next.js Route Handlers + `server-actions` | **(a) Next.js Route Handlers** | Simplifies deployment (single container), aligns with Next.js 15 App Router philosophy, easier SSE implementation via route handlers |
| **Credential encryption** | (a) AES-256 with env-based key<br>(b) Native OS keyring<br>(c) Plaintext (dev only) | **(a) AES-256 with `JWT_SECRET` as key** | Balances security with simplicity; no external keyring dependencies; reuses existing secret |
| **SSE connection scope** | (a) Single stream for all data<br>(b) Separate streams per module (cards, ticker, monitoring)<br>(c) WebSockets instead | **(b) Separate streams: `/api/stream/cards`, `/api/stream/ticker`, `/api/stream/monitoring`** | Reduces payload size, allows granular subscriptions, avoids unnecessary data transfer to family view |
| **Driver polling architecture** | (a) In-process Node timers<br>(b) Separate worker threads<br>(c) External cron + API calls | **(a) In-process Node setInterval with async queues** | Simplest for MVP; workers add complexity without clear benefit for typical home lab scale (<50 services) |
| **Icon fetch strategy** | (a) Client-side fetch<br>(b) Server proxy<br>(c) Server fetch + cache | **(c) Server fetch + cache** | Required for local sovereignty; client-side can't guarantee offline access; server controls cache lifecycle |
| **Role masking implementation** | (a) Filter in React components<br>(b) Filter in API responses<br>(c) Separate DB queries per role | **(b) Filter in API responses (middleware)** | Security-critical filtering must happen server-side; single source of truth; prevents leaking forbidden data to browser |
| **State persistence location** | (a) LocalStorage only<br>(b) DB + LocalStorage sync<br>(c) URL params + LocalStorage | **(c) URL params (nav state) + LocalStorage (collapsed categories)** | Matches doc (Section 5); URL allows shareable state; LocalStorage for UI preferences |
| **Maintenance mode storage** | (a) DB `settings` table<br>(b) In-memory state<br>(c) Environment variable | **(a) DB `settings` table** | Persists across restarts; matches doc (Section 5); allows audit trail |

### 3.2 Data Model Clarifications

| Gap | Options | Recommendation | Rationale |
|-----|---------|----------------|-----------|
| **"ADMIN ONLY" card marking** | (a) Add `visibility` field to `cards` table<br>(b) Add `admin_only` boolean to `subcategories`<br>(c) Infer from subcategory name pattern | **(b) `admin_only` boolean on `subcategories`** | Granularity matches doc's "category-level restriction"; simpler than per-card; allows entire sections to be gated |
| **Gradient storage format** | (a) Store 4 colors as JSON array<br>(b) Store as comma-separated hex<br>(c) Regenerate on-demand | **(a) JSON array in `gradient_colors` field** | Matches SQLite TEXT type; flexible for future gradient logic changes; easy to parse in JS |
| **Driver credentials encryption** | (a) Encrypt entire JSON blob<br>(b) Encrypt individual fields<br>(c) Store plaintext in trusted env | **(a) Encrypt entire JSON blob** | Simpler key management; entire blob treated as opaque secret; matches doc's "Encrypted JSON" phrase |
| **Cascade delete behavior** | (a) Cascade category → subcategory → cards<br>(b) Prevent delete if children exist<br>(c) Soft delete (archive) | **(a) Cascade with ON DELETE CASCADE** | Matches admin UX expectation; prevents orphaned records; cleanup jobs handle file assets |

### 3.3 UX & Behavior Clarifications

| Gap | Options | Recommendation | Rationale |
|-----|---------|----------------|-----------|
| **Empty category display** | (a) Hide empty categories<br>(b) Show "No apps yet"<br>(c) Show with placeholder | **(a) Hide empty categories** | Cleaner UI; dynamic reflow already handles gaps per doc; admin can see empties in Dashboard module |
| **Filter behavior on no results** | (a) Show "No matches" message<br>(b) Show empty grid<br>(c) Show top 3 closest matches | **(a) Show "No matches found" message** | Better UX than empty silence; no fuzzy search in MVP scope |
| **Card click behavior** | (a) `target="_blank"`<br>(b) `target="_blank" rel="noopener noreferrer"`<br>(c) Same tab | **(b) `target="_blank" rel="noopener noreferrer"`** | Matches doc requirement; security best practice; prevents opener hijacking |
| **Drag-and-drop scope** | (a) Reorder within subcategory only<br>(b) Move across subcategories<br>(c) Move across categories | **(a) Reorder within subcategory only** | Matches doc ("reorder cards within their subcategories"); simpler logic; predictable hierarchy |
| **Onboarding skip option** | (a) No skip (forced)<br>(b) Skip to empty dashboard<br>(c) Skip with guest mode | **(a) No skip (unskippable superuser creation)** | Matches doc ("unskippable"); ensures security baseline |

### 3.4 Monitoring & Integration

| Gap | Options | Recommendation | Rationale |
|-----|---------|----------------|-----------|
| **Driver failure handling** | (a) Mark card offline<br>(b) Show last known state<br>(c) Hide card | **(a) Mark card offline (red, no pulse)** | Matches "fail-silent" philosophy; user can diagnose via admin logs; transparent failure state |
| **Status poll interval** | (a) Fixed 5s for all<br>(b) Configurable per integration<br>(c) Adaptive based on load | **(b) Configurable per integration (default 5s)** | Matches `integrations.poll_interval` in schema; some drivers need faster/slower polling |
| **SSE reconnect logic** | (a) Auto-reconnect in browser<br>(b) Manual refresh required<br>(c) Exponential backoff | **(a) Auto-reconnect with EventSource API** | Standard SSE behavior; improves resilience; no doc guidance means use web standard |
| **Ticker aggregation scope** | (a) Single primary server<br>(b) All servers in `integrations`<br>(c) User-selected servers | **(a) Single primary server (first Unraid/Proxmox integration)** | Doc says "aggregate" but doesn't specify multi-server in ticker context; MVP assumes single host for tactical ticker |

### 3.5 Missing Specifications

| Gap | Options | Recommendation | Rationale |
|-----|---------|----------------|-----------|
| **Port binding** | (a) 3000<br>(b) 80<br>(c) User-configurable | **(a) 3000 (Next.js default), expose via ENV** | Standard Next.js convention; reverse proxy can map externally |
| **Log level control** | (a) Fixed INFO<br>(b) ENV-based (DEBUG/INFO/ERROR)<br>(c) Runtime toggleable | **(b) ENV var `LOG_LEVEL` (default: INFO)** | Standard practice; supports troubleshooting without rebuild |
| **Asset size limits** | (a) No limit<br>(b) 5MB per upload<br>(c) 10MB total cache | **(b) 5MB per upload, 500MB total cache with LRU cleanup** | Prevents abuse; 5MB covers high-res icons; 500MB = ~1000 icons at 500KB avg |
| **Session expiry** | (a) 24 hours<br>(b) 7 days<br>(c) No expiry | **(a) 24 hours with refresh token** | Balances convenience with security; admin sessions shouldn't persist indefinitely |
| **Notification rate limit** | (a) 1 per 30 min (per type)<br>(b) 1 per hour (global)<br>(c) Configurable | **(a) 1 per type per 30 min (as specified in doc)** | Matches doc Section 5; prevents spam while allowing distinct alerts |

---

## 4. INTEGRATION ARCHITECTURE

### 4.1 Architecture Options Evaluated

#### Option A: Monolithic Next.js (Single Container) ✅ SELECTED
**Structure:**
- Single Next.js app with App Router
- `/app` pages + `/api` route handlers in same process
- Drivers as Node modules imported by API routes
- Single `Dockerfile` → single container
- SQLite embedded in same filesystem

**Pros:**
- Simplest deployment (one `docker-compose.yml`, one image)
- No network latency between components
- Shared codebase for type safety (TypeScript across frontend/backend)
- Matches doc's "Unified Docker Image" phrase
- Easier development (single `npm run dev`)

**Cons:**
- All concerns in one codebase (could grow large)
- Driver crashes could theoretically affect UI (mitigated by async try-catch)
- Harder to scale horizontally (but not needed for home lab)

#### Option B: Next.js + Separate Driver Service
**Structure:**
- Container 1: Next.js frontend + API gateway
- Container 2: Node.js driver polling service
- Communication via HTTP or message queue
- Shared SQLite volume or separate driver DB

**Pros:**
- Isolation (driver failures can't crash UI)
- Could scale driver service independently
- Cleaner separation of concerns

**Cons:**
- More complex deployment (2 containers, inter-service networking)
- Adds latency to status updates
- Overkill for home lab scale
- Doc doesn't suggest this architecture

#### Option C: Next.js with Serverless-style API Routes + Worker Threads
**Structure:**
- Next.js app with App Router
- API routes use Node.js Worker Threads for driver polling
- Main thread handles UI + API gateway
- Workers report back via message passing

**Pros:**
- Isolation via OS-level threads
- Single container (matches doc)
- Protects main thread from driver blocking

**Cons:**
- Worker complexity (serialization, debugging)
- Harder to reason about than simple async
- May not work well with Better-SQLite3 (not thread-safe without locking)

### 4.2 Selected Architecture: Monolithic Next.js

**Justification:**
1. **Doc alignment**: Explicitly states "Unified Docker Image" and "Single `Dockerfile`"
2. **Simplicity**: Home lab context (<50 services) doesn't need microservices
3. **Performance**: No network hops; SQLite lives in same process memory
4. **Development velocity**: Faster iteration with unified codebase
5. **Type safety**: Shared types between API and UI (no OpenAPI/gRPC overhead)
6. **Fail-silent design**: Doc's "fail-silent driver logic" means driver errors are caught and logged, not propagated; async/await with try-catch sufficient

### 4.3 Module Boundaries (Logical Separation)

```
/app                    → Next.js pages (RSC)
  /page.tsx            → Home grid
  /admin/
    /layout.tsx        → Admin shell with sidebar
    /page.tsx          → Console overview
    /dashboard/...     → Dashboard management
    /users/...         → User management
    /monitoring/...    → Monitoring hub
  /onboarding/...      → First-run setup

/api                    → Next.js Route Handlers
  /auth/...            → Login, logout, session
  /cards/...           → CRUD for cards
  /categories/...      → CRUD for categories
  /branding/...        → Icon fetch, color extraction
  /stream/
    /cards/route.ts    → SSE for card status
    /ticker/route.ts   → SSE for admin ticker
    /monitoring/route.ts → SSE for monitoring data
  /notifications/...   → Webhook testing

/components            → Shared React components
  /cards/              → AppCard variants (Small/Medium/Large)
  /admin/              → Admin-specific UI (DndList, Modal)
  /layout/             → Nav, Sidebar, TopBar

/lib                   → Shared server utilities
  /db.ts               → Better-SQLite3 client + migrations
  /auth.ts             → JWT validation middleware
  /crypto.ts           → AES-256 encryption for credentials
  /sse.ts              → SSE connection manager

/drivers               → Modular driver logic
  /base.ts             → BaseDriver interface
  /unraid.ts           → Unraid API client
  /plex.ts             → Plex API client
  /uptime-kuma.ts      → Uptime Kuma client
  (etc.)

/services              → Business logic layer
  /branding.ts         → Icon fetch + color extraction
  /monitoring.ts       → Driver polling orchestrator
  /notifications.ts    → Webhook dispatch + flood control

/data                  → Mounted volume (persistent)
  /homepage.db         → SQLite database
  /cache/              → Auto-fetched icons
  /uploads/            → User-uploaded assets
```

**Inter-Module Communication:**
- **UI ↔ API**: Standard HTTP (fetch from client components, direct import in RSC)
- **API ↔ Services**: Direct function calls (same process)
- **Services ↔ Drivers**: Direct function calls (same process)
- **Services ↔ DB**: Better-SQLite3 synchronous API
- **Real-time updates**: SSE (HTTP long-poll) from API routes to browser

---

## 5. IMPLEMENTATION PLAN

### Phase 0: Repository Bootstrapping (Foundation)

#### Task 0.1: Initialize Next.js Project ✅ COMPLETE
**What to create:**
- `package.json` with dependencies
- `tsconfig.json` with path aliases
- `next.config.ts`
- Directory structure

**Why:** Establishes baseline Next.js 15 structure per doc Section 4

**Acceptance criteria:**
- `npm run dev` starts Next.js dev server
- TypeScript compilation works

**Test plan:** Visit `http://localhost:3000` and see Next.js welcome page

#### Task 0.2: Configure Project Structure ✅ COMPLETE
**What to create:**
- Create directory structure: `/app`, `/api`, `/components`, `/lib`, `/drivers`, `/services`, `/data`
- Root layout with design system CSS
- Global styles with Void theme tokens

**Why:** Matches doc Section 4 architecture

**Acceptance criteria:**
- All directories exist
- Path aliases resolve in IDE
- Design tokens accessible via CSS variables

**Test plan:** Import from `@/lib/db` without errors

#### Task 0.3: Set Up Database Layer
**What to create:**
- `/lib/db.ts`: Better-SQLite3 client with connection pooling
- `/lib/migrations/001_initial_schema.sql`: Create all 7 tables (categories, subcategories, cards, integrations, users, widgets, settings)
- `/lib/migrations/runner.mjs`: Migration runner that executes on startup

**Why:** Satisfies data model from Section 4

**Acceptance criteria:**
- Database file created at `/data/homepage.db`
- All tables exist with correct schema
- Foreign key constraints enforced

**Test plan:**
- Run migration
- Use SQLite CLI to verify schema: `.schema categories`
- Test cascade delete: Delete category with subcategories

#### Task 0.4: Implement Authentication Utilities
**What to create:**
- `/lib/auth.ts`: JWT signing/verification functions
- `/lib/middleware/authMiddleware.ts`: Next.js middleware for protected routes
- `/lib/crypto.ts`: AES-256 encryption/decryption for credentials

**Why:** Satisfies security requirements from Section 4

**Acceptance criteria:**
- `signToken(user)` returns valid JWT
- `verifyToken(token)` decodes user payload
- Middleware redirects unauthenticated users from `/admin/*`
- `encrypt(json)` / `decrypt(cipher)` round-trip successfully

**Test plan:**
- Unit test token creation and validation
- Manually visit `/admin` without login → redirect to `/`

#### Task 0.5: Docker Configuration
**What to create:**
- `Dockerfile`: Multi-stage build (deps → build → runtime)
- `docker-compose.yml`: Service definition with `/data` volume mount
- `.dockerignore`: Exclude `node_modules`, `.git`, etc.

**Why:** Satisfies deployment model from Section 8

**Acceptance criteria:**
- `docker compose build` succeeds
- `docker compose up` starts container
- Database persists across container restarts

**Test plan:**
- Build image
- Start container
- Create test record in DB
- Restart container
- Verify test record still exists

#### Task 0.6: Git & Deployment Prep
**What to create:**
- `.gitignore` (exclude `/data`, `.env`, `.env.local`, `node_modules`)
- `.env.example` with all required vars (no values)
- `README.md` with setup steps

**Why:** Ensures repo is immediately deployable when pushed to GitHub

**Acceptance criteria:**
- `.gitignore` excludes sensitive files
- `.env.example` documents all ENV vars
- README provides clear setup instructions

**Test plan:** Clone fresh repo → follow README → successfully deploy

---

### Phase 1: Minimal Runnable Skeleton (MVP Core)

#### Task 1.1: Home Page Layout (Static)
**What to create:**
- `/app/page.tsx`: Home grid shell with top navigation (Home/Admin tabs)
- `/components/layout/TopNav.tsx`: Top navigation bar

**Why:** Establishes "Two-World Split" from Section 2

**Acceptance criteria:**
- Page renders with Void Black background (#050608)
- Top nav shows "Home" and "Admin" tabs
- Typography uses JetBrains Mono

**Test plan:** Visual inspection matches design system (Section 2)

#### Task 1.2: Admin Shell Layout
**What to create:**
- `/app/admin/layout.tsx`: Admin layout with left sidebar (collapsed on mobile)
- `/components/layout/AdminSidebar.tsx`: Sidebar with 5 modules (Console, Dashboard, Users, API Settings, Monitoring)
- `/app/admin/page.tsx`: Admin console overview (placeholder)

**Why:** Satisfies "Admin Cockpit" structure from Section 2

**Acceptance criteria:**
- Sidebar renders on desktop
- Sidebar collapses on <640px
- Active module highlighted

**Test plan:**
- Resize browser
- Click module links → URL updates

#### Task 1.3: Onboarding Flow
**What to create:**
- `/app/onboarding/page.tsx`: Superuser creation form
- `/api/onboarding/route.ts`: POST handler for superuser creation
- `/lib/middleware/onboardingCheck.ts`: Middleware to redirect if `users` table empty

**Why:** Satisfies first-run experience from Section 3, 4

**Acceptance criteria:**
- If DB has no users → redirect to `/onboarding`
- Form validates username/password
- Submitting creates user with role='superuser'
- After submit → redirect to `/admin`

**Test plan:**
- Fresh DB → auto-redirect to `/onboarding`
- Create superuser
- Verify user in DB
- Revisit `/onboarding` → redirect to `/` (users exist)

#### Task 1.4: Admin Login/Logout
**What to create:**
- `/app/admin/login/page.tsx`: Login form
- `/api/auth/login/route.ts`: POST handler (verify password, sign JWT, set HttpOnly cookie)
- `/api/auth/logout/route.ts`: POST handler (clear cookie, redirect to `/`)

**Why:** Satisfies auth requirements from Section 4

**Acceptance criteria:**
- Login with correct credentials → sets JWT cookie → redirect to `/admin`
- Login with wrong credentials → error message
- Logout clears cookie → redirect to `/`

**Test plan:**
- Login with wrong password → error
- Login with correct password → see admin page
- Check browser cookies → see HttpOnly JWT
- Logout → redirect to home

#### Task 1.5: Database Seed (Optional Dev Data)
**What to create:**
- `/lib/migrations/002_seed_demo_data.sql`: Insert sample categories, subcategories, cards (e.g., Entertainment → Streaming → Plex card)

**Why:** Enables visual testing without manual data entry

**Acceptance criteria:**
- Running seed creates 2-3 categories with 5-10 cards

**Test plan:** Query DB → see sample data

---

### Phase 2: CRUD Operations (Data Management)

#### Task 2.1: Categories API
**What to create:**
- `/api/categories/route.ts`: GET (list all), POST (create)
- `/api/categories/[id]/route.ts`: GET (single), PATCH (update), DELETE (cascade to subcategories/cards)

**Why:** Satisfies dashboard management from Section 3

**Acceptance criteria:**
- Admin can create/read/update/delete categories
- Deleting category cascades to children
- Non-admin requests blocked

**Test plan:**
- Create category → query DB
- Delete category with subcategories → verify cascade

#### Task 2.2: Subcategories API
**What to create:**
- `/api/subcategories/route.ts`: GET, POST
- `/api/subcategories/[id]/route.ts`: GET, PATCH, DELETE

**Why:** Satisfies tiered management from Section 3

**Acceptance criteria:**
- CRUD operations work
- `admin_only` boolean controls visibility
- Foreign key constraint enforced

**Test plan:** Create subcategory → verify `category_id` foreign key

#### Task 2.3: Cards API
**What to create:**
- `/api/cards/route.ts`: GET (with role-based filtering), POST
- `/api/cards/[id]/route.ts`: GET, PATCH, DELETE
- `/lib/services/filterCardsByRole.ts`: Middleware to filter admin-only cards for family view

**Why:** Satisfies card management + role masking from Section 5

**Acceptance criteria:**
- Admin sees all cards
- Family view filters out cards in `admin_only` subcategories
- Deleting card triggers cleanup job for icon

**Test plan:**
- Create card in admin-only subcategory
- GET `/api/cards` without auth → card hidden
- GET `/api/cards` with admin JWT → card visible

#### Task 2.4: Admin Dashboard Module (UI)
**What to create:**
- `/app/admin/dashboard/page.tsx`: List view of categories/subcategories/cards
- `/components/admin/DndList.tsx`: Drag-and-drop reordering with `@dnd-kit`
- `/components/admin/CardModal.tsx`: Add/edit modal for cards

**Why:** Satisfies admin UI from Section 3

**Acceptance criteria:**
- Lists render from API
- Drag-and-drop updates `order_index` in DB
- Modal allows CRUD operations
- Manual icon upload saves to `/data/uploads`

**Test plan:**
- Reorder cards → refresh page → order persists
- Upload icon → verify file in `/data/uploads`

---

### Phase 3: Branding & Asset Management

#### Task 3.1: Icon Fetch Service
**What to create:**
- `/lib/services/branding.ts`: Function to fetch icon from URL (check manifest.json, apple-touch-icon, favicon)
- `/api/branding/fetch/route.ts`: POST endpoint (takes URL, returns icon path)

**Why:** Satisfies automated branding from Section 3, 5

**Acceptance criteria:**
- Given app URL → fetch highest-res icon
- Save to `/data/cache/{hash}.png`
- Return path to client

**Test plan:**
- POST `/api/branding/fetch` with URL `https://plex.tv` → returns icon path
- Verify file exists in `/data/cache`

#### Task 3.2: Color Extraction & Gradient Generation
**What to create:**
- `/lib/services/colorExtraction.ts`: Use `sharp` to extract 2-3 dominant colors
- `/lib/services/gradientGenerator.ts`: Generate 4-color gradient array blended with Void theme
- Update `/api/branding/fetch/route.ts` to include gradient in response

**Why:** Satisfies gradient generation from Section 5

**Acceptance criteria:**
- Extract colors from icon
- Return JSON array of 4 hex colors
- Store in `cards.gradient_colors`

**Test plan:**
- Fetch icon for colorful app (e.g., Plex) → verify gradient contains brand colors

#### Task 3.3: Asset Cleanup Job
**What to create:**
- `/lib/services/assetCleanup.ts`: Function to delete icon from `/data/cache` or `/data/uploads` based on card.icon_url
- Trigger on card DELETE in `/api/cards/[id]/route.ts`

**Why:** Satisfies cleanup from Section 5

**Acceptance criteria:**
- Deleting card removes orphaned icon
- Does not delete icons used by other cards

**Test plan:**
- Create 2 cards with same icon URL
- Delete 1 card → icon remains
- Delete 2nd card → icon deleted

---

### Phase 4: Real-Time Monitoring (SSE & Drivers)

#### Task 4.1: SSE Infrastructure
**What to create:**
- `/lib/sse.ts`: SSE connection manager (track clients, broadcast events)
- `/api/stream/cards/route.ts`: SSE endpoint for card status
- Client-side EventSource in `/components/cards/AppCard.tsx`

**Why:** Satisfies real-time flow from Section 4

**Acceptance criteria:**
- Browser connects to `/api/stream/cards`
- Server sends `data: {...}` events
- Browser updates UI without refresh

**Test plan:**
- Open browser console
- Watch network tab → see `event-stream` connection
- Trigger status update → see UI change

#### Task 4.2: Base Driver Interface
**What to create:**
- `/drivers/base.ts`: `BaseDriver` abstract class with `poll()` method
- `/lib/services/monitoring.ts`: Orchestrator that calls `poll()` on all active drivers

**Why:** Establishes driver architecture from Section 5

**Acceptance criteria:**
- BaseDriver defines contract: `poll() → Promise<Status>`
- Orchestrator iterates integrations table, calls driver, handles errors

**Test plan:** Mock driver → verify poll() called at interval

#### Task 4.3: Implement Core Drivers
**What to create:**
- `/drivers/unraid.ts`: Poll Unraid API for system stats (CPU, RAM, Storage)
- `/drivers/uptime-kuma.ts`: Poll Uptime Kuma for service status
- `/drivers/plex.ts`: Poll Plex for active sessions

**Why:** Satisfies integration ecosystem from Section 3

**Acceptance criteria:**
- Each driver returns `{status: 'online'|'warning'|'offline', data: {...}}`
- 2s timeout = offline

**Test plan:**
- Configure integration in DB
- Start polling → verify status updates in SSE stream

#### Task 4.4: Admin Tactical Ticker
**What to create:**
- `/api/stream/ticker/route.ts`: SSE endpoint for aggregate stats
- `/components/admin/TacticalTicker.tsx`: Status bar at top of admin pages
- Aggregate CPU/RAM/Storage from primary Unraid driver

**Why:** Satisfies admin ticker from Section 3

**Acceptance criteria:**
- Ticker shows real-time CPU/RAM/Storage
- Only visible on `/admin/*` routes

**Test plan:** Navigate to `/admin` → see ticker update every 5s

---

### Phase 5: Home Grid Rendering

#### Task 5.1: AppCard Component
**What to create:**
- `/components/cards/AppCard.tsx`: Base card component
- `/components/cards/SmallCard.tsx`: Square 25% width variant
- `/components/cards/MediumCard.tsx`: Wide 50% width variant
- `/components/cards/LargeCard.tsx`: Tall 25% width variant with breathing gradient
- CSS Modules for glassmorphism (24px blur, 1px borders)

**Why:** Satisfies card specs from Section 2, 3

**Acceptance criteria:**
- All card sizes render correctly
- Gradients animate on large cards (2s loop)
- Status heartbeat pulses (green/amber, solid red offline)
- Click opens URL in new tab

**Test plan:**
- Visual regression test across breakpoints
- Verify `target="_blank" rel="noopener noreferrer"`

#### Task 5.2: Home Grid Layout
**What to create:**
- `/app/page.tsx`: Fetch cards grouped by category/subcategory
- Render subcategory separators
- Responsive grid (stacked <640px, 2-col 640-1024px, flex >1024px)

**Why:** Satisfies home layout from Section 2, 3

**Acceptance criteria:**
- Cards grouped under subcategory headings
- Admin-only subcategories hidden for family view
- Grid reflows without gaps

**Test plan:**
- View as family user → no admin sections
- Login as admin → see admin sections

#### Task 5.3: Dashboard Filter
**What to create:**
- `/components/layout/SearchBar.tsx`: Text input at top of home grid
- Client-side filter logic (case-insensitive match on name/description)

**Why:** Satisfies filter feature from Section 3

**Acceptance criteria:**
- Typing filters cards in real-time
- No results → show "No matches found"

**Test plan:** Type partial app name → see filtered list

#### Task 5.4: Category Collapse State
**What to create:**
- `/components/cards/CategoryHeader.tsx`: Collapsible heading with chevron
- LocalStorage persistence for collapsed state

**Why:** Satisfies state persistence from Section 5

**Acceptance criteria:**
- Clicking heading toggles collapse
- State persists across page reloads

**Test plan:**
- Collapse category → refresh page → still collapsed

---

### Phase 6: User Management

#### Task 6.1: Users API
**What to create:**
- `/api/users/route.ts`: GET (list all), POST (create new admin)
- `/api/users/[id]/route.ts`: DELETE (only superuser can delete)

**Why:** Satisfies multi-admin from Section 4

**Acceptance criteria:**
- Superuser can create admins
- Admins cannot create users (403)
- Cannot delete self

**Test plan:**
- Login as superuser → create admin
- Login as admin → try to create user → 403

#### Task 6.2: Users Management UI
**What to create:**
- `/app/admin/users/page.tsx`: List of users with add/delete buttons

**Why:** Satisfies admin UI from Section 2

**Acceptance criteria:**
- Table shows username, role
- Add button opens modal
- Delete button shows confirmation

**Test plan:** Create user via UI → verify in DB

---

### Phase 7: Notifications

#### Task 7.1: Notification Service
**What to create:**
- `/lib/services/notifications.ts`: Webhook dispatcher (Discord, Telegram, Pushover)
- Flood control logic (1 per type per 30 min)
- `/api/notifications/test/route.ts`: Test webhook endpoint

**Why:** Satisfies notification engine from Section 3, 5

**Acceptance criteria:**
- POST to Discord/Telegram webhooks
- Rate limiting prevents spam
- Test endpoint sends sample alert

**Test plan:**
- Trigger test alert → verify message in Discord
- Trigger 2 alerts <30min apart → only 1 sent

#### Task 7.2: Maintenance Mode
**What to create:**
- `/api/settings/maintenance/route.ts`: PATCH endpoint to toggle maintenance mode
- SSE event `MT_STATE_CHANGE` broadcast to all clients
- `/components/layout/MaintenanceBanner.tsx`: Global banner

**Why:** Satisfies maintenance mode from Section 5

**Acceptance criteria:**
- Admin toggles switch → banner appears instantly on all sessions
- Banner persists across page reloads

**Test plan:**
- Open 2 browser tabs
- Toggle maintenance in tab 1 → banner appears in tab 2 within 1s

---

### Phase 8: Monitoring Hub

#### Task 8.1: Monitoring UI
**What to create:**
- `/app/admin/monitoring/page.tsx`: Dashboard with driver status cards
- `/components/admin/DriverStatusCard.tsx`: Card showing last poll time, success/error, raw response

**Why:** Satisfies monitoring hub from Section 3

**Acceptance criteria:**
- Shows list of integrations
- Each card shows online/offline state
- Raw JSON visible for debugging

**Test plan:** Disconnect Plex → see error in monitoring hub

---

### Phase 9: Polish & Hardening

#### Task 9.1: Animations
**What to create:**
- Add Framer Motion to card hover (scale 1.02-1.05)
- Breathing gradients on large cards (CSS keyframes)
- Page transition animations (400ms fade/slide)

**Why:** Satisfies micro-animations from Section 2

**Acceptance criteria:**
- 60 FPS on mobile
- Hover animations snappy (200ms)

**Test plan:** Use Chrome DevTools FPS monitor

#### Task 9.2: Error Boundaries
**What to create:**
- React error boundaries for top-level routes
- Graceful fallback UI

**Why:** Production resilience (implied by "high-performance" goals)

**Acceptance criteria:**
- Component error doesn't crash entire app

**Test plan:** Throw error in component → see fallback

#### Task 9.3: Logging & Diagnostics
**What to create:**
- Structured logging with `pino` or simple console wrapper
- Log driver handshakes, auth attempts, errors
- ENV var `LOG_LEVEL`

**Why:** Satisfies troubleshooting from Section 8

**Acceptance criteria:**
- Logs to stdout
- `docker logs -f homepage3` shows driver polls

**Test plan:** Tail logs → see driver activity

#### Task 9.4: Performance Optimization
**What to create:**
- Next.js image optimization for icons
- Lazy load drivers (dynamic imports)
- Debounce search filter (150ms)

**Why:** Satisfies <500ms FMP target from Section 7

**Acceptance criteria:**
- Lighthouse score >90
- FMP <500ms on LAN

**Test plan:** Run Lighthouse audit

---

### Phase 10: Testing & Documentation

#### Task 10.1: E2E Tests (Critical Paths)
**What to create:**
- Playwright tests for:
  - Onboarding flow
  - Login/logout
  - Create card → appears on home grid
  - Drag-and-drop reorder

**Why:** Satisfies QA from Section 7

**Acceptance criteria:**
- All tests pass in CI

**Test plan:** `npm run test:e2e`

#### Task 10.2: README & Deployment Docs
**What to create:**
- `README.md`: Project overview, tech stack, setup instructions
- `docs/DEPLOYMENT.md`: Docker setup, ENV vars, backup/recovery

**Why:** Satisfies deployment section (Section 8)

**Acceptance criteria:**
- New user can follow README to deploy

**Test plan:** Give to another developer → verify they can deploy

---

## 6. ASSUMPTIONS

### 6.1 Authentication & Security
- **Local LAN trust model**: The doc states family view is "accessible without authentication on the local network." This assumes the deployment environment has perimeter security (firewall, VPN) and that unauthenticated access to `/` is acceptable risk.
- **No HTTPS requirement**: Doc mentions "optimized for private local server hosting" and doesn't specify SSL. HTTPS is assumed to be handled by external reverse proxy (Traefik, Nginx) if needed, not by the app itself.
- **Single JWT secret**: `JWT_SECRET` environment variable is sufficient for both session signing and credential encryption (no separate `ENCRYPTION_KEY` required).

### 6.2 Monitoring & Drivers
- **Single primary server for ticker**: Doc mentions "multi-server monitoring" but tactical ticker description implies single-source aggregate. Ticker pulls from first active Unraid/Proxmox integration; multi-server details shown in Monitoring Hub, not ticker.
- **2-second timeout universally**: "Response received in <2000ms" defines ONLINE. This applies to all drivers unless explicitly configured otherwise.
- **Driver errors non-fatal**: "Fail-silent driver logic" + "UI remains 100% functional" implies driver exceptions are caught and logged, not propagated. Try-catch at orchestrator level is sufficient.

### 6.3 Data Model
- **Admin-only at subcategory level**: Doc says "restricted 'ADMIN' sections" and "remove restricted sections for guests." `admin_only` boolean on `subcategories` table (not individual cards) matches this requirement.
- **Gradient storage format**: Doc doesn't specify how 4-color gradient is stored. JSON array of hex strings (e.g., `["#3B82F6", "#A855F7", "#22C55E", "#F59E0B"]`) in TEXT column.
- **No soft deletes**: Doc doesn't mention archiving or soft deletes. Hard deletes with cascade are acceptable.

### 6.4 Branding & Assets
- **Icon fetch order**: Doc says "fetch from standard manifests." Priority order assumed: (1) Web App Manifest `icons` array (largest size), (2) `apple-touch-icon`, (3) `favicon.ico`.
- **Color extraction library**: Doc doesn't specify tool. `sharp` (Node.js image processing) assumed for server-side color extraction.
- **5MB upload limit**: Doc doesn't specify. 5MB per file assumed (covers high-res PNGs) based on typical icon size expectations.

### 6.5 UX & Behavior
- **No drag-and-drop on home grid**: Doc says "No layout customization (drag-and-drop) on the Home tab" and "Row-based Drag-and-Drop" in admin. Drag-and-drop is admin-only feature.
- **External links always new tab**: Doc says "must open in a new tab." All app card clicks use `target="_blank"` with no exceptions.
- **Empty categories hidden**: Doc doesn't specify. Hidden on home grid (cleaner), visible in admin Dashboard module (for management).

### 6.6 Deployment
- **Port 3000 default**: Doc doesn't specify port. Next.js default (3000) assumed with option to override via ENV.
- **x86_64 primary target**: Doc says "Primary support for x86_64." ARM64 builds are optional future work, not required for MVP.
- **No Kubernetes**: Doc only mentions Docker Compose. Helm charts, Kubernetes manifests out of scope.

### 6.7 Scope Boundaries
- **No PWA in MVP**: Doc mentions "Native Mobile Applications: Strictly a high-performance Web/PWA experience" but PWA push notifications in "Future Roadmap." No service worker or manifest.json in MVP.
- **No widget system in MVP**: `widgets` table exists in schema but Section 6 says "Interactive Widgets" in future roadmap. Widgets table created but CRUD not implemented.
- **No auto-discovery**: Doc explicitly says "No automatic docker-socket polling." All app cards added manually via admin UI.

### 6.8 Real-Time Behavior
- **SSE over WebSockets**: Doc specifies "Server-Sent Events (SSE)." This is preferred over WebSockets due to simpler reconnect logic and HTTP compatibility.
- **Browser reconnect automatic**: SSE standard includes auto-reconnect. No custom reconnect logic needed (browser handles).

---

## REVISION HISTORY

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-29 | 1.0 | Initial technical assessment and implementation plan |

---

**END OF DOCUMENT**

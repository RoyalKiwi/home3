# Homepage3: Project Master Plan

This document is the "Source of Truth" for the Homepage3 project. We will plan each section in detail before moving to implementation.

---

## 1. Project Overview & Vision
*The "Soul" of the project.*
- **Vision Statement**: "A premium, high-performance 'Void' cockpit that transforms a chaotic home server into a stunning, organized, and interactive command center."
- **Core Problem to Solve**: Creating a high-fidelity home dashboard that resolves common frustrations with complex YAML configurations and lack of visual depth (glassmorphism/gradients) or automated setup (icon/color fetching).
- **Primary Goals (SMART)**:
  1. **Visual Excellence**: Achieve a 100% "Void" aesthetic with 24px backdrop blurs and dynamic 4-color app gradients.
  2. **Zero-Friction Management**: Implement a unified "Icon + Color" API that handles app branding in under 5 seconds per card.
  3. **Intelligent Organization**: A layout system that intelligently scales and organizes services based on priority and type, ensuring a clutter-free experience that feels robust and professional.
  4. **Graceful Resilience**: The system must remain high-performance and usable even when downstream services (monitoring drivers, external APIs) are offline.
  5. **Dual-Path Experience**: A clear functional split between a "Family Front-End" (focused on simple app access) and an "Admin Cockpit" (focused on editing, monitoring, and server health).
  6. **High-Performance Execution**: The interface must feel instantaneous, with optimized asset loading and zero-lag interactions even on lower-powered hardware like tablets or older phones.
  7. **Seamless Scalability**: The architecture must support an growing ecosystem of apps and monitoring sources without degrading performance or cluttering the user experience.
  8. **Full Local Self-Sufficiency**: The homepage must be 100% functional on the local network. It must not depend on external internet APIs for core UI, icon rendering, or dashboard logic.
- **Infrastructure & Resilience Features**:
  - **Live-Sync Local Cache**: Icons and assets are cached locally for 100% offline sovereignty, but the system must periodically poll the branding source for updates to ensure the dashboard reflects the latest app logos.
  - **High-Performance Scaling**: Optimized for low-powered hardware and large app sets.
- **Target Audience/Users**: 
  - **Family/Guests**: Non-technical users who need an intuitive, beautiful way to access media and tools without distractions.
  - **Admins**: Power users who require deep systemic visibility and instant configuration controls.
- **Project Scope & Security Constraints**:
  - **Data Lifecycle**: This is a **Fresh Start** build focused on a clean, modern architecture.
  - **Access Model**: The "Family Front-End" is accessible without authentication on the local network. 
  - **Security Layer**: A dedicated Admin Login is required only for management, editing, and sensitive monitoring data.
  - **Environment**: Optimized for private local server hosting.

---

## 2. Design & User Experience (UX)
*The "Look and Feel".*
  - **Design System (Tokens)**:
    - **Core Palette**:
      - **Background**: `#050608` (Void Black) - Absolute backdrop.
      - **Surface**: `#161b22` (Slate Surface) - Cards/Nav.
      - **Callout**: `#0a192f` (Deep Navy) - Admin/Info blocks.
    - **Role Identity**:
      - **User**: `#3B82F6` (Bright Cyan/Blue).
      - **Admin**: `#A855F7` (Soft Purple).
    - **Text Hierarchy**:
      - **Primary**: `#FFFFFF` (Solid White) - Headers.
      - **Secondary**: `#94A3B8` (Slate Gray) - Labels/Descriptions.
      - **Ghost**: `#475569` (Muted) - URLs and non-critical metadata.
    - **Action States**:
      - **Primary Buttons**: High-contrast white background with black text.
      - **Icons/Controls**: Ghosted/Low-opacity by default; full opacity on hover.
    - **System Status**:
      - **Online**: `#22C55E` (Emerald Green).
      - **Offline**: `#EF4444` (True Red).
      - **Warn**: `#F59E0B` (Amber).
    - **Typography**: **JetBrains Mono** - Professional/Technical monospace feel.
    - **Geometry & Physics**:
      - **Rounding**: `12px` to `16px` (Modern/Safe) for all cards and modals.
      - **Spacing**: `16px` (Grid Gaps) / `24px` (Section Margins).
      - **Borders**: Strictly `1px` high-fidelity lines.
      - **Depth**: Soft "Branded Glow" shadows matching the primary card gradient color (low-opacity).
    - **Functional Atoms**:
      - **Animations**: `200ms` (Snappy/Hover), `400ms` (Modals/Transitions), `2000ms+` (Breathing Gradients).
      - **Breakpoints**: 
        - **Mobile**: `<640px` (Stacked list view).
        - **Tablet**: `640px - 1024px` (2-column grid).
        - **Desktop**: `>1024px` (Flexible grid system).
      - **Iconography**: `32px` (Small cards) / `64px` (Large cards).
      - **Custom Scrollbar**: Ultra-thin (4px) ghosted slate-gray bars.
- **Glassmorphism & Aesthetics**:
  - **The Glass Spec**:
    - **Backdrop Blur**: `24px` (High-fidelity frosting).
    - **Surface Tint**: `rgba(16, 22, 34, 0.4)` (Subtle slate overlay for readability).
    - **Border/Edge**: 
      - Base: `1px solid rgba(255, 255, 255, 0.1)` (Consistent all around).
      - Accent: `1px solid rgba(255, 255, 255, 0.2)` (Top and Left edges only to simulate light).
  - **Visual Depth**: Cards should appear to "float" above the #050608 backdrop using the previously defined branded glow shadows.
- **Layout & Navigation Flow**:
  - **The "Two-World" Split**: A persistent Top Navigation Bar for **Home** and **Admin**.
  - **Home (Viewing Experience)**: A focused, full-width categorized grid.
    - **External Links**: Clicking an app card **must** open in a new tab to preserve the dashboard state.
  - **Admin (Control Experience)**:
    - **Sidebar Navigation**: A conditional, persistent left-hand sidebar that **only appears** when the Admin world is active via the top-nav toggle. It contains six core modules:
      - **Admin Console**: General overview and tactical ticker.
      - **Dashboard**: Hierarchical list management for Categories, Subcategories, and Cards.
      - **Users**: User account and role management.
      - **Configuration**: Status dot configuration with global and per-card source selection, card-to-monitor mappings.
      - **API Settings**: Driver credentials and integration logs.
      - **Monitoring**: Deep telemetry and server health hub.
    - **Inner Module Navigation**: Horizontal sub-tabs for granular management within a module (e.g., "Cards", "Subcategories" inside Dashboard).
    - **Exit Flow**: Logging out of the Admin session immediately redirects to the "Family-View" Home tab.
  - **State Persistence**: The UI must persist the user's location, including the active Sidebar Module and active Sub-tab.
  - **Adaptive UI**: The sidebar in Admin mode gracefully collapses on smaller screens.
- **Micro-animations & Interactions**:
  - **Dynamic Scaling**: App cards and primary buttons should subtly expand (scale up ~2-5%) when hovered to provide clear interactive feedback. No 3D tilting is required.
  - **Living Glass (Gradients)**: Large cards featuring 4-color gradients should have a slow, rhythmic "breathing" animation where colors subtly shift or rotate on a loop.
  - **Status Heartbeats**:
    - **Online**: A subtle, rhythmic heartbeat pulse on the green status indicator.
    - **Warning**: A cautious, slower pulse on the amber indicator.
    - **Offline**: Solid red (no animation) to indicate a static, non-responsive state.
  - **System Transitions**: Page and tab switches should use a high-performance "Fade & Slide" transition (approx 400ms) to maintain the premium feel.

---

## 3. Product Features & Functionality
*The "What".*
- **Core Features (Dashboard, Grid, etc.)**:
  - **Categorized Homepage Layout**:
    - **Visual Structure**: Organized by subcategory headings (e.g., "Entertainment") featuring a decorative horizontal "separator" line that follows the text.
    - **Reflow Logic**: The dashboard reflows perfectly to remove restricted "ADMIN" sections for guests, leaving no visual gaps.
    - **Category Persistence**: Remembers which categories the user has collapsed across sessions.
    - **Home Grid Stability**: No layout customization (drag-and-drop) on the Home tab. 
  - **Simple Dashboard Filter**: A minimalist, high-speed text input at the top of the Home grid to filter app cards by name/description in real-time.
  - **Multi-State Application Cards (Responsive Grid)**:
    - **Small**: Square-format tiles (25% width). Icon + Name + Description + Heartbeat.
    - **Medium**: Wide-format horizontal tiles (50% width). Icon + Name + Description + Heartbeat.
    - **Large**: Tall, vertical "Phone Screen" style cards (25% width). Icon + Name + Description + Heartbeat + **Breathing Gradient**.
  - **Universal Consistency & Information Density**: 
    - **Descriptions**: Required for ALL card sizes to provide immediate context via sub-text labels.
    - **Status Heartbeats**: A pulsing visual indicator (Online: Emerald, Warning: Amber, Offline: Solid Red).
    - **Static Card Support**: A per-card toggle to disable heartbeat logic for simple web links (Wiki, Docs, etc.).
  - **Focused App Interaction**: Single click-through to the application's URL in a new tab.

- **Integration Ecosystem (Standard Drivers)**:
  - **Server Health**: Unraid (API), Proxmox (API), Netdata (Streaming), Uptime Kuma (Status).
  - **Media & Entertainment**: Plex/Jellyfin (Sessions), Tautulli (Stats), *arr Suite (Queue status).
  - **Network & Security**: Pi-hole/AdGuard Home (Queries/Blocked), Tailscale (Node status), VPN (Connection state).
  - **Hardware Specific**: UPS monitoring (NUT/APC), S.M.A.R.T (Disk health), GPU Telemetry (Nvidia/AMD).

- **Automation (Branding Agent)**:
  - **Branding Sync**: System auto-fetches icons and analyzed gradients from external manifests to ensure the local cache stays current with upstream brand changes.

- **Integrated Notification Engine**:
  - **Alerting & Posting**: Posts critical server alerts (S.M.A.R.T, Temps) to Discord/Telegram/Pushover.
  - **Customizable Thresholds**: User-defined triggers for warnings.
  - **Global Maintenance Mode**: Admin-triggered banner across the entire dashboard for planned downtime notifications.

- **Admin-Specific Features**:
  - **Dashboard Management Module**:
    - **Tiered Management Hub**: A high-density interface for managing the dashboard's 3-tier hierarchy (**Categories > Subcategories > Cards**).
    - **List-Based Management**: Unlike the visual Home grid, this is a clean, row-based workspace.
    - **Hierarchy & Layout Control**:
      - **Categories**: Add, rename, or delete top-level vertical sections.
      - **Subcategories**: Add, rename, or delete groups within a category.
      - **Cards**: Hierarchical list of application metadata (Name, URL, Size, Status toggle).
      - **Visual Ordering**: Row-based **Drag-and-Drop** to reorder cards within their subcategories.
    - **Lifecycle Operations**:
      - **Add/Edit Interface**: Modal-based editing with Name, Description, URL, **Manual Icon Upload**, Icon URL override, and Size selection.
      - **Status Heartbeat Toggle**: A per-card switch to enable/disable real-time monitoring on the Home tab.
  - **Admin Tactical Ticker**: A high-density status bar at the top of the **Admin tab only**, providing aggregate server health (Total CPU, RAM, and Storage) at a glance.
  - **Monitoring Hub**:
    - **Observational Hub**: Dashboard for general server health, container telemetry, and notification status.
    - **Philosophy**: Observation-Only. Deep visibility and direct links to official management apps.
    - **Fail-Silent Driver Logic**: UI remains 100% functional even if individual server sources disconnect.

- **Onboarding & First-Run Experience**:
  - **The "Clean Slate" State**: If no users exist in the database, the application automatically redirects to a specialized Onboarding screen.
  - **Mandatory Superuser Creation**: Users must define a primary Admin username and password before proceeding. This step is unskippable to ensure immediate system security.
  - **Initial Configuration**: Optional steps to set the server name and primary branding (e.g., logo and base void color).
  - **Dashboard Scaffolding**: Option to pre-load a "Discovery Template" with common categories (Entertainment, Productivity, System) to jumpstart the dashboard.

- **Infrastructure & Resilience Features**:
  - **Live-Sync Local Cache**: Icons/assets cached locally; auto-poll for updates.
  - **High-Performance Scaling**: Optimized for low-powered hardware with zero-lag interactions.

---

## 4. Technical Specifications
*The "Engine".*
- **Frontend Stack**:
  - **Framework**: Next.js 15+ (App Router) utilizing React Server Components (RSC).
  - **Styling**: CSS Modules (Native CSS).
  - **Animations**: Framer Motion + Native CSS Keyframes.
  - **Interactions**: **@dnd-kit** (for high-performance Admin drag-and-drop).
  - **Icons**: Lucide React.

- **Backend Stack**:
  - **Runtime**: Node.js 22+ (LTS).
  - **Database**: Better-SQLite3.
  - **Auth**: Next-Auth / Jose (JWT).
  - **Driver Engine**: Modular Bridge Layer responsible for background service polling and real-time browser updates via **Server-Sent Events (SSE)**.

- **Database Schema (Better-SQLite3)**:
  - **`categories` Table**: ID, Name, Order Index.
  - **`subcategories` Table**: ID, CategoryID, Name, Order Index, ShowSeparator (bool).
  - **`cards` Table**: ID, SubcategoryID, Name, Subtext, URL, IconURL, Size (Small/Medium/Large), ShowStatus (bool), Order Index.
  - **`integrations` Table**: ID, ServiceName, Credentials (Encrypted JSON), PollInterval, IsActive.
  - **`users` Table**: ID, Username, PasswordHash, Role (Superuser/Admin).
  - **`widgets` Table**: ID, WidgetType (Stats/Events), Config (JSON), GridPosition (x/y/w/h).
  - **`settings` Table**: Key/Value pairs (Maintenance Mode, Global Banners, Notification Webhooks).

- **Project Architecture & Directory Structure**:
  - `/app`: Next.js frontend pages, layout, and client-side components.
  - `/api`: Next.js Route Handlers for the backend (Auth, Streaming, Management).
  - `/components`: Reusable UI atoms (Cards, Modals, Nav).
  - `/lib`: Shared server utilities (Database client, SSE manager, Notification bridge).
  - `/drivers`: Modular logic for fetching data from external services (Unraid, Plex, etc.).
  - `/data`: Persistent directory for `homepage.db` (SQLite), `/cache` (Fetched Icons), and `/uploads` (User-uploaded Assets).
  - `Dockerfile` & `docker-compose.yml`: Unified deployment files.

- **First-Run Initialization Logic**:
  - **DB Check**: On every request, a lightweight middleware check verifies if the `users` table is populated.
  - **Secure Redirect**: If empty, a hardware-level redirect (302) sends the user to `/onboarding`.
  - **Asset Pre-fetch**: The system pre-downloads a base set of "Essential" icons during onboarding to ensure the UI is functional immediately.

- **Multi-Admin Authentication & Security**:
  - **Account System**: A dedicated `users` table in SQLite for **Admin accounts only**.
  - **Superuser & Delegation**:
    - Initial setup creates a single **Superuser** account with full management access.
    - The Superuser has the ability to create and manage additional **Admin** accounts for other power users.
  - **Account-Free Family Access**: The primary homepage grid is accessible without an account, providing a frictionless experience for guest/family users.
  - **Session Management**: Secure HttpOnly JWT cookies to store Admin identity.
  - **Private Routes**: `/admin/**` routes are server-side checked for a valid Admin JWT.
  - **Data Masking**: API keys, IP addresses, and sensitive telemetry are masked by default in all Admin UIs for enhanced privacy.

- **Real-Time Telemetry Flow (Server-Sent Events)**:
  - **The Handshake**:
    1. Browser connects to `/api/stats/stream`.
    2. Server maintains an open HTTP connection (`text/event-stream`).
    3. The "Bridge Layer" polls server drivers (CPU/RAM/Container Status).
    4. Only **changed** data is pushed to the browser as a JSON event.
  - **Performance Benefit**: Extremely lightweight; the browser never has to refresh or repeatedly ask "any updates?", ensuring zero-lag heartbeats on the UI.

- **API Architecture & Handshakes**:
  - **Branding Logic**: Admin adds App → Server searches Icon Database → Server returns icon + 4-color palette → Result saved to SQLite.
  - **Maintenance Handshake**: Admin toggles Maintenance Mode → Server updates `settings` table → All active client streams receive an "MT_ON" event → Dashboard displays banner instantly.

- **Infrastructure & Portability**:
  - **Deployment**: Docker (Unified Image).
  - **Local Sovereignty**: 100% functional during internet outages; local cache for all assets.

---

## 5. Feature Handshakes & Logic
*How the parts talk to each other.*

- **Automated Branding Handshake**:
  - **Step 1: Icon Discovery**: When a URL is provided, the backend attempts to fetch the highest-resolution icon from standard manifests. 
  - **Step 1b: Manual Override**: If a user uploads a file, the automated discovery is bypassed in favor of the local `/data/uploads` path.
  - **Step 2: Color Extraction**: Using a server-side canvas or sharp-based analysis, the engine extracts the 2-3 most dominant colors from the icon (whether fetched or uploaded).
  - **Step 3: Gradient Generation**: These colors are mathematically blended with the "Void" theme to create a **4-color dynamic gradient** (Hero Gradients).
  - **Step 4: Local Caching**: The final icon and gradient tokens are stored in the `/data/cache` directory.
  - **Step 5: File Cleanup**: When a card is deleted, a background task automatically purges the associated icon from `/data/cache` or `/data/uploads` to prevent asset bloating.

- **Status & Monitoring Handshake**:
  - **Step 1: Driver Polling**: The backend "Bridge Layer" executes the specific driver logic for each card (e.g., pinging an Unraid API endpoint).
  - **Step 2: Status Derivation**:
    - **ONLINE**: Response received in <2000ms.
    - **WARNING**: Response received but contains "Health Warning" flags (e.g., S.M.A.R.T error).
    - **OFFLINE**: No response or connection timeout reached.
  - **Step 3: State Streaming**: The derived status is packaged into a JSON event and "pushed" to the dashboard via the SSE stream.

- **Visibility & Role-Masking Logic**:
  - **Logic**: A server-side middleware filters the `cards` query result based on the user's role found in the JWT.
  - **Behavior**: If a card belongs to a subcategory marked as "ADMIN ONLY," it is discarded from the data stream for non-admin sessions, ensuring forbidden links are never even sent to the browser.

- **External Notification Handshake**:
  - **Trigger**: Monitoring logic identifies a "Critical" state (e.g., CPU Temp > 90C).
  - **Backend Action**: The Notification Bridge constructs a payload (JSON) containing the alert type, value, and timestamp.
  - **Payload Dispatch**: The bridge posts the payload to configured Webhooks (Discord/Telegram/Pushover).
  - **Flood Control Logic**: A mechanism ensures the system only sends one notification per alert type every 30 minutes to prevent spam.

- **Global Maintenance Mode Handshake**:
  - **Trigger**: Admin toggles the "System Maintenance" switch in Admin Settings.
  - **Transmission**: Server updates `settings` table and broadcasts an `MT_STATE_CHANGE` event via the SSE stream.
  - **UI Interaction**: Every active browser session receives the event and instantly renders a system notice banner.

- **UI State & Category Persistence**:
  - **Collapsed State**: Saved to standard **Browser LocalStorage** per user.
  - **Navigation State**: The active tab/sub-tab is persisted in the **URL Search Params** to ensure page refreshes maintain the user's focus.

---

## 6. Project Management & Scope
*The "Boundaries".*
- **In-Scope (The MVP)**:
  - **"Void" Dashboard UI**: High-fidelity, glassmorphic interface with 24px backdrop blurs and breathing gradients.
  - **Tiered Management System**: 3-tier structure (Category > Subcategory > Card) managed via a dedicated Admin tab.
  - **Simple Dashboard Search**: Minimalist, real-time filter bar for the family grid.
  - **Admin Tactical Ticker & Event Log**: High-density health bar and diagnostic logs for integration troubleshooting.
  - **Live Monitoring Bridge**: SSE-driven "Heartbeat" system for real-time status (Online/Warning/Offline).
  - **Multi-Server Monitoring**: Support for polling hardware telemetry across multiple physical machine endpoints.
  - **Automatic Branding Agent**: Automated fetching of icons and generation of 4-color app gradients.
  - **Manual Asset Uploads**: Support for direct file uploads for custom brand icons/logos.
  - **UI State Persistence**: Browser-local storage of collapsed categories and active navigation tabs.
  - **Multi-Admin Authentication**: Superuser account creation and support for delegated Admin roles.
  - **Integrated Notification Engine**: Critical server health alerts pushed to Discord/Telegram.
  - **Onboarding Experience**: Smooth, sequential first-run setup for initial configuration.
- **Out-of-Scope**:
  - **Server Control Actions**: Direct actions like "Restart Server" or "Reboot Container" (Observation-Only philosophy).
  - **Legacy Data Migration**: No automatic import of `home-2` or old configuration files.
  - **Advanced Docker Auto-Discovery**: No automatic docker-socket polling for app creation; app addition is intentional and manual.
  - **Internal Proxy/Reverse Proxy**: Dashboard serves links only; it does not handle port mapping or SSL termination.
  - **Native Mobile Applications**: Strictly a high-performance Web/PWA experience.
- **Assumptions & Constraints**:
  - **Local LAN Focus**: Designed and optimized for private, local network deployment using Docker.
  - **Hardware Requirements**: Requires viewing devices that support **GPU-acceleration** for modern CSS (Backdrop-filter and complex gradients).
  - **Self-Sovereignty**: All critical assets must be stored locally to ensure 100% functionality during internet outages.

---

## 7. Testing & Quality Assurance
*Ensuring it works.*
- **Verification Plan**:
  - **Visual Fidelity Audit**: Manual inspection of 24px backdrop blurs and sub-pixel borders across Chrome, Safari, and Firefox.
  - **SSE Resilience Test**: Manually stop a service to verify heartbeat updates in <5s without a page refresh.
  - **Onboarding Walkthrough**: Fresh-install test to verify the Superuser creation redirect works every time.
  - **Manual Upload Check**: Upload a custom logo and verify it is saved to `/data/uploads` and that colors are extracted correctly for the gradient.
  - **D&D Sync Check**: Reorder a card in the Admin tab and verify the change is instantly reflected on the Home tab.
  - **Maintenance Broadcast**: Toggle "Maintenance Mode" and verify the banner appears instantly across all active browser sessions.
  - **Notification Loop**: Trigger a manual "Test Alert" from the Admin tab to verify Discord/Telegram webhook delivery.
  - **Admin Delegation Test**: Create a second Admin account and verify they can perform all management actions.
- **Edge Case Handling**:
  - **Malformed Driver Data**: Verify system stability when a driver received invalid or "Garbage" JSON stats.
  - **Offline Sovereignty**: Disconnect the internet and verify the dashboard renders perfectly using the local cache.
  - **Upload Failures**: Verify rejection of non-image files and graceful handling of "Out of Space" errors.
  - **Ticker Telemetry Audit**: Cross-reference Admin Ticker stats against `htop`/Unraid for data accuracy.
  - **Search Latency Test**: Verify lag-free filtering on a dashboard populated with 50+ cards.
- **Quality Standards**:
  - **Performance**: Dashboard must render first meaningful paint in **<500ms** on local LAN.
  - **FPS Consistency**: Breathing gradients and transitions must maintain 60FPS on modern mobile devices.
  - **Security Lockout**: Verify that unauthenticated users are 100% blocked from all `/admin` routes.

---

## 8. Deployment & Post-Launch
*Going live.*
- **Containerization Strategy**:
  - **Unified Docker Image**: A single `Dockerfile` for the Next.js app and backend runtime.
  - **Environment Configuration (`.env`)**:
    - `JWT_SECRET`: Secure string for admin session signing.
    - `DATA_PATH`: Path to the persistent `/data` volume.
    - `NODE_ENV`: Production/Development toggle.
  - **Architecture**: Primary support for **x86_64**. *Optional: Multi-arch Buildx for ARM64 (Raspberry Pi compatibility).*
- **Maintenance & Portability**:
  - **Backup & Recovery**: The entire system state is stored in the `/data` directory. Backups consist solely of archiving this volume. Disaster recovery is achieved by re-mounting the `/data` folder to a fresh container pull.
  - **Continuous Updates**: One-command updates via `docker compose pull` and `up`.
  - **Diagnostics**: Standardize troubleshooting via `docker logs -f landing-page` to monitor driver handshakes and system health.
- **Future Roadmap**:
  - **Interactive Widgets**: Draggable, live-data widgets for real-time bandwidth and storage graphs.
  - **PWA Push Notifications**: Native alerts for critical system thresholds.
  - **Hardware Key Support**: FIDO2/WebAuthn for secure, passwordless Admin login.

# ASIET Gatekeeper v2

A React campus access website with a local SQLite backend, persistent scan queue,
and Windows setup/fullscreen startup scripts.

## Run now with cloud data

Use `npm run dev` to start the website and cloud API together, then open
http://127.0.0.1:5173. Turso is the default database. First create your Turso libSQL
database and fill in the server-only `.env.server` file using
[CLOUD-SETUP.md](CLOUD-SETUP.md). Until those details are configured the website
shows setup instructions. No local SQL installation is required for cloud mode.

## Later: install a local database on the checkpoint computer

Run `setup.bat` from Command Prompt. It installs the runtime, builds the website,
creates the local database, asks for officer/admin passwords, and registers boot
and sign-in startup tasks. Read [LOCAL-INSTALL.md](LOCAL-INSTALL.md) for installation,
backups, queue recovery, and the distinction between fullscreen and Windows sign-in.

Cloud mode is the default for ordinary startup; the Windows installer selects
local SQLite explicitly. Registry changes and scan decisions are enforced by
the backend; pending scans survive browser restarts in the same profile.
The sections below describe the original, explicitly selected demo mode.

## Run

```sh
npm install
npm run dev:demo
```

On Windows PowerShell with script execution disabled, use `npm.cmd` instead of `npm`. Open http://127.0.0.1:5173.

Demo officer: `SEC-G1-204` / `gatekeeper`. Demo administrator: `ADM-ASIET-001` / `admin-demo`. Officer credentials are prefilled; the administrator password must be entered manually and is not displayed on the sign-in screen. Sample barcode: `ASI22CS084`.

## Features

- Continuous barcode keyboard input and manual ID lookup; automatic IN/OUT determination, suspended/unknown ID rejection, and incident recording. Configure USB readers with an Enter suffix. Each scan clears and refocuses the input immediately while the last result remains visible. There is no Next Scan confirmation step.
- Paired access logs: one row per visit with separate check-in and check-out dates/times, role/date/visit-status filters, pagination, and CSV/PDF export. Overnight visits remain paired; denied attempts and missing historical timestamps are shown explicitly.
- Member registration and editing, barcode cards, validated CSV/XLSX/JSON imports, and CSV/XLSX/PDF registry export.
- Student, Staff, and Librarian member roles, with Gate 1 as the sole checkpoint. Staff and librarian access status, after-hours metadata, and scanner-protocol preferences.
- Administrator checkpoint pause/resume, transit workbooks, and an incident audit ledger.
- Management navigation is tucked into the three-dot button above Sign out. Logs, registry, access permissions, and administration require an unlocked administrator session, including direct URL navigation. Returning to Scanner locks management access again. This is a frontend demo guard, not server-enforced data protection; browser storage and bundled demo credentials remain accessible on the device.
- Responsive desktop/mobile layouts, keyboard navigation, dialog focus handling, and reduced-motion support.

## Package analysis

| Package | Purpose |
| --- | --- |
| React / React DOM | Components and application state |
| Vite | Development server and production bundling |
| Tailwind CSS / PostCSS / Autoprefixer | Existing design tokens and CSS processing |
| Papa Parse | CSV import/export |
| SheetJS (`xlsx`) | Excel import/export, loaded on demand |
| jsPDF | PDF exports, loaded on demand |
| JsBarcode | Printable Code 128 identity barcodes |
| Cheerio | Existing design-inspection/conversion scripts |
| Playwright | Browser workflow and responsive checks |

No additional runtime dependencies were needed. The original React scaffold had no entry point, application shell, store, or shared components. The seven page components are now implemented with shared state and functioning controls. Original HTML and images remain in `stitch_gatekeeper_college_entry_system`. The old `convert-designs.mjs` script regenerates static mockups and would overwrite the implemented pages; do not run it on the app.

## Validation

```sh
npm test
npm run build
npx playwright test
```

Start the dev server on port 5173 before running the browser test. The test uses installed Google Chrome. Screenshots are written into `test-results`.

## System status connection

The panel below Scanner checks `GET /api/system/status` on the same server every 30 seconds while the tab is visible, with a five-second timeout. It accepts only successful JSON responses. Without a backend it shows **Not connected** and **Not available**, rather than treating the Vite frontend or browser storage as the system database.

The future backend should return actual server/database health and storage measurements in this shape (the numbers below are examples):

```json
{
  "server": { "status": "online" },
  "database": { "status": "connected" },
  "storage": { "usedBytes": 26843545600, "totalBytes": 107374182400 }
}
```

Server status can be `online` or `degraded`; database status can be `connected` or `disconnected`. Use `storage: null` when measurements are unavailable. Storage values describe the system disk/volume containing the database, not the browser's localStorage quota. On connection failure the panel clears previously displayed measurements. To use a different endpoint, set `VITE_SYSTEM_STATUS_URL` in `.env.local` and restart Vite. This setting is a public endpoint URL, not a place for database credentials. This panel does not itself install a database or move records out of browser storage.

## Scope

Existing browser data is retained. Former Faculty roles become Staff, and checkpoint labels become Gate 1. Legacy Visitor records remain in the registry without an assigned role; edit those records to choose a supported role before allowing access. Exports use the same paired visit structure as the Access logs page. A date filter matches either the check-in or check-out date.

This is a frontend demonstration. Records, transit events, and incidents persist in this browser's localStorage; the selected demo session uses sessionStorage. Demo credentials are public and are not real authentication. There is no server, cross-device synchronization, physical gate integration, camera decoding, or institutional-system connection. Faculty after-hours/protocol fields are stored preferences; only ACTIVE/SUSPENDED status and checkpoint pause affect scan decisions. Sign-in time does not represent a security boundary. Typography uses Segoe UI and native system fallbacks, without external font requests; icons are self-contained inline SVGs. Production deployment needs backend authentication, authorization, durable data storage, and server-enforced access policies.

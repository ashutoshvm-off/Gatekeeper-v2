# Local Windows installation

This installation uses a Node.js 24 backend and a SQLite database on the same
computer. It does not need a cloud account, SQL server installation, or internet
after setup. Windows 10/11, a local disk, and administrator access are required.

## Install

Keep this project folder and its package-lock.json together. Open Command Prompt
in this folder and run:

```bat
setup.bat
```

Approve the Windows administrator prompt. Setup downloads a private Node.js 24
runtime from nodejs.org, verifies its SHA-256 checksum, installs the locked npm
dependencies, builds the website, and copies the runnable app into
`C:\Program Files\ASIET-Gatekeeper`. It uses installed Edge or Chrome; if neither
exists it attempts to install Edge with winget. Initial downloads require internet.

On first setup, choose two passwords (at least 12 characters each):

- Officer: `SEC-G1-204`
- Administrator: `ADM-ASIET-001`

Passwords are hashed with scrypt; demo credentials do not work in local mode.
Setup protects the database/config folder for SYSTEM and administrators.
Before installing locally, upload your CSV, XLSX, or JSON registry to the cloud
website (up to 25 MB per file, 500 rows per database batch). Keep the configured
Turso URL/token in the project's `.env.server`. Finish all cloud uploads and
pending scans and stop the cloud development server before running setup.

On first installation setup automatically copies and verifies all cloud members,
scan events, paired visits, incidents, and checkpoint settings. It commits the
download only after row-count/checksum/integrity checks pass. A failed or changing
cloud download stops setup before local startup is enabled. Rerun after correcting
the issue. An existing populated local database is never overwritten silently.
Re-running a completed installation preserves passwords and new local data and
skips cloud transfer. The local Administration page displays the transfer report.
After handover, operate the local website; this is not ongoing two-way sync.

Open `http://127.0.0.1:4317` to use the installed website. It listens only on this
computer, not on the campus network. Keep this exact address and browser profile
to recover queued taps.

## Startup and fullscreen

Setup creates these Windows Task Scheduler tasks:

- **ASIET Gatekeeper Server**: starts as SYSTEM when Windows boots; restarts after
  failure. Runs without a visible command window.
- **ASIET Gatekeeper Fullscreen**: waits for server health, then opens a dedicated
  persistent browser profile in fullscreen when the Windows account that ran
  setup signs in. It does not enable Windows automatic sign-in.

Fullscreen uses `--start-fullscreen`, not Edge's InPrivate kiosk mode. This keeps
IndexedDB pending taps across browser restarts. Fullscreen is not an operating
system lockdown: F11 exits fullscreen and Alt+F4 closes the browser. The browser
profile is `%LOCALAPPDATA%\ASIET-Gatekeeper\Browser` for that Windows account.
Application sign-in may be needed after restart/session expiry; queued scans stay
on disk and resume after signing in. Keep the computer powered and Windows awake
during scanning; setup does not change power/sleep settings.

## Database, backup and recovery

- Database: `%ProgramData%\ASIET-Gatekeeper\gatekeeper.sqlite`
- Configuration/password hashes: `%ProgramData%\ASIET-Gatekeeper\config.json`
- Server log: `%ProgramData%\ASIET-Gatekeeper\server.log`
- Backups: `%ProgramData%\ASIET-Gatekeeper\backups`

Use **Administration → Local database → Create database backup**, or run
`backup.bat`. The SQLite online backup API includes committed WAL data safely
while the application is running. It does not include taps still pending in the
browser; the Scan queue's export button saves those separately. Copy backups to
another disk. Backups are manual and are not automatically deleted.

`start.bat` starts the installed server and opens fullscreen. `stop.bat` stops
the server until the next start/reboot. `uninstall-startup.bat` stops the server
and removes both startup tasks. None of these deletes the database, backup files,
application files, or browser queue.

To restore, stop the server, preserve the entire current database directory as a
recovery copy, and restore a known-good backup as `gatekeeper.sqlite` in a clean
data directory with the saved config and its original permissions. Do not mix an
older database with newer `-wal`/`-shm` files. Restoring an older backup also rolls
back its event deduplication history: reconcile any pending browser queue with
the restored history before resuming operations.

Old demo data is not automatically deleted or mixed into the real database.
Export the old registry from `npm run dev:demo` in its original browser/profile
and import the file in local mode. The administrator's **Copy legacy browser
members** button works only when the legacy data is in the same origin/profile.
Old scan-history exports should be retained separately; this release does not
import historical demo transit logs into the new live visit state.

## Rapid taps and outages

Configure a USB keyboard-wedge scanner to end each complete barcode with Enter.
Every form submission receives a unique event ID and capture timestamp. It is
written to IndexedDB with strict durability before the UI calls it captured.
The input immediately refocuses for the next barcode.

One uploader across all tabs of this profile sends the oldest pending taps in
batches of up to 25. Database transactions serialize IN/OUT decisions; a unique
event key and client sequence prevent a lost response/retry from inserting a
duplicate or toggling direction again. Pending taps are deleted only after the
database confirms the entire batch. Every genuinely separate tap is retained,
including repeated taps of the same card. There is no time-based suppression.

The Scan queue panel shows pending count, latest captured ID, latest confirmed
result, and retry errors. Upload failures retry with backoff up to 30 seconds.
Use **Retry sync now** to retry sooner. After a server/session restart, sign in
again. A queued tap is NOT an access approval; use the database-confirmed result.
Queued scans are evaluated using registry and checkpoint status at processing
time; capture and receipt timestamps are both retained. Ordering is guaranteed
within this profile; separate terminals would require a broader ordering policy.

If browser storage cannot accept a tap, a persistent warning lists unsaved IDs.
Keep the window open and retry them after fixing disk/storage capacity. Such
unsaved taps exist only in memory. Clearing the profile/browser data deletes
pending taps, and no software can guarantee recovery from disk failure or power
loss before a write commits. Two physical keyboard scanners typing simultaneously
into the same input can interleave characters; this queue handles complete scans,
not overlapping hardware keystreams.

History is retained in SQLite with no automatic expiration. Log views are queried
and paginated on the server; registry/staff tables render 50 members per page.
Administrators load the registry into memory for editing/import checks. Very large
PDF/XLSX exports also run in browser memory; filter by date for manageable reports.

## Development and checks

Node.js 24 is required. For an isolated development installation set
`GATEKEEPER_DATA_DIR` to a local test folder before initialization/start. Feed
`server/init.mjs` JSON containing `guard` and `admin` passwords via standard input
(not command-line arguments). Then use `npm start` for the backend and `npm run dev`
for Vite; its API proxy targets port 4317. Production uses `npm run build` then
`npm start`. `npm run dev:demo` explicitly enables the old browser-only demo.

Ordinary startup now defaults to Turso. For local development also set
`GATEKEEPER_DATABASE=sqlite`; `npm run dev` starts both backend and Vite, so do not
start a second backend at the same time. The installed Windows task already
selects SQLite. See `CLOUD-SETUP.md` for the current cloud workflow.

```sh
npm test
npm run build
node --test tests/integration/local.test.mjs
```

The integration test requires installed Chrome. It uses an isolated temporary
database/profile and verifies 100 offline taps, browser restart, lost response,
retry deduplication, another 100 rapid taps, database-backed log pagination,
unsaved-tap warnings/recovery, and simultaneous uploads from two tabs.
The original browser suite expects `npm run dev:demo` on port 5173.

Installer/task registration and an actual Windows reboot must be verified on the
deployment computer; automated tests do not reboot or change Windows startup.

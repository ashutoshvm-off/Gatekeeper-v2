# Run with Turso cloud data

Cloud mode is now the default for `npm run dev` and `npm start`. The Windows
SQLite installer remains available for your future local deployment; it is not
required to use cloud mode.

## One-time setup

1. Create an account at https://app.turso.tech and create a **libSQL** database.
   This adapter uses Turso's supported `@libsql/client` API for libSQL databases.
   Pick a nearby region and copy the `libsql://...` database URL.
2. Create a database authentication token with read/write access. This is a
   database token, not an account/platform API token.
3. In the project folder, copy `.env.server.example` to `.env.server`:

   ```bat
   copy .env.server.example .env.server
   ```

4. Edit `.env.server` locally. Set the database URL and token, and choose officer
   and administrator passwords with at least 12 characters. Keep passwords in
   quotes if they contain `#` or spaces. Do not paste secrets into chat, put them
   in `VITE_*` variables, or commit the file; `.env.server` is ignored by Git.
5. Install dependencies once, then start:

   ```bat
   npm install
   npm run dev
   ```

   Or run `start-cloud.bat` after dependencies are installed. Node.js 24 is required.

Open http://127.0.0.1:5173. The command starts both Vite and the cloud API on port
4317; Ctrl+C stops them. You do not need to install a local database, register
Windows startup tasks, or run `setup.bat` for this mode.

Login IDs are `SEC-G1-204` (officer) and `ADM-ASIET-001` (administrator), using the
passwords you entered in `.env.server`. Restart the command after changing that
file. Without configuration the website opens and shows setup instructions;
there is no fallback to demo credentials or a local database.

## Data loading

The backend creates the app's tables/indexes and scan-processing triggers on the
first successful connection. It does not create the Turso account/database or
insert fake student data. Sign in as administrator and import your registry once.
After that, registry, visits, incidents and checkpoint state are read from Turso.
Returning to the website loads that cloud data through the API. An arbitrary
pre-existing student database needs a separate schema mapping/import.

The scan queue stays in IndexedDB on this computer. It sends complete taps to
Turso in ordered batches and removes them only after the cloud confirms success.
Retries are idempotent. A single server-side SQL transaction processes each batch,
so network latency cannot interrupt a transaction between individual taps.
Cloud outages leave taps pending; they do not silently write to local SQLite.
The queue belongs to the browser profile and origin. Moving between port 5173
and 4317 or another profile does not automatically move pending taps.

Database tokens are used only by the backend. The website/API still run on this
computer, bound to loopback. This change connects the data to the cloud; it does
not publish the website on the internet. For a built version run `npm run build`
then `npm start` and open http://127.0.0.1:4317.

Use Turso's dashboard/CLI for cloud backups and storage usage. The local backup
button is hidden in cloud mode. Existing local SQLite records and demo browser
records are not migrated or deleted automatically.

## Later: local deployment

Upload your registry once through Data management while using Turso. When ready
to switch, let every cloud scan queue finish, stop cloud scanning/imports, and
stop `npm run dev`. Keep the configured `.env.server` in this project folder.
Run `setup.bat` on the target computer while connected to the internet.

Setup automatically downloads members, scan events, paired visits, incidents,
and checkpoint settings into a temporary SQLite database. It copies in pages of
500 rows, checks row counts and SHA-256 checksums, verifies SQLite integrity, and
commits to the new local database in one transaction. A cloud revision check
rejects a download if cloud records changed during the copy. No partial registry
is activated, and interrupted transfers can be retried by rerunning setup.

After verification, setup registers/enables startup and opens the local website
using the transferred data. The local Administration page shows the transfer
date and counts. Existing completed transfers are skipped on later setup runs,
so newer local edits/history are preserved. An already-populated local database
without a transfer marker requires manual reconciliation; setup refuses to
overwrite it. An empty cloud registry or missing credentials also stops setup.

This is a one-time cloud-to-local handover. Continue operating only the local
website afterward; later cloud edits do not synchronize back into it. Browser
taps that have not yet reached Turso are not part of the transfer. Cloud data is
left intact. Cloud credentials are not copied into the installed application.
See `LOCAL-INSTALL.md` for the local setup.

## Verification

`npm test` checks the cloud adapter's real SQL/transactions using an isolated
libSQL database. It also checks the local backend and missing-configuration state.
`node --test tests/integration/local.test.mjs` verifies persistent queue recovery.
No live Turso credentials are supplied with the project, so a live cloud round
trip must be verified after you supply your database URL and token.
# Importing access logs from an older system

Open **Administration → Import historical logs**. Choose the CSV export (XLSX and JSON tables also work, up to 25 MB), select its layout, and match the old column headings. The CSV template shows paired visits. For a shared date column with separate entry/exit times, map that same date to both timestamps.

Separate IN/OUT/DENIED events are sorted and paired by member within the selected file. Paired visits may include check-in, check-out, or denied-attempt timestamps. Use four-digit years and select day/month/year or month/day/year. ISO dates always work; timestamps without an offset use IST. Missing or invalid dates/times block the import until corrected. Review the preview, then click **Import visits**.

Re-importing identical visits skips duplicates using member ID, original log ID (when mapped), and timestamps. Keep the same file and mappings when retrying an interrupted import. Each batch is committed atomically; a retry also handles a response lost after saving. Incomplete historical visits remain marked missing check-in/check-out and do not change current scanner occupancy. Event pairing happens within one file: use a complete export rather than splitting the IN and OUT of a visit across files. This imports access history, not free-form incident notes.

Imported history is stored in Turso alongside current scans and is included in the verified one-time transfer performed by `setup.bat`. After setup, the installed launcher saves new activity to local SQLite. `npm run dev` in this source folder continues to follow `.env.server`; running the installer does not change that file. Do not keep uploading to the cloud after cutting over to the installed local website.


## Keeping the cloud website running

Run start-cloud.bat to launch the API and Vite as background processes. You can close the launcher window afterward. Run stop-cloud.bat to stop this background launch before setup.bat. Re-running the launcher while the website is healthy reuses it. Diagnostics are in .runtime/cloud-output.log and .runtime/cloud-errors.log.

npm run dev remains available for terminal development; keep that terminal open. Neither cloud launcher installs Windows boot tasks. After a reboot, run the cloud launcher again, or complete setup.bat when you are ready for the local installation with automatic startup. Server restarts end existing sign-in sessions; sign in again to resume.

## Clearing data and completing the local handover

Administration → Database maintenance → Clear database requires a paused checkpoint, drained queues, the exact confirmation phrase and the administrator password. This clears members and history in the currently connected database, retains login/installation settings, and leaves the checkpoint paused. SQLite creates a backup first; manual cloud clearing is permanent. All users sign in again afterward.

On local setup, Turso cleanup now follows the verified transfer: a local backup is checked against the transfer checksums, then the unchanged cloud dataset is cleared transactionally. Minimal migration metadata remains; writes to that retired cloud dataset are blocked. Cloud account/token settings are not deleted. If cleanup fails, the local website still runs offline and shows a pending cleanup report. Rerun setup.bat with internet to retry; if cloud data changed after transfer, newer records must be reconciled before deletion. Do not continue using cloud scanners after handover.

Rapid taps continue to use the persistent IndexedDB queue. Local processing does not require internet. Taps are removed only after database confirmation; unavailable storage shows an unsaved-tap warning.

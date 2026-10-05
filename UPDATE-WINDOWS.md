# Update the second computer

First push the latest project changes from the development computer to the same
GitHub repository/branch used by the checkpoint computer. Do not commit
`.env.server`, passwords, tokens, databases, or browser profiles.

On the checkpoint computer, finish scans and wait for **0 pending** in every
browser. Close the fullscreen browser with Alt+F4. Open PowerShell in the cloned
source folder (adjust this path if your clone is elsewhere):

```powershell
Set-Location 'C:\ASIET-Gatekeeper'
git status --short
git pull --ff-only
```

If Git reports conflicts or a failed pull, stop and resolve the message. Do not
reset/delete local files just to force an update. After a successful pull:

```powershell
.\update.bat
```

Approve the administrator prompt. Internet is needed for npm dependencies. The
updater uses the private Node.js installed by setup.bat. It builds first, saves
the previous application files, stops the local server, creates a database
backup, copies the new code into Program Files, and checks server health.
An application-copy or startup failure attempts to restore the previous code.
It does not automatically restore an older database, as that could lose records.

The updater preserves local members, history, passwords and the browser profile.
It does not download Turso records again, run cloud cleanup, or change the Windows
account assigned to the fullscreen task. Database backups are in
`%ProgramData%\ASIET-Gatekeeper\backups`; old application files are in
`%ProgramFiles%\ASIET-Gatekeeper\app-backups`.

Once **Update complete** appears, open the website from your normal operator
Windows account:

```powershell
.\start.bat
```

Sign in again if necessary. Check SQLite is connected and perform an authorized
test scan. A browser left open on the old page must be refreshed to load the new
code. `git pull` alone only updates the source clone; update.bat updates the
installed application. First-time installations still use setup.bat.

## Scanner shows an ID but does not show details

"No database confirmation yet" is an initial queue status, not a specific error.
Click the barcode field (or press F2), scan a card, and press Enter. If that works,
configure the physical reader to append Enter/CR or Tab after every barcode using
its model's configuration guide.

For readers that cannot send a terminator, enable **Auto-submit fast scans (reader
has no Enter/Tab)** on the scanner page. This preference is saved in that browser.
It submits a burst of at least six characters, with no more than 60 ms between
characters, after a 300 ms pause. Manual typing, paste, slow readers and shorter
IDs still need Enter. Use a reader suffix for reliable boundaries between very
close scans. The repeated-joined-barcode guard continues to require a rescan.

If the scanned value differs from the institutional ID, use the member's Barcode
field to register the actual card value after checking it. Do not shorten or guess
the scanned code. If no text appears, check input focus and keyboard/HID reader
mode; this fallback cannot receive data from a serial-only device.

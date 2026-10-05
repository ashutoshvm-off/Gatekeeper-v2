      CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY, barcode TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT UNIQUE NOT NULL,
        client TEXT NOT NULL, client_seq INTEGER NOT NULL, captured_at TEXT NOT NULL, received_at TEXT NOT NULL,
        member_id TEXT NOT NULL, direction TEXT NOT NULL, result TEXT NOT NULL, UNIQUE(client, client_seq));
      CREATE INDEX IF NOT EXISTS event_member ON events(member_id,seq);
      CREATE TABLE IF NOT EXISTS visits(key TEXT PRIMARY KEY, id TEXT NOT NULL, name TEXT NOT NULL,
        department TEXT NOT NULL, role TEXT NOT NULL, checkInDate TEXT NOT NULL DEFAULT '', checkInTime TEXT NOT NULL DEFAULT '',
        checkOutDate TEXT NOT NULL DEFAULT '', checkOutTime TEXT NOT NULL DEFAULT '', attemptDate TEXT NOT NULL DEFAULT '',
        attemptTime TEXT NOT NULL DEFAULT '', status TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', updated INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS open_visit ON visits(id) WHERE status='Checked in';
      CREATE INDEX IF NOT EXISTS visit_updated ON visits(updated DESC);
      CREATE INDEX IF NOT EXISTS visit_chronological ON visits(max(checkInDate || ' ' || checkInTime,checkOutDate || ' ' || checkOutTime,attemptDate || ' ' || attemptTime) DESC, updated DESC);
      CREATE INDEX IF NOT EXISTS visit_in_date ON visits(checkInDate);
      CREATE INDEX IF NOT EXISTS visit_out_date ON visits(checkOutDate);
      CREATE TABLE IF NOT EXISTS incidents(key TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      INSERT OR IGNORE INTO settings VALUES ('locked','false');

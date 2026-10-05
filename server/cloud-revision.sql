-- A changing revision makes a paginated transfer fail rather than silently
-- mixing registry/history from different points in time.
INSERT OR IGNORE INTO settings VALUES ('data_revision','0');
CREATE TRIGGER IF NOT EXISTS revision_members_insert AFTER INSERT ON members BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_members_update AFTER UPDATE ON members BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_members_delete AFTER DELETE ON members BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_events_insert AFTER INSERT ON events BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_events_update AFTER UPDATE ON events BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_events_delete AFTER DELETE ON events BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_visits_insert AFTER INSERT ON visits BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_visits_update AFTER UPDATE ON visits BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_visits_delete AFTER DELETE ON visits BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_incidents_insert AFTER INSERT ON incidents BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_incidents_update AFTER UPDATE ON incidents BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_incidents_delete AFTER DELETE ON incidents BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;
CREATE TRIGGER IF NOT EXISTS revision_checkpoint AFTER UPDATE ON settings WHEN NEW.key='locked' BEGIN UPDATE settings SET value=CAST(value AS INTEGER)+1 WHERE key='data_revision'; END;

-- Process an entire upload in one remote batch transaction. No per-tap network
-- round trips or interactive transactions that time out while a queue drains.
CREATE TABLE IF NOT EXISTS scan_inbox (
  key TEXT PRIMARY KEY NOT NULL, client TEXT NOT NULL, client_seq INTEGER NOT NULL,
  input TEXT NOT NULL, captured_at TEXT NOT NULL, received_at TEXT NOT NULL,
  date TEXT NOT NULL, time TEXT NOT NULL, actor TEXT NOT NULL,
  UNIQUE(client,client_seq)
);
CREATE TRIGGER IF NOT EXISTS apply_cloud_scan AFTER INSERT ON scan_inbox BEGIN
  SELECT CASE WHEN NEW.client_seq <= (SELECT MAX(client_seq) FROM events WHERE client=NEW.client)
    THEN RAISE(ABORT,'Scan sequence is out of order') END;
  INSERT INTO events(key,client,client_seq,captured_at,received_at,member_id,direction,result)
  SELECT NEW.key,NEW.client,NEW.client_seq,NEW.captured_at,NEW.received_at,d.id,d.direction,
    json_object('key',NEW.key,'input',NEW.input,'person',json(d.data),'reason',d.reason,
      'row',json_object('key',NEW.key,'id',d.id,'name',d.name,'department',d.department,'role',d.role,
        'direction',d.direction,'date',NEW.date,'time',NEW.time,'capturedAt',NEW.captured_at,
        'receivedAt',NEW.received_at,'operator',NEW.actor,'gate','Gate 1','source','Barcode / manual input','reason',d.reason))
  FROM (
    SELECT m.data,coalesce(m.id,upper(trim(NEW.input))) AS id,
      coalesce(json_extract(m.data,'$.name'),'Unregistered ID') AS name,
      coalesce(json_extract(m.data,'$.department'),'Unknown') AS department,
      coalesce(json_extract(m.data,'$.role'),'') AS role,
      CASE WHEN (SELECT value FROM settings WHERE key='locked')='true' OR m.id IS NULL
        OR coalesce(json_extract(m.data,'$.role'),'')='' OR json_extract(m.data,'$.status')<>'ACTIVE' THEN 'DENIED'
        WHEN EXISTS(SELECT 1 FROM visits WHERE id=m.id AND status='Checked in') THEN 'OUT' ELSE 'IN' END AS direction,
      CASE WHEN (SELECT value FROM settings WHERE key='locked')='true' THEN 'Checkpoint paused by administrator'
        WHEN m.id IS NULL THEN 'ID not found in the registry'
        WHEN json_extract(m.data,'$.status')<>'ACTIVE' THEN 'This access pass is suspended'
        ELSE 'Identity matched to the campus registry' END AS reason
    FROM (SELECT 1) LEFT JOIN members m ON m.id=upper(trim(NEW.input)) OR m.barcode=upper(trim(NEW.input))
  ) d;
  UPDATE visits SET checkOutDate=NEW.date,checkOutTime=NEW.time,status='Checked out',
    updated=(SELECT seq FROM events WHERE key=NEW.key)
    WHERE status='Checked in' AND id=(SELECT member_id FROM events WHERE key=NEW.key AND direction='OUT');
  INSERT INTO visits(key,id,name,department,role,checkInDate,checkInTime,attemptDate,attemptTime,status,reason,updated)
    SELECT key,member_id,json_extract(result,'$.row.name'),json_extract(result,'$.row.department'),json_extract(result,'$.row.role'),
      CASE WHEN direction='IN' THEN NEW.date ELSE '' END,CASE WHEN direction='IN' THEN NEW.time ELSE '' END,
      CASE WHEN direction='DENIED' THEN NEW.date ELSE '' END,CASE WHEN direction='DENIED' THEN NEW.time ELSE '' END,
      CASE WHEN direction='IN' THEN 'Checked in' ELSE 'Denied' END,json_extract(result,'$.reason'),seq
    FROM events WHERE key=NEW.key AND direction<>'OUT';
END;
CREATE TRIGGER IF NOT EXISTS member_identity_insert BEFORE INSERT ON members BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM members WHERE (id=NEW.barcode OR barcode=NEW.id) AND id<>NEW.id)
    THEN RAISE(ABORT,'Barcode conflicts with a member ID') END;
END;
CREATE TRIGGER IF NOT EXISTS member_identity_update BEFORE UPDATE ON members BEGIN
  SELECT CASE WHEN EXISTS(SELECT 1 FROM members WHERE (id=NEW.barcode OR barcode=NEW.id) AND id<>NEW.id)
    THEN RAISE(ABORT,'Barcode conflicts with a member ID') END;
END;

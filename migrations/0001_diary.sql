CREATE TABLE entries (
  date TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE revisions (
  date TEXT NOT NULL,
  version INTEGER NOT NULL,
  body TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (date, version)
);
-- A trigger keeps the snapshot and current entry in the same SQLite transaction.
CREATE TRIGGER entry_insert_history AFTER INSERT ON entries BEGIN
  INSERT INTO revisions VALUES (NEW.date, NEW.version, NEW.body, NEW.updated_at);
END;
CREATE TRIGGER entry_update_history AFTER UPDATE ON entries BEGIN
  INSERT INTO revisions VALUES (NEW.date, NEW.version, NEW.body, NEW.updated_at);
END;

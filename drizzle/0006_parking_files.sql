CREATE TABLE parking_file_chunks (
  path TEXT NOT NULL,
  part INTEGER NOT NULL,
  content BLOB NOT NULL,
  PRIMARY KEY (path, part)
);

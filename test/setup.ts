import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Fresh SQLite file per worker so tests never touch a real sovereign.db.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "sov-test-")), "test.db");
process.env.SESSION_SECRET ||= "test-secret-0123456789abcdef0123456789";

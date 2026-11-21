// A database file that isn't a database at all. Used by db-unreadable.test.js.
import "./tempDataDir.js";
import { mkdirSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";

mkdirSync("data");
writeFileSync("data/enmap.sqlite", randomBytes(50_000));

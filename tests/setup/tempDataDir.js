// Import this first in any test that touches the database. ES modules run their
// imports in order, so this switches to a temporary data folder before
// modules/settings.js (imported after it) opens one. See useTempDataDir().
import { useTempDataDir } from "../helpers.js";

useTempDataDir();

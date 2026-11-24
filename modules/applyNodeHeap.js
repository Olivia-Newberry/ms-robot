// Imported by index.js before anything else that matters (see modules/nodeHeap.js). ES
// modules run their imports in order, so this runs before the database is opened.
import { applyNodeHeapLimit } from "./nodeHeap.js";

applyNodeHeapLimit();

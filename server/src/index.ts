/**
 * Server entry point
 */

import { createServer } from "./server";

const server = createServer();

console.log(`Server running on http://${server.hostname}:${server.port}`);

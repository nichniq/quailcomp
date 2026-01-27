/**
 * Server entry point
 */

import { createServer } from "@/server";

const server = createServer();

console.log(`Server running on ${server.url}`);

import { MCP_SERVER_INFO } from "./mcp"

/** Stable publisher identity, intentionally independent of the request origin. */
export const PUBLISHER_DOMAIN = MCP_SERVER_INFO.name
export const PUBLISHER_DID = `did:web:${PUBLISHER_DOMAIN}`
export const PUBLISHER_ORIGIN = `https://${PUBLISHER_DOMAIN}`

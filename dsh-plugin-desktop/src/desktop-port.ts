/** Shared Desktop Web port policy. */

/**
 * OmniMux-owned loopback Host port.
 * Upstream DSH Desktop uses 43120 and retries +1 through +32 on EADDRINUSE.
 * Keep this outside that window so a default dual install (OmniMux + DSH Desktop)
 * does not collide.
 */
export const DESKTOP_DEFAULT_WEB_PORT = 44_120

/** Maximum number of sequential ports tried after a real bind collision. */
export const DESKTOP_WEB_PORT_RETRY_LIMIT = 32

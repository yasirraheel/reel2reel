/**
 * Centralized API endpoint configuration.
 *
 * All external service URLs should be defined here so they can be
 * swapped for different environments or self-hosted instances.
 */

const isDev = import.meta.env.DEV;

/** OpenReel cloud services */
export const OPENREEL_CLOUD_URL = isDev
  ? "http://localhost:8787"
  : "https://openreel-cloud.niiyeboah1996.workers.dev";

/** OpenReel transcription / TTS service (Hosted on VPS) */
export const OPENREEL_TTS_URL = "https://cineworm.org/api/v1/ai";

/** OpenReel transcription service (Hosted on VPS) */
export const OPENREEL_TRANSCRIBE_URL = "https://cineworm.org/api/v1/ai";

/**
 * Third-party API base URLs.
 * These are used by the api-proxy service in dev mode (direct calls)
 * and by the Cloudflare Pages Function proxy in production.
 * Application code should use apiFetch() from services/api-proxy.ts
 * instead of importing these directly.
 */

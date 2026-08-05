import { z } from "zod";

const envSchema = z.object({
  // Default to paths that Nginx will proxy to API_URL in all modes
  VITE_API_URL: z.string().default("/api"),
  VITE_WS_URL: z.string().default("/ws"),
  // URL of the operator's password vault, framed in the session console's
  // "Vault" tab so hardware-security-key 2FA can be satisfied outside the
  // (USB-less) session browser. See session-vault.tsx for the full rationale.
  // NOTE: Vite inlines import.meta.env values at BUILD time, so this cannot
  // be overridden by a container/runtime env var - changing it requires a
  // rebuild of the UI.
  VITE_VAULT_URL: z.string().default("https://vault.nlma.io"),
});

export const env = envSchema.parse(import.meta.env);

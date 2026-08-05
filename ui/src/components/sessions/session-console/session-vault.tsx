import { env } from "@/env";

// Renders the operator's password vault (Vaultwarden) as a tab in the
// session console, deliberately OUTSIDE the Steel session's own browser
// window.
//
// Why: a Steel session runs Chrome inside a container with no USB access.
// If a site demands a WebAuthn hardware security key for 2FA, the prompt
// appears inside the session and can never be satisfied - it just hangs on
// "Awaiting security key interaction...". The vault is exactly such a site.
// Framing it here instead loads it in the OPERATOR'S OWN browser, at the
// vault's own origin, so the operator's real security key works, the
// vault's zero-knowledge decryption stays entirely client-side, and the
// master password never touches the Steel host.
//
// The vault server already sends the headers that make this safe to embed:
// no X-Frame-Options, and a CSP frame-ancestors that allowlists this app's
// origin.
export default function SessionVault() {
  const vaultUrl = env.VITE_VAULT_URL;

  if (!vaultUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center text-sm text-[var(--gray-11)]">
        Vault URL is not configured (VITE_VAULT_URL).
      </div>
    );
  }

  return (
    <iframe
      src={vaultUrl}
      title="Password Vault"
      className="w-full h-full"
      // publickey-credentials-get: WebAuthn is a permissions-policy-gated
      // feature. A cross-origin iframe does NOT inherit it from the parent
      // page by default - without this explicit delegation, the security
      // key prompt silently never appears, reintroducing the exact bug this
      // panel exists to fix, just invisibly. DO NOT remove this attribute.
      // clipboard-write: lets the vault's own copy-to-clipboard buttons work.
      allow="publickey-credentials-get; clipboard-write"
    />
  );
}

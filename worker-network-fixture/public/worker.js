const endpoint = new URL("/api/collect", self.location.origin).href;
const kind = new URL(self.location.href).searchParams.get("kind") ?? "bootstrap";

async function submit(kind) {
  const response = await fetch(`${endpoint}?kind=${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, source: "worker-network-fixture" }),
  });
  if (!response.ok) throw new Error(`Unexpected response: ${response.status}`);
}

submit(kind).catch(() => {});
postMessage({
  type: kind === "bootstrap" ? "ready" : "submitted",
  fingerprint: {
    deviceMemory: navigator.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    platform: navigator.platform,
    userAgentDataPlatform: navigator.userAgentData?.platform,
  },
});
setTimeout(() => self.close(), 5_000);

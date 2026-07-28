export default function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    response.status(405).json({ error: "method_not_allowed" });
    return;
  }

  response.status(201).json({ receivedAt: new Date().toISOString() });
}

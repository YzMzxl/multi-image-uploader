const { handleWorkerRequest } = require("../../index");

exports.handler = async function handler(event) {
  const rawUrl = event.rawUrl || buildUrl(event);
  const headers = new Headers(normalizeHeaders(event.headers));
  const body = shouldAttachBody(event.httpMethod)
    ? decodeBody(event.body, event.isBase64Encoded)
    : undefined;

  const request = new Request(rawUrl, {
    method: event.httpMethod,
    headers,
    body,
    duplex: body ? "half" : undefined,
  });

  const response = await handleWorkerRequest(request, process.env);
  return {
    statusCode: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.text(),
  };
};

exports.config = {
  path: "/api/*",
};

function shouldAttachBody(method = "") {
  return !["GET", "HEAD"].includes(String(method).toUpperCase());
}

function normalizeHeaders(headers) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (value === undefined) continue;
    normalized[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }
  return normalized;
}

function decodeBody(body, isBase64Encoded) {
  if (!body) {
    return undefined;
  }

  return isBase64Encoded ? Buffer.from(body, "base64") : body;
}

function buildUrl(event) {
  const host = event.headers?.host || "localhost";
  const protocol = event.headers?.["x-forwarded-proto"] || "https";
  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  return `${protocol}://${host}${event.path}${query}`;
}

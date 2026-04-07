const { handleWorkerRequest } = require("../index");

module.exports = async function handler(req, res) {
  const body = await readRawBody(req);
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = new URL(req.url, `${protocol}://${host}`);

  const request = new Request(url, {
    method: req.method,
    headers: new Headers(normalizeHeaders(req.headers)),
    body: shouldAttachBody(req.method) ? body : undefined,
    duplex: shouldAttachBody(req.method) ? "half" : undefined,
  });

  const response = await handleWorkerRequest(request, process.env);
  for (const [key, value] of response.headers.entries()) {
    res.setHeader(key, value);
  }

  const payload = Buffer.from(await response.arrayBuffer());
  res.status(response.status).send(payload);
};

module.exports.config = {
  api: {
    bodyParser: false,
  },
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

function readRawBody(req) {
  if (!shouldAttachBody(req.method)) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

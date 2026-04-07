const IPFS_UPLOAD_URL = "https://api.img2ipfs.org/api/v0/add?pin=false";
const IPFS_GATEWAY_BASE_URL = "https://ipfs.io/ipfs";

async function upload({ file }) {
  const upstream = await postMultipart({
    url: IPFS_UPLOAD_URL,
    fileField: "file",
    file,
  });

  if (!upstream?.Hash) {
    throw createUpstreamError("IPFS upstream response missing Hash", upstream);
  }

  return {
    data: {
      url: `${IPFS_GATEWAY_BASE_URL}/${upstream.Hash}`,
    },
    meta: {
      hash: upstream.Hash,
      name: upstream.Name || file.name || "upload.bin",
      size: upstream.Size || "",
      upstream: IPFS_UPLOAD_URL,
    },
  };
}

async function postMultipart({
  url,
  fileField,
  file,
  fields = {},
  headers = {},
}) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value);
  }

  formData.append(fileField, file, file.name || "upload.bin");

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "IMGUploaderNode/1.0",
      ...headers,
    },
  });

  const raw = await response.text();
  const data = tryParseJson(raw);

  if (!response.ok) {
    throw createUpstreamError(
      data?.msg || data?.message || `Upstream HTTP ${response.status}`,
      raw,
    );
  }

  return data;
}

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function createUpstreamError(message, details, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = typeof details === "string" ? details.slice(0, 400) : JSON.stringify(details || "").slice(0, 400);
  return error;
}

module.exports = {
  id: "ipfs",
  upload,
};

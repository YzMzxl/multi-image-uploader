const CELINE_UPLOAD_URL = "https://ocs.celine.cn/livechat/chat/file/upload/celine/web/0/0";

async function upload({ file }) {
  const upstream = await postMultipart({
    url: CELINE_UPLOAD_URL,
    fileField: "file",
    file,
  });

  if (!upstream?.attachment?.url) {
    throw createUpstreamError("Celine upstream response missing attachment.url", upstream);
  }

  return {
    attachment: {
      url: upstream.attachment.url,
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
  id: "celine",
  upload,
};

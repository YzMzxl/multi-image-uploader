const IMG58_GET_UPLOAD_URL = "https://im.58.com/msg/get_pic_upload_url";
const IMG58_GET_UPLOAD_URL_QUERY = new URLSearchParams({
  params: "LjAuMC4wJmFwcGlkPTEwMTQwLW1jcyU0MGppdG1vdVFyY0hzJmV4dGVuZF9mbGFnPTAmdW5yZWFkX2luZGV4PTEmc2RrX3ZlcnNpb249NjQzMiZkZXZpY2VfaWQ9NThBbm9ueW1vdXMxM2E1MTI2YS1hYWIxLTQxMjQtOTM2Mi05YjlhM2Q1Njg3ZjEmeHh6bF9zbWFydGlkPSZpZDU4PUNoQlBsMmVqUlhSbTdhTlFNTWRrQWclM0QlM0Q1dXNlcl9pZD01OEFub255bW91czEzYTUxMjZhLWFhYjEtNDEyNC05MzYyLTliOWEzZDU2ODdmMSZzb3VyY2U9MTQmaW1fdG9rZW49NThBbm9ueW1vdXMxM2E1MTI2YS1hYWIxLTQxMjQtOTM2Mi05YjlhM2Q1Njg3ZjEmY2xpZW50X3ZlcnNpb249MS4wJmNsaWVudF90eXBlPXBjd2ViJm9zX3R5cGU9Q2hyb21lJm9zX3ZlcnNpb249MTMy",
  version: "j1.0",
}).toString();
const IMG58_GET_UPLOAD_URL_BODY = "cl9zb3VyY2UiOjE0LCJ0b19pZCI6IjEwMDAyIiwidG9fc291cmNlIjoxMDAsImZpbGVfc3VmZml4cyI6WyJwbmciXX01eyJzZW5kZXJfaWQiOiI1OEFub255bW91czEzYTUxMjZhLWFhYjEtNDEyNC05MzYyLTliOWEzZDU2ODdmMSIsInNlbmRl";
const IMG58_ORIGIN = "https://ai.58.com";
const IMG58_REFERER = "https://ai.58.com/";
const IMG58_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";

async function upload({ file }) {
  const uploadUrl = await getUploadUrl();
  await uploadFile(uploadUrl, file);

  const finalUrl = buildFinalUrl(uploadUrl);
  return {
    data: {
      url: finalUrl,
    },
    meta: {
      uploadUrl,
      path: extractFilePath(uploadUrl),
      retention: "temporary",
      note: "58img may periodically delete uploaded files.",
    },
  };
}

async function getUploadUrl() {
  const response = await fetch(`${IMG58_GET_UPLOAD_URL}?${IMG58_GET_UPLOAD_URL_QUERY}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: IMG58_ORIGIN,
      Referer: IMG58_REFERER,
      "User-Agent": IMG58_USER_AGENT,
    },
    body: IMG58_GET_UPLOAD_URL_BODY,
  });

  if (!response.ok) {
    throw createUpstreamError(
      `Failed to get upload URL: ${response.status}`,
      await safeReadText(response),
    );
  }

  const payload = await response.json().catch(() => null);
  const uploadUrl = payload?.data?.upload_info?.[0]?.url;
  if (payload?.error_code !== 0 || !uploadUrl) {
    throw createUpstreamError(
      "Invalid upload URL response",
      JSON.stringify(payload || "").slice(0, 400),
    );
  }

  return uploadUrl;
}

async function uploadFile(uploadUrl, file) {
  const fileContent = await file.arrayBuffer();
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "image/jpeg",
      Origin: IMG58_ORIGIN,
      Referer: IMG58_REFERER,
    },
    body: fileContent,
  });

  if (!response.ok) {
    throw createUpstreamError(
      `Upload failed: ${response.status}`,
      await safeReadText(response),
    );
  }
}

function buildFinalUrl(uploadUrl) {
  const hostIndex = Math.floor(Math.random() * 8) + 1;
  return `https://pic${hostIndex}.58cdn.com.cn/${extractFilePath(uploadUrl)}`;
}

function extractFilePath(uploadUrl) {
  const target = new URL(uploadUrl);
  const filePath = target.pathname.replace(/^\/+/, "");
  if (!filePath) {
    throw createUpstreamError("58img upload URL missing file path", uploadUrl);
  }

  return filePath;
}

async function safeReadText(response) {
  try {
    return (await response.text()).slice(0, 400);
  } catch {
    return "";
  }
}

function createUpstreamError(message, details, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = typeof details === "string" ? details : JSON.stringify(details || "").slice(0, 400);
  return error;
}

module.exports = {
  id: "58img",
  upload,
};

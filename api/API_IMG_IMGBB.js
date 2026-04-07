const IMGBB_UPLOAD_URL = "https://zh-cn.imgbb.com/json";

async function upload({ file }) {
  const upstream = await postMultipart({
    url: IMGBB_UPLOAD_URL,
    fileField: "source",
    file,
    fields: {
      type: "file",
      action: "upload",
    },
    headers: {
      Referer: "https://zh-cn.imgbb.com/",
      Origin: "https://zh-cn.imgbb.com",
    },
  });

  if (!upstream?.success || upstream?.status_code !== 200 || !upstream?.image?.url) {
    throw createUpstreamError("ImgBB upstream upload failed", upstream);
  }

  return {
    data: {
      url: upstream.image.url,
    },
    meta: {
      filename: upstream.image.filename || file.name || "upload.bin",
      size: upstream.image.size || file.size || "",
      deleteUrl: upstream.image.delete_url || "",
      thumbUrl: upstream.thumb?.url || "",
      mediumUrl: upstream.medium?.url || "",
      upstream: IMGBB_UPLOAD_URL,
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
      data?.msg || data?.message || raw || `Upstream HTTP ${response.status}`,
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
  id: "imgbb",
  upload,
};

const { getScdnConfig } = require("../runtime-config");

async function upload({ file, env }) {
  const config = getScdnConfig(env);
  if (config.passwordEnabled && !config.imagePassword) {
    throw createConfigError(
      "SCDN password protection requires SCDN_IMAGE_PASSWORD when SCDN_PASSWORD_ENABLED is true.",
    );
  }

  const formData = new FormData();
  formData.append("image", file, file.name || "upload.bin");
  formData.append("outputFormat", config.outputFormat);

  if (config.passwordEnabled) {
    formData.append("password_enabled", "true");
    formData.append("image_password", config.imagePassword);
  }

  if (config.cdnDomain) {
    formData.append("cdn_domain", config.cdnDomain);
  }

  const response = await fetch(config.uploadUrl, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "IMGUploaderNode/1.0",
    },
  });

  const raw = await response.text();
  const data = tryParseJson(raw);

  if (!response.ok) {
    throw createUpstreamError(
      extractErrorMessage(data, raw, response.status),
      raw,
      normalizeStatusCode(response.status),
    );
  }

  if (!data?.success || !data?.url) {
    throw createUpstreamError(
      extractErrorMessage(data, raw, response.status) || "SCDN upload failed",
      raw,
      normalizeStatusCode(response.status || 502),
    );
  }

  return {
    success: true,
    message: data.message || "",
    data: {
      url: data.url,
    },
    meta: {
      filename: data?.data?.filename || extractFileName(data.url),
      originalSize: data?.data?.original_size ?? file.size ?? "",
      compressedSize: data?.data?.compressed_size ?? "",
      compressionRatio: data?.data?.compression_ratio ?? "",
      outputFormat: config.outputFormat,
      passwordEnabled: config.passwordEnabled,
      cdnDomain: config.cdnDomain,
      upstream: config.uploadUrl,
    },
  };
}

function extractErrorMessage(payload, raw, status) {
  if (payload && typeof payload === "object") {
    const message = payload.message || payload.msg || payload.error || payload.details;
    if (message) {
      return String(message);
    }
  }

  if (raw) {
    return String(raw).slice(0, 240);
  }

  return `Upstream HTTP ${status}`;
}

function normalizeStatusCode(status) {
  if ([400, 405, 429].includes(Number(status))) {
    return Number(status);
  }

  return 502;
}

function extractFileName(url) {
  try {
    const cleanUrl = String(url).split("?")[0];
    return decodeURIComponent(cleanUrl.slice(cleanUrl.lastIndexOf("/") + 1));
  } catch {
    return "";
  }
}

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function createConfigError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = "";
  return error;
}

function createUpstreamError(message, details, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = typeof details === "string"
    ? details.slice(0, 400)
    : JSON.stringify(details || "").slice(0, 400);
  return error;
}

module.exports = {
  id: "scdn",
  upload,
};

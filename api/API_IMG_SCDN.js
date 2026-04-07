const { getScdnConfig } = require("../runtime-config");

async function upload({ file, fields }) {
  const config = getScdnConfig(fields);
  if (config.passwordEnabled && !config.imagePassword) {
    throw createConfigError(
      "SCDN password protection requires image_password when password_enabled is true.",
    );
  }

  const { data, uploadCdnDomain } = await uploadWithFallback(file, config);
  const remoteUrl = applyScdnCdnDomain(data.url, config.cdnDomain || uploadCdnDomain);

  return {
    success: true,
    message: data.message || "",
    data: {
      url: remoteUrl,
    },
    meta: {
      filename: data?.data?.filename || extractFileName(remoteUrl),
      originalSize: data?.data?.original_size ?? file.size ?? "",
      compressedSize: data?.data?.compressed_size ?? "",
      compressionRatio: data?.data?.compression_ratio ?? "",
      outputFormat: config.outputFormat,
      passwordEnabled: config.passwordEnabled,
      cdnDomain: config.cdnDomain || uploadCdnDomain,
      upstream: config.uploadUrl,
    },
  };
}

async function uploadWithFallback(file, config) {
  const candidates = buildUploadCandidates(config.cdnDomain);
  let lastError = null;

  for (const uploadCdnDomain of candidates) {
    try {
      const data = await performScdnUpload(file, config, uploadCdnDomain);
      return {
        data,
        uploadCdnDomain,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || createUpstreamError("SCDN upload failed", "", 502);
}

function buildUploadCandidates(targetCdnDomain) {
  const candidates = [];

  if (targetCdnDomain === "esaimg.cdn1.vip") {
    candidates.push("esaimg.cdn1.vip");
  } else {
    candidates.push("");
    candidates.push("esaimg.cdn1.vip");
  }

  return [...new Set(candidates)];
}

async function performScdnUpload(file, config, uploadCdnDomain) {
  const formData = new FormData();
  formData.append("image", file, file.name || "upload.bin");
  formData.append("outputFormat", config.outputFormat);

  if (config.passwordEnabled) {
    formData.append("password_enabled", "true");
    formData.append("image_password", config.imagePassword);
  }

  if (uploadCdnDomain) {
    formData.append("cdn_domain", uploadCdnDomain);
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

  return data;
}

function applyScdnCdnDomain(url, cdnDomain) {
  if (!cdnDomain) {
    return url;
  }

  try {
    const target = new URL(url);
    target.host = cdnDomain;
    return target.toString();
  } catch {
    return url;
  }
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

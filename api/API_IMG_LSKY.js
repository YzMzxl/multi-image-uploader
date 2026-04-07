const { resolveLskyConfigFromService } = require("../runtime-config");

async function upload({ file, env, service }) {
  const config = resolveLskyConfigFromService(service, env);
  if (!config.enabled || !config.uploadUrl) {
    throw createConfigError(
      "Lsky Pro+ is not configured. Set LSKY_PRO_SERVICES or legacy LSKY_PRO_* variables first.",
    );
  }

  const formData = new FormData();
  formData.append("file", file, file.name || "upload.bin");

  if (config.storageId) {
    formData.append("storage_id", config.storageId);
  }
  if (config.albumId) {
    formData.append("album_id", config.albumId);
  }
  if (config.expiredAt) {
    formData.append("expired_at", config.expiredAt);
  }
  if (config.intro) {
    formData.append("intro", config.intro);
  }
  if (config.isPublic !== null) {
    formData.append("is_public", config.isPublic ? "1" : "0");
  }
  if (config.removeExif !== null) {
    formData.append("is_remove_exif", config.removeExif ? "1" : "0");
  }
  for (const tag of config.tags) {
    formData.append("tags[]", tag);
  }

  const response = await fetch(config.uploadUrl, {
    method: "POST",
    body: formData,
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "IMGUploaderNode/1.0",
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
    },
  });

  const raw = await response.text();
  const data = tryParseJson(raw);
  if (!response.ok) {
    throw createUpstreamError(
      extractErrorMessage(data, raw, response.status),
      raw,
    );
  }

  if (!isSuccessfulPayload(data)) {
    throw createUpstreamError(
      extractErrorMessage(data, raw, response.status) || "Lsky Pro+ upload failed",
      raw,
    );
  }

  const remoteUrl = extractRemoteUrl(data, config);
  if (!remoteUrl) {
    throw createUpstreamError("Lsky Pro+ response missing public URL", raw);
  }

  return {
    status: true,
    message: data?.message || data?.msg || "success",
    data: {
      ...(data?.data || {}),
      public_url: remoteUrl,
      url: remoteUrl,
    },
    meta: {
      upstream: config.uploadUrl,
      tokenConfigured: Boolean(config.token),
      storageId: config.storageId,
      albumId: config.albumId,
      tags: config.tags,
    },
  };
}

function extractRemoteUrl(payload, config) {
  const data = payload?.data || {};
  const candidates = [
    data.public_url,
    data.url,
    data.src,
    data.links?.url,
    data.links?.direct,
    data.pathname,
    data.path,
    data.key,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeRemoteUrl(candidate, config.baseUrl);
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function normalizeRemoteUrl(value, baseUrl) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  if (!baseUrl) {
    return normalized;
  }

  if (normalized.startsWith("/")) {
    return `${baseUrl}${normalized}`;
  }

  return `${baseUrl}/${normalized.replace(/^\/+/, "")}`;
}

function isSuccessfulPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  if (payload.status === false || payload.code >= 400) {
    return false;
  }

  return Boolean(payload.data);
}

function extractErrorMessage(payload, raw, status) {
  if (payload && typeof payload === "object") {
    const messages = [
      payload.message,
      payload.msg,
      payload.error,
      payload.details,
      payload.errors?.file?.[0],
      payload.errors?.message,
    ];
    const first = messages.find((value) => String(value || "").trim());
    if (first) {
      return String(first);
    }
  }

  if (raw) {
    return String(raw).slice(0, 240);
  }

  return `Upstream HTTP ${status}`;
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
  id: "lsky",
  upload,
};

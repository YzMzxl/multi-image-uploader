const fs = require("fs");
const path = require("path");

const BASE_SERVICE_DEFINITIONS = require("./services.json");

const DEFAULT_ENV_FILES = [".env.local", ".env"];
const LSKY_DEFAULT_FIELDS = [
  "file",
  "storage_id",
  "album_id",
  "expired_at",
  "tags[]",
  "is_public",
  "is_remove_exif",
  "intro",
];
const LSKY_ACCENT_PALETTE = [
  "#0f766e",
  "#0ea5e9",
  "#2563eb",
  "#16a34a",
  "#ca8a04",
  "#dc2626",
  "#9333ea",
  "#ea580c",
];
const SCDN_UPLOAD_URL = "https://img.scdn.io/api/v1.php";
const SCDN_DEFAULT_OUTPUT_FORMAT = "auto";
const SCDN_SUPPORTED_OUTPUT_FORMATS = [
  "auto",
  "jpeg",
  "png",
  "webp",
  "gif",
  "webp_animated",
];
const SCDN_SUPPORTED_CDN_DOMAINS = [
  "img.scdn.io",
  "cloudflareimg.cdn.sn",
  "edgeoneimg.cdn.sn",
  "esaimg.cdn1.vip",
];

let projectEnvLoaded = false;

function loadEnvFiles(env = process.env, options = {}) {
  const cwd = options.cwd || __dirname;

  for (const filename of DEFAULT_ENV_FILES) {
    const filePath = path.join(cwd, filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    applyEnvText(content, env);
  }

  return env;
}

function ensureProjectEnvLoaded(env = process.env, options = {}) {
  if (env !== process.env) {
    return env;
  }

  if (!projectEnvLoaded) {
    loadEnvFiles(process.env, options);
    projectEnvLoaded = true;
  }

  return process.env;
}

function getProjectEnv(options = {}) {
  return ensureProjectEnvLoaded(process.env, options);
}

function applyEnvText(content, env) {
  const lines = String(content || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    if (!key || env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }
}

function buildRuntimeServices(env = process.env) {
  env = ensureProjectEnvLoaded(env);
  return [
    ...BASE_SERVICE_DEFINITIONS,
    ...getPublicLskyServices(env),
  ];
}

function buildRuntimeSettings(env = process.env) {
  env = ensureProjectEnvLoaded(env);

  const proxyToken = getProxyAuthToken(env);
  const lskyConfigs = getLskyConfigs(env);
  const primary = lskyConfigs[0] || buildEmptyLskyConfig();
  const scdn = getScdnConfig();

  return {
    auth: {
      proxyTokenConfigured: Boolean(proxyToken),
    },
    scdn: {
      uploadUrl: scdn.uploadUrl,
      outputFormat: scdn.outputFormat,
      passwordEnabled: scdn.passwordEnabled,
      passwordConfigured: Boolean(scdn.imagePassword),
      cdnDomain: scdn.cdnDomain,
      maxFileSizeBytes: scdn.maxFileSizeBytes,
      supportedOutputFormats: [...SCDN_SUPPORTED_OUTPUT_FORMATS],
      supportedCdnDomains: [...SCDN_SUPPORTED_CDN_DOMAINS],
    },
    lsky: {
      enabled: lskyConfigs.length > 0,
      serviceCount: lskyConfigs.length,
      source: getLskyConfigSource(env),
      fields: [...LSKY_DEFAULT_FIELDS],
      services: lskyConfigs.map((config) => buildLskySettingsItem(config)),
      baseUrl: primary.baseUrl,
      apiUrl: primary.apiUrl,
      uploadUrl: primary.uploadUrl,
      tokenConfigured: Boolean(primary.token),
      storageId: primary.storageId,
      albumId: primary.albumId,
      expiredAt: primary.expiredAt,
      isPublic: primary.isPublic,
      removeExif: primary.removeExif,
      intro: primary.intro,
      tags: primary.tags,
    },
  };
}

function getServerConfig(env = process.env) {
  env = ensureProjectEnvLoaded(env);

  return {
    port: parsePort(env.PORT),
    authToken: getProxyAuthToken(env),
  };
}

function getProxyAuthToken(env = process.env) {
  env = ensureProjectEnvLoaded(env);
  return firstNonEmpty(env.AUTH_TOKEN, env.IMG_AUTH_TOKEN);
}

function getScdnConfig(env = process.env) {
  const imagePassword = firstNonEmpty(
    env?.image_password,
    env?.imagePassword,
  );
  const passwordEnabledOverride = parseOptionalBoolean(
    firstNonEmpty(env?.password_enabled, env?.passwordEnabled),
  );

  return {
    uploadUrl: SCDN_UPLOAD_URL,
    outputFormat: normalizeScdnOutputFormat(
      firstNonEmpty(env?.outputFormat),
    ),
    passwordEnabled: passwordEnabledOverride ?? Boolean(imagePassword),
    imagePassword,
    cdnDomain: normalizeScdnCdnDomain(
      firstNonEmpty(env?.cdn_domain, env?.cdnDomain),
    ),
    maxFileSizeBytes: parseOptionalNumber(env?.maxFileSizeBytes),
  };
}

function getPublicLskyServices(env = process.env) {
  env = ensureProjectEnvLoaded(env);
  return getLskyConfigs(env).map((config, index) => buildPublicLskyService(config, index));
}

function getLskyConfigs(env = process.env) {
  env = ensureProjectEnvLoaded(env);

  const multiConfigs = getMultiLskyConfigs(env);
  if (multiConfigs.length) {
    return multiConfigs;
  }

  const legacyConfig = getLegacyLskyConfig(env);
  return legacyConfig ? [legacyConfig] : [];
}

function getLskyConfig(env = process.env) {
  return getLskyConfigs(env)[0] || buildEmptyLskyConfig();
}

function getLskyConfigByKey(configKey, env = process.env) {
  env = ensureProjectEnvLoaded(env);
  return getLskyConfigs(env).find((config) => config.key === configKey) || null;
}

function resolveLskyConfigFromService(service, env = process.env) {
  env = ensureProjectEnvLoaded(env);

  const configKey = String(service?.runtimeConfigKey || service?.lskyConfigKey || "").trim();
  if (configKey) {
    return getLskyConfigByKey(configKey, env);
  }

  return getLskyConfig(env);
}

function getLskyConfigSource(env = process.env) {
  env = ensureProjectEnvLoaded(env);
  if (parseJsonLskyServices(env).length) {
    return "multi";
  }

  return getLegacyLskyConfig(env) ? "legacy" : "none";
}

function getMultiLskyConfigs(env = process.env) {
  env = ensureProjectEnvLoaded(env);

  return parseJsonLskyServices(env)
    .map((item, index) => normalizeLskyConfig(item, {
      index,
      keyFallback: `lsky-${index + 1}`,
      nameFallback: `Lsky Pro+ ${index + 1}`,
      subtitleFallback: "Runtime config",
    }))
    .filter((config) => config.enabled && config.uploadUrl);
}

function getLegacyLskyConfig(env = process.env) {
  env = ensureProjectEnvLoaded(env);

  const normalized = normalizeLskyConfig({
    key: firstNonEmpty(env.LSKY_PRO_KEY, "default"),
    name: firstNonEmpty(env.LSKY_PRO_NAME, "Lsky Pro+"),
    subtitle: firstNonEmpty(env.LSKY_PRO_SUBTITLE, "Runtime config"),
    accent: firstNonEmpty(env.LSKY_PRO_ACCENT),
    enabled: parseOptionalBoolean(env.LSKY_PRO_ENABLED),
    baseUrl: firstNonEmpty(env.LSKY_PRO_BASE_URL, env.LSKY_PRO_URL, env.LSKY_BASE_URL),
    apiUrl: firstNonEmpty(env.LSKY_PRO_API_URL),
    token: firstNonEmpty(env.LSKY_PRO_TOKEN, env.LSKY_TOKEN),
    storageId: firstNonEmpty(env.LSKY_PRO_STORAGE_ID, env.LSKY_STORAGE_ID),
    albumId: firstNonEmpty(env.LSKY_PRO_ALBUM_ID, env.LSKY_ALBUM_ID),
    expiredAt: firstNonEmpty(env.LSKY_PRO_EXPIRED_AT),
    tags: splitCommaValues(env.LSKY_PRO_TAGS),
    isPublic: parseOptionalBoolean(env.LSKY_PRO_IS_PUBLIC),
    removeExif: parseOptionalBoolean(env.LSKY_PRO_REMOVE_EXIF),
    intro: firstNonEmpty(env.LSKY_PRO_INTRO),
    maxFileSizeBytes: parseOptionalNumber(env.LSKY_PRO_MAX_FILE_SIZE_BYTES),
    accepts: splitCommaValues(env.LSKY_PRO_ACCEPTS),
  }, {
    index: 0,
    keyFallback: "default",
    nameFallback: "Lsky Pro+",
    subtitleFallback: "Runtime config",
  });

  return normalized.enabled && normalized.uploadUrl ? normalized : null;
}

function parseJsonLskyServices(env = process.env) {
  env = ensureProjectEnvLoaded(env);

  const raw = firstNonEmpty(env.LSKY_PRO_SERVICES, env.LSKY_PRO_SERVICES_JSON);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeLskyConfig(source, options = {}) {
  const index = Number(options.index || 0);
  const baseUrl = normalizeBaseUrl(
    firstNonEmpty(source?.baseUrl, source?.url, source?.siteUrl),
  );
  const apiUrl = normalizeApiUrl(
    firstNonEmpty(source?.apiUrl, baseUrl ? `${baseUrl}/api/v2` : ""),
  );
  const key = slugify(firstNonEmpty(source?.key, source?.slug, options.keyFallback, `lsky-${index + 1}`))
    || `lsky-${index + 1}`;
  const enabledOverride = source?.enabled === undefined || source?.enabled === null
    ? null
    : parseOptionalBoolean(source.enabled);
  const enabled = enabledOverride ?? Boolean(apiUrl);

  return {
    type: "lsky",
    key,
    id: `lsky-${key}`,
    endpoint: `/api/lsky-upload/${key}`,
    handlerId: "lsky",
    name: firstNonEmpty(source?.name, options.nameFallback, `Lsky Pro+ ${index + 1}`),
    subtitle: firstNonEmpty(source?.subtitle, options.subtitleFallback, "Runtime config"),
    accent: firstNonEmpty(source?.accent, LSKY_ACCENT_PALETTE[index % LSKY_ACCENT_PALETTE.length]),
    enabled,
    baseUrl: baseUrl || deriveBaseUrlFromApiUrl(apiUrl),
    apiUrl,
    uploadUrl: apiUrl ? `${apiUrl}/upload` : "",
    token: firstNonEmpty(source?.token),
    storageId: firstNonEmpty(source?.storageId),
    albumId: firstNonEmpty(source?.albumId),
    expiredAt: firstNonEmpty(source?.expiredAt),
    tags: normalizeTags(source?.tags),
    isPublic: source?.isPublic === undefined || source?.isPublic === null
      ? null
      : parseOptionalBoolean(source.isPublic),
    removeExif: source?.removeExif === undefined || source?.removeExif === null
      ? null
      : parseOptionalBoolean(source.removeExif),
    intro: firstNonEmpty(source?.intro),
    maxFileSizeBytes: parseOptionalNumber(source?.maxFileSizeBytes),
    accepts: normalizeAccepts(source?.accepts),
  };
}

function buildPublicLskyService(config, index) {
  const targetHost = safeHostname(config.baseUrl || config.apiUrl);
  const authLabel = config.token
    ? "Bearer Token (upload:write)"
    : "Guest / optional token";
  const configSummary = [
    config.storageId ? `storage_id=${config.storageId}` : "",
    config.albumId ? `album_id=${config.albumId}` : "",
    config.isPublic === null ? "" : `is_public=${config.isPublic ? 1 : 0}`,
    config.removeExif === null ? "" : `is_remove_exif=${config.removeExif ? 1 : 0}`,
  ].filter(Boolean).join(", ");

  return {
    id: config.id,
    handlerId: config.handlerId,
    runtimeConfigKey: config.key,
    name: config.name,
    subtitle: config.subtitle,
    accent: config.accent || LSKY_ACCENT_PALETTE[index % LSKY_ACCENT_PALETTE.length],
    mode: "Node proxy",
    summary: `Upload to ${targetHost || "your Lsky Pro+ instance"} via server-side runtime config.`,
    method: "POST",
    endpoint: config.endpoint,
    auth: authLabel,
    fileField: "file",
    successPath: "data.public_url",
    note: configSummary
      ? `Configured via env/.env. ${configSummary}. Effective settings: /api/settings`
      : "Configured via env/.env. Effective settings: /api/settings",
    uploadMode: "real",
    resultBaseUrl: "",
    maxFileSizeBytes: config.maxFileSizeBytes || undefined,
    accepts: config.accepts,
  };
}

function buildLskySettingsItem(config) {
  return {
    key: config.key,
    id: config.id,
    endpoint: config.endpoint,
    name: config.name,
    subtitle: config.subtitle,
    baseUrl: config.baseUrl,
    apiUrl: config.apiUrl,
    uploadUrl: config.uploadUrl,
    tokenConfigured: Boolean(config.token),
    storageId: config.storageId,
    albumId: config.albumId,
    expiredAt: config.expiredAt,
    isPublic: config.isPublic,
    removeExif: config.removeExif,
    intro: config.intro,
    tags: config.tags,
    maxFileSizeBytes: config.maxFileSizeBytes,
    accepts: config.accepts,
  };
}

function buildEmptyLskyConfig() {
  return {
    key: "",
    id: "",
    endpoint: "",
    handlerId: "lsky",
    name: "",
    subtitle: "",
    accent: "",
    enabled: false,
    baseUrl: "",
    apiUrl: "",
    uploadUrl: "",
    token: "",
    storageId: "",
    albumId: "",
    expiredAt: "",
    tags: [],
    isPublic: null,
    removeExif: null,
    intro: "",
    maxFileSizeBytes: null,
    accepts: ["image/*"],
  };
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return splitCommaValues(value);
}

function normalizeAccepts(value) {
  if (Array.isArray(value)) {
    const accepts = value.map((item) => String(item).trim()).filter(Boolean);
    return accepts.length ? accepts : ["image/*"];
  }

  const accepts = splitCommaValues(value);
  return accepts.length ? accepts : ["image/*"];
}

function normalizeScdnOutputFormat(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return SCDN_DEFAULT_OUTPUT_FORMAT;
  }

  return SCDN_SUPPORTED_OUTPUT_FORMATS.includes(normalized)
    ? normalized
    : SCDN_DEFAULT_OUTPUT_FORMAT;
}

function normalizeScdnCdnDomain(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "img.scdn.io") {
    return "";
  }

  return normalized;
}

function safeHostname(value) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function normalizeBaseUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return "";
  }

  return normalized.replace(/\/api\/v2$/i, "");
}

function normalizeApiUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/\/upload$/i, "")
    .replace(/\/+$/g, "");
}

function normalizeUrl(value) {
  return String(value || "").trim().replace(/\/+$/g, "");
}

function deriveBaseUrlFromApiUrl(apiUrl) {
  if (!apiUrl) {
    return "";
  }

  return apiUrl.replace(/\/api\/v2$/i, "");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitCommaValues(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalBoolean(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function parseOptionalNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function parsePort(value) {
  const numeric = parseOptionalNumber(value);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric > 65535) {
    return 8000;
  }

  return numeric;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (String(value || "").trim()) {
      return String(value).trim();
    }
  }

  return "";
}

module.exports = {
  BASE_SERVICE_DEFINITIONS,
  buildRuntimeServices,
  buildRuntimeSettings,
  ensureProjectEnvLoaded,
  getProjectEnv,
  getProxyAuthToken,
  getScdnConfig,
  getLskyConfig,
  getLskyConfigByKey,
  getLskyConfigs,
  getPublicLskyServices,
  getServerConfig,
  loadEnvFiles,
  resolveLskyConfigFromService,
};

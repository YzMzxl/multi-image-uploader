const SERVICE_DEFINITIONS = [
  { id: "celine", endpoint: "/api/celine-upload", fileField: "file" },
  { id: "ipfs", endpoint: "/api/ipfs-upload", fileField: "image" },
  { id: "imgbb", endpoint: "/api/imgbb-upload", fileField: "image" },
  { id: "58img", endpoint: "/api/58img-upload", fileField: "image" },
  { id: "scdn", endpoint: "/api/scdn-upload", fileField: "image" },
];

const CELINE_UPLOAD_URL = "https://ocs.celine.cn/livechat/chat/file/upload/celine/web/0/0";
const IPFS_UPLOAD_URL = "https://api.img2ipfs.org/api/v0/add?pin=false";
const IPFS_GATEWAY_BASE_URL = "https://ipfs.io/ipfs";
const IMGBB_UPLOAD_URL = "https://zh-cn.imgbb.com/json";
const SCDN_UPLOAD_URL = "https://img.scdn.io/api/v1.php";
const IMG58_GET_UPLOAD_URL = "https://im.58.com/msg/get_pic_upload_url";
const SCDN_OUTPUT_FORMATS = new Set(["auto", "jpeg", "png", "webp", "gif", "webp_animated"]);
const IMG58_GET_UPLOAD_URL_QUERY = new URLSearchParams({
  params: "LjAuMC4wJmFwcGlkPTEwMTQwLW1jcyU0MGppdG1vdVFyY0hzJmV4dGVuZF9mbGFnPTAmdW5yZWFkX2luZGV4PTEmc2RrX3ZlcnNpb249NjQzMiZkZXZpY2VfaWQ9NThBbm9ueW1vdXMxM2E1MTI2YS1hYWIxLTQxMjQtOTM2Mi05YjlhM2Q1Njg3ZjEmeHh6bF9zbWFydGlkPSZpZDU4PUNoQlBsMmVqUlhSbTdhTlFNTWRrQWclM0QlM0Q1dXNlcl9pZD01OEFub255bW91czEzYTUxMjZhLWFhYjEtNDEyNC05MzYyLTliOWEzZDU2ODdmMSZzb3VyY2U9MTQmaW1fdG9rZW49NThBbm9ueW1vdXMxM2E1MTI2YS1hYWIxLTQxMjQtOTM2Mi05YjlhM2Q1Njg3ZjEmY2xpZW50X3ZlcnNpb249MS4wJmNsaWVudF90eXBlPXBjd2ViJm9zX3R5cGU9Q2hyb21lJm9zX3ZlcnNpb249MTMy",
  version: "j1.0",
}).toString();
const IMG58_GET_UPLOAD_URL_BODY = "cl9zb3VyY2UiOjE0LCJ0b19pZCI6IjEwMDAyIiwidG9fc291cmNlIjoxMDAsImZpbGVfc3VmZml4cyI6WyJwbmciXX01eyJzZW5kZXJfaWQiOiI1OEFub255bW91czEzYTUxMjZhLWFhYjEtNDEyNC05MzYyLTliOWEzZDU2ODdmMSIsInNlbmRl";
const IMG58_ORIGIN = "https://ai.58.com";
const IMG58_REFERER = "https://ai.58.com/";
const IMG58_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36";
const SERVICE_BY_ENDPOINT = new Map(
  SERVICE_DEFINITIONS.map((service) => [service.endpoint, service]),
);

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  let formDataPromise = null;

  const descriptor = await executeApiRequest({
    pathname: url.pathname,
    method: request.method,
    headers: request.headers,
    getFile: async (service) => {
      if (request.method !== "POST") {
        return null;
      }

      formDataPromise ||= request.formData();
      const formData = await formDataPromise;
      const file = formData.get(service.fileField);
      return file instanceof File ? file : null;
    },
    getFields: async (service) => {
      if (request.method !== "POST") {
        return {};
      }

      formDataPromise ||= request.formData();
      const formData = await formDataPromise;
      return getWorkerFormFields(formData, service.fileField);
    },
  });

  if (!descriptor) {
    return new Response("Not Found", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(descriptor.body, {
    status: descriptor.status,
    headers: descriptor.headers,
  });
}

async function executeApiRequest({
  pathname,
  method,
  headers,
  getFile,
  getFields = async () => ({}),
}) {
  if (!pathname?.startsWith("/api/")) {
    return null;
  }

  if (method === "OPTIONS") {
    return buildEmptyResponse(204, headers);
  }

  if (pathname === "/api/health") {
    return buildJsonResponse(200, { ok: true }, headers);
  }

  const service = SERVICE_BY_ENDPOINT.get(pathname);
  if (!service) {
    return buildJsonResponse(404, {
      code: 404,
      msg: "API route not found",
      details: "",
    }, headers);
  }

  if (method !== "POST") {
    return buildJsonResponse(405, {
      code: 405,
      msg: "Method not allowed",
      details: "",
    }, headers);
  }

  const file = await getFile(service);
  if (!file) {
    return buildJsonResponse(400, {
      code: 400,
      msg: "No file uploaded.",
      details: "",
    }, headers);
  }

  const fields = await getFields(service);

  try {
    const payload = await uploadByServiceId(service.id, file, fields);
    return buildJsonResponse(200, payload, headers);
  } catch (error) {
    return buildJsonResponse(Number(error?.statusCode || 500), {
      code: Number(error?.statusCode || 500),
      msg: String(error?.message || error),
      details: error?.details || "",
    }, headers);
  }
}

async function uploadByServiceId(serviceId, file, fields) {
  switch (serviceId) {
    case "celine":
      return uploadCeline(file);
    case "ipfs":
      return uploadIpfs(file);
    case "imgbb":
      return uploadImgbb(file);
    case "58img":
      return upload58img(file);
    case "scdn":
      return uploadScdn(file, fields);
    default:
      throw createUpstreamError("Service handler not found", serviceId, 500);
  }
}

async function uploadCeline(file) {
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

async function uploadIpfs(file) {
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

async function uploadImgbb(file) {
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

async function upload58img(file) {
  const uploadUrl = await get58imgUploadUrl();
  await upload58imgFile(uploadUrl, file);
  const finalUrl = build58imgFinalUrl(uploadUrl);

  return {
    data: {
      url: finalUrl,
    },
    meta: {
      uploadUrl,
      path: extract58imgPath(uploadUrl),
      retention: "temporary",
      note: "58img may periodically delete uploaded files.",
    },
  };
}

async function uploadScdn(file, fields = {}) {
  const outputFormat = normalizeScdnOutputFormat(fields.outputFormat);
  const passwordEnabled = parseBooleanField(fields.password_enabled);
  const imagePassword = String(fields.image_password || "").trim();
  const cdnDomain = normalizeScdnCdnDomain(fields.cdn_domain);

  if (passwordEnabled && !imagePassword) {
    throw createUpstreamError("SCDN password protection requires image_password when password_enabled is true.", "", 400);
  }

  const { upstream, uploadCdnDomain } = await uploadScdnWithFallback(file, {
    outputFormat,
    passwordEnabled,
    imagePassword,
    cdnDomain,
  });
  const remoteUrl = applyScdnCdnDomain(upstream.url, cdnDomain || uploadCdnDomain);

  return {
    success: true,
    data: {
      url: remoteUrl,
    },
    meta: {
      filename: extractFileNameFromUrl(remoteUrl),
      originalSize: upstream?.data?.original_size ?? file.size ?? "",
      compressedSize: upstream?.data?.compressed_size ?? "",
      compressionRatio: upstream?.data?.compression_ratio ?? "",
      outputFormat,
      passwordEnabled,
      cdnDomain: cdnDomain || uploadCdnDomain,
      upstream: SCDN_UPLOAD_URL,
    },
  };
}

async function uploadScdnWithFallback(file, options) {
  const candidates = buildScdnUploadCandidates(options.cdnDomain);
  let lastError = null;

  for (const uploadCdnDomain of candidates) {
    try {
      const upstream = await performScdnUpload(file, options, uploadCdnDomain);
      return {
        upstream,
        uploadCdnDomain,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || createUpstreamError("SCDN upstream upload failed", "", 502);
}

function buildScdnUploadCandidates(targetCdnDomain) {
  if (targetCdnDomain === "esaimg.cdn1.vip") {
    return ["esaimg.cdn1.vip"];
  }

  return ["", "esaimg.cdn1.vip"];
}

async function performScdnUpload(file, options, uploadCdnDomain) {
  const upstream = await postMultipart({
    url: SCDN_UPLOAD_URL,
    fileField: "image",
    file,
    fields: {
      outputFormat: options.outputFormat,
      ...(options.passwordEnabled ? { password_enabled: "true", image_password: options.imagePassword } : {}),
      ...(uploadCdnDomain ? { cdn_domain: uploadCdnDomain } : {}),
    },
  });

  if (!upstream?.success || !upstream?.url) {
    throw createUpstreamError("SCDN upstream upload failed", upstream);
  }

  return upstream;
}

async function get58imgUploadUrl() {
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

async function upload58imgFile(uploadUrl, file) {
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
      "User-Agent": "IMGUploaderWorker/1.0",
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

function build58imgFinalUrl(uploadUrl) {
  const hostIndex = Math.floor(Math.random() * 8) + 1;
  return `https://pic${hostIndex}.58cdn.com.cn/${extract58imgPath(uploadUrl)}`;
}

function extract58imgPath(uploadUrl) {
  const target = new URL(uploadUrl);
  const filePath = target.pathname.replace(/^\/+/, "");
  if (!filePath) {
    throw createUpstreamError("58img upload URL missing file path", uploadUrl);
  }

  return filePath;
}

function extractFileNameFromUrl(url) {
  try {
    const cleanUrl = String(url).split("?")[0];
    return decodeURIComponent(cleanUrl.slice(cleanUrl.lastIndexOf("/") + 1));
  } catch {
    return "";
  }
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

function getWorkerFormFields(formData, fileField) {
  const fields = {};

  for (const [key, value] of formData.entries()) {
    if (key === fileField && value instanceof File) {
      continue;
    }

    if (value instanceof File) {
      continue;
    }

    fields[key] = String(value);
  }

  return fields;
}

function normalizeScdnOutputFormat(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SCDN_OUTPUT_FORMATS.has(normalized) ? normalized : "auto";
}

function normalizeScdnCdnDomain(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "img.scdn.io") {
    return "";
  }

  return normalized;
}

function parseBooleanField(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

async function safeReadText(response) {
  try {
    return (await response.text()).slice(0, 400);
  } catch {
    return "";
  }
}

function buildJsonResponse(status, payload, requestHeaders) {
  return {
    status,
    headers: {
      ...buildCorsHeaders(requestHeaders),
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  };
}

function buildEmptyResponse(status, requestHeaders) {
  return {
    status,
    headers: {
      ...buildCorsHeaders(requestHeaders),
    },
    body: "",
  };
}

function buildCorsHeaders(requestHeaders) {
  const origin = requestHeaders.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Auth-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
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

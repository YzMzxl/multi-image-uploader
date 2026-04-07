const {
  buildRuntimeServices,
  buildRuntimeSettings,
  getProjectEnv,
  getProxyAuthToken,
} = require("./runtime-config");
const celine = require("./api/API_IMG_CELINE");
const ipfs = require("./api/API_IMG_IPFS");
const imgbb = require("./api/API_IMG_IMGBB");
const img58 = require("./api/API_IMG_58IMG");
const lsky = require("./api/API_IMG_LSKY");

const SERVICE_HANDLERS = {
  celine,
  ipfs,
  imgbb,
  "58img": img58,
  lsky,
};

async function executeApiRequest({
  pathname,
  method,
  headers,
  env = getProjectEnv(),
  getFile,
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

  if (pathname === "/api/services") {
    return buildJsonResponse(200, buildRuntimeServices(env), headers);
  }

  if (pathname === "/api/settings") {
    return buildJsonResponse(200, buildRuntimeSettings(env), headers);
  }

  const service = getServiceByEndpoint(pathname, env);
  if (!service) {
    return buildJsonResponse(404, {
      code: 404,
      msg: "API route not found",
      details: "",
    }, headers);
  }

  if (!isAuthorized(headers, env)) {
    return buildJsonResponse(401, {
      code: 401,
      msg: "Unauthorized",
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

  try {
    const handler = SERVICE_HANDLERS[service.handlerId || service.id];
    if (!handler?.upload) {
      throw createError("Service handler not found", "", 500);
    }

    const payload = await handler.upload({
      file,
      headers,
      env,
      service,
    });

    return buildJsonResponse(200, payload, headers);
  } catch (error) {
    return normalizeErrorResponse(error, headers);
  }
}

async function handleNodeApiRequest(req, env) {
  return executeApiRequest({
    pathname: req.path,
    method: req.method,
    headers: req.headers,
    env: env || getProjectEnv(),
    getFile: async (service) => {
      const uploadedFile = getNodeUploadedFile(req.files, service.fileField);
      if (!uploadedFile) {
        return null;
      }

      return new File(
        [uploadedFile.buffer],
        uploadedFile.originalname || "upload.bin",
        {
          type: uploadedFile.mimetype || "application/octet-stream",
          lastModified: Date.now(),
        },
      );
    },
  });
}

async function handleWorkerRequest(request, env = {}) {
  const url = new URL(request.url);
  let formDataPromise = null;

  const descriptor = await executeApiRequest({
    pathname: url.pathname,
    method: request.method,
    headers: request.headers,
    env,
    getFile: async (service) => {
      if (request.method !== "POST") {
        return null;
      }

      formDataPromise ||= request.formData();
      const formData = await formDataPromise;
      const file = formData.get(service.fileField);
      return file instanceof File ? file : null;
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

function getServiceByEndpoint(pathname, env) {
  return buildRuntimeServices(env || getProjectEnv())
    .find((service) => service.endpoint === pathname) || null;
}

function getNodeUploadedFile(files, fieldName) {
  if (!Array.isArray(files) || !files.length) {
    return null;
  }

  return files.find((file) => file.fieldname === fieldName) || null;
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
  const origin = getHeader(requestHeaders, "origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Auth-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function isAuthorized(headers, env = {}) {
  const configuredToken = getProxyAuthToken(env);
  if (!configuredToken) {
    return true;
  }

  const authorization = getHeader(headers, "authorization");
  const headerToken = authorization.replace(/^Bearer\s+/i, "") || getHeader(headers, "x-auth-token");
  return headerToken === configuredToken;
}

function getHeader(headers, name) {
  if (!headers) {
    return "";
  }

  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(name.toLowerCase()) || "";
  }

  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value ? String(value) : "";
}

function normalizeErrorResponse(error, requestHeaders) {
  const statusCode = Number(error?.statusCode || 500);
  return buildJsonResponse(statusCode, {
    code: statusCode,
    msg: String(error?.message || error),
    details: error?.details || "",
  }, requestHeaders);
}

function createError(message, details = "", statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

module.exports = {
  SERVICE_DEFINITIONS: buildRuntimeServices(),
  handleNodeApiRequest,
  handleWorkerRequest,
};

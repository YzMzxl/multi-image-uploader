const { getServerConfig } = require("./runtime-config");

const express = require("express");
const multer = require("multer");
const { handleNodeApiRequest } = require("./index");

const app = express();
const { port: PORT } = getServerConfig();
const PUBLIC_DIR = require("path").join(__dirname, "public");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024,
  },
});

app.use(express.static(PUBLIC_DIR, { index: "index.html" }));

app.options("/api/*", async (req, res) => {
  const descriptor = await handleNodeApiRequest(req);
  sendDescriptor(res, descriptor);
});

app.post("/api/*", upload.any(), async (req, res) => {
  const descriptor = await handleNodeApiRequest(req);
  sendDescriptor(res, descriptor);
});

app.all("/api/*", async (req, res) => {
  const descriptor = await handleNodeApiRequest(req);
  sendDescriptor(res, descriptor);
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running at http://127.0.0.1:${PORT}`);
});

function sendDescriptor(res, descriptor) {
  if (!descriptor) {
    res.status(404).json({
      code: 404,
      msg: "Route not found",
      details: "",
    });
    return;
  }

  for (const [key, value] of Object.entries(descriptor.headers || {})) {
    res.setHeader(key, value);
  }

  res.status(descriptor.status).send(descriptor.body);
}

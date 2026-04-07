const FIELD_CONFIG = [
  { key: "url", label: "URL" },
  { key: "markdown", label: "Markdown" },
  { key: "html", label: "HTML" },
  { key: "bbcode", label: "BBCode" },
];
const LOCAL_STORAGE_KEYS = {
  scdnSettings: "multi-image-uploader:scdn-settings",
};
const SCDN_OUTPUT_FORMAT_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "gif", label: "GIF" },
  { value: "webp_animated", label: "动图 WebP" },
];
const SCDN_CDN_DOMAIN_OPTIONS = [
  { value: "", label: "默认域名（img.scdn.io）" },
  { value: "cloudflareimg.cdn.sn", label: "cloudflareimg.cdn.sn" },
  { value: "edgeoneimg.cdn.sn", label: "edgeoneimg.cdn.sn" },
  { value: "esaimg.cdn1.vip", label: "esaimg.cdn1.vip" },
];

const PROJECT_REPO_URL = "https://github.com/YzMzxl/multi-image-uploader";

let SERVICES = [];

const state = {
  activeServiceId: "",
  autoCopyFormat: "url",
  toggles: {
    autoCopy: false,
    convertToWebp: false,
  },
  items: [],
  logs: [],
  uploadBusy: false,
  idSeed: 0,
  serviceSettings: {
    scdn: loadStoredScdnSettings(),
  },
};

const dom = {
  dockScroll: document.getElementById("dockScroll"),
  serviceTabs: document.getElementById("serviceTabs"),
  repoLink: document.getElementById("repoLink"),
  switchRail: document.getElementById("switchRail"),
  autoCopyFormatSwitch: document.getElementById("autoCopyFormatSwitch"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  pickBtn: document.getElementById("pickBtn"),
  clearBtn: document.getElementById("clearBtn"),
  activeServiceName: document.getElementById("activeServiceName"),
  activeServiceSupport: document.getElementById("activeServiceSupport"),
  queueSummary: document.getElementById("queueSummary"),
  queueList: document.getElementById("queueList"),
  emptyState: document.getElementById("emptyState"),
  serviceCard: document.getElementById("serviceCard"),
  serviceSettingsPanel: document.getElementById("serviceSettingsPanel"),
  autoCopyToggle: document.getElementById("autoCopyToggle"),
  webpToggle: document.getElementById("webpToggle"),
};

async function init() {
  try {
    SERVICES = await loadServices();
    if (!SERVICES.length) {
      throw new Error("接口配置为空");
    }

    state.activeServiceId = SERVICES[0].id;
    pushLog("页面骨架已就绪，等待图片进入队列。");
    pushLog("当前可用接口已完成加载。");

    bindEvents();
    render();
  } catch (error) {
    console.error(error);
    showServiceLoadError(error);
  }
}

async function loadServices() {
  const sources = ["/api/services", "./services.json"];
  let lastError = null;

  for (const source of sources) {
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`接口配置加载失败：HTTP ${response.status}`);
      }

      const services = await response.json();
      if (!Array.isArray(services)) {
        throw new Error("接口配置格式无效");
      }

      if (services.length) {
        return services;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("接口配置为空");
}

function showServiceLoadError(error) {
  const message = String(error?.message || error || "未知错误");
  dom.serviceTabs.innerHTML = "";
  dom.serviceCard.innerHTML = `<p class="service-note">接口配置加载失败：${escapeHtml(message)}</p>`;
  dom.serviceSettingsPanel.innerHTML = `<p class="service-note">接口设置面板不可用。</p>`;
  dom.activeServiceName.textContent = "加载失败";
  dom.activeServiceSupport.textContent = "-";
  dom.fileInput.accept = "image/*,video/*";
  dom.clearBtn.disabled = true;
  dom.repoLink.href = PROJECT_REPO_URL;
}

function bindEvents() {
  dom.serviceTabs.addEventListener("click", handleServiceTabClick);
  dom.autoCopyFormatSwitch.addEventListener("click", handleAutoCopyFormatClick);
  dom.queueList.addEventListener("click", handleQueueAction);
  dom.serviceSettingsPanel.addEventListener("input", handleServiceSettingsInput);
  dom.serviceSettingsPanel.addEventListener("change", handleServiceSettingsInput);
  dom.serviceSettingsPanel.addEventListener("click", handleServiceSettingsAction);
  dom.clearBtn.addEventListener("click", clearQueue);
  bindScrollbarReveal(dom.dockScroll);
  bindScrollbarReveal(dom.switchRail);
  bindScrollbarReveal(dom.autoCopyFormatSwitch);
  bindScrollbarReveal(dom.queueList);
  bindHorizontalWheelScroll(dom.dockScroll);
  bindHorizontalWheelScroll(dom.switchRail);
  bindHorizontalWheelScroll(dom.autoCopyFormatSwitch, { stopPropagation: true });

  dom.pickBtn.addEventListener("click", openFilePicker);
  dom.dropzone.addEventListener("click", openFilePicker);
  dom.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  });

  dom.fileInput.addEventListener("change", (event) => {
    addFiles(event.target.files);
    dom.fileInput.value = "";
  });

  dom.autoCopyToggle.addEventListener("change", (event) => {
    state.toggles.autoCopy = event.target.checked;
    renderAutoCopyFormatSwitch();
    pushLog(
      state.toggles.autoCopy
        ? `已开启自动复制，当前格式为 ${getFieldLabel(state.autoCopyFormat)}。`
        : "已关闭自动复制。",
    );
  });

  dom.webpToggle.addEventListener("change", (event) => {
    state.toggles.convertToWebp = event.target.checked;
    pushLog(state.toggles.convertToWebp ? "上传前转 WebP 已开启。" : "上传前转 WebP 已关闭。");
  });

  dom.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dom.dropzone.classList.add("is-dragover");
  });

  dom.dropzone.addEventListener("dragleave", () => {
    dom.dropzone.classList.remove("is-dragover");
  });

  dom.dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dom.dropzone.classList.remove("is-dragover");
    addFiles(event.dataTransfer.files);
  });

  window.addEventListener("paste", (event) => {
    const clipboardItems = [...(event.clipboardData?.items || [])];
    const files = clipboardItems
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (files.length) {
      addFiles(files);
      pushLog(`已从剪贴板读取 ${files.length} 张图片。`);
    }
  });
}

function render() {
  renderServiceTabs();
  renderAutoCopyFormatSwitch();
  renderServiceCard();
  renderServiceSettingsPanel();
  renderQueue();

  const activeService = getActiveService();
  if (!activeService) {
    dom.activeServiceName.textContent = "-";
    dom.activeServiceSupport.textContent = "-";
    dom.fileInput.accept = "image/*,video/*";
    dom.clearBtn.disabled = true;
    dom.emptyState.hidden = state.items.length > 0;
    dom.repoLink.href = PROJECT_REPO_URL;
    return;
  }

  dom.activeServiceName.textContent = activeService.name;
  dom.activeServiceSupport.textContent = formatAccepts(activeService.accepts);
  dom.fileInput.accept = (activeService.accepts || ["image/*"]).join(",");
  dom.clearBtn.disabled = state.uploadBusy || state.items.length === 0;
  dom.emptyState.hidden = state.items.length > 0;
  dom.repoLink.href = PROJECT_REPO_URL;
}

function renderServiceTabs() {
  if (!SERVICES.length) {
    dom.serviceTabs.innerHTML = "";
    return;
  }

  dom.serviceTabs.innerHTML = SERVICES.map((service) => {
    const activeClass = service.id === state.activeServiceId ? "is-active" : "";
    return `
      <button
        class="service-tab ${activeClass}"
        type="button"
        data-service-id="${service.id}"
        style="--service-accent: ${service.accent}"
        role="tab"
        aria-selected="${service.id === state.activeServiceId}"
      >
        <strong>${escapeHtml(service.name)}</strong>
        <span>${escapeHtml(service.subtitle)}</span>
      </button>
    `;
  }).join("");
}

function renderAutoCopyFormatSwitch() {
  dom.autoCopyFormatSwitch.innerHTML = FIELD_CONFIG.map((field) => {
    const activeClass = state.autoCopyFormat === field.key ? "is-active" : "";
    return `
      <button class="${activeClass}" type="button" data-format="${field.key}" role="tab" aria-selected="${state.autoCopyFormat === field.key}">
        ${field.label}
      </button>
    `;
  }).join("");

  dom.autoCopyFormatSwitch.classList.toggle("is-disabled", !state.toggles.autoCopy);
}

function renderServiceCard() {
  const service = getActiveService();
  if (!service) {
    dom.serviceCard.innerHTML = `<p class="service-note">接口配置尚未加载。</p>`;
    return;
  }

  dom.serviceCard.innerHTML = `
    <div class="service-card-head">
      <div>
        <span class="eyebrow">当前接口</span>
        <h3>${escapeHtml(service.name)}</h3>
      </div>
      <span class="service-badge" style="background: ${hexToSoftRgba(service.accent, 0.12)}; color: ${service.accent};">
        ${escapeHtml(service.mode)}
      </span>
    </div>
    <div class="service-summary">${escapeHtml(service.summary)}</div>
    <dl class="service-grid">
      <div class="service-row">
        <dt>请求方式</dt>
        <dd>${escapeHtml(service.method)}</dd>
      </div>
      <div class="service-row">
        <dt>接口地址</dt>
        <dd>${escapeHtml(service.endpoint)}</dd>
      </div>
      <div class="service-row">
        <dt>鉴权方式</dt>
        <dd>${escapeHtml(service.auth)}</dd>
      </div>
      <div class="service-row">
        <dt>上传字段</dt>
        <dd>${escapeHtml(service.fileField)}</dd>
      </div>
      <div class="service-row">
        <dt>返回映射</dt>
        <dd>${escapeHtml(service.successPath)}</dd>
      </div>
    </dl>
    <p class="service-note">${escapeHtml(service.note)}</p>
  `;
}

function renderServiceSettingsPanel() {
  const service = getActiveService();
  if (!service) {
    dom.serviceSettingsPanel.innerHTML = `<p class="service-note">接口设置尚未加载。</p>`;
    return;
  }

  if (service.id !== "scdn") {
    dom.serviceSettingsPanel.innerHTML = `<p class="service-note">当前接口没有额外的可视化设置项。</p>`;
    return;
  }

  const settings = state.serviceSettings.scdn;
  dom.serviceSettingsPanel.innerHTML = `
    <div class="service-card-head">
      <div>
        <span class="eyebrow">SCDN</span>
        <h3>上传参数</h3>
      </div>
      <button class="mini-btn" type="button" data-action="reset-scdn-settings">恢复默认</button>
    </div>
    <div class="service-summary">这些设置只保存在当前浏览器，并会随上传请求发送到代理服务，不写入 .env。</div>
    <div class="settings-grid">
      <label class="settings-field">
        <span class="settings-label">输出格式</span>
        <select data-scdn-field="outputFormat">
          ${SCDN_OUTPUT_FORMAT_OPTIONS.map((option) => `
            <option value="${escapeAttr(option.value)}" ${option.value === settings.outputFormat ? "selected" : ""}>
              ${escapeHtml(option.label)}
            </option>
          `).join("")}
        </select>
        <small class="settings-help">支持 auto、jpeg、png、webp、gif、webp_animated。</small>
      </label>

      <div class="settings-field">
        <span class="settings-label">密码保护</span>
        <label class="toggle">
          <input type="checkbox" data-scdn-field="passwordEnabled" ${settings.passwordEnabled ? "checked" : ""} />
          <span class="toggle-ui" aria-hidden="true"></span>
          <span class="toggle-text">启用图片访问密码</span>
        </label>
        <small class="settings-help">开启后，图片访问前需要输入密码。</small>
      </div>

      <label class="settings-field">
        <span class="settings-label">图片密码</span>
        <input
          type="text"
          data-scdn-field="imagePassword"
          value="${escapeAttr(settings.imagePassword)}"
          placeholder="开启密码保护后必填"
          ${settings.passwordEnabled ? "" : "disabled"}
        />
        <small class="settings-help">密码会随当前上传请求一起提交。</small>
      </label>

      <label class="settings-field">
        <span class="settings-label">CDN 域名</span>
        <select data-scdn-field="cdnDomain">
          ${SCDN_CDN_DOMAIN_OPTIONS.map((option) => `
            <option value="${escapeAttr(option.value)}" ${option.value === settings.cdnDomain ? "selected" : ""}>
              ${escapeHtml(option.label)}
            </option>
          `).join("")}
        </select>
        <small class="settings-help">留空表示使用 SCDN 默认返回域名。</small>
      </label>
    </div>
    <p class="service-note">设置修改后即时生效，无需重启本地服务。</p>
  `;
}

function renderQueue() {
  if (!state.items.length) {
    dom.queueList.innerHTML = "";
    dom.queueSummary.textContent = "暂无文件";
    return;
  }

  const total = state.items.length;
  const done = state.items.filter((item) => item.status === "done").length;
  const working = state.items.filter((item) => item.status === "uploading" || item.status === "preparing").length;
  const queued = state.items.filter((item) => item.status === "queued").length;
  const failed = state.items.filter((item) => item.status === "error").length;
  dom.queueSummary.textContent = `${total} 个文件 · ${done} 已完成 · ${working} 处理中 · ${queued} 排队中 · ${failed} 失败`;

  dom.queueList.innerHTML = state.items.map((item) => renderQueueItem(item)).join("");
}

function renderQueueItem(item) {
  const service = getServiceById(item.serviceId);
  const statusText = getStatusText(item.status);
  const previewMarkup = isVideoItem(item)
    ? `<video src="${escapeAttr(item.previewUrl)}" muted playsinline preload="metadata"></video>`
    : `<img src="${escapeAttr(item.previewUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" />`;
  const outputMarkup = item.outputs
    ? FIELD_CONFIG.map((field) => `
        <div class="output-row">
          <label>${field.label}</label>
          <input readonly value="${escapeAttr(item.outputs[field.key])}" />
          <button class="copy-btn" type="button" data-action="copy" data-id="${item.id}" data-field="${field.key}">
            复制
          </button>
        </div>
      `).join("")
    : "";

  return `
    <article class="queue-item" data-item-id="${item.id}">
      <div class="thumb-box">
        ${previewMarkup}
        <span class="thumb-tag">${escapeHtml(service.name)}</span>
      </div>
      <div class="item-main">
        <div class="item-top">
          <div>
            <h3>${escapeHtml(item.name)}</h3>
            <div class="item-meta">
              <span class="meta-pill">${formatBytes(item.originalSize)}</span>
              <span class="meta-pill">${escapeHtml(item.finalName || item.name)}</span>
              <span class="status-pill is-${item.status}">${statusText}</span>
            </div>
          </div>
          <div class="item-actions">
            <button class="mini-btn" type="button" data-action="preview" data-id="${item.id}">
              预览
            </button>
          </div>
        </div>

        <div class="item-progress-caption">
          <span>${escapeHtml(item.statusHint)}</span>
          <span>${Math.round(item.progress)}%</span>
        </div>
        <div class="item-progress">
          <div class="item-progress-bar" style="width: ${Math.max(0, Math.min(100, item.progress))}%"></div>
        </div>

        ${item.error ? `<div class="error-text">${escapeHtml(item.error)}</div>` : ""}

        ${item.outputs ? `<div class="output-grid">${outputMarkup}</div>` : ""}
      </div>
    </article>
  `;
}

function renderProgress() {
  return;
}

function renderActivity() {
  return;
}

function handleServiceTabClick(event) {
  const button = event.target.closest("[data-service-id]");
  if (!button) return;

  const nextServiceId = button.dataset.serviceId;
  if (nextServiceId === state.activeServiceId) return;

  state.activeServiceId = nextServiceId;
  pushLog(`已切换到 ${getActiveService().name}。`);
  render();
}

function handleAutoCopyFormatClick(event) {
  const button = event.target.closest("[data-format]");
  if (!button) return;

  state.autoCopyFormat = button.dataset.format;
  pushLog(`自动复制格式切换为 ${button.textContent.trim()}。`);
  renderAutoCopyFormatSwitch();
}

function handleQueueAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const { action, id, field } = button.dataset;
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return;

  if (action === "preview") {
    window.open(item.outputs?.url || item.previewUrl, "_blank", "noopener,noreferrer");
    return;
  }

  if (action === "copy" && item.outputs?.[field]) {
    copyText(item.outputs[field], `已复制 ${field.toUpperCase()}。`);
  }
}

function handleServiceSettingsInput(event) {
  const service = getActiveService();
  if (!service || service.id !== "scdn") {
    return;
  }

  const field = event.target.dataset.scdnField;
  if (!field) {
    return;
  }

  const nextSettings = {
    ...state.serviceSettings.scdn,
  };

  switch (field) {
    case "outputFormat":
      nextSettings.outputFormat = sanitizeScdnOutputFormat(event.target.value);
      break;
    case "passwordEnabled":
      nextSettings.passwordEnabled = event.target.checked;
      break;
    case "imagePassword":
      nextSettings.imagePassword = String(event.target.value || "").trim();
      break;
    case "cdnDomain":
      nextSettings.cdnDomain = sanitizeScdnCdnDomain(event.target.value);
      break;
    default:
      return;
  }

  state.serviceSettings.scdn = sanitizeScdnSettings(nextSettings);
  persistScdnSettings();
  renderServiceSettingsPanel();
}

function handleServiceSettingsAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  if (button.dataset.action === "reset-scdn-settings") {
    state.serviceSettings.scdn = createDefaultScdnSettings();
    persistScdnSettings();
    renderServiceSettingsPanel();
    pushLog("已恢复 SCDN 默认设置。");
  }
}

function openFilePicker() {
  dom.fileInput.click();
}

function addFiles(fileList) {
  const files = [...fileList].filter(Boolean);
  if (!files.length) return;

  const service = getActiveService();
  const serviceId = state.activeServiceId;
  let queuedCount = 0;
  let rejectedCount = 0;

  files.forEach((file) => {
    const validationError = validateFileForService(service, file);
    const baseItem = {
      id: createId(),
      serviceId,
      file,
      name: file.name,
      originalSize: file.size,
      previewUrl: URL.createObjectURL(file),
      outputs: null,
      finalName: "",
      error: "",
    };

    if (validationError) {
      rejectedCount += 1;
      state.items.push({
        ...baseItem,
        status: "error",
        statusHint: "文件不符合当前接口限制",
        progress: 0,
        error: validationError,
      });
      return;
    }

    queuedCount += 1;
    state.items.push({
      ...baseItem,
      status: "queued",
      statusHint: service.uploadMode === "real" ? "等待上传" : "等待演示上传",
      progress: 0,
    });
  });

  if (queuedCount) {
    pushLog(`已加入 ${queuedCount} 个文件，当前接口为 ${getServiceById(serviceId).name}。`);
  }
  if (rejectedCount) {
    pushLog(`有 ${rejectedCount} 个文件未通过当前接口校验。`);
  }
  render();
  pumpQueue();
}

async function pumpQueue() {
  if (state.uploadBusy) return;

  const nextItem = state.items.find((item) => item.status === "queued");
  if (!nextItem) return;

  state.uploadBusy = true;
  render();

  try {
    await processItem(nextItem);
  } finally {
    state.uploadBusy = false;
    render();
    if (state.items.some((item) => item.status === "queued")) {
      pumpQueue();
    }
  }
}

async function processItem(item) {
  const service = getServiceById(item.serviceId);
  item.status = "preparing";
  item.progress = 6;
  item.statusHint = service.uploadMode === "real" ? "准备上传" : "准备演示上传";
  render();

  try {
    let workingFile = item.file;
    if (state.toggles.convertToWebp) {
      const converted = await maybeConvertToWebp(item.file);
      if (converted) {
        workingFile = converted;
        pushLog(`已将 ${item.name} 转为 WebP。`);
      }
    }

    item.status = "uploading";
    item.statusHint = `正在上传到 ${service.name}`;
    render();

    const uploadResult = service.uploadMode === "real"
      ? await uploadViaService(item, workingFile, service)
      : await uploadViaDemo(item, workingFile, service);

    item.finalName = uploadResult.finalName;
    item.progress = 100;
    item.status = "done";
    item.error = "";
    item.statusHint = uploadResult.isDemo ? "演示结果已生成" : "上传完成";
    item.outputs = buildOutputs(uploadResult.remoteUrl, uploadResult.finalName, item.file.type);

    pushLog(
      uploadResult.isDemo
        ? `${service.name} 已生成 ${uploadResult.finalName} 的演示链接。`
        : `${service.name} 已完成 ${uploadResult.finalName} 上传。`,
    );
    render();

    if (state.toggles.autoCopy) {
      await copyText(
        item.outputs[state.autoCopyFormat],
        `已自动复制 ${getFieldLabel(state.autoCopyFormat)}。`,
      );
    }
  } catch (error) {
    item.status = "error";
    item.progress = 0;
    item.statusHint = "上传失败";
    item.error = String(error.message || error);
    pushLog(`${service.name} 上传失败：${item.error}`);
    render();
  }
}

async function uploadViaDemo(item, workingFile, service) {
  await simulateUpload(item);
  const finalName = workingFile.name;
  return {
    remoteUrl: buildMockUrl(service, finalName),
    finalName,
    isDemo: true,
  };
}

function simulateUpload(item) {
  return new Promise((resolve) => {
    const duration = Math.min(2600, Math.max(1200, 900 + item.originalSize / 650));
    const interval = 90;
    const steps = Math.ceil(duration / interval);
    let step = 0;

    const timer = setInterval(() => {
      step += 1;
      const ratio = step / steps;
      const eased = ratio < 0.88 ? ratio * 92 : 92 + ((ratio - 0.88) / 0.12) * 8;
      item.progress = Math.min(100, eased);
      item.statusHint = `正在演示上传 ${Math.round(item.progress)}%`;
      renderProgress();
      renderQueue();

      if (step >= steps) {
        clearInterval(timer);
        resolve();
      }
    }, interval);
  });
}

function uploadViaService(item, file, service) {
  const requestFileName = buildRequestFileName(service, file);

  item.progress = Math.max(item.progress, 18);
  item.statusHint = "正在构造上传请求";
  renderProgress();
  renderQueue();

  const formData = new FormData();
  appendServiceFormFields(formData, service, requestFileName);
  formData.append(service.fileField, file, requestFileName);

  item.progress = Math.max(item.progress, 42);
  item.statusHint = "正在发送请求";
  renderProgress();
  renderQueue();

  return fetch(service.endpoint, {
    method: service.method,
    body: formData,
  })
    .then(async (response) => {
      item.progress = Math.max(item.progress, 76);
      item.statusHint = "正在解析接口响应";
      renderProgress();
      renderQueue();

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, "", response.status));
      }

      if (!isServiceResponseSuccessful(payload, service)) {
        throw new Error(extractErrorMessage(payload, "", response.status) || "接口返回失败");
      }

      const urlPath = readByPath(payload, service.successPath);
      if (!urlPath) {
        throw new Error(`接口响应缺少 ${service.successPath}`);
      }

      const remoteUrl = normalizeServiceUrl(joinUploadUrl(service.resultBaseUrl, urlPath), service);
      return {
        remoteUrl,
        finalName: extractFileName(remoteUrl) || requestFileName,
        isDemo: false,
      };
    })
    .catch((error) => {
      if (error instanceof TypeError) {
        throw new Error("网络错误、跨域被拦截或接口不可达");
      }
      throw error;
    });
}

async function maybeConvertToWebp(file) {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  try {
    const image = await loadImageFromFile(file);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.86);
    });

    if (!blob) {
      return null;
    }

    return new File([blob], replaceExtension(file.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch (error) {
    pushLog(`WebP 转换失败，已保留原文件：${file.name}`);
    return null;
  }
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("图片读取失败"));
    };
    image.src = objectUrl;
  });
}

function clearQueue() {
  if (state.uploadBusy) {
    return;
  }

  state.items.forEach((item) => {
    URL.revokeObjectURL(item.previewUrl);
  });
  state.items = [];
  pushLog("已清空上传队列。");
  render();
}

function bindHorizontalWheelScroll(element, options = {}) {
  const { stopPropagation = false } = options;

  element.addEventListener("wheel", (event) => {
    if (element.scrollWidth <= element.clientWidth) {
      return;
    }

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) {
      return;
    }

    event.preventDefault();
    if (stopPropagation) {
      event.stopPropagation();
    }
    element.scrollLeft += delta;
  }, { passive: false });
}

function bindScrollbarReveal(element) {
  let hideTimer = null;

  element.addEventListener("scroll", () => {
    element.classList.add("is-scroll-active");
    if (hideTimer) {
      clearTimeout(hideTimer);
    }
    hideTimer = setTimeout(() => {
      element.classList.remove("is-scroll-active");
    }, 520);
  }, { passive: true });
}

async function copyText(text, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    pushLog(successMessage);
  } catch (error) {
    pushLog("复制失败，请手动复制。");
  }
}

function getActiveService() {
  return getServiceById(state.activeServiceId);
}

function getServiceById(id) {
  return SERVICES.find((service) => service.id === id) || SERVICES[0] || null;
}

function createDefaultScdnSettings() {
  return {
    outputFormat: "auto",
    passwordEnabled: false,
    imagePassword: "",
    cdnDomain: "",
  };
}

function loadStoredScdnSettings() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.scdnSettings);
    if (!raw) {
      return createDefaultScdnSettings();
    }

    const parsed = JSON.parse(raw);
    return sanitizeScdnSettings(parsed);
  } catch (error) {
    return createDefaultScdnSettings();
  }
}

function persistScdnSettings() {
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.scdnSettings,
      JSON.stringify(state.serviceSettings.scdn),
    );
  } catch (error) {
    return;
  }
}

function sanitizeScdnSettings(value) {
  const nextValue = value && typeof value === "object" ? value : {};
  return {
    outputFormat: sanitizeScdnOutputFormat(nextValue.outputFormat),
    passwordEnabled: Boolean(nextValue.passwordEnabled),
    imagePassword: String(nextValue.imagePassword || "").trim(),
    cdnDomain: sanitizeScdnCdnDomain(nextValue.cdnDomain),
  };
}

function sanitizeScdnOutputFormat(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return SCDN_OUTPUT_FORMAT_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "auto";
}

function sanitizeScdnCdnDomain(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "img.scdn.io") {
    return "";
  }

  return SCDN_CDN_DOMAIN_OPTIONS.some((option) => option.value === normalized)
    ? normalized
    : "";
}

function buildAdapterStub(service) {
  if (service.uploadMode === "real") {
    return `const service = {
  endpoint: "${service.endpoint}",
  method: "${service.method}",
  fileField: "${service.fileField}",
  responsePath: "${service.successPath}",
  resultBaseUrl: "${service.resultBaseUrl}"
};

async function uploadAdapter(file) {
  const formData = new FormData();
  formData.append(service.fileField, file);

  const response = await fetch(service.endpoint, {
    method: service.method,
    body: formData
  });

  const data = await response.json();
  const url = service.responsePath.split(".").reduce((value, key) => value?.[key], data);
  if (!url) {
    throw new Error("Upload response path is missing.");
  }
  if (/^https?:\\/\\//i.test(url)) {
    return url;
  }
  if (!service.resultBaseUrl) {
    return url;
  }
  return url.startsWith("/") ? service.resultBaseUrl + url : service.resultBaseUrl + "/" + url;
}
`;
  }

  return `const service = {
  id: "${service.id}",
  endpoint: "${service.endpoint}",
  method: "${service.method}",
  auth: "${service.auth}",
  fileField: "${service.fileField}",
  successPath: "${service.successPath}"
};

async function uploadAdapter(file) {
  // 后续把这里替换成真实 fetch / XHR 即可
  // formData.append(service.fileField, file)
  // return remoteUrl
}
`;
}

function buildMockUrl(service, fileName) {
  const now = new Date();
  const folder = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("/");
  const safeName = encodeURIComponent(fileName);
  return `https://${service.demoHost}/${folder}/${safeName}`;
}

function buildOutputs(remoteUrl, finalName, mimeType = "") {
  const safeAlt = fileStem(finalName);
  const isVideo = mimeType.startsWith("video/") || isVideoFileName(finalName);
  return {
    url: remoteUrl,
    markdown: isVideo ? `[${safeAlt}](${remoteUrl})` : `![${safeAlt}](${remoteUrl})`,
    html: isVideo
      ? `<video src="${remoteUrl}" controls playsinline></video>`
      : `<img src="${remoteUrl}" alt="${safeAlt}">`,
    bbcode: isVideo ? `[url]${remoteUrl}[/url]` : `[img]${remoteUrl}[/img]`,
  };
}

function buildGeneratedName(name) {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "")
    .replace("T", "-");
  const extension = name.includes(".") ? name.split(".").pop() : "png";
  return `img-${timestamp}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
}

function buildRequestFileName(_service, file) {
  return file.name;
}

function appendServiceFormFields(formData, service, requestFileName) {
  if (service.requestNameField) {
    formData.append(service.requestNameField, requestFileName);
  }

  if (service.id === "scdn") {
    const settings = state.serviceSettings.scdn;
    formData.append("outputFormat", settings.outputFormat);

    if (settings.passwordEnabled) {
      formData.append("password_enabled", "true");
      formData.append("image_password", settings.imagePassword);
    }

    if (settings.cdnDomain) {
      formData.append("cdn_domain", settings.cdnDomain);
    }
  }
}

function replaceExtension(name, nextExtension) {
  const parts = name.split(".");
  if (parts.length === 1) {
    return `${name}.${nextExtension}`;
  }
  parts.pop();
  return `${parts.join(".")}.${nextExtension}`;
}

function fileStem(name) {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(0, index) : name;
}

function extractFileName(url) {
  try {
    const cleanUrl = String(url).split("?")[0];
    return decodeURIComponent(cleanUrl.slice(cleanUrl.lastIndexOf("/") + 1));
  } catch (error) {
    return "";
  }
}

function formatBytes(value) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** power;
  return `${size.toFixed(size >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function getStatusText(status) {
  switch (status) {
    case "queued":
      return "排队中";
    case "preparing":
      return "预处理中";
    case "uploading":
      return "上传中";
    case "done":
      return "已完成";
    case "error":
      return "失败";
    default:
      return "未知";
  }
}

function getFieldLabel(fieldKey) {
  return FIELD_CONFIG.find((field) => field.key === fieldKey)?.label || fieldKey;
}

function createId() {
  state.idSeed += 1;
  return `file-${Date.now()}-${state.idSeed}`;
}

function validateFileForService(service, file) {
  const accepts = service.accepts || ["image/*"];
  const matches = accepts.some((pattern) => matchesAcceptPattern(file, pattern));
  if (!matches) {
    return "当前接口仅支持图片或视频文件。";
  }

  if (service.maxFileSizeBytes && file.size > service.maxFileSizeBytes) {
    return `文件超出大小限制，当前接口最大支持 ${formatBytes(service.maxFileSizeBytes)}。`;
  }

  if (service.id === "scdn") {
    const settings = state.serviceSettings.scdn;
    if (settings.passwordEnabled && !settings.imagePassword) {
      return "SCDN 已开启密码保护，请先填写图片密码。";
    }
  }

  return "";
}

function matchesAcceptPattern(file, pattern) {
  if (!pattern) return false;
  if (pattern === "*/*") return true;
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, pattern.length - 1);
    return file.type.startsWith(prefix);
  }
  if (pattern.startsWith(".")) {
    return file.name.toLowerCase().endsWith(pattern.toLowerCase());
  }
  return file.type === pattern;
}

function isVideoItem(item) {
  return item.file.type.startsWith("video/") || isVideoFileName(item.finalName || item.name);
}

function isVideoFileName(name) {
  return /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(name);
}

function pushLog(text) {
  state.logs.unshift({
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
    text,
  });
  state.logs = state.logs.slice(0, 20);
  renderActivity();
}

function hexToSoftRgba(hex, alpha) {
  const value = hex.replace("#", "");
  const normalized = value.length === 3
    ? value.split("").map((char) => char + char).join("")
    : value;
  const bigint = parseInt(normalized, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function tryParseJson(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

function readByPath(object, path) {
  if (!object || !path) return "";
  return path.split(".").reduce((value, key) => value?.[key], object) || "";
}

function joinUploadUrl(baseUrl, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  if (path.startsWith("/")) return `${baseUrl}${path}`;
  return `${baseUrl}/${path}`;
}

function isServiceResponseSuccessful(payload, service) {
  if (!service.successFlagPath) {
    return true;
  }
  return readByPath(payload, service.successFlagPath) === service.successFlagValue;
}

function normalizeServiceUrl(url, service) {
  if (!url) {
    return "";
  }
  if (service.forceHttps) {
    return String(url).replace(/^http:\/\//i, "https://");
  }
  return String(url);
}

function formatAccepts(accepts = []) {
  const hasImage = accepts.some((pattern) => pattern.startsWith("image/"));
  const hasVideo = accepts.some((pattern) => pattern.startsWith("video/"));
  if (hasImage && hasVideo) {
    return "图片 / 视频";
  }
  if (hasImage) {
    return "图片";
  }
  if (hasVideo) {
    return "视频";
  }
  return "文件";
}

function extractErrorMessage(payload, responseText, status) {
  if (payload && typeof payload === "object") {
    const knownMessage = payload.message || payload.msg || payload.error || payload.details || readByPath(payload, "error.message");
    if (knownMessage) {
      return String(knownMessage);
    }
  }

  if (responseText) {
    return String(responseText).slice(0, 180);
  }

  return `HTTP ${status}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("\n", "&#10;");
}

window.addEventListener("beforeunload", () => {
  state.items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
});

init();

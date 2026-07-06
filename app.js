const categories = window.exerciseCategories;
const tags = window.exerciseTags;
const exercises = window.exerciseDatabase;

const state = {
  category: "全部",
  tags: new Set(),
  selected: new Map()
};

const grid = document.querySelector("#exerciseGrid");
const libraryCount = document.querySelector("#libraryCount");
const categoryFilters = document.querySelector("#categoryFilters");
const tagFilters = document.querySelector("#tagFilters");
const searchInput = document.querySelector("#searchInput");
const selectedList = document.querySelector("#selectedList");
const emptyState = document.querySelector("#emptyState");
const downloadPdfBtn = document.querySelector("#downloadPdfBtn");
const mobileDownloadPdfBtn = document.querySelector("#mobileDownloadPdfBtn");
const downloadStatus = document.querySelector("#downloadStatus");

const clientName = document.querySelector("#clientName");
const prescriptionDate = document.querySelector("#prescriptionDate");
const therapistName = document.querySelector("#therapistName");
const goalSelect = document.querySelector("#goalSelect");

const today = new Date().toISOString().slice(0, 10);
prescriptionDate.value = today;

const PDF_PAGE_WIDTH = 1240;
const PDF_PAGE_HEIGHT = 1754;
const PDF_SCALE = 2;

let isDownloadingPdf = false;

function initFilters() {
  categoryFilters.innerHTML = categories.map(category => (
    `<button class="segment-button ${category === state.category ? "active" : ""}" data-category="${category}" type="button">${category}</button>`
  )).join("");

  tagFilters.innerHTML = tags.map(tag => (
    `<label class="check-pill"><input type="checkbox" value="${tag}" ${state.tags.has(tag) ? "checked" : ""} />${tag}</label>`
  )).join("");
}

function filteredExercises() {
  const term = searchInput.value.trim().toLowerCase();
  return exercises.filter(exercise => {
    const categoryMatch = state.category === "全部" || exercise.category === state.category;
    const tagMatch = state.tags.size === 0 || [...state.tags].every(tag => exercise.tags.includes(tag));
    const haystack = `${exercise.name} ${exercise.category} ${exercise.tags.join(" ")} ${exercise.description} ${exercise.steps}`.toLowerCase();
    return categoryMatch && tagMatch && haystack.includes(term);
  });
}

function renderExercises() {
  const visible = filteredExercises();
  libraryCount.textContent = `${visible.length} 個項目`;
  grid.innerHTML = visible.map(exercise => {
    const selected = state.selected.get(exercise.id);
    return `
      <article class="exercise-card ${selected ? "selected" : ""}">
        <div class="exercise-visual">
          <img src="${exercise.image}" alt="${exercise.name}示意圖" loading="lazy" />
        </div>
        <div class="exercise-body">
          <h3>${exercise.name}</h3>
          <p>${exercise.description}</p>
          <div class="exercise-meta">
            <span class="tag">${exercise.category}</span>
            ${exercise.tags.slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join("")}
          </div>
          <div class="card-actions">
            <label><input type="checkbox" data-select="${exercise.id}" ${selected ? "checked" : ""} />加入處方箋</label>
          </div>
          <div class="dose-inputs">
            <label>次數<input data-dose="reps" data-id="${exercise.id}" value="${selected?.reps || exercise.defaultReps}" /></label>
            <label>組數<input data-dose="sets" data-id="${exercise.id}" value="${selected?.sets || exercise.defaultSets}" /></label>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function prescriptionItems() {
  return [...state.selected.values()];
}

function renderPreview() {
  document.querySelector("#previewClient").textContent = clientName.value || "未填寫";
  document.querySelector("#previewDate").textContent = prescriptionDate.value || "-";
  document.querySelector("#previewTherapist").textContent = therapistName.value || "未填寫";
  document.querySelector("#previewGoal").textContent = goalSelect.value;

  const items = prescriptionItems();
  emptyState.hidden = items.length > 0;
  selectedList.innerHTML = items.map((item, index) => `
    <section class="rx-item">
      <img src="${item.image}" alt="${item.name}示意圖" />
      <div>
        <h3>${index + 1}. ${item.name}</h3>
        <p>${item.steps}</p>
        <div class="rx-dose">
          <span>次數：${item.reps}</span>
          <span>組數：${item.sets}</span>
          <span>頻率：每週 3-5 天</span>
        </div>
        <p>注意事項：${item.caution}</p>
      </div>
    </section>
  `).join("");
}

function upsertSelection(id, patch = {}) {
  const exercise = exercises.find(item => item.id === id);
  if (!exercise) return;
  const current = state.selected.get(id) || {
    ...exercise,
    reps: exercise.defaultReps,
    sets: exercise.defaultSets
  };
  state.selected.set(id, { ...current, ...patch });
}

function textPrescription() {
  const lines = [
    "居家復健復能處方箋",
    `個案：${clientName.value || "未填寫"}`,
    `日期：${prescriptionDate.value || "-"}`,
    `治療師：${therapistName.value || "未填寫"}`,
    `主要目標：${goalSelect.value}`,
    "",
    "處方內容："
  ];

  prescriptionItems().forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`   說明：${item.steps}`);
    lines.push(`   劑量：${item.reps}，${item.sets}，每週 3-5 天`);
    lines.push(`   注意事項：${item.caution}`);
  });

  lines.push("");
  lines.push("安全提醒：動作過程若出現胸悶、暈眩、明顯疼痛、呼吸困難或不穩跌倒風險，請立即停止並聯絡治療師或醫療人員。");
  return lines.join("\n");
}

function safeFileName(value) {
  return (value || "未命名").replace(/[\\/:*?"<>|]/g, "-").trim() || "未命名";
}

function triggerBlobDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    anchor.remove();
  }, 60000);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-999px";
  textarea.style.left = "-999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

function prefersShareSheet() {
  return Boolean(navigator.share) && (window.matchMedia("(max-width: 760px)").matches || navigator.maxTouchPoints > 0);
}

async function shareOrCopyTextPrescription() {
  const text = textPrescription();
  const title = "居家復健復能處方箋";

  if (prefersShareSheet()) {
    try {
      await copyText(text);
      await navigator.share({ title, text });
      setDownloadStatus("文字已複製並開啟分享", "success");
      return;
    } catch (error) {
      if (error.name === "AbortError") {
        setDownloadStatus("文字已複製", "success");
        return;
      }
    }
  }

  try {
    await copyText(text);
    setDownloadStatus("文字已複製", "success");
  } catch (error) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    triggerBlobDownload(blob, `復健復能處方箋-${safeFileName(clientName.value)}.txt`);
    setDownloadStatus("文字檔已送出下載", "success");
  }
}

function setDownloadStatus(message, type = "info") {
  if (!downloadStatus) return;
  downloadStatus.textContent = message;
  downloadStatus.dataset.type = type;
}

function nextFrame() {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => resolve());
  });
}

function wrapText(ctx, text, maxWidth) {
  const lines = [];
  let current = "";
  for (const char of text) {
    const next = current + char;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
  const lines = wrapText(ctx, text, maxWidth).slice(0, maxLines);
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
  return y + lines.length * lineHeight;
}

function loadImage(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function drawContainedImage(ctx, image, x, y, width, height) {
  ctx.fillStyle = "#f1f6f3";
  ctx.fillRect(x, y, width, height);
  if (!image) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function canEmbedImagesInPdf() {
  return window.location.protocol !== "file:";
}

function makePageCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = PDF_PAGE_WIDTH * PDF_SCALE;
  canvas.height = PDF_PAGE_HEIGHT * PDF_SCALE;
  return canvas;
}

function newPdfPage() {
  const canvas = makePageCanvas();
  const ctx = canvas.getContext("2d");
  ctx.scale(PDF_SCALE, PDF_SCALE);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT);
  ctx.fillStyle = "#1c2730";
  ctx.textBaseline = "top";
  return { canvas, ctx };
}

function drawPdfHeader(ctx) {
  ctx.fillStyle = "#0f766e";
  ctx.font = "700 24px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  ctx.fillText("Home Program", 72, 64);
  ctx.fillStyle = "#1c2730";
  ctx.font = "800 46px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  ctx.fillText("居家復健復能處方箋", 72, 100);
  ctx.fillStyle = "#0f766e";
  ctx.fillRect(72, 178, 1096, 6);

  ctx.fillStyle = "#0f766e";
  ctx.fillRect(1060, 72, 88, 88);
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 42px Georgia, serif";
  ctx.fillText("Rx", 1080, 96);
}

function drawMetaBox(ctx, label, value, x, y, width) {
  ctx.fillStyle = "#f7faf8";
  ctx.strokeStyle = "#d9e2e4";
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, width, 76);
  ctx.strokeRect(x, y, width, 76);
  ctx.fillStyle = "#60717d";
  ctx.font = "800 18px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  ctx.fillText(label, x + 18, y + 12);
  ctx.fillStyle = "#1c2730";
  ctx.font = "800 24px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  drawWrappedText(ctx, value, x + 18, y + 38, width - 36, 28, 1);
}

function drawPdfMeta(ctx) {
  const values = [
    ["個案", clientName.value || "未填寫"],
    ["日期", prescriptionDate.value || "-"],
    ["治療師", therapistName.value || "未填寫"],
    ["目標", goalSelect.value]
  ];
  drawMetaBox(ctx, values[0][0], values[0][1], 72, 220, 520);
  drawMetaBox(ctx, values[1][0], values[1][1], 620, 220, 548);
  drawMetaBox(ctx, values[2][0], values[2][1], 72, 316, 520);
  drawMetaBox(ctx, values[3][0], values[3][1], 620, 316, 548);
}

function canvasToJpegBinary(canvas) {
  const dataUrl = canvas.toDataURL("image/jpeg", 0.96);
  const binary = atob(dataUrl.split(",")[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBinaryString(bytes) {
  let result = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return result;
}

function buildPdfFromCanvases(canvases) {
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const pageCount = canvases.length;
  const imageStart = 1;
  const contentStart = imageStart + pageCount;
  const pageStart = contentStart + pageCount;
  const pagesObjectNumber = pageStart + pageCount;
  const catalogObjectNumber = pagesObjectNumber + 1;
  const objects = new Array(catalogObjectNumber);

  canvases.forEach((canvas, index) => {
    const imageObjectNumber = imageStart + index;
    const contentObjectNumber = contentStart + index;
    const pageObjectNumber = pageStart + index;
    const imageBytes = canvasToJpegBinary(canvas);
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im${imageObjectNumber} Do\nQ`;

    objects[imageObjectNumber - 1] = `<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n${bytesToBinaryString(imageBytes)}\nendstream`;
    objects[contentObjectNumber - 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objects[pageObjectNumber - 1] = `<< /Type /Page /Parent ${pagesObjectNumber} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${imageObjectNumber} ${imageObjectNumber} 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
  });

  const kids = Array.from({ length: pageCount }, (_, index) => `${pageStart + index} 0 R`).join(" ");
  objects[pagesObjectNumber - 1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`;
  objects[catalogObjectNumber - 1] = `<< /Type /Catalog /Pages ${pagesObjectNumber} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObjectNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: "application/pdf" });
}

async function createPrescriptionPdfBlob(options = {}) {
  const includeImages = options.includeImages ?? canEmbedImagesInPdf();
  const items = prescriptionItems();
  const pages = [];
  let { canvas, ctx } = newPdfPage();
  drawPdfHeader(ctx);
  drawPdfMeta(ctx);

  let y = 440;
  const bottom = 1580;
  const left = 72;
  const right = 1168;
  const imageSize = { width: 180, height: 120 };

  ctx.font = "700 26px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  ctx.fillStyle = "#1c2730";

  if (items.length === 0) {
    ctx.fillStyle = "#60717d";
    ctx.font = "500 24px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
    drawWrappedText(ctx, "尚未選擇動作。請先從動作資料庫勾選處方項目。", left, y, right - left, 34);
  }

  const loadedImages = includeImages ? await Promise.all(items.map(item => loadImage(item.image))) : items.map(() => null);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const estimatedHeight = 206;
    if (y + estimatedHeight > bottom) {
      pages.push(canvas);
      ({ canvas, ctx } = newPdfPage());
      y = 72;
    }

    const rowTop = y;
    ctx.strokeStyle = "#d9e2e4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    y += 24;
    drawContainedImage(ctx, loadedImages[index], left, y, imageSize.width, imageSize.height);
    ctx.strokeStyle = "#d9e2e4";
    ctx.strokeRect(left, y, imageSize.width, imageSize.height);

    const textX = left + imageSize.width + 28;
    const textWidth = right - textX;
    ctx.fillStyle = "#1c2730";
    ctx.font = "800 25px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
    y = drawWrappedText(ctx, `${index + 1}. ${item.name}`, textX, y, textWidth, 32, 2);

    ctx.fillStyle = "#60717d";
    ctx.font = "500 20px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
    y = drawWrappedText(ctx, item.steps, textX, y + 8, textWidth, 28, 3);

    ctx.fillStyle = "#0b554f";
    ctx.font = "800 19px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
    y = drawWrappedText(ctx, `次數：${item.reps}　組數：${item.sets}　頻率：每週 3-5 天`, textX, y + 10, textWidth, 26, 2);

    ctx.fillStyle = "#60717d";
    ctx.font = "500 18px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
    y = Math.max(y, rowTop + 24 + imageSize.height);
    y = drawWrappedText(ctx, `注意事項：${item.caution}`, textX, y + 10, textWidth, 26, 2);
    y += 22;
  }

  if (y + 150 > bottom) {
    pages.push(canvas);
    ({ canvas, ctx } = newPdfPage());
    y = 72;
  }

  ctx.fillStyle = "#fff8ea";
  ctx.fillRect(left, y + 20, right - left, 112);
  ctx.strokeStyle = "#ead29f";
  ctx.strokeRect(left, y + 20, right - left, 112);
  ctx.fillStyle = "#b7791f";
  ctx.font = "800 22px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  ctx.fillText("安全提醒", left + 22, y + 40);
  ctx.fillStyle = "#60717d";
  ctx.font = "500 19px -apple-system, BlinkMacSystemFont, 'Noto Sans TC', sans-serif";
  drawWrappedText(ctx, "動作過程若出現胸悶、暈眩、明顯疼痛、呼吸困難或不穩跌倒風險，請立即停止並聯絡治療師或醫療人員。", left + 22, y + 72, right - left - 44, 28, 2);

  pages.push(canvas);
  return buildPdfFromCanvases(pages);
}

async function downloadPdf() {
  if (isDownloadingPdf) return;
  isDownloadingPdf = true;
  const buttons = [downloadPdfBtn, mobileDownloadPdfBtn].filter(Boolean);
  buttons.forEach(button => {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.textContent = "產生中...";
  });
  setDownloadStatus("PDF 產生中...", "info");

  try {
    await nextFrame();
    const blob = await createPrescriptionPdfBlob();
    triggerBlobDownload(blob, `復健復能處方箋-${safeFileName(clientName.value)}.pdf`);
    setDownloadStatus(canEmbedImagesInPdf() ? "PDF 已送出下載" : "PDF 已送出下載（無圖片版）", "success");
  } catch (error) {
    try {
      const fallbackBlob = await createPrescriptionPdfBlob({ includeImages: false });
      triggerBlobDownload(fallbackBlob, `復健復能處方箋-${safeFileName(clientName.value)}.pdf`);
      setDownloadStatus("PDF 已送出下載（無圖片版）", "success");
    } catch (fallbackError) {
      console.error("PDF download failed", error, fallbackError);
      setDownloadStatus("PDF 產生失敗，請改用 localhost 開啟", "error");
    }
  } finally {
    isDownloadingPdf = false;
    buttons.forEach(button => {
      button.disabled = false;
      button.textContent = button.dataset.originalText;
    });
  }
}

categoryFilters.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  initFilters();
  renderExercises();
});

tagFilters.addEventListener("change", event => {
  const checkbox = event.target;
  if (!checkbox.value) return;
  if (checkbox.checked) state.tags.add(checkbox.value);
  else state.tags.delete(checkbox.value);
  renderExercises();
});

searchInput.addEventListener("input", renderExercises);

grid.addEventListener("change", event => {
  const selectId = event.target.dataset.select;
  const doseField = event.target.dataset.dose;
  const doseId = event.target.dataset.id;

  if (selectId) {
    if (event.target.checked) upsertSelection(selectId);
    else state.selected.delete(selectId);
    renderExercises();
    renderPreview();
  }

  if (doseField && doseId) {
    upsertSelection(doseId, { [doseField]: event.target.value });
    renderPreview();
    renderExercises();
  }
});

[clientName, prescriptionDate, therapistName, goalSelect].forEach(input => {
  input.addEventListener("input", renderPreview);
});

document.querySelector("#clearSelectionBtn").addEventListener("click", () => {
  state.selected.clear();
  renderExercises();
  renderPreview();
});

downloadPdfBtn.addEventListener("click", downloadPdf);
if (mobileDownloadPdfBtn) mobileDownloadPdfBtn.addEventListener("click", downloadPdf);

document.querySelector("#downloadTextBtn").addEventListener("click", () => {
  shareOrCopyTextPrescription();
});

initFilters();
renderExercises();
renderPreview();

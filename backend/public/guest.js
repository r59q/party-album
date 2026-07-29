const fileInput = document.querySelector("#fileInput");
const previewWrap = document.querySelector("#previewWrap");
const previewImg = document.querySelector("#previewImg");
const celebrationLayer = document.querySelector(".celebration-layer");
const statusEl = document.querySelector("#status");
const timelineEl = document.querySelector("#timeline");

const pickBtn = document.querySelector("#pickBtn");
const retakeBtn = document.querySelector("#retakeBtn");
const cancelBtn = document.querySelector("#cancelBtn");
const lightbox = document.querySelector("#lightbox");
const lightboxClose = document.querySelector("#lightboxClose");
const lightboxPrev = document.querySelector("#lightboxPrev");
const lightboxNext = document.querySelector("#lightboxNext");
const lightboxImg = document.querySelector("#lightboxImg");
const lightboxMeta = document.querySelector("#lightboxMeta");

const urlParams = new URLSearchParams(window.location.search);
const inferredEventId = urlParams.get("eventId") || "sample-event";
const inferredToken = urlParams.get("token") || "";
const inferredTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const translations = {
  en: {
    takePhoto: "Take Photo",
    retake: "Cancel, Retake",
    delete: "Delete",
    photoViewer: "Photo viewer",
    closePhotoViewer: "Close photo viewer",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    selectedPhotoPreview: "Selected photo preview",
    eventPhoto: "Event photo",
    noPhotos: "No photos uploaded yet.",
    uploading: "Uploading photo...",
    uploaded: "Uploaded ⭐ Thank you!",
    uploadErrorPrefix: "Upload error:",
    deleteErrorPrefix: "Delete error:",
    timelineErrorPrefix: "Timeline error:",
    retakingPhoto: "Retaking photo...",
    takeAnotherPhoto: "Take another photo",
    uploadCanceled: "Upload canceled.",
    uploadedStatus: "Uploaded. Tap Retake or Delete to delete it.",
    photoIndex: "Photo {current} of {total}",
    openPhotoAria: "Open photo"
  },
  da: {
    takePhoto: "Tag billede",
    retake: "Fotryd, prøv igen",
    delete: "Slet",
    photoViewer: "Billedevisning",
    closePhotoViewer: "Luk billedevisning",
    previousPhoto: "Forrige billede",
    nextPhoto: "Næste billede",
    selectedPhotoPreview: "Preview af valgt billede",
    eventPhoto: "Begivenhedsbillede",
    noPhotos: "Ingen billeder uploadet endnu.",
    uploading: "Uploader billede...",
    uploaded: "Uploadet ⭐ Tak!",
    uploadErrorPrefix: "Uploadfejl:",
    deleteErrorPrefix: "Sletningsfejl:",
    timelineErrorPrefix: "Tidslinjefejl:",
    retakingPhoto: "Tagger billede igen...",
    takeAnotherPhoto: "Tag et andet billede",
    uploadCanceled: "Upload annulleret.",
    uploadedStatus: "Uploadet. Tryk Tag igen eller Slet for at slette det.",
    photoIndex: "Billede {current} af {total}",
    openPhotoAria: "Åbn billede"
  }
};

function getDeviceLocale() {
  const candidates = [navigator.language, navigator.userLanguage, ...(navigator.languages || [])];
  for (const candidate of candidates) {
    const normalized = (candidate || "").toLowerCase();
    if (normalized.startsWith("da")) {
      return "da";
    }
    if (normalized.startsWith("en")) {
      return "en";
    }
  }
  return "en";
}

function t(key, params = {}) {
  const locale = getDeviceLocale();
  const dictionary = translations[locale] || translations.en;
  const value = dictionary[key] || translations.en[key] || key;
  return Object.entries(params).reduce((result, [paramKey, paramValue]) => result.replace(`{${paramKey}}`, String(paramValue)), value);
}

function applyTranslations() {
  const locale = getDeviceLocale();
  document.documentElement.lang = locale === "da" ? "da" : "en";

  if (pickBtn) {
    pickBtn.textContent = t("takePhoto");
  }
  if (retakeBtn) {
    retakeBtn.textContent = t("retake");
  }
  if (cancelBtn) {
    cancelBtn.textContent = t("delete");
  }
  if (previewImg) {
    previewImg.alt = t("selectedPhotoPreview");
  }
  if (lightbox) {
    lightbox.setAttribute("aria-label", t("photoViewer"));
  }
  if (lightboxClose) {
    lightboxClose.setAttribute("aria-label", t("closePhotoViewer"));
  }
  if (lightboxPrev) {
    lightboxPrev.setAttribute("aria-label", t("previousPhoto"));
  }
  if (lightboxNext) {
    lightboxNext.setAttribute("aria-label", t("nextPhoto"));
  }
  if (timelinePhotos.length) {
    updateLightboxState();
  }
}

let selectedFile = null;
let previewUrl = null;
let refreshInFlight = false;
let lastTimelineSignature = "";
let activeUploadController = null;
let uploadInFlight = false;
let uploadedPhotoId = null;
let pendingRetakeAfterDelete = false;
let timelinePhotos = [];
let currentLightboxIndex = -1;
let touchStartX = 0;
let touchStartY = 0;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function resetPreview() {
  selectedFile = null;
  fileInput.value = "";
  previewWrap.classList.add("hidden");
  uploadedPhotoId = null;
  celebrationLayer.innerHTML = "";
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
}

function launchCelebration() {
  celebrationLayer.innerHTML = "";
  const pieces = 10;
  const emojiOptions = ["⭐", "✨", "🎈"];

  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("span");
    piece.className = "celebration-piece";
    piece.textContent = emojiOptions[index % emojiOptions.length];
    piece.style.left = `${10 + Math.random() * 80}%`;
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * 140}px`);
    piece.style.setProperty("--duration", `${1200 + Math.random() * 500}ms`);
    piece.style.animationDelay = `${Math.random() * 80}ms`;
    celebrationLayer.appendChild(piece);
  }

  window.setTimeout(() => {
    celebrationLayer.innerHTML = "";
  }, 1800);
}

function setCaptureButtonsDisabled(disabled) {
  pickBtn.disabled = disabled;
  fileInput.disabled = disabled;
}

async function cancelCurrentUpload(message) {
  if (activeUploadController) {
    activeUploadController.abort();
  }

  if (uploadedPhotoId) {
    try {
      await fetchJson(`/photos/${encodeURIComponent(uploadedPhotoId)}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inferredToken })
      });
      await refreshTimeline();
    } catch (error) {
      setStatus(`${t("deleteErrorPrefix")} ${error.message}`, true);
      pendingRetakeAfterDelete = false;
      return;
    }
  }

  uploadInFlight = false;
  setCaptureButtonsDisabled(false);
  resetPreview();
  if (message) {
    setStatus(message);
  }

  if (pendingRetakeAfterDelete) {
    pendingRetakeAfterDelete = false;
    fileInput.click();
  }
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = body.message || body.error || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body;
}

function timelinePhotoItem(photo, index) {
  return `
    <article class="photo" data-index="${index}" role="button" tabindex="0" aria-label="${t("openPhotoAria")} ${index + 1}">
      <img src="${photo.viewUrl}" alt="${t("eventPhoto")} ${index + 1}" loading="lazy" />
    </article>
  `;
}

function timelineSignature(data) {
  if (!data.timeline?.length) {
    return "empty";
  }

  return JSON.stringify(
    data.timeline.map((group) => ({
      hour: group.hour,
      label: group.label,
      photoIds: group.photos.map((photo) => photo.photoId)
    }))
  );
}

function renderTimeline(data) {
  timelinePhotos = [];

  if (!data.timeline?.length) {
    timelineEl.innerHTML = `<p class="empty">${t("noPhotos")}</p>`;
    closeLightbox();
    return;
  }

  const flattenedPhotos = data.timeline.flatMap((group) => group.photos || []);
  timelinePhotos = flattenedPhotos.map((photo) => ({ ...photo }));

  timelineEl.innerHTML = data.timeline
    .map(
      (group) => `
      <section class="hour-group">
        <h3>${group.label || group.hour} <span>(${group.count})</span></h3>
        <div class="grid">
          ${group.photos.map((photo, photoIndex) => timelinePhotoItem(photo, timelinePhotos.findIndex((item) => item.photoId === photo.photoId))).join("")}
        </div>
      </section>
    `
    )
    .join("");
}

async function refreshTimeline() {
  if (refreshInFlight) {
    return;
  }

  refreshInFlight = true;
  try {
    const data = await fetchJson(
      `/events/${encodeURIComponent(inferredEventId)}/photos/timeline?timezone=${encodeURIComponent(inferredTimezone)}&token=${encodeURIComponent(inferredToken)}`
    );
    const signature = timelineSignature(data);
    if (signature === lastTimelineSignature) {
      return;
    }
    lastTimelineSignature = signature;
    renderTimeline(data);
  } catch (error) {
    if (!selectedFile) {
      setStatus(`${t("timelineErrorPrefix")} ${error.message}`, true);
    }
  } finally {
    refreshInFlight = false;
  }
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  document.body.style.overflow = "";
  currentLightboxIndex = -1;
}

function updateLightboxState() {
  if (!timelinePhotos.length) {
    closeLightbox();
    return;
  }

  const photo = timelinePhotos[currentLightboxIndex];
  if (!photo) {
    currentLightboxIndex = 0;
  }

  const safePhoto = timelinePhotos[currentLightboxIndex] || timelinePhotos[0];
  lightboxImg.src = safePhoto.viewUrl;
  lightboxImg.alt = `${t("eventPhoto")} ${currentLightboxIndex + 1}`;
  lightboxMeta.textContent = t("photoIndex", { current: currentLightboxIndex + 1, total: timelinePhotos.length });
  lightboxPrev.disabled = timelinePhotos.length <= 1;
  lightboxNext.disabled = timelinePhotos.length <= 1;
}

function openLightbox(index) {
  if (!timelinePhotos.length) {
    return;
  }

  currentLightboxIndex = Math.max(0, Math.min(index, timelinePhotos.length - 1));
  updateLightboxState();
  lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function showLightboxPhoto(direction) {
  if (!timelinePhotos.length) {
    return;
  }

  currentLightboxIndex = (currentLightboxIndex + direction + timelinePhotos.length) % timelinePhotos.length;
  updateLightboxState();
}

pickBtn.addEventListener("click", () => {
  fileInput.click();
});

retakeBtn.addEventListener("click", () => {
  if (uploadedPhotoId) {
    pendingRetakeAfterDelete = true;
    void cancelCurrentUpload(t("retakingPhoto"));
    return;
  }

  void cancelCurrentUpload(t("retakingPhoto"));
  fileInput.click();
});

cancelBtn.addEventListener("click", () => {
  void cancelCurrentUpload(t("takeAnotherPhoto"));
});

timelineEl.addEventListener("click", (event) => {
  const card = event.target.closest(".photo");
  if (!card) {
    return;
  }

  openLightbox(Number(card.dataset.index));
});

timelineEl.addEventListener("keydown", (event) => {
  const card = event.target.closest(".photo");
  if (!card || (event.key !== "Enter" && event.key !== " ")) {
    return;
  }

  event.preventDefault();
  openLightbox(Number(card.dataset.index));
});

lightboxClose.addEventListener("click", closeLightbox);
lightboxPrev.addEventListener("click", () => showLightboxPhoto(-1));
lightboxNext.addEventListener("click", () => showLightboxPhoto(1));
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

lightbox.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

lightbox.addEventListener("touchend", (event) => {
  const touch = event.changedTouches[0];
  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (Math.abs(deltaX) > 60 && Math.abs(deltaX) > Math.abs(deltaY)) {
    showLightboxPhoto(deltaX < 0 ? 1 : -1);
  }
}, { passive: true });

document.addEventListener("keydown", (event) => {
  if (lightbox.classList.contains("hidden")) {
    return;
  }

  if (event.key === "Escape") {
    closeLightbox();
  } else if (event.key === "ArrowLeft") {
    showLightboxPhoto(-1);
  } else if (event.key === "ArrowRight") {
    showLightboxPhoto(1);
  }
});

async function startAutoUpload() {
  if (!selectedFile || uploadInFlight) {
    return;
  }

  uploadInFlight = true;
  setCaptureButtonsDisabled(true);
  activeUploadController = new AbortController();
  setStatus(t("uploading"));

  try {
    const fileForUpload = selectedFile;
    const init = await fetchJson("/uploads/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: inferredEventId,
        token: inferredToken,
        fileName: fileForUpload.name || "photo.jpg",
        contentType: fileForUpload.type || "image/jpeg",
        sizeBytes: fileForUpload.size
      }),
      signal: activeUploadController.signal
    });

    const putRes = await fetch(init.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": fileForUpload.type || "image/jpeg"
      },
      body: fileForUpload,
      signal: activeUploadController.signal
    });

    if (!putRes.ok) {
      throw new Error(`Upload failed with HTTP ${putRes.status}`);
    }

    await fetchJson("/uploads/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: inferredEventId,
        token: inferredToken,
        photoId: init.photoId,
        objectKey: init.objectKey,
        contentType: fileForUpload.type || "image/jpeg",
        sizeBytes: fileForUpload.size,
        capturedAtClient: new Date().toISOString()
      }),
      signal: activeUploadController.signal
    });

    uploadedPhotoId = init.photoId;
    setStatus(t("uploaded"));
    launchCelebration();
    await refreshTimeline();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    setStatus(`${t("uploadErrorPrefix")} ${error.message}`, true);
  } finally {
    uploadInFlight = false;
    activeUploadController = null;
    setCaptureButtonsDisabled(false);
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) {
    return;
  }

  pendingRetakeAfterDelete = false;
  selectedFile = file;
  uploadedPhotoId = null;
  if (activeUploadController) {
    activeUploadController.abort();
  }
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
  }
  previewUrl = URL.createObjectURL(file);
  previewImg.src = previewUrl;
  previewWrap.classList.remove("hidden");
  void startAutoUpload();
});

function bootGuestUi() {
  applyTranslations();
  refreshTimeline();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootGuestUi, { once: true });
} else {
  bootGuestUi();
}

window.addEventListener("languagechange", applyTranslations);

window.setInterval(() => {
  refreshTimeline();
}, 15000);

window.addEventListener("focus", () => {
  refreshTimeline();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshTimeline();
  }
});
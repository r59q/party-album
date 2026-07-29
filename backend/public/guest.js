const fileInput = document.querySelector("#fileInput");
const previewWrap = document.querySelector("#previewWrap");
const previewImg = document.querySelector("#previewImg");
const statusEl = document.querySelector("#status");
const timelineEl = document.querySelector("#timeline");

const pickBtn = document.querySelector("#pickBtn");
const retakeBtn = document.querySelector("#retakeBtn");
const cancelBtn = document.querySelector("#cancelBtn");

const urlParams = new URLSearchParams(window.location.search);
const inferredEventId = urlParams.get("eventId") || "sample-event";
const inferredToken = urlParams.get("token") || "";
const inferredTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

let selectedFile = null;
let previewUrl = null;
let refreshInFlight = false;
let lastTimelineSignature = "";
let activeUploadController = null;
let uploadInFlight = false;
let uploadedPhotoId = null;
let pendingRetakeAfterDelete = false;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function resetPreview() {
  selectedFile = null;
  fileInput.value = "";
  previewWrap.classList.add("hidden");
  uploadedPhotoId = null;
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
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
      setStatus(`Delete error: ${error.message}`, true);
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

function timelinePhotoItem(photo) {
  return `
    <article class="photo">
      <img src="${photo.viewUrl}" alt="Event photo" loading="lazy" />
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
  if (!data.timeline?.length) {
    timelineEl.innerHTML = "<p class=\"empty\">No photos uploaded yet.</p>";
    return;
  }

  timelineEl.innerHTML = data.timeline
    .map(
      (group) => `
      <section class="hour-group">
        <h3>${group.label || group.hour} <span>(${group.count})</span></h3>
        <div class="grid">
          ${group.photos.map((photo) => timelinePhotoItem(photo)).join("")}
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
      setStatus(`Timeline error: ${error.message}`, true);
    }
  } finally {
    refreshInFlight = false;
  }
}

pickBtn.addEventListener("click", () => {
  fileInput.click();
});

retakeBtn.addEventListener("click", () => {
  if (uploadedPhotoId) {
    pendingRetakeAfterDelete = true;
    void cancelCurrentUpload("Retaking photo...");
    return;
  }

  void cancelCurrentUpload("Retaking photo...");
  fileInput.click();
});

cancelBtn.addEventListener("click", () => {
  void cancelCurrentUpload("Upload canceled.");
});

async function startAutoUpload() {
  if (!selectedFile || uploadInFlight) {
    return;
  }

  uploadInFlight = true;
  setCaptureButtonsDisabled(true);
  activeUploadController = new AbortController();
  setStatus("Uploading photo...");

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
    setStatus("Uploaded. Tap Retake or Cancel to delete it.");
    await refreshTimeline();
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return;
    }
    setStatus(`Upload error: ${error.message}`, true);
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

refreshTimeline();

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
const eventIdInput = document.querySelector("#eventId");
const tokenInput = document.querySelector("#token");
const baseUrlInput = document.querySelector("#baseUrl");
const joinUrlEl = document.querySelector("#joinUrl");
const nfcPayloadEl = document.querySelector("#nfcPayload");
const qrImgEl = document.querySelector("#qrImg");
const downloadLinkEl = document.querySelector("#downloadLink");
const statusEl = document.querySelector("#status");

const copyJoinBtn = document.querySelector("#copyJoinBtn");
const copyNfcBtn = document.querySelector("#copyNfcBtn");
const printBtn = document.querySelector("#printBtn");

const current = new URL(window.location.href);
baseUrlInput.value = `${current.origin}/guest`;

function setStatus(message) {
  statusEl.textContent = message;
}

function buildJoinUrl() {
  const eventId = eventIdInput.value.trim();
  const token = tokenInput.value.trim();
  const baseUrlRaw = baseUrlInput.value.trim();

  if (!eventId || !baseUrlRaw) {
    joinUrlEl.value = "";
    nfcPayloadEl.value = "";
    qrImgEl.removeAttribute("src");
    downloadLinkEl.setAttribute("href", "#");
    return;
  }

  let url;
  try {
    url = new URL(baseUrlRaw);
  } catch {
    setStatus("Guest base URL must be a valid URL.");
    return;
  }

  url.searchParams.set("eventId", eventId);
  if (token) {
    url.searchParams.set("token", token);
  } else {
    url.searchParams.delete("token");
  }

  const value = url.toString();
  joinUrlEl.value = value;
  nfcPayloadEl.value = value;

  const qrEndpoint = `/tools/qr.svg?value=${encodeURIComponent(value)}`;
  qrImgEl.src = qrEndpoint;
  downloadLinkEl.href = qrEndpoint;
  setStatus("");
}

async function copyText(value, successText) {
  try {
    await navigator.clipboard.writeText(value);
    setStatus(successText);
  } catch {
    setStatus("Copy failed. You can copy manually.");
  }
}

copyJoinBtn.addEventListener("click", () => {
  if (!joinUrlEl.value) {
    setStatus("Nothing to copy yet.");
    return;
  }
  copyText(joinUrlEl.value, "Join URL copied.");
});

copyNfcBtn.addEventListener("click", () => {
  if (!nfcPayloadEl.value) {
    setStatus("Nothing to copy yet.");
    return;
  }
  copyText(nfcPayloadEl.value, "NFC payload copied.");
});

printBtn.addEventListener("click", () => {
  if (!joinUrlEl.value) {
    setStatus("Generate a URL first.");
    return;
  }
  window.print();
});

for (const element of [eventIdInput, tokenInput, baseUrlInput]) {
  element.addEventListener("input", buildJoinUrl);
}

buildJoinUrl();
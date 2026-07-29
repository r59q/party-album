const streamEl = document.querySelector("#stream");
const emptyEl = document.querySelector("#empty");

const params = new URLSearchParams(window.location.search);
const eventId = params.get("eventId") || "sample-event";
const token = params.get("token") || "";
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

let refreshInFlight = false;
let previousSignature = "";

function flattenTimeline(timeline) {
  return timeline || [];
}

function timelineSignature(timeline) {
  return JSON.stringify(
    (timeline || []).map((group) => ({
      hour: group.hour,
      photos: (group.photos || []).map((photo) => photo.photoId)
    }))
  );
}

function renderTimeline(groups) {
  if (!groups.length) {
    streamEl.innerHTML = "";
    emptyEl.classList.remove("hidden");
    return;
  }

  emptyEl.classList.add("hidden");
  streamEl.innerHTML = groups
    .map((group) => {
      const title = group.label || group.hour;
      const photos = (group.photos || [])
        .map(
          (photo) => `
            <figure class="tile">
              <img src="${photo.viewUrl}" alt="Event photo" loading="lazy" decoding="async" />
            </figure>
          `
        )
        .join("");

      return `
        <section class="hour-group">
          <h2>${title}</h2>
          <div class="grid">
            ${photos}
          </div>
        </section>
      `;
    })
    .join("");
}

async function refresh() {
  if (refreshInFlight) {
    return;
  }

  refreshInFlight = true;
  try {
    const res = await fetch(
      `/events/${encodeURIComponent(eventId)}/photos/timeline?timezone=${encodeURIComponent(timezone)}&token=${encodeURIComponent(token)}`
    );
    if (!res.ok) {
      return;
    }

    const data = await res.json();
    const signature = timelineSignature(data.timeline);
    if (signature === previousSignature) {
      return;
    }

    previousSignature = signature;
    renderTimeline(flattenTimeline(data.timeline));
  } finally {
    refreshInFlight = false;
  }
}

refresh();
window.setInterval(refresh, 10000);

window.addEventListener("focus", refresh);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refresh();
  }
});
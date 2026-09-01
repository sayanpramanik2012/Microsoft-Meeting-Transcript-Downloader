"use strict";

const elements = {
  capture: document.querySelector("#capture"),
  captureLabel: document.querySelector("#capture-label"),
  download: document.querySelector("#download"),
  downloadLabel: document.querySelector("#download-label"),
  progressRing: document.querySelector("#progress-ring"),
  progressPercent: document.querySelector("#progress-percent"),
  statusTitle: document.querySelector("#status-title"),
  statusDetail: document.querySelector("#status-detail"),
  capturedCount: document.querySelector("#captured-count"),
  missingCount: document.querySelector("#missing-count"),
  statusDot: document.querySelector("#status-dot"),
  activityTitle: document.querySelector("#activity-title"),
  activityDetail: document.querySelector("#activity-detail"),
};

let currentTabId = null;
let pollTimer = null;
let starting = false;

function calculateProgress(status) {
  if (status?.expectedTotal) {
    return Math.min(100, Math.round((status.indexed / status.expectedTotal) * 100));
  }
  return status?.records ? 1 : 0;
}

function setProgress(value) {
  const progress = Math.max(0, Math.min(100, value));
  elements.progressRing.style.setProperty("--progress", String(progress));
  elements.progressRing.setAttribute("aria-valuenow", String(progress));
  elements.progressPercent.textContent = `${progress}%`;
}

function showState({
  title,
  detail,
  activityTitle,
  activityDetail,
  state = "idle",
}) {
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
  elements.activityTitle.textContent = activityTitle;
  elements.activityDetail.textContent = activityDetail;
  elements.statusDot.className = `status-dot ${state}`;
}

function setCaptureButton(label, busy = false) {
  elements.captureLabel.textContent = label;
  elements.capture.disabled = busy;
  elements.capture.classList.toggle("is-busy", busy);
  elements.capture.setAttribute("aria-busy", String(busy));
}

function setDownloadButton(status) {
  const hasRecords = Boolean(status?.records);
  const busy = Boolean(status?.autoRunning) || starting;
  elements.download.hidden = !hasRecords || busy;
  elements.download.disabled = busy;
  elements.downloadLabel.textContent = status?.complete
    ? "Download again"
    : "Download captured rows";
}

function renderRecorderStatus(status) {
  const progress = calculateProgress(status);
  const captured = status?.expectedTotal
    ? `${status.indexed} / ${status.expectedTotal} rows`
    : status?.records
      ? `${status.records} rows`
      : "—";
  const missing = status?.expectedTotal ? String(status.missingCount) : "—";

  setProgress(progress);
  elements.capturedCount.textContent = captured;
  elements.missingCount.textContent = missing;
  setDownloadButton(status);

  if (starting) {
    setCaptureButton("Starting capture…", true);
    showState({
      title: "Finding transcript…",
      detail: "Checking the open Microsoft Teams page.",
      activityTitle: "Preparing capture",
      activityDetail: "Keep the transcript pane open while the extension works.",
      state: "running",
    });
    return;
  }

  if (!status?.active) {
    setCaptureButton("Capture transcript");
    showState({
      title: "Ready to capture",
      detail: "Open a completed Teams transcript to begin.",
      activityTitle: "One-click capture",
      activityDetail: "The extension will scroll, collect every row, and download automatically.",
    });
    return;
  }

  if (status.error) {
    setCaptureButton("Try again");
    showState({
      title: "Capture stopped",
      detail: status.error,
      activityTitle: "Transcript could not be completed",
      activityDetail: "Keep the transcript pane open, then try the capture again.",
      state: "error",
    });
    return;
  }

  if (status.autoRunning) {
    setCaptureButton("Capturing…", true);
    showState({
      title: "Capturing transcript…",
      detail: status.expectedTotal
        ? `${progress}% complete`
        : "Detecting the transcript length…",
      activityTitle: "Auto-scrolling in progress",
      activityDetail: status.note || "The recorder is collecting all visible transcript rows.",
      state: "running",
    });
    return;
  }

  if (status.complete) {
    setCaptureButton("Capture again");
    showState({
      title: status.downloaded ? "Transcript downloaded" : "Capture complete",
      detail: `${status.indexed} rows captured successfully.`,
      activityTitle: status.downloaded ? "Download complete" : "Ready to download",
      activityDetail: status.downloaded
        ? "The text file was saved to your browser's download folder."
        : "Use Download again if the automatic download was blocked.",
      state: "complete",
    });
    return;
  }

  if (status.autoFinished) {
    setCaptureButton("Retry capture");
    showState({
      title: status.downloaded ? "Captured rows downloaded" : "Some rows are still missing",
      detail: status.expectedTotal
        ? `${status.missingCount} of ${status.expectedTotal} rows were not found.`
        : "The total number of transcript rows could not be detected.",
      activityTitle: status.downloaded ? "Partial file saved" : "Automatic download paused",
      activityDetail: status.downloaded
        ? "Retry capture when you need a verified complete transcript."
        : "Retry for a complete file, or download the rows captured so far.",
      state: status.downloaded ? "complete" : "error",
    });
    return;
  }

  setCaptureButton("Capture transcript");
  showState({
    title: "Recorder ready",
    detail: captured === "—" ? "Select Capture transcript to begin." : `${captured} detected.`,
    activityTitle: "Ready for automatic capture",
    activityDetail: "The transcript will download when every row has been verified.",
  });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active browser tab was found.");
  return tab;
}

async function executeCommand(action) {
  if (!currentTabId) currentTabId = (await getActiveTab()).id;
  const results = await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    func: (requestedAction) => {
      const recorder = globalThis.__teamsTranscriptRecorderExtension;
      if (!recorder) return { active: false };
      return recorder.command(requestedAction);
    },
    args: [action],
  });
  return results[0]?.result || { active: false };
}

async function refreshStatus() {
  if (starting) return;
  try {
    const status = await executeCommand("status");
    renderRecorderStatus(status);
  } catch (error) {
    renderUnavailable(error.message);
  }
}

function renderUnavailable(detail) {
  starting = false;
  setProgress(0);
  elements.capturedCount.textContent = "—";
  elements.missingCount.textContent = "—";
  elements.download.hidden = true;
  setCaptureButton("Try again");
  showState({
    title: "Unavailable on this page",
    detail,
    activityTitle: "Open Microsoft Teams on the web",
    activityDetail: "Open a completed meeting transcript, then select Try again.",
    state: "error",
  });
}

async function startCapture() {
  if (starting) return;
  starting = true;
  renderRecorderStatus(null);

  try {
    currentTabId = (await getActiveTab()).id;
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ["recorder.js"],
    });
    const status = await executeCommand("auto");
    starting = false;
    renderRecorderStatus(status);
  } catch (error) {
    renderUnavailable(
      "Open the Transcript pane in Microsoft Teams, wait for its rows to appear, and try again."
    );
  }
}

async function downloadCaptured() {
  try {
    const status = await executeCommand("download");
    renderRecorderStatus(status);
  } catch (error) {
    renderUnavailable(error.message);
  }
}

elements.capture.addEventListener("click", startCapture);
elements.download.addEventListener("click", downloadCaptured);

getActiveTab()
  .then((tab) => {
    currentTabId = tab.id;
    return refreshStatus();
  })
  .catch((error) => renderUnavailable(error.message));

pollTimer = window.setInterval(refreshStatus, 600);
window.addEventListener("unload", () => window.clearInterval(pollTimer));

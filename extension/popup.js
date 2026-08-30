"use strict";

const elements = {
  statusDot: document.querySelector("#status-dot"),
  statusTitle: document.querySelector("#status-title"),
  statusDetail: document.querySelector("#status-detail"),
  start: document.querySelector("#start"),
  auto: document.querySelector("#auto"),
  download: document.querySelector("#download"),
  stop: document.querySelector("#stop"),
};

let currentTabId = null;
let pollTimer = null;

function showStatus(title, detail, state = "idle") {
  elements.statusTitle.textContent = title;
  elements.statusDetail.textContent = detail;
  elements.statusDot.className = `status-dot ${state}`;
}

function setButtons(status) {
  const active = Boolean(status?.active);
  const busy = Boolean(status?.autoRunning);
  elements.start.disabled = busy;
  elements.start.textContent = active ? "Restart recorder" : "Start recorder";
  elements.auto.disabled = !active || busy;
  elements.download.disabled = !active || busy || status.records === 0;
  elements.stop.disabled = !active;
}

function renderRecorderStatus(status) {
  setButtons(status);

  if (!status?.active) {
    showStatus("Not started", "Open a Teams transcript, then select Start.", "idle");
    return;
  }

  if (status.error) {
    showStatus("Recorder error", status.error, "error");
    return;
  }

  let detail;
  if (status.expectedTotal) {
    detail = `${status.indexed} of ${status.expectedTotal} rows captured`;
    if (!status.complete && status.missingCount) {
      detail += ` · ${status.missingCount} missing`;
    }
  } else {
    detail = `${status.records} rows captured · total not detected yet`;
  }

  if (status.note) detail += ` · ${status.note}`;
  showStatus(
    status.complete ? "Capture complete" : status.autoRunning ? "Auto-capturing" : "Recorder active",
    detail,
    status.complete ? "complete" : "running"
  );
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
  try {
    const status = await executeCommand("status");
    renderRecorderStatus(status);
  } catch (error) {
    setButtons(null);
    showStatus("Unavailable on this page", error.message, "error");
  }
}

async function startRecorder() {
  try {
    showStatus("Starting recorder", "Looking for an open transcript pane…", "running");
    if (!currentTabId) currentTabId = (await getActiveTab()).id;
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ["recorder.js"],
    });
    await refreshStatus();
  } catch (error) {
    setButtons(null);
    showStatus(
      "Transcript not found",
      "Open the Transcript pane in Microsoft Teams, wait for its rows to appear, and try again.",
      "error"
    );
  }
}

async function runCommand(action) {
  try {
    const status = await executeCommand(action);
    renderRecorderStatus(status);
  } catch (error) {
    showStatus("Action failed", error.message, "error");
  }
}

elements.start.addEventListener("click", startRecorder);
elements.auto.addEventListener("click", () => runCommand("auto"));
elements.download.addEventListener("click", () => runCommand("download"));
elements.stop.addEventListener("click", () => runCommand("stop"));

getActiveTab()
  .then((tab) => {
    currentTabId = tab.id;
    return refreshStatus();
  })
  .catch((error) => showStatus("Unavailable", error.message, "error"));

pollTimer = window.setInterval(refreshStatus, 750);
window.addEventListener("unload", () => window.clearInterval(pollTimer));


/*
 * Transcript Capture for Teams
 *
 * Runs only after the user clicks the extension toolbar action and starts the
 * recorder. Transcript data remains in this tab and is never sent anywhere.
 */
(() => {
  "use strict";

  const GLOBAL_KEY = "__teamsTranscriptRecorderExtension";
  globalThis[GLOBAL_KEY]?.stop?.();

  const records = new Map();
  const durationPattern = /(?:(\d+) hours? )?(\d+) minutes? (\d+) seconds?/i;
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  let surface = null;
  let expectedTotal = 0;
  let sequence = 0;
  let capturePending = false;
  let autoRunning = false;
  let stopped = false;
  let note = "capturing visible rows";

  const cleanInline = (text) => (text || "").replace(/\s+/g, " ").trim();
  const cleanMessage = (text) => (text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  function findTranscriptSurface() {
    const candidates = [...document.querySelectorAll("div.ms-List-surface")]
      .map((element) => ({
        element,
        score: element.querySelectorAll(
          '.ms-List-cell[data-list-index] [id^="sub-entry-"]'
        ).length,
      }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score);
    return candidates[0]?.element || null;
  }

  surface = findTranscriptSurface();
  if (!surface) {
    throw new Error(
      "Teams transcript list not found. Open the Transcript pane and wait for its rows to appear, then try again."
    );
  }

  function parseTime(text) {
    const value = cleanInline(text);
    const duration = value.match(durationPattern);
    if (duration) {
      const hours = Number(duration[1] || 0);
      const minutes = Number(duration[2]);
      const seconds = Number(duration[3]);
      return {
        seconds: hours * 3600 + minutes * 60 + seconds,
        label: hours
          ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
          : `${minutes}:${String(seconds).padStart(2, "0")}`,
      };
    }

    const clock = value.match(/^(?:(\d+):)?(\d+):(\d{2})$/);
    if (clock) {
      const hours = Number(clock[1] || 0);
      const minutes = Number(clock[2]);
      const seconds = Number(clock[3]);
      return {
        seconds: hours * 3600 + minutes * 60 + seconds,
        label: hours
          ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
          : `${minutes}:${String(seconds).padStart(2, "0")}`,
      };
    }

    return { seconds: Number.MAX_SAFE_INTEGER, label: "" };
  }

  function readCell(cell) {
    const body = cell.querySelector('[id^="sub-entry-"]');
    if (!body) return null;

    const message = cleanMessage(body.innerText);
    if (!message) return null;

    const entry = cell.querySelector('[id^="entry-"][role="group"]');
    const accessibleLabel = cleanInline(
      entry?.getAttribute("aria-label") ||
        cell.querySelector('[id^="timestampSpeakerAriaLabel-"]')?.textContent
    );
    const headerSpeaker = cleanInline(
      cell.querySelector('[id^="itemHeader-"] [class*="itemDisplayName"]')?.innerText
    );
    const visibleTime = cleanInline(
      cell.querySelector('[id^="Header-timestamp-"]')?.innerText
    );

    let parsedTime = parseTime(accessibleLabel);
    if (!parsedTime.label) parsedTime = parseTime(visibleTime);

    const speakerFromLabel = cleanInline(accessibleLabel.replace(durationPattern, ""));
    const speaker = speakerFromLabel || headerSpeaker;
    const timeText = visibleTime || parsedTime.label;

    const rawIndex = cell.getAttribute("data-list-index");
    const numericIndex = rawIndex !== null && /^\d+$/.test(rawIndex)
      ? Number(rawIndex)
      : null;

    const rawPosition = body.getAttribute("aria-posinset");
    const position = rawPosition && /^\d+$/.test(rawPosition) ? Number(rawPosition) : null;
    const rawSetSize = body.getAttribute("aria-setsize");
    const setSize = rawSetSize && /^\d+$/.test(rawSetSize) ? Number(rawSetSize) : null;

    if (setSize) expectedTotal = Math.max(expectedTotal, setSize);

    const isStartEvent = /\bstarted transcription\b/i.test(message);
    const isStopEvent = /\bstopped transcription\b/i.test(message);
    const fallbackOrder = isStartEvent
      ? -1
      : isStopEvent
        ? Number.MAX_SAFE_INTEGER
        : parsedTime.seconds;

    const key = numericIndex !== null
      ? `index:${numericIndex}`
      : `fallback:${accessibleLabel}|${message}`;
    const quality =
      (numericIndex !== null ? 1000 : 0) +
      (position !== null ? 100 : 0) +
      (timeText ? 50 : 0) +
      (speaker ? 25 : 0) +
      message.length;

    return {
      key,
      index: numericIndex,
      position,
      speaker,
      timeText,
      seconds: parsedTime.seconds,
      fallbackOrder,
      message,
      quality,
    };
  }

  function storeRecord(record) {
    const existing = records.get(record.key);
    if (!existing) {
      records.set(record.key, { ...record, sequence: sequence++ });
      return;
    }
    if (record.quality > existing.quality) {
      records.set(record.key, { ...record, sequence: existing.sequence });
    }
  }

  function coverage() {
    const capturedIndexes = new Set(
      [...records.values()]
        .filter((record) => Number.isInteger(record.index))
        .map((record) => record.index)
    );
    const missing = expectedTotal
      ? Array.from({ length: expectedTotal }, (_, index) => index)
          .filter((index) => !capturedIndexes.has(index))
      : [];
    return {
      indexed: capturedIndexes.size,
      missing,
      complete: Boolean(expectedTotal) && missing.length === 0,
    };
  }

  function publicStatus() {
    const stats = coverage();
    return {
      active: !stopped,
      autoRunning,
      records: records.size,
      expectedTotal,
      indexed: stats.indexed,
      missingCount: stats.missing.length,
      missingPreview: stats.missing.slice(0, 15),
      complete: stats.complete,
      note,
    };
  }

  function bindSurface() {
    const current = findTranscriptSurface();
    if (!current || current === surface) return Boolean(current);
    surface = current;
    mutationObserver.disconnect();
    mutationObserver.observe(surface, observerOptions);
    return true;
  }

  function captureNow() {
    if (stopped) return;
    bindSurface();
    if (!surface?.isConnected) return;

    surface.querySelectorAll('.ms-List-cell[data-list-index]').forEach((cell) => {
      const record = readCell(cell);
      if (record) storeRecord(record);
    });
  }

  function scheduleCapture() {
    if (capturePending || stopped) return;
    capturePending = true;
    requestAnimationFrame(() => {
      capturePending = false;
      captureNow();
    });
  }

  function findScrollContainer(element) {
    let best = null;
    let bestOverflow = 0;

    for (let current = element.parentElement; current; current = current.parentElement) {
      const overflow = current.scrollHeight - current.clientHeight;
      if (overflow > bestOverflow) {
        best = current;
        bestOverflow = overflow;
      }

      const overflowY = getComputedStyle(current).overflowY;
      if (overflow > 4 && /(auto|scroll)/i.test(overflowY)) return current;
    }

    return best || document.scrollingElement;
  }

  async function moveAndCapture(scroller, top) {
    scroller.scrollTop = top;
    scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sleep(350);
    captureNow();
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }

  async function scanDirection(scroller, direction) {
    let unchanged = 0;
    let priorTop = -1;

    for (let stepNumber = 0; stepNumber < 2500 && autoRunning && !stopped; stepNumber++) {
      if (coverage().complete) return;

      const maximumTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const step = Math.max(180, Math.floor(scroller.clientHeight * 0.65));
      const nextTop = direction > 0
        ? Math.min(maximumTop, scroller.scrollTop + step)
        : Math.max(0, scroller.scrollTop - step);

      if (Math.abs(nextTop - priorTop) < 1) unchanged += 1;
      else unchanged = 0;
      priorTop = nextTop;

      await moveAndCapture(scroller, nextTop);
      if (unchanged >= 4) return;
    }
  }

  async function autoCaptureAll() {
    if (autoRunning || stopped) return;
    autoRunning = true;
    const scroller = findScrollContainer(surface);
    const oldScrollBehavior = scroller.style.scrollBehavior;
    scroller.style.scrollBehavior = "auto";

    try {
      note = "moving to top";
      await moveAndCapture(scroller, 0);
      note = "scanning transcript";
      await scanDirection(scroller, 1);

      if (!coverage().complete) {
        note = "checking missing rows";
        await scanDirection(scroller, -1);
      }

      note = coverage().complete
        ? "ready to download"
        : "incomplete; keep the pane open and retry";
    } catch (error) {
      note = `auto-capture failed: ${error.message}`;
    } finally {
      scroller.style.scrollBehavior = oldScrollBehavior;
      autoRunning = false;
    }
  }

  function orderedRecords() {
    return [...records.values()].sort((left, right) => {
      if (left.index !== null && right.index !== null) return left.index - right.index;
      if (left.index !== null) return -1;
      if (right.index !== null) return 1;
      return left.fallbackOrder - right.fallbackOrder || left.sequence - right.sequence;
    });
  }

  function transcriptText() {
    return orderedRecords()
      .map((record) => {
        if (/\b(?:started|stopped) transcription\b/i.test(record.message)) {
          return cleanInline(record.message);
        }

        const prefix = [record.timeText && `[${record.timeText}]`, record.speaker]
          .filter(Boolean)
          .join(" ");
        return prefix ? `${prefix}\n${record.message}` : record.message;
      })
      .join("\n\n") + "\n";
  }

  function downloadTranscript() {
    if (autoRunning) return;
    captureNow();
    const stats = coverage();
    if (expectedTotal && !stats.complete) {
      const preview = stats.missing.slice(0, 15).join(", ");
      const proceed = window.confirm(
        `Capture is incomplete (${stats.indexed}/${expectedTotal}). ` +
          `Missing row indexes: ${preview}${stats.missing.length > 15 ? ", …" : ""}.\n\n` +
          "Download the partial transcript anyway?"
      );
      if (!proceed) return;
    }

    const blob = new Blob(["\ufeff", transcriptText()], {
      type: "text/plain;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Teams_Transcript_Complete.txt";
    link.style.display = "none";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    note = "download started";
  }

  const observerOptions = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "aria-posinset", "aria-setsize", "data-list-index"],
  };
  const mutationObserver = new MutationObserver(scheduleCapture);
  mutationObserver.observe(surface, observerOptions);
  document.addEventListener("scroll", scheduleCapture, true);
  const safetyInterval = setInterval(captureNow, 750);

  function stop() {
    if (stopped) return { active: false };
    stopped = true;
    autoRunning = false;
    mutationObserver.disconnect();
    document.removeEventListener("scroll", scheduleCapture, true);
    clearInterval(safetyInterval);
    if (globalThis[GLOBAL_KEY]?.stop === stop) delete globalThis[GLOBAL_KEY];
    return { active: false };
  }

  function command(action) {
    if (action === "status") return publicStatus();
    if (action === "auto") {
      void autoCaptureAll();
      return publicStatus();
    }
    if (action === "download") {
      downloadTranscript();
      return publicStatus();
    }
    if (action === "stop") return stop();
    return { ...publicStatus(), error: "Unknown recorder action." };
  }

  globalThis[GLOBAL_KEY] = {
    command,
    stop,
  };

  captureNow();
})();


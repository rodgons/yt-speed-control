(() => {
  const settings = { ...DEFAULT_SETTINGS };
  const controllers = new Set();
  let speed = 1;
  let pendingSecondsSaved = 0;
  let ticks = 0;

  const isYouTube = () => /(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname);
  const clamp = (value) => Math.min(MAX_SPEED, Math.max(MIN_SPEED, value));
  const round = (value) => Math.round(value * 10000) / 10000;

  async function init() {
    // Registered before awaiting anything: this script runs at document_start, so these listeners
    // come before the page's own and its key handlers (e.g. the Shorts player's) can't swallow ours.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });

    const [synced, local] = await Promise.all([
      browser.storage.sync.get(DEFAULT_SETTINGS),
      browser.storage.local.get({ speed: 1 }),
    ]);
    Object.assign(settings, synced);
    if (!settings.allSites && !isYouTube()) return;
    speed = clamp(Number(local.speed) || 1);

    for (const video of document.getElementsByTagName("video")) attach(video);
    new MutationObserver(onMutations).observe(document.documentElement, { childList: true, subtree: true });
    if (isYouTube() && window === window.top) {
      // Media events don't bubble, so listen in the capture phase.
      for (const type of ["timeupdate", "loadedmetadata", "emptied"]) document.addEventListener(type, onShortsMediaEvent, true);
      injectShortsButtons();
    }

    browser.storage.onChanged.addListener(onStorageChanged);
    setInterval(tick, 1000);
  }

  function onMutations(mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.nodeName === "VIDEO") attach(node);
        else for (const video of node.getElementsByTagName("video")) attach(video);
      }
    }
    if (isYouTube() && window === window.top) scheduleShortsInjection();
  }

  // ---- Per-video overlay ----

  function attach(video) {
    for (const controller of controllers) if (controller.video === video) return;

    const parent = video.parentElement;
    if (!parent) return;
    // Mount next to the video's container (on YouTube that's #movie_player, which also goes fullscreen).
    const host = parent.parentElement && parent.parentElement !== document.documentElement ? parent.parentElement : parent;

    const panel = document.createElement("div");
    panel.className = "ypsc-panel";
    // Shorts get side buttons in the action bar instead of the overlay.
    if (video.closest("#shorts-player")) panel.classList.add("ypsc-shorts-player");
    const slowerButton = makeButton("ypsc-slower", ICONS.slower, "Slower");
    const speedButton = makeButton("ypsc-speed", null, "Reset speed");
    const fasterButton = makeButton("ypsc-faster", ICONS.faster, "Faster");
    const settingsButton = makeButton("ypsc-settings", ICONS.settings, "Speed settings");
    panel.append(slowerButton, speedButton, fasterButton, settingsButton);

    panel.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        const button = event.target.closest("button");
        if (button === slowerButton) changeSpeed("slower");
        else if (button === fasterButton) changeSpeed("faster");
        else if (button === speedButton) changeSpeed("reset");
        else if (button === settingsButton) browser.runtime.sendMessage({ action: "openOptions" });
      },
      true
    );
    // Keep the player from toggling fullscreen/playback when the panel is clicked.
    for (const type of ["dblclick", "mousedown", "mouseup"]) {
      panel.addEventListener(type, (event) => event.stopPropagation(), true);
    }

    host.insertBefore(panel, host.firstChild);

    const controller = { video, host, panel, speedButton, hideTimer: null };
    controllers.add(controller);
    applyPanelSettings(controller);
    updateIndicator(controller);

    host.addEventListener("mousemove", () => flash(controller));
    host.addEventListener("mouseleave", () => hide(controller));

    video.addEventListener("play", () => applySpeed(video));
    video.addEventListener("loadedmetadata", () => applySpeed(video));
    video.addEventListener("ratechange", () => {
      // Players reset the rate while loading a new source; keep ours instead of adopting theirs.
      if (video.readyState === 0) return applySpeed(video);
      if (video.playbackRate !== speed) setSpeed(video.playbackRate, false);
      updateIndicator(controller);
    });

    applySpeed(video);
  }

  // Material Icons paths (Apache 2.0), the same icon family YouTube's player uses.
  const ICONS = {
    slower: "M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z",
    faster: "M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z",
    settings:
      "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z",
  };

  function makeButton(className, iconPath, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ypsc-btn ${className}`;
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    if (iconPath) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", iconPath);
      svg.append(path);
      button.append(svg);
    }
    return button;
  }

  function applyPanelSettings(controller) {
    const { panel } = controller;
    panel.dataset.mode = settings.displayMode;
    panel.dataset.position = settings.position;
    panel.classList.toggle("ypsc-no-settings", !settings.showSettingsButton);
  }

  function updateIndicator(controller) {
    controller.speedButton.textContent = formatSpeed(controller.video.playbackRate);
  }

  // ---- Shorts side buttons ----
  // Approach based on Better YouTube Shorts (github.com/ynshung/better-yt-shorts): clone one of
  // YouTube's own action-bar buttons so ours always match the current Shorts look.

  const SHORTS_VARIANTS = ["ytSpecButtonShapeNextOverlayDark", "ytSpecButtonShapeNextOverlayLight", "ytSpecButtonShapeNextMono"];
  // Clicking the Shorts speed button steps up to the max, then wraps around to the min.
  const SHORTS_MIN_SPEED = 0.5;
  const SHORTS_MAX_SPEED = 3;
  let shortsInjectionScheduled = false;

  const formatSpeed = (value) => `${Number(value.toFixed(2))}x`;

  function scheduleShortsInjection() {
    if (shortsInjectionScheduled) return;
    shortsInjectionScheduled = true;
    requestAnimationFrame(() => {
      shortsInjectionScheduled = false;
      injectShortsButtons();
    });
  }

  function injectShortsButtons() {
    if (!location.pathname.startsWith("/shorts")) return;
    for (const bar of document.querySelectorAll("reel-action-bar-view-model")) {
      if (bar.querySelector(".ypsc-shorts-group")) continue;
      const group = makeShortsGroup(bar.querySelector("button-view-model"));
      // Clones of native buttons could be picked up by YouTube's own handlers; keep events to ourselves.
      group.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.target.closest(".ypsc-shorts-button")) cycleShortsSpeed();
        },
        true
      );
      group.addEventListener("wheel", onShortsWheel, { passive: false });
      bar.insertBefore(group, bar.firstChild);
    }
    syncShortsVariants();
    updateShortsTime();
  }

  function makeShortsGroup(template) {
    const group = document.createElement("div");
    group.className = "ypsc-shorts-group";
    const title = "Change playback speed";
    let root;
    let content;
    let time;
    if (template) {
      root = template.cloneNode(true);
      root.querySelectorAll("svg, yt-icon, yt-touch-feedback-shape, yt-light-shape").forEach((el) => el.remove());
      root.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      root.querySelectorAll("[aria-pressed]").forEach((el) => el.removeAttribute("aria-pressed"));
      root.querySelectorAll("[aria-label]").forEach((el) => el.setAttribute("aria-label", title));
      const button = root.querySelector("button") ?? root;
      content = button.querySelector(".ytSpecButtonShapeNextIcon, .yt-spec-button-shape-next__icon") ?? button;
      content.replaceChildren();
      // Reuse the native label under the button for the time readout.
      time = root.querySelector(".ytAttributedStringHost, [role='text'], .yt-core-attributed-string");
      group.append(root);
    } else {
      // Fallback for when YouTube's markup changes and there is no native button to copy.
      root = document.createElement("button");
      root.type = "button";
      root.className = "ypsc-shorts-fallback";
      content = root;
      group.append(root);
    }
    if (!time) {
      time = document.createElement("span");
      time.className = "ypsc-shorts-time-fallback";
      group.append(time);
    }
    time.classList.add("ypsc-shorts-time");
    time.textContent = "";

    const span = document.createElement("span");
    span.className = "ypsc-shorts-text";
    span.textContent = formatSpeed(speed);
    content.append(span);
    root.classList.add("ypsc-shorts-button");
    root.title = title;
    return group;
  }

  function cycleShortsSpeed() {
    const next = round(speed + settings.speedStep);
    setSpeed(next > SHORTS_MAX_SPEED ? SHORTS_MIN_SPEED : next);
  }

  function onShortsWheel(event) {
    if (!settings.mouseWheel || !event.shiftKey) return;
    const delta = event.deltaY || event.deltaX;
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    changeSpeed(delta < 0 ? "faster" : "slower");
  }

  function updateShortsButtons() {
    for (const el of document.querySelectorAll(".ypsc-shorts-text")) el.textContent = formatSpeed(speed);
  }

  function updateShortsTime() {
    const video = document.querySelector("#shorts-player video");
    const text = video && Number.isFinite(video.duration) ? `${Math.floor(video.currentTime)}/${Math.round(video.duration)}s` : "";
    for (const el of document.querySelectorAll(".ypsc-shorts-time")) {
      if (el.textContent !== text) el.textContent = text;
    }
  }

  function onShortsMediaEvent(event) {
    if (event.target instanceof HTMLVideoElement && event.target.closest("#shorts-player")) updateShortsTime();
  }

  // YouTube switches the action bar between styles (beside vs. over the video); follow the like button.
  function syncShortsVariants() {
    for (const group of document.querySelectorAll(".ypsc-shorts-group")) {
      const likeButton = group.parentElement?.querySelector("like-button-view-model button");
      if (!likeButton) continue;
      const overlay = likeButton.closest("label")?.classList.contains("ytSpecButtonShapeWithLabelIsOverlay") ?? false;
      for (const button of group.querySelectorAll("button")) {
        for (const variant of SHORTS_VARIANTS) button.classList.toggle(variant, likeButton.classList.contains(variant));
      }
      for (const label of group.querySelectorAll("label")) label.classList.toggle("ytSpecButtonShapeWithLabelIsOverlay", overlay);
    }
  }

  function flash(controller, duration = 1000) {
    controller.panel.classList.add("ypsc-visible");
    clearTimeout(controller.hideTimer);
    controller.hideTimer = setTimeout(() => hide(controller), duration);
  }

  function hide(controller) {
    clearTimeout(controller.hideTimer);
    controller.panel.classList.remove("ypsc-visible");
  }

  // ---- Speed ----

  function applySpeed(video) {
    if (video.playbackRate !== speed) video.playbackRate = speed;
  }

  function setSpeed(value, applyToVideos = true) {
    speed = clamp(round(value));
    if (applyToVideos) for (const { video } of controllers) applySpeed(video);
    updateShortsButtons();
    browser.storage.local.set({ speed });
  }

  function changeSpeed(action) {
    if (action === "faster") setSpeed(speed + settings.speedStep);
    else if (action === "slower") setSpeed(speed - settings.speedStep);
    else setSpeed(1);
    for (const controller of controllers) flash(controller);
  }

  // ---- Input ----

  function isEditable(element) {
    return element instanceof Element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.nodeName));
  }

  function keyAction(key) {
    if (settings.fasterKeys.includes(key)) return "faster";
    if (settings.slowerKeys.includes(key)) return "slower";
    if (settings.resetKeys.includes(key)) return "reset";
    return null;
  }

  function onKeyDown(event) {
    if (!controllers.size || event.ctrlKey || event.metaKey || event.altKey) return;
    if (isEditable(event.composedPath()[0])) return;
    const action = keyAction(event.key);
    if (!action) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    changeSpeed(action);
  }

  function onWheel(event) {
    if (!settings.mouseWheel || !event.shiftKey) return;
    if (![...controllers].some(({ host }) => host.contains(event.target))) return;
    // Shift+wheel is reported as horizontal scrolling on some platforms.
    const delta = event.deltaY || event.deltaX;
    if (!delta) return;
    event.preventDefault();
    changeSpeed(delta < 0 ? "faster" : "slower");
  }

  // ---- Settings & bookkeeping ----

  function onStorageChanged(changes, area) {
    if (area === "local" && changes.speed) {
      // Speed changed in another tab (or frame): follow it without writing it back.
      const newSpeed = clamp(Number(changes.speed.newValue) || 1);
      if (newSpeed !== speed) {
        speed = newSpeed;
        for (const { video } of controllers) applySpeed(video);
        updateShortsButtons();
      }
      return;
    }
    if (area !== "sync") return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (key in DEFAULT_SETTINGS) settings[key] = newValue ?? DEFAULT_SETTINGS[key];
    }
    for (const controller of controllers) applyPanelSettings(controller);
  }

  function tick() {
    syncShortsVariants();
    for (const controller of controllers) {
      const { video, panel } = controller;
      if (!video.isConnected) {
        panel.remove();
        controllers.delete(controller);
      } else if (!video.paused && !video.ended && video.playbackRate > 1) {
        pendingSecondsSaved += video.playbackRate - 1;
      }
    }
    // Flush in batches to stay well clear of storage write limits.
    if (++ticks % 10 === 0 && pendingSecondsSaved > 0) {
      const seconds = pendingSecondsSaved;
      pendingSecondsSaved = 0;
      browser.storage.local.get({ secondsSaved: 0 }).then(({ secondsSaved }) =>
        browser.storage.local.set({ secondsSaved: secondsSaved + seconds })
      );
    }
  }

  init();
})();

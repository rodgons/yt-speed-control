const KEY_NAMES = { " ": "Space" };
let settings = { ...DEFAULT_SETTINGS };
let statusTimer = null;

async function save(changes) {
  Object.assign(settings, changes);
  await browser.storage.sync.set(changes);
  const status = document.getElementById("status");
  status.textContent = "Saved.";
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.textContent = ""), 1200);
}

function render() {
  for (const row of document.querySelectorAll(".keys")) {
    const setting = row.dataset.setting;
    const chips = row.querySelector(".chips");
    chips.replaceChildren(
      ...settings[setting].map((key) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = KEY_NAMES[key] ?? key;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "×";
        remove.title = "Remove";
        remove.addEventListener("click", () => {
          save({ [setting]: settings[setting].filter((k) => k !== key) }).then(render);
        });
        chip.append(remove);
        return chip;
      })
    );
  }
  document.getElementById("speedStep").value = settings.speedStep;
  document.getElementById("position").value = settings.position;
  for (const radio of document.getElementsByName("displayMode")) radio.checked = radio.value === settings.displayMode;
  for (const id of ["showSettingsButton", "mouseWheel", "rememberSpeed", "allSites"]) {
    document.getElementById(id).checked = settings[id];
  }
}

function listenForKey(button) {
  const setting = button.closest(".keys").dataset.setting;
  button.classList.add("listening");
  button.textContent = "Press a key…";

  const onKey = (event) => {
    event.preventDefault();
    window.removeEventListener("keydown", onKey, true);
    button.classList.remove("listening");
    button.textContent = "Add key";
    const key = event.key;
    if (key === "Escape" || ["Shift", "Control", "Alt", "Meta"].includes(key)) return;
    // A key can only trigger one action, so take it away from the others.
    const changes = {};
    for (const name of ["fasterKeys", "slowerKeys", "resetKeys"]) {
      changes[name] = settings[name].filter((k) => k !== key);
    }
    changes[setting].push(key);
    save(changes).then(render);
  };
  window.addEventListener("keydown", onKey, true);
}

function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (days || hours) parts.push(`${hours}h`);
  parts.push(`${minutes}m`, `${seconds % 60}s`);
  return parts.join(" ");
}

async function renderStats() {
  const { secondsSaved } = await browser.storage.local.get({ secondsSaved: 0 });
  document.getElementById("secondsSaved").textContent = `You've saved ${formatDuration(secondsSaved)} by watching faster.`;
}

document.addEventListener("DOMContentLoaded", async () => {
  settings = await browser.storage.sync.get(DEFAULT_SETTINGS);
  render();
  renderStats();

  for (const button of document.querySelectorAll(".keys .add")) {
    button.addEventListener("click", () => listenForKey(button));
  }

  document.getElementById("speedStep").addEventListener("change", (event) => {
    const step = Number(event.target.value);
    if (step > 0 && step <= 4) save({ speedStep: step });
    else event.target.value = settings.speedStep;
  });
  document.getElementById("position").addEventListener("change", (event) => save({ position: event.target.value }));
  for (const radio of document.getElementsByName("displayMode")) {
    radio.addEventListener("change", () => save({ displayMode: radio.value }));
  }
  for (const id of ["showSettingsButton", "mouseWheel", "rememberSpeed", "allSites"]) {
    document.getElementById(id).addEventListener("change", (event) => save({ [id]: event.target.checked }));
  }

  document.getElementById("resetStats").addEventListener("click", async () => {
    await browser.storage.local.set({ secondsSaved: 0 });
    renderStats();
  });
  document.getElementById("restoreDefaults").addEventListener("click", async () => {
    await save(structuredClone(DEFAULT_SETTINGS));
    render();
  });

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.secondsSaved) renderStats();
  });
});

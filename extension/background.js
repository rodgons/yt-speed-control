browser.action.onClicked.addListener(() => browser.runtime.openOptionsPage());

browser.runtime.onMessage.addListener((message) => {
  if (message?.action === "openOptions") browser.runtime.openOptionsPage();
});

// The chosen speed is shared by all tabs for the browser session; start each session at 1×
// unless the user wants it kept across restarts.
browser.runtime.onStartup.addListener(async () => {
  const { rememberSpeed } = await browser.storage.sync.get({ rememberSpeed: DEFAULT_SETTINGS.rememberSpeed });
  if (!rememberSpeed) await browser.storage.local.set({ speed: 1 });
});

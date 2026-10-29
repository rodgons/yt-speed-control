// Shared by the content script and the options page.
// Keys are stored as KeyboardEvent.key values; numpad and main-row keys produce the same value.
const DEFAULT_SETTINGS = {
  speedStep: 0.25,
  fasterKeys: ["+", "="],
  slowerKeys: ["-"],
  resetKeys: ["*"],
  displayMode: "hover", // hover | always | simple | none
  position: "top-right", // top-left | top-center | top-right | bottom-left | bottom-center | bottom-right
  mouseWheel: true,
  rememberSpeed: false,
  showSettingsButton: true,
  allSites: true,
};

const MIN_SPEED = 0.0625;
const MAX_SPEED = 16;

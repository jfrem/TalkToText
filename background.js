// Voice Dictation Extension - Background Script
// Manages state across tabs and handles communication with content scripts

// Global state
let isDictating = false;
let currentTabId = null;
let currentLanguage = "es-ES";
let userSettings = null;

// Initialize settings
function initializeSettings() {
  chrome.storage.sync.get(["language", "userSettings"], (data) => {
    currentLanguage = data.language || "es-ES";
    userSettings = data.userSettings || {
      buttonPosition: "right",
      tooltipDuration: 3000,
      autoCapitalize: true,
      preserveEnglish: true,
      enableLearning: true,
      showControlPanel: true,
      confidenceThreshold: 0.7,
      autoCorrect: true,
      enableVoiceCommands: true,
      continuousMode: true,
      idleTimeout: 30000,
      accentColor: "#1a3636",
    };
  });
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case "toggleDictation":
      isDictating = !isDictating;
      currentTabId = sender.tab ? sender.tab.id : currentTabId;

      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "setDictationState",
          isDictating,
          language: currentLanguage,
        });
      }

      // Update icon state
      updateExtensionIcon(isDictating);

      // Set badge text
      // Set badge text
      chrome.action.setBadgeText({
        text: isDictating ? "ON" : "",
        tabId: currentTabId,
      });

      // Set badge color
      chrome.action.setBadgeBackgroundColor({
        color: isDictating ? "#4CAF50" : "#cccccc",
        tabId: currentTabId,
      });

      // Update tooltip
      chrome.action.setTitle({
        title: isDictating ? "Dictado activo" : "Iniciar dictado por voz",
        tabId: currentTabId,
      });

      sendResponse({ isDictating });
      break;

    case "startDictation":
      isDictating = true;
      currentTabId = sender.tab ? sender.tab.id : currentTabId;

      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "setDictationState",
          isDictating: true,
          language: currentLanguage,
        });
      }

      updateExtensionIcon(true);
      chrome.action.setBadgeText({
        text: "ON",
        tabId: currentTabId,
      });

      sendResponse({ success: true });
      break;

    case "stopDictation":
      isDictating = false;

      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "setDictationState",
          isDictating: false,
        });
      }

      updateExtensionIcon(false);
      chrome.action.setBadgeText({
        text: "",
        tabId: currentTabId,
      });

      sendResponse({ success: true });
      break;

    case "setLanguage":
      currentLanguage = message.language;
      chrome.storage.sync.set({ language: currentLanguage });

      if (isDictating && currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "updateLanguage",
          language: currentLanguage,
        });
      }

      sendResponse({ success: true });
      break;

    case "updateSettings":
      userSettings = { ...userSettings, ...message.settings };
      chrome.storage.sync.set({ userSettings });

      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "updateSettings",
          settings: userSettings,
        });
      }

      sendResponse({ success: true });
      break;

    case "showSettings":
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "showSettings",
        });
      }

      sendResponse({ success: true });
      break;

    case "getState":
      sendResponse({
        isDictating,
        currentTabId,
        currentLanguage,
        userSettings,
      });
      break;

    case "resetSettings":
      userSettings = {
        buttonPosition: "right",
        tooltipDuration: 3000,
        autoCapitalize: true,
        preserveEnglish: true,
        enableLearning: true,
        showControlPanel: true,
        confidenceThreshold: 0.7,
        autoCorrect: true,
        enableVoiceCommands: true,
        continuousMode: true,
        idleTimeout: 30000,
        accentColor: "#1a3636",
      };

      chrome.storage.sync.set({ userSettings });

      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "updateSettings",
          settings: userSettings,
        });
      }

      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: "Acción no reconocida" });
  }

  return true; // Keep message channel open for async response
});

// Update extension icon based on state
function updateExtensionIcon(active) {
  chrome.action.setIcon({
    path: active
      ? {
          16: "icons/mic-active-16.png",
          32: "icons/mic-active-32.png",
          48: "icons/mic-active-48.png",
          128: "icons/mic-active-128.png",
        }
      : {
          16: "icons/mic-inactive-16.png",
          32: "icons/mic-inactive-32.png",
          48: "icons/mic-inactive-48.png",
          128: "icons/mic-inactive-128.png",
        },
  });
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  // Only allow activation on standard web pages
  if (
    tab.url &&
    (tab.url.startsWith("http://") || tab.url.startsWith("https://"))
  ) {
    currentTabId = tab.id;

    // Toggle dictation state
    isDictating = !isDictating;

    // Send message to content script
    chrome.tabs.sendMessage(tab.id, {
      action: "setDictationState",
      isDictating,
      language: currentLanguage,
    });

    // Update UI
    updateExtensionIcon(isDictating);
    chrome.action.setBadgeText({
      text: isDictating ? "ON" : "",
      tabId: tab.id,
    });

    chrome.action.setBadgeBackgroundColor({
      color: isDictating ? "#4CAF50" : "#cccccc",
      tabId: tab.id,
    });
  }
});

// Handle tab switching - update icon state to match current tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  // Check if this was the tab with active dictation
  if (activeInfo.tabId === currentTabId && isDictating) {
    updateExtensionIcon(true);
    chrome.action.setBadgeText({
      text: "ON",
      tabId: activeInfo.tabId,
    });
  } else {
    updateExtensionIcon(false);
    chrome.action.setBadgeText({
      text: "",
      tabId: activeInfo.tabId,
    });
  }
});

// Handle tab closing - stop dictation if the active tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === currentTabId) {
    isDictating = false;
    currentTabId = null;
  }
});

// Context menu creation
function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "toggle-dictation",
      title: "Iniciar/Detener dictado por voz",
      contexts: ["page", "editable"],
    });

    chrome.contextMenus.create({
      id: "change-language",
      title: "Cambiar idioma",
      contexts: ["page", "editable"],
    });

    chrome.contextMenus.create({
      id: "lang-es",
      parentId: "change-language",
      title: "Español",
      contexts: ["page", "editable"],
    });

    chrome.contextMenus.create({
      id: "lang-en",
      parentId: "change-language",
      title: "English",
      contexts: ["page", "editable"],
    });

    chrome.contextMenus.create({
      id: "lang-fr",
      parentId: "change-language",
      title: "Français",
      contexts: ["page", "editable"],
    });

    chrome.contextMenus.create({
      id: "lang-de",
      parentId: "change-language",
      title: "Deutsch",
      contexts: ["page", "editable"],
    });

    chrome.contextMenus.create({
      id: "settings",
      title: "Configuración",
      contexts: ["page", "editable"],
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;

  switch (info.menuItemId) {
    case "toggle-dictation":
      isDictating = !isDictating;
      currentTabId = tab.id;

      chrome.tabs.sendMessage(tab.id, {
        action: "setDictationState",
        isDictating,
        language: currentLanguage,
      });

      updateExtensionIcon(isDictating);
      chrome.action.setBadgeText({
        text: isDictating ? "ON" : "",
        tabId: tab.id,
      });
      break;

    case "lang-es":
      currentLanguage = "es-ES";
      chrome.storage.sync.set({ language: currentLanguage });

      if (isDictating && currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "updateLanguage",
          language: currentLanguage,
        });
      }
      break;

    case "lang-en":
      currentLanguage = "en-US";
      chrome.storage.sync.set({ language: currentLanguage });

      if (isDictating && currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "updateLanguage",
          language: currentLanguage,
        });
      }
      break;

    case "lang-fr":
      currentLanguage = "fr-FR";
      chrome.storage.sync.set({ language: currentLanguage });

      if (isDictating && currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "updateLanguage",
          language: currentLanguage,
        });
      }
      break;

    case "lang-de":
      currentLanguage = "de-DE";
      chrome.storage.sync.set({ language: currentLanguage });

      if (isDictating && currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: "updateLanguage",
          language: currentLanguage,
        });
      }
      break;

    case "settings":
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: "showSettings",
        });
      }
      break;
  }
});

// Command shortcuts (keyboard shortcuts defined in manifest)
chrome.commands.onCommand.addListener((command) => {
  if (currentTabId) {
    switch (command) {
      case "toggle-dictation":
        isDictating = !isDictating;

        chrome.tabs.sendMessage(currentTabId, {
          action: "setDictationState",
          isDictating,
          language: currentLanguage,
        });

        updateExtensionIcon(isDictating);
        chrome.action.setBadgeText({
          text: isDictating ? "ON" : "",
          tabId: currentTabId,
        });
        break;

      case "toggle-command-mode":
        chrome.tabs.sendMessage(currentTabId, {
          action: "toggleCommandMode",
        });
        break;

      case "show-settings":
        chrome.tabs.sendMessage(currentTabId, {
          action: "showSettings",
        });
        break;
    }
  }
});

// Initialize
function initialize() {
  // Load settings
  initializeSettings();

  // Create context menu
  createContextMenu();

  // Set default icon state
  updateExtensionIcon(false);
}

// Run initialization
initialize();

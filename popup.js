// Voice Dictation Extension - Popup Script
document.addEventListener("DOMContentLoaded", function () {
  // DOM Elements
  const toggleBtn = document.getElementById("toggle-dictation");
  const commandModeBtn = document.getElementById("toggle-command-mode");
  const languageSelect = document.getElementById("language-select");
  const settingsBtn = document.getElementById("open-settings");
  const statusIndicator = document.getElementById("status-indicator");

  // Get current state from background script
  chrome.runtime.sendMessage({ action: "getState" }, function (response) {
    if (response.isDictating) {
      toggleBtn.textContent = "Detener dictado";
      toggleBtn.classList.add("active");
      statusIndicator.classList.add("active");
      statusIndicator.setAttribute("title", "Dictado activo");
    } else {
      toggleBtn.textContent = "Iniciar dictado";
      toggleBtn.classList.remove("active");
      statusIndicator.classList.remove("active");
      statusIndicator.setAttribute("title", "Dictado inactivo");
    }

    // Set language selector
    if (response.currentLanguage) {
      languageSelect.value = response.currentLanguage;
    }
  });

  // Toggle dictation event
  toggleBtn.addEventListener("click", function () {
    chrome.runtime.sendMessage(
      { action: "toggleDictation" },
      function (response) {
        if (response.isDictating) {
          toggleBtn.textContent = "Detener dictado";
          toggleBtn.classList.add("active");
          statusIndicator.classList.add("active");
          statusIndicator.setAttribute("title", "Dictado activo");
        } else {
          toggleBtn.textContent = "Iniciar dictado";
          toggleBtn.classList.remove("active");
          statusIndicator.classList.remove("active");
          statusIndicator.setAttribute("title", "Dictado inactivo");
        }
      }
    );
  });

  // Toggle command mode
  commandModeBtn.addEventListener("click", function () {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "toggleCommandMode" });
      }
    });
  });

  // Language change event
  languageSelect.addEventListener("change", function () {
    chrome.runtime.sendMessage({
      action: "setLanguage",
      language: languageSelect.value,
    });
  });

  // Open settings event
  settingsBtn.addEventListener("click", function () {
    chrome.runtime.sendMessage({ action: "showSettings" });
    window.close(); // Close popup after opening settings
  });

  // Keyboard shortcuts within popup
  document.addEventListener("keydown", function (e) {
    // Alt+D to toggle dictation
    if (e.altKey && e.key === "d") {
      e.preventDefault();
      toggleBtn.click();
    }

    // Alt+C to toggle command mode
    if (e.altKey && e.key === "c") {
      e.preventDefault();
      commandModeBtn.click();
    }

    // Alt+S to open settings
    if (e.altKey && e.key === "s") {
      e.preventDefault();
      settingsBtn.click();
    }

    // Escape to close popup
    if (e.key === "Escape") {
      window.close();
    }
  });
});

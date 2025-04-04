class VoiceDictation {
  constructor() {
    // Core properties
    this.recognition = null;
    this.currentLanguage = "es-ES";
    this.isListening = false;
    this.lastSentenceEndedWithPunctuation = false;
    this.interimResults = "";
    this.commandMode = false;

    // UI elements
    this.dictationButton = null;
    this.activeElement = null;
    this.tooltip = null;
    this.feedbackElement = null;
    this.settingsPanel = null;
    this.controlPanel = null;
    this.confidenceIndicator = null;

    // Performance related properties
    this.observer = null;
    this.mutationObserver = null;
    this.observedElements = new WeakMap(); // Using WeakMap for better memory management
    this.throttleTimers = {};
    this.idleTimer = null;
    this.recognitionRetryCount = 0;
    this.maxRecognitionRetries = 3;
    this.maxSimultaneousObservations = 30;
    this.currentObservations = 0;

    // Text processing properties
    this.consecutiveSpacesRegex = /\s{2,}/g;
    this.sentenceEndingPunctuation = new Set([".", "?", "!"]);
    this.learnedTerms = new Set();
    this.richTextEditorHandlers = new Map();
    this.suggestionHistory = [];
    this.dictionaryCorrections = new Map();

    // User settings with improved defaults
    this.userSettings = {
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

    // Enhanced punctuation and command maps
    this.punctuationMap = {
      es: {
        punto: ".",
        coma: ",",
        "punto y coma": ";",
        "dos puntos": ":",
        "signo de interrogación": "?",
        interrogación: "?",
        "signo de exclamación": "!",
        exclamación: "!",
        "abrir paréntesis": "(",
        "cerrar paréntesis": ")",
        "abrir comillas": '"',
        "cerrar comillas": '"',
        guion: "-",
        comillas: '"',
        "nueva línea": "\n",
        "nueva párrafo": "\n\n",
        borrar: "",
        espacio: " ",
        mayúscula: "",
        minúscula: "",
        "borrar última palabra": "",
        enter: "\n",
        tabulador: "\t",
      },
      en: {
        period: ".",
        comma: ",",
        semicolon: ";",
        colon: ":",
        "question mark": "?",
        "exclamation mark": "!",
        "exclamation point": "!",
        "open parenthesis": "(",
        "close parenthesis": ")",
        "open bracket": "[",
        "close bracket": "]",
        "open brace": "{",
        "close brace": "}",
        dash: "-",
        hyphen: "-",
        quote: '"',
        quotes: '"',
        "new line": "\n",
        "new paragraph": "\n\n",
        delete: "",
        space: " ",
        capitalize: "",
        lowercase: "",
        "delete last word": "",
        enter: "\n",
        tab: "\t",
      },
    };

    // Voice commands map
    this.commandsMap = {
      es: {
        "modo comando": () => this.toggleCommandMode(),
        "modo dictado": () => this.toggleCommandMode(),
        "seleccionar todo": () => document.execCommand("selectAll"),
        copiar: () => document.execCommand("copy"),
        pegar: () => document.execCommand("paste"),
        deshacer: () => document.execCommand("undo"),
        rehacer: () => document.execCommand("redo"),
        "ir al principio": () => this.moveCursorToStart(),
        "ir al final": () => this.moveCursorToEnd(),
        guardar: () => this.simulateKeyboard({ ctrlKey: true, key: "s" }),
        buscar: () => this.simulateKeyboard({ ctrlKey: true, key: "f" }),
        cerrar: () => this.simulateKeyboard({ altKey: true, key: "F4" }),
      },
      en: {
        "command mode": () => this.toggleCommandMode(),
        "dictation mode": () => this.toggleCommandMode(),
        "select all": () => document.execCommand("selectAll"),
        copy: () => document.execCommand("copy"),
        paste: () => document.execCommand("paste"),
        undo: () => document.execCommand("undo"),
        redo: () => document.execCommand("redo"),
        "go to start": () => this.moveCursorToStart(),
        "go to end": () => this.moveCursorToEnd(),
        save: () => this.simulateKeyboard({ ctrlKey: true, key: "s" }),
        find: () => this.simulateKeyboard({ ctrlKey: true, key: "f" }),
        close: () => this.simulateKeyboard({ altKey: true, key: "F4" }),
      },
    };

    // Initialize the extension
    this.init();
  }

  async init() {
    try {
      await this.loadSettings();
      await this.loadLearnedTerms();
      await this.loadDictionaryCorrections();

      this.injectFontAwesome();
      this.createUIElements();
      this.setupLanguage();
      this.setupEventListeners();
      this.setupObservers();
      this.injectStyles();
      this.setupIdleMode();
      this.restoreState();
      this.setupRichTextEditors();

      console.log("Voice Dictation initialized successfully");
    } catch (error) {
      console.error("Error initializing Voice Dictation:", error);
    }
  }

  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["language", "userSettings"], (data) => {
        this.currentLanguage = data.language || this.currentLanguage;
        this.userSettings = {
          ...this.userSettings,
          ...(data.userSettings || {}),
        };
        resolve();
      });
    });
  }

  async loadLearnedTerms() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["learnedTerms"], (data) => {
        if (data.learnedTerms) {
          this.learnedTerms = new Set(data.learnedTerms);
        }
        resolve();
      });
    });
  }

  async loadDictionaryCorrections() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["dictionaryCorrections"], (data) => {
        if (data.dictionaryCorrections) {
          this.dictionaryCorrections = new Map(data.dictionaryCorrections);
        }
        resolve();
      });
    });
  }

  async restoreState() {
    const data = await new Promise((resolve) => {
      chrome.storage.sync.get(["isDictationActive"], resolve);
    });
    if (data.isDictationActive && this.activeElement) {
      // Use requestAnimationFrame for a more responsive restart
      requestAnimationFrame(() => this.startDictation());
    }
  }

  createUIElements() {
    this.createDictationButton();
    this.createFeedbackElement();
    this.createTooltip();
    this.createSettingsPanel();
    this.createControlPanel();
    this.createConfidenceIndicator();
  }

  createDictationButton() {
    if (this.dictationButton) return;

    this.dictationButton = document.createElement("button");
    this.dictationButton.id = "voice-dictation-button";
    this.dictationButton.innerHTML = '<i class="fas fa-microphone"></i>';
    this.dictationButton.title = "Iniciar dictado por voz";
    this.dictationButton.setAttribute("aria-label", "Dictado por voz");
    this.dictationButton.setAttribute("aria-live", "polite");
    this.dictationButton.setAttribute("role", "button");

    // Apply user's accent color
    this.dictationButton.style.background = this.userSettings.accentColor;

    document.body.appendChild(this.dictationButton);

    this.dictationButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleDictation();
    });

    // Add right-click for settings
    this.dictationButton.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showSettings();
    });
  }

  createTooltip() {
    this.tooltip = document.createElement("div");
    this.tooltip.id = "voice-dictation-tooltip";
    this.tooltip.setAttribute("aria-live", "polite");
    document.body.appendChild(this.tooltip);
  }

  createFeedbackElement() {
    this.feedbackElement = document.createElement("div");
    this.feedbackElement.id = "voice-dictation-feedback";
    this.feedbackElement.setAttribute("aria-live", "polite");
    document.body.appendChild(this.feedbackElement);
  }

  createControlPanel() {
    this.controlPanel = document.createElement("div");
    this.controlPanel.id = "voice-dictation-control-panel";
    this.controlPanel.innerHTML = `
      <div class="control-buttons">
        <button id="vd-pause-btn" title="Pausar dictado" aria-label="Pausar dictado">
          <i class="fas fa-pause"></i>
        </button>
        <button id="vd-language-btn" title="Cambiar idioma" aria-label="Cambiar idioma">
          <i class="fas fa-language"></i>
        </button>
        <button id="vd-command-btn" title="Modo comando" aria-label="Modo comando">
          <i class="fas fa-terminal"></i>
        </button>
        <button id="vd-settings-btn" title="Configuración" aria-label="Configuración">
          <i class="fas fa-cog"></i>
        </button>
      </div>
      <div class="language-selector" style="display:none;">
        <button data-lang="es-ES">Español</button>
        <button data-lang="en-US">English</button>
        <button data-lang="fr-FR">Français</button>
        <button data-lang="de-DE">Deutsch</button>
        <button data-lang="it-IT">Italiano</button>
        <button data-lang="pt-BR">Português</button>
      </div>
    `;

    document.body.appendChild(this.controlPanel);

    // Configure control panel events
    document
      .getElementById("vd-pause-btn")
      .addEventListener("click", () => this.toggleDictation());
    document.getElementById("vd-language-btn").addEventListener("click", () => {
      const selector = this.controlPanel.querySelector(".language-selector");
      selector.style.display =
        selector.style.display === "none" ? "flex" : "none";
    });
    document
      .getElementById("vd-command-btn")
      .addEventListener("click", () => this.toggleCommandMode());
    document
      .getElementById("vd-settings-btn")
      .addEventListener("click", () => this.showSettings());

    // Language selection events
    this.controlPanel
      .querySelectorAll(".language-selector button")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          this.currentLanguage = btn.getAttribute("data-lang");
          chrome.storage.sync.set({ language: this.currentLanguage });
          if (this.recognition) {
            this.recognition.lang = this.currentLanguage;
          }
          this.controlPanel.querySelector(".language-selector").style.display =
            "none";
          this.showTooltip(`Idioma cambiado a: ${btn.textContent}`);
        });
      });
  }

  createConfidenceIndicator() {
    this.confidenceIndicator = document.createElement("div");
    this.confidenceIndicator.id = "voice-dictation-confidence";
    this.confidenceIndicator.innerHTML = `
      <div class="confidence-bar">
        <div class="confidence-level"></div>
      </div>
    `;
    document.body.appendChild(this.confidenceIndicator);
  }

  createSettingsPanel() {
    this.settingsPanel = document.createElement("div");
    this.settingsPanel.id = "voice-dictation-settings";
    this.settingsPanel.innerHTML = `
      <div class="settings-header">
        <h3>Configuración de Dictado por Voz</h3>
        <button id="vd-close-settings" aria-label="Cerrar configuración">×</button>
      </div>
      <div class="settings-content">
        <div class="settings-tabs">
          <button class="tab-btn active" data-tab="general">General</button>
          <button class="tab-btn" data-tab="appearance">Apariencia</button>
          <button class="tab-btn" data-tab="advanced">Avanzado</button>
          <button class="tab-btn" data-tab="dictionary">Diccionario</button>
        </div>
        
        <div class="tab-content active" id="general-tab">
          <div class="setting-group">
            <label>
              <input type="checkbox" id="vd-auto-capitalize" ${
                this.userSettings.autoCapitalize ? "checked" : ""
              }>
              Capitalización automática
            </label>
          </div>
          <div class="setting-group">
            <label>
              <input type="checkbox" id="vd-preserve-english" ${
                this.userSettings.preserveEnglish ? "checked" : ""
              }>
              Conservar términos en inglés
            </label>
          </div>
          <div class="setting-group">
            <label>
              <input type="checkbox" id="vd-enable-learning" ${
                this.userSettings.enableLearning ? "checked" : ""
              }>
              Aprendizaje automático de términos
            </label>
          </div>
          <div class="setting-group">
            <label>
              <input type="checkbox" id="vd-auto-correct" ${
                this.userSettings.autoCorrect ? "checked" : ""
              }>
              Autocorrección
            </label>
          </div>
          <div class="setting-group">
            <label>
              <input type="checkbox" id="vd-continuous-mode" ${
                this.userSettings.continuousMode ? "checked" : ""
              }>
              Modo continuo
            </label>
          </div>
          <div class="setting-group">
            <label>
              <input type="checkbox" id="vd-enable-commands" ${
                this.userSettings.enableVoiceCommands ? "checked" : ""
              }>
              Habilitar comandos de voz
            </label>
          </div>
        </div>
        
        <div class="tab-content" id="appearance-tab">
          <div class="setting-group">
            <label>Posición del botón:</label>
            <select id="vd-button-position">
              <option value="right" ${
                this.userSettings.buttonPosition === "right" ? "selected" : ""
              }>Derecha</option>
              <option value="left" ${
                this.userSettings.buttonPosition === "left" ? "selected" : ""
              }>Izquierda</option>
            </select>
          </div>
          <div class="setting-group">
            <label>
              <input type="checkbox" id="vd-show-control-panel" ${
                this.userSettings.showControlPanel ? "checked" : ""
              }>
              Mostrar panel de control
            </label>
          </div>
          <div class="setting-group">
            <label>Color de acento:</label>
            <input type="color" id="vd-accent-color" value="${
              this.userSettings.accentColor
            }">
          </div>
          <div class="setting-group">
            <label>Duración del tooltip (ms):</label>
            <input type="number" id="vd-tooltip-duration" value="${
              this.userSettings.tooltipDuration
            }">
          </div>
        </div>
        
        <div class="tab-content" id="advanced-tab">
          <div class="setting-group">
            <label>Umbral de confianza (%):</label>
            <input type="range" id="vd-confidence-threshold" min="0" max="1" step="0.05" 
              value="${this.userSettings.confidenceThreshold}">
            <span id="vd-confidence-value">${
              this.userSettings.confidenceThreshold * 100
            }%</span>
          </div>
          <div class="setting-group">
            <label>Tiempo de inactividad (ms):</label>
            <input type="number" id="vd-idle-timeout" value="${
              this.userSettings.idleTimeout
            }">
          </div>
          <div class="setting-group">
            <label>Idioma predeterminado:</label>
            <select id="vd-default-language">
              <option value="es-ES" ${
                this.currentLanguage === "es-ES" ? "selected" : ""
              }>Español</option>
              <option value="en-US" ${
                this.currentLanguage === "en-US" ? "selected" : ""
              }>English</option>
              <option value="fr-FR" ${
                this.currentLanguage === "fr-FR" ? "selected" : ""
              }>Français</option>
              <option value="de-DE" ${
                this.currentLanguage === "de-DE" ? "selected" : ""
              }>Deutsch</option>
              <option value="it-IT" ${
                this.currentLanguage === "it-IT" ? "selected" : ""
              }>Italiano</option>
              <option value="pt-BR" ${
                this.currentLanguage === "pt-BR" ? "selected" : ""
              }>Português</option>
            </select>
          </div>
        </div>
        
        <div class="tab-content" id="dictionary-tab">
          <h4>Términos aprendidos</h4>
          <div class="dictionary-search">
            <input type="text" id="vd-term-search" placeholder="Buscar término...">
          </div>
          <ul id="vd-learned-terms-list" class="scrollable-list"></ul>
          <div class="add-term">
            <input type="text" id="vd-new-term" placeholder="Nuevo término">
            <button id="vd-add-term">Añadir</button>
          </div>
          
          <h4>Correcciones personalizadas</h4>
          <div class="corrections-container">
            <div class="correction-pair">
              <input type="text" id="vd-incorrect-word" placeholder="Palabra incorrecta">
              <input type="text" id="vd-correct-word" placeholder="Corrección">
              <button id="vd-add-correction">Añadir</button>
            </div>
            <ul id="vd-corrections-list" class="scrollable-list"></ul>
          </div>
        </div>
        
        <div class="settings-buttons">
          <button id="vd-reset-settings">Restablecer</button>
          <button id="vd-save-settings">Guardar</button>
        </div>
      </div>
    `;
    document.body.appendChild(this.settingsPanel);

    // Settings events
    document
      .getElementById("vd-save-settings")
      .addEventListener("click", () => this.saveSettings());
    document
      .getElementById("vd-close-settings")
      .addEventListener("click", () => this.hideSettings());
    document
      .getElementById("vd-reset-settings")
      .addEventListener("click", () => this.resetSettings());
    document
      .getElementById("vd-add-term")
      .addEventListener("click", () => this.addLearnedTerm());
    document
      .getElementById("vd-add-correction")
      .addEventListener("click", () => this.addCustomCorrection());

    // Tab switching
    this.settingsPanel.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        // Deactivate all tabs
        this.settingsPanel
          .querySelectorAll(".tab-btn")
          .forEach((b) => b.classList.remove("active"));
        this.settingsPanel
          .querySelectorAll(".tab-content")
          .forEach((c) => c.classList.remove("active"));

        // Activate selected tab
        e.target.classList.add("active");
        document
          .getElementById(`${e.target.dataset.tab}-tab`)
          .classList.add("active");
      });
    });

    // Update confidence threshold display
    const confidenceInput = document.getElementById("vd-confidence-threshold");
    const confidenceValue = document.getElementById("vd-confidence-value");
    confidenceInput.addEventListener("input", () => {
      confidenceValue.textContent = `${Math.round(
        confidenceInput.value * 100
      )}%`;
    });

    // Term search functionality
    document.getElementById("vd-term-search").addEventListener("input", (e) => {
      const searchText = e.target.value.toLowerCase();
      const termsList = document.getElementById("vd-learned-terms-list");

      Array.from(termsList.children).forEach((li) => {
        const term = li.textContent.replace("×", "").toLowerCase();
        li.style.display = term.includes(searchText) ? "" : "none";
      });
    });

    this.updateLearnedTermsList();
    this.updateCorrectionsList();
  }

  showSettings() {
    this.settingsPanel.style.display = "block";
    this.updateLearnedTermsList();
    this.updateCorrectionsList();
  }

  hideSettings() {
    this.settingsPanel.style.display = "none";
  }

  resetSettings() {
    if (
      confirm(
        "¿Estás seguro de que deseas restablecer todas las configuraciones a sus valores predeterminados?"
      )
    ) {
      this.userSettings = {
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

      // Update UI to reflect reset settings
      document.getElementById("vd-auto-capitalize").checked =
        this.userSettings.autoCapitalize;
      document.getElementById("vd-preserve-english").checked =
        this.userSettings.preserveEnglish;
      document.getElementById("vd-enable-learning").checked =
        this.userSettings.enableLearning;
      document.getElementById("vd-auto-correct").checked =
        this.userSettings.autoCorrect;
      document.getElementById("vd-continuous-mode").checked =
        this.userSettings.continuousMode;
      document.getElementById("vd-enable-commands").checked =
        this.userSettings.enableVoiceCommands;
      document.getElementById("vd-button-position").value =
        this.userSettings.buttonPosition;
      document.getElementById("vd-show-control-panel").checked =
        this.userSettings.showControlPanel;
      document.getElementById("vd-accent-color").value =
        this.userSettings.accentColor;
      document.getElementById("vd-tooltip-duration").value =
        this.userSettings.tooltipDuration;
      document.getElementById("vd-confidence-threshold").value =
        this.userSettings.confidenceThreshold;
      document.getElementById("vd-confidence-value").textContent = `${
        this.userSettings.confidenceThreshold * 100
      }%`;
      document.getElementById("vd-idle-timeout").value =
        this.userSettings.idleTimeout;

      this.showTooltip("Configuración restablecida correctamente", "status");
    }
  }

  saveSettings() {
    this.userSettings = {
      autoCapitalize: document.getElementById("vd-auto-capitalize").checked,
      preserveEnglish: document.getElementById("vd-preserve-english").checked,
      enableLearning: document.getElementById("vd-enable-learning").checked,
      autoCorrect: document.getElementById("vd-auto-correct").checked,
      continuousMode: document.getElementById("vd-continuous-mode").checked,
      enableVoiceCommands:
        document.getElementById("vd-enable-commands").checked,
      buttonPosition: document.getElementById("vd-button-position").value,
      showControlPanel: document.getElementById("vd-show-control-panel")
        .checked,
      accentColor: document.getElementById("vd-accent-color").value,
      tooltipDuration:
        parseInt(document.getElementById("vd-tooltip-duration").value) || 3000,
      confidenceThreshold:
        parseFloat(document.getElementById("vd-confidence-threshold").value) ||
        0.7,
      idleTimeout:
        parseInt(document.getElementById("vd-idle-timeout").value) || 30000,
    };

    // Update language if changed
    const newLanguage = document.getElementById("vd-default-language").value;
    if (newLanguage !== this.currentLanguage) {
      this.currentLanguage = newLanguage;
      chrome.storage.sync.set({ language: this.currentLanguage });
      if (this.recognition) {
        this.recognition.lang = this.currentLanguage;
      }
    }

    // Apply visual changes
    this.dictationButton.style.background = this.userSettings.accentColor;
    this.controlPanel.style.display = this.userSettings.showControlPanel
      ? "block"
      : "none";

    chrome.storage.sync.set({ userSettings: this.userSettings });
    this.hideSettings();
    this.positionButton(this.activeElement);
    this.showTooltip("Configuración guardada correctamente", "status");
  }

  addLearnedTerm() {
    const termInput = document.getElementById("vd-new-term");
    const term = termInput.value.trim();

    if (term && !this.learnedTerms.has(term.toLowerCase())) {
      this.learnedTerms.add(term.toLowerCase());
      chrome.storage.sync.set({
        learnedTerms: Array.from(this.learnedTerms),
      });
      termInput.value = "";
      this.updateLearnedTermsList();

      // Add to punctuation map for preservation
      const langCode = this.currentLanguage.substring(0, 2);
      if (langCode === "es" && !this.punctuationMap["en"][term.toLowerCase()]) {
        this.punctuationMap["en"][term.toLowerCase()] = term;
      }

      this.showTooltip(`Término "${term}" añadido correctamente`, "status");
    } else if (this.learnedTerms.has(term.toLowerCase())) {
      this.showTooltip(`El término "${term}" ya existe`, "error");
    }
  }

  updateLearnedTermsList() {
    const list = document.getElementById("vd-learned-terms-list");
    if (!list) return;

    list.innerHTML = "";

    if (this.learnedTerms.size === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "empty-list";
      emptyItem.textContent = "No hay términos guardados";
      list.appendChild(emptyItem);
      return;
    }

    Array.from(this.learnedTerms)
      .sort()
      .forEach((term) => {
        const li = document.createElement("li");
        li.textContent = term;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.className = "remove-term";
        removeBtn.setAttribute("aria-label", `Eliminar término ${term}`);
        removeBtn.addEventListener("click", () => {
          this.learnedTerms.delete(term);
          chrome.storage.sync.set({
            learnedTerms: Array.from(this.learnedTerms),
          });
          this.updateLearnedTermsList();
          this.showTooltip(`Término "${term}" eliminado`, "status");
        });

        li.appendChild(removeBtn);
        list.appendChild(li);
      });
  }

  addCustomCorrection() {
    const incorrectInput = document.getElementById("vd-incorrect-word");
    const correctInput = document.getElementById("vd-correct-word");

    const incorrectWord = incorrectInput.value.trim().toLowerCase();
    const correctWord = correctInput.value.trim();

    if (incorrectWord && correctWord) {
      this.dictionaryCorrections.set(incorrectWord, correctWord);

      // Save to storage as array of arrays (Map isn't directly serializable)
      chrome.storage.sync.set({
        dictionaryCorrections: Array.from(this.dictionaryCorrections.entries()),
      });

      incorrectInput.value = "";
      correctInput.value = "";

      this.updateCorrectionsList();
      this.showTooltip(
        `Corrección añadida: "${incorrectWord}" → "${correctWord}"`,
        "status"
      );
    }
  }

  updateCorrectionsList() {
    const list = document.getElementById("vd-corrections-list");
    if (!list) return;

    list.innerHTML = "";

    if (this.dictionaryCorrections.size === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "empty-list";
      emptyItem.textContent = "No hay correcciones guardadas";
      list.appendChild(emptyItem);
      return;
    }

    // Sort corrections alphabetically
    Array.from(this.dictionaryCorrections.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([incorrect, correct]) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="incorrect-word">${incorrect}</span> → <span class="correct-word">${correct}</span>`;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "×";
        removeBtn.className = "remove-term";
        removeBtn.setAttribute(
          "aria-label",
          `Eliminar corrección para ${incorrect}`
        );
        removeBtn.addEventListener("click", () => {
          this.dictionaryCorrections.delete(incorrect);
          chrome.storage.sync.set({
            dictionaryCorrections: Array.from(
              this.dictionaryCorrections.entries()
            ),
          });
          this.updateCorrectionsList();
          this.showTooltip(
            `Corrección eliminada para "${incorrect}"`,
            "status"
          );
        });

        li.appendChild(removeBtn);
        list.appendChild(li);
      });
  }

  setupRichTextEditors() {
    // Setup event handlers for different rich text editors

    // CKEditor
    // CKEditor
    this.registerRichTextHandler("cke_editor", (element) => {
      return {
        insert: (text) => {
          const editor = CKEDITOR.instances[element.id];
          if (editor) {
            editor.insertText(text);
            return true;
          }
          return false;
        },
        deleteLastWord: () => {
          const editor = CKEDITOR.instances[element.id];
          if (editor) {
            const range = editor.getSelection().getRanges()[0];
            const walker = new CKEDITOR.dom.walker(range);
            walker.evaluator = (node) => node.type === CKEDITOR.NODE_TEXT;
            walker.guard = (node) =>
              node.type !== CKEDITOR.NODE_ELEMENT || node.getName() !== "br";

            let lastTextNode = null;
            let offset = 0;

            while ((node = walker.previous())) {
              lastTextNode = node;
              offset = node.getLength();
              break;
            }

            if (lastTextNode) {
              const text = lastTextNode.getText();
              const lastSpace = text.lastIndexOf(" ", offset - 2);

              if (lastSpace > -1) {
                lastTextNode.setText(
                  text.substring(0, lastSpace + 1) + text.substring(offset)
                );
                range.setStart(lastTextNode, lastSpace + 1);
              } else {
                lastTextNode.setText(text.substring(offset));
                range.setStart(lastTextNode, 0);
              }

              range.collapse(true);
              editor.getSelection().selectRanges([range]);
              return true;
            }
          }
          return false;
        },
      };
    });

    // TinyMCE
    this.registerRichTextHandler("tinymce", (element) => {
      return {
        insert: (text) => {
          const editor = tinymce.get(element.id);
          if (editor) {
            editor.insertContent(text);
            return true;
          }
          return false;
        },
        deleteLastWord: () => {
          const editor = tinymce.get(element.id);
          if (editor) {
            const selection = editor.selection;
            const range = selection.getRng();
            const textNode = range.startContainer;

            if (textNode.nodeType === Node.TEXT_NODE) {
              const text = textNode.data;
              const offset = range.startOffset;
              const lastSpace = text.lastIndexOf(" ", offset - 2);

              if (lastSpace > -1) {
                textNode.data =
                  text.substring(0, lastSpace + 1) + text.substring(offset);
                range.setStart(textNode, lastSpace + 1);
              } else {
                textNode.data = text.substring(offset);
                range.setStart(textNode, 0);
              }

              range.collapse(true);
              selection.setRng(range);
              return true;
            }
          }
          return false;
        },
      };
    });

    // Quill
    this.registerRichTextHandler("ql-editor", (element) => {
      return {
        insert: (text) => {
          const editor = $(element).closest(".quill-wrapper").data("quill");
          if (editor) {
            const range = editor.getSelection();
            if (range) {
              editor.insertText(range.index, text);
              return true;
            }
          }
          return false;
        },
        deleteLastWord: () => {
          const editor = $(element).closest(".quill-wrapper").data("quill");
          if (editor) {
            const range = editor.getSelection();
            if (range) {
              const [leaf, offset] = editor.getLeaf(range.index);
              if (leaf.domNode.nodeType === Node.TEXT_NODE) {
                const text = leaf.domNode.data;
                const lastSpace = text.lastIndexOf(" ", offset - 2);

                if (lastSpace > -1) {
                  editor.deleteText(
                    range.index - (offset - lastSpace - 1),
                    offset - lastSpace - 1
                  );
                } else {
                  editor.deleteText(range.index - offset, offset);
                }
                return true;
              }
            }
          }
          return false;
        },
      };
    });

    // ContentEditable genérico mejorado
    this.registerRichTextHandler("contenteditable", (element) => {
      return {
        insert: (text) => {
          if (element.isContentEditable) {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              range.deleteContents();

              if (text === "\n" || text === "\n\n") {
                const br = document.createElement("br");
                range.insertNode(br);
                if (text === "\n\n") {
                  const newRange = document.createRange();
                  newRange.setStartAfter(br);
                  newRange.insertNode(document.createElement("br"));
                  range.setStartAfter(br.nextSibling);
                } else {
                  range.setStartAfter(br);
                }
              } else {
                const textNode = document.createTextNode(text);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
              }

              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              this.triggerInputEvent();
              return true;
            }
          }
          return false;
        },
        deleteLastWord: () => {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const textContent = range.startContainer.textContent || "";
            const lastSpace = textContent.lastIndexOf(
              " ",
              range.startOffset - 2
            );

            if (lastSpace > -1) {
              range.setStart(range.startContainer, lastSpace + 1);
            } else {
              range.setStart(range.startContainer, 0);
            }

            range.deleteContents();
            this.triggerInputEvent();
            return true;
          }
          return false;
        },
      };
    });
  }

  registerRichTextHandler(className, handlerFactory) {
    this.richTextEditorHandlers.set(className, handlerFactory);
  }

  getRichTextHandler(element) {
    if (!element) return null;

    // Buscar por clase directa
    for (const [className, handlerFactory] of this.richTextEditorHandlers) {
      if (element.classList.contains(className)) {
        return handlerFactory(element);
      }
    }

    // Buscar en padres
    for (const [className, handlerFactory] of this.richTextEditorHandlers) {
      const parentElement = element.closest(`.${className}`);
      if (parentElement) {
        return handlerFactory(parentElement);
      }
    }

    // Si es contentEditable pero no tiene un manejador específico
    if (element.isContentEditable) {
      return this.richTextEditorHandlers.get("contenteditable")(element);
    }

    return null;
  }

  injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #voice-dictation-button {
        position: absolute;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${this.userSettings.accentColor};
        color: white;
        border: none;
        cursor: pointer;
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: transform 0.2s, background 0.2s;
        font-size: 18px;
        outline: none;
      }
      
      #voice-dictation-button:focus {
        box-shadow: 0 0 0 3px rgba(26, 54, 54, 0.4);
      }
      
      #voice-dictation-button:hover {
        transform: scale(1.1);
        background: ${this.adjustColor(this.userSettings.accentColor, -20)};
      }
      
      #voice-dictation-button.recording {
        background: #db4437;
        animation: pulse 1.5s infinite;
      }
      
      #voice-dictation-button.recording:hover {
        background: #c53929;
      }
      
      #voice-dictation-button.command-mode {
        background: #4285f4;
      }
      
      #voice-dictation-button.command-mode:hover {
        background: #3367d6;
      }
      
      #voice-dictation-button.command-mode.recording {
        background: #4285f4;
        animation: pulse 1.5s infinite;
      }
      
      #voice-dictation-tooltip {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 12px 24px;
        border-radius: 4px;
        font-size: 16px;
        pointer-events: none;
        opacity: 0;
        z-index: 10000;
        max-width: 80vw;
        text-align: center;
        transition: opacity 0.3s;
      }
      
      #voice-dictation-tooltip.error {
        background: rgba(211, 47, 47, 0.9);
      }
      
      #voice-dictation-tooltip.status {
        background: rgba(56, 142, 60, 0.9);
      }
      
      #voice-dictation-tooltip.command {
        background: rgba(66, 133, 244, 0.9);
      }
      
      #voice-dictation-feedback {
        position: fixed;
        bottom: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 14px;
        pointer-events: none;
        opacity: 0;
        z-index: 9998;
        max-width: 80vw;
        text-align: center;
        transition: opacity 0.3s;
      }
      
      #voice-dictation-control-panel {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9997;
        display: ${this.userSettings.showControlPanel ? "block" : "none"};
        overflow: hidden;
        transition: all 0.3s ease;
      }
      
      #voice-dictation-control-panel .control-buttons {
        display: flex;
        border-bottom: 1px solid #eee;
      }
      
      #voice-dictation-control-panel button {
        background: none;
        border: none;
        padding: 10px 15px;
        cursor: pointer;
        color: #555;
        transition: all 0.2s;
      }
      
      #voice-dictation-control-panel button:hover {
        background: #f5f5f5;
        color: ${this.userSettings.accentColor};
      }
      
      #voice-dictation-control-panel .language-selector {
        display: flex;
        flex-wrap: wrap;
        padding: 10px;
        max-width: 200px;
      }
      
      #voice-dictation-control-panel .language-selector button {
        flex: 1 0 50%;
        text-align: center;
        padding: 8px;
        font-size: 12px;
      }
      
      #voice-dictation-confidence {
        position: fixed;
        bottom: 70px;
        right: 20px;
        width: 150px;
        background: rgba(255,255,255,0.8);
        border-radius: 4px;
        padding: 5px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        z-index: 9996;
        display: none;
      }
      
      #voice-dictation-confidence .confidence-bar {
        height: 6px;
        background: #eee;
        border-radius: 3px;
        overflow: hidden;
      }
      
      #voice-dictation-confidence .confidence-level {
        height: 100%;
        width: 0%;
        background: ${this.userSettings.accentColor};
        transition: width 0.3s;
      }
      
      #voice-dictation-settings {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.2);
        z-index: 10001;
        width: 400px;
        max-width: 90vw;
        max-height: 85vh;
        overflow: hidden;
        color: #333;
      }
      
      #voice-dictation-settings .settings-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        border-bottom: 1px solid #eee;
      }
      
      #voice-dictation-settings .settings-header h3 {
        margin: 0;
        color: ${this.userSettings.accentColor};
        font-size: 18px;
      }
      
      #voice-dictation-settings #vd-close-settings {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        color: #999;
      }
      
      #voice-dictation-settings #vd-close-settings:hover {
        color: #333;
      }
      
      #voice-dictation-settings .settings-content {
        padding: 20px;
        max-height: calc(85vh - 60px);
        overflow-y: auto;
      }
      
      .settings-tabs {
        display: flex;
        margin-bottom: 20px;
        border-bottom: 1px solid #eee;
      }
      
      .settings-tabs .tab-btn {
        background: none;
        border: none;
        padding: 10px 15px;
        margin-right: 5px;
        cursor: pointer;
        color: #666;
        border-bottom: 2px solid transparent;
      }
      
      .settings-tabs .tab-btn.active {
        color: ${this.userSettings.accentColor};
        border-bottom: 2px solid ${this.userSettings.accentColor};
      }
      
      .tab-content {
        display: none;
      }
      
      .tab-content.active {
        display: block;
      }
      
      .setting-group {
        margin-bottom: 15px;
      }
      
      .setting-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
      }
      
      .setting-group input[type="checkbox"] {
        margin-right: 8px;
      }
      
      .setting-group select, 
      .setting-group input[type="number"],
      .setting-group input[type="text"],
      .setting-group input[type="color"] {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      
      .setting-group input[type="range"] {
        width: 80%;
        vertical-align: middle;
      }
      
      #vd-confidence-value {
        display: inline-block;
        width: 15%;
        text-align: right;
        padding-left: 5px;
      }
      
      h4 {
        margin-top: 20px;
        margin-bottom: 10px;
        padding-bottom: 5px;
        border-bottom: 1px solid #eee;
        color: #555;
      }
      
      .scrollable-list {
        list-style: none;
        padding: 0;
        max-height: 150px;
        overflow-y: auto;
        border: 1px solid #eee;
        border-radius: 4px;
        margin-bottom: 10px;
      }
      
      .scrollable-list li {
        padding: 8px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #f5f5f5;
      }
      
      .scrollable-list li:last-child {
        border-bottom: none;
      }
      
      .scrollable-list li:hover {
        background: #f9f9f9;
      }
      
      .scrollable-list .empty-list {
        color: #999;
        font-style: italic;
        justify-content: center;
      }
      
      .incorrect-word {
        color: #d32f2f;
        text-decoration: line-through;
        margin-right: 5px;
      }
      
      .correct-word {
        color: #388e3c;
        font-weight: 500;
      }
      
      .remove-term {
        background: none;
        border: none;
        color: #db4437;
        cursor: pointer;
        font-size: 16px;
        padding: 0 5px;
      }
      
      .dictionary-search {
        margin-bottom: 10px;
      }
      
      .dictionary-search input {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      
      .add-term {
        display: flex;
        margin-top: 5px;
        margin-bottom: 20px;
      }
      
      .add-term input {
        flex-grow: 1;
        margin-right: 5px;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .add-term button {
        padding: 8px 12px;
        background: ${this.userSettings.accentColor};
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .correction-pair {
        display: flex;
        margin-bottom: 10px;
      }
      
      .correction-pair input {
        flex-grow: 1;
        margin-right: 5px;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      
      .correction-pair button {
        padding: 8px 12px;
        background: ${this.userSettings.accentColor};
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .settings-buttons {
        display: flex;
        justify-content: flex-end;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #eee;
      }
      
      .settings-buttons button {
        padding: 8px 15px;
        margin-left: 10px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      
      #vd-save-settings {
        background: ${this.userSettings.accentColor};
        color: white;
      }
      
      #vd-reset-settings {
        background: #f5f5f5;
        color: #333;
      }
      
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        #voice-dictation-settings,
        #voice-dictation-control-panel {
          background: #333;
          color: #eee;
        }
        
        #voice-dictation-settings h3 {
          color: white;
        }
        
        #voice-dictation-settings #vd-close-settings {
          color: #ccc;
        }
        
        #voice-dictation-settings #vd-close-settings:hover {
          color: white;
        }
        
        .settings-tabs {
          border-bottom-color: #555;
        }
        
        .settings-tabs .tab-btn {
          color: #ccc;
        }
        
        .scrollable-list {
          border-color: #555;
        }
        
        .scrollable-list li {
          border-bottom-color: #444;
        }
        
        .scrollable-list li:hover {
          background: #3a3a3a;
        }
        
        .setting-group select,
        .setting-group input[type="number"],
        .setting-group input[type="text"] {
          background: #444;
          border-color: #555;
          color: #eee;
        }
        
        .add-term input,
        .correction-pair input,
        .dictionary-search input {
          background: #444;
          border-color: #555;
          color: #eee;
        }
        
        #vd-reset-settings {
          background: #444;
          color: #eee;
        }
        
        .settings-buttons {
          border-top-color: #444;
        }
        
        #voice-dictation-control-panel button {
          color: #ccc;
        }
        
        #voice-dictation-control-panel button:hover {
          background: #444;
        }
        
        #voice-dictation-confidence {
          background: rgba(51,51,51,0.8);
        }
        
        #voice-dictation-confidence .confidence-bar {
          background: #444;
        }
      }
      
      @media (prefers-reduced-motion: reduce) {
        #voice-dictation-button, 
        #voice-dictation-tooltip, 
        #voice-dictation-feedback,
        #voice-dictation-control-panel,
        #voice-dictation-confidence .confidence-level {
          transition: none;
          animation: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Helper function to darken/lighten a hex color
  adjustColor(hex, percent) {
    // Remove # if present
    hex = hex.replace(/^#/, "");

    // Convert to rgb
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // Adjust
    r = Math.max(0, Math.min(255, Math.round(r + (percent / 100) * 255)));
    g = Math.max(0, Math.min(255, Math.round(g + (percent / 100) * 255)));
    b = Math.max(0, Math.min(255, Math.round(b + (percent / 100) * 255)));

    // Convert back to hex
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  setupEventListeners() {
    const passiveOptions = { passive: true };

    // Utility function for debouncing events
    const debounce = (fn, delay) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    };

    // Use event delegation for better performance
    document.addEventListener(
      "focusin",
      this.throttle(this.handleFocusChange.bind(this), 200)
    );
    document.addEventListener(
      "click",
      this.throttle(this.handleFocusChange.bind(this), 200)
    );

    // Window events with optimized passive handlers
    window.addEventListener(
      "scroll",
      debounce(this.updateButtonPosition.bind(this), 100),
      passiveOptions
    );
    window.addEventListener(
      "resize",
      debounce(this.updateButtonPosition.bind(this), 100),
      passiveOptions
    );

    // Keyboard shortcut support
    document.addEventListener("keydown", (e) => {
      // Alt+Shift+D to toggle dictation
      if (e.altKey && e.shiftKey && e.key === "d") {
        e.preventDefault();
        this.toggleDictation();
      }

      // Alt+Shift+S to open settings
      if (e.altKey && e.shiftKey && e.key === "s") {
        e.preventDefault();
        this.showSettings();
      }

      // Alt+Shift+C to toggle command mode
      if (e.altKey && e.shiftKey && e.key === "c") {
        e.preventDefault();
        this.toggleCommandMode();
      }
    });

    // Chrome message listener
    chrome.runtime.onMessage.addListener((message) => {
      switch (message.action) {
        case "updateLanguage":
          this.currentLanguage = message.language;
          if (this.recognition) {
            this.recognition.lang = this.currentLanguage;
          }
          break;

        case "updateSettings":
          this.userSettings = { ...this.userSettings, ...message.settings };
          break;

        case "showSettings":
          this.showSettings();
          break;

        case "setDictationState":
          if (message.isDictating) {
            this.startDictation();
          } else {
            this.stopDictation();
          }
          break;
      }
      return true;
    });
  }

  throttle(fn, delay) {
    let lastCall = 0;
    return (...args) => {
      const now = new Date().getTime();
      if (now - lastCall < delay) return;
      lastCall = now;
      fn.apply(this, args);
    };
  }

  setupObservers() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && this.isTextInput(entry.target)) {
            if (
              this.currentObservations < this.maxSimultaneousObservations &&
              !this.observedElements.has(entry.target)
            ) {
              this.observedElements.set(entry.target, true);
              this.currentObservations++;
              this.positionButton(entry.target);
            }
          } else if (this.observedElements.has(entry.target)) {
            this.observedElements.delete(entry.target);
            this.currentObservations--;
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
      }
    );

    this.mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (this.isTextInput(node)) {
                this.observeElement(node);
              }

              if (window.requestIdleCallback) {
                requestIdleCallback(() => {
                  node
                    .querySelectorAll(
                      'input, textarea, [contenteditable="true"]'
                    )
                    .forEach((el) => {
                      this.observeElement(el);
                    });
                });
              } else {
                node
                  .querySelectorAll('input, textarea, [contenteditable="true"]')
                  .forEach((el) => {
                    this.observeElement(el);
                  });
              }
            }
          });
        }
      });
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    if (window.requestIdleCallback) {
      requestIdleCallback(() => {
        document
          .querySelectorAll('input, textarea, [contenteditable="true"]')
          .forEach((el) => {
            this.observeElement(el);
          });
      });
    } else {
      document
        .querySelectorAll('input, textarea, [contenteditable="true"]')
        .forEach((el) => {
          this.observeElement(el);
        });
    }
  }

  observeElement(element) {
    if (
      this.currentObservations < this.maxSimultaneousObservations &&
      !this.observedElements.has(element) &&
      this.isTextInput(element)
    ) {
      this.observer.observe(element);
      this.observedElements.set(element, true);
      this.currentObservations++;
    }
  }

  setupIdleMode() {
    const resetIdleTimer = () => {
      if (this.idleTimer) clearTimeout(this.idleTimer);
      if (!this.isListening) {
        this.idleTimer = setTimeout(() => {
          this.enterIdleMode();
        }, this.userSettings.idleTimeout);
      }
    };

    const activityEvents = [
      "mousemove",
      "keydown",
      "scroll",
      "click",
      "touchstart",
    ];
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    });

    resetIdleTimer();
  }

  enterIdleMode() {
    if (this.isListening) return;
    if (this.observer) {
      this.observer.disconnect();
      this.observedElements = new WeakMap();
      this.currentObservations = 0;
    }
    if (this.dictationButton && this.dictationButton.style.display !== "none") {
      this.dictationButton.style.display = "none";
    }
  }

  exitIdleMode() {
    if (this.observer) {
      this.observer.disconnect();
      this.observedElements = new WeakMap();
      this.currentObservations = 0;

      document
        .querySelectorAll('input, textarea, [contenteditable="true"]')
        .forEach((el) => {
          this.observeElement(el);
        });
    }

    if (this.activeElement) {
      this.positionButton(this.activeElement);
    }

    this.setupIdleMode();
  }

  handleFocusChange(event) {
    const target = event.target;
    if (this.isTextInput(target)) {
      this.activeElement = target;
      this.positionButton(this.activeElement);
      this.exitIdleMode();
    }
  }

  updateButtonPosition() {
    if (this.activeElement) {
      this.positionButton(this.activeElement);
    }
  }

  isTextInput(element) {
    if (!element || !element.tagName) return false;

    const tagName = element.tagName.toLowerCase();
    const type = element.type ? element.type.toLowerCase() : "";

    if (
      element.disabled ||
      element.hidden ||
      element.offsetParent === null ||
      getComputedStyle(element).visibility === "hidden" ||
      element.readOnly
    ) {
      return false;
    }

    return (
      (tagName === "input" &&
        (type === "text" ||
          type === "search" ||
          type === "email" ||
          type === "url" ||
          type === "password" ||
          type === "tel" ||
          type === "number")) ||
      tagName === "textarea" ||
      (element.isContentEditable && !element.classList.contains("ace_content"))
    );
  }

  positionButton(element) {
    if (!element || !this.dictationButton) return;

    try {
      const rect = element.getBoundingClientRect();
      const buttonSize = 40;
      const margin = 10;

      let top = window.scrollY + rect.top + rect.height / 2 - buttonSize / 2;
      let left = window.scrollX + rect.right + margin;

      if (this.userSettings.buttonPosition === "left") {
        left = window.scrollX + rect.left - buttonSize - margin;
      }

      const maxLeft = window.innerWidth - buttonSize - margin;
      if (left > maxLeft) {
        left = window.scrollX + rect.left - buttonSize - margin;
      }

      const maxTop = window.innerHeight - buttonSize - margin;
      if (top > maxTop) {
        top = maxTop;
      }

      this.dictationButton.style.top = `${Math.max(margin, top)}px`;
      this.dictationButton.style.left = `${Math.max(margin, left)}px`;
      this.dictationButton.style.display = "flex";
    } catch (e) {
      console.error("Error positioning button:", e);
    }
  }

  toggleDictation() {
    if (this.isListening) {
      this.stopDictation();
    } else {
      this.startDictation();
    }
  }

  async startDictation() {
    if (!this.activeElement) {
      this.showTooltip("Seleccione un campo de texto primero", "error");
      return;
    }

    try {
      const hasPermission = await this.checkMicrophonePermission();
      if (!hasPermission) {
        this.showTooltip("Permiso de micrófono no concedido", "error");
        return;
      }

      if (!this.lazyRecognitionInit) {
        this.setupSpeechRecognition();
      }

      this.recognition.start();
      this.showControlPanelIfEnabled();
    } catch (e) {
      console.error("Error al iniciar reconocimiento:", e);
      this.showTooltip("Error al iniciar el micrófono", "error");
      this.stopDictation();
    }
  }

  setupSpeechRecognition() {
    this.recognition = new (window.SpeechRecognition ||
      window.webkitSpeechRecognition)();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = this.currentLanguage;
    this.lazyRecognitionInit = true;
    this.recognitionRetryCount = 0;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.dictationButton.classList.add("recording");
      if (this.commandMode) {
        this.dictationButton.classList.add("command-mode");
      }
      this.dictationButton.innerHTML = '<i class="fas fa-stop"></i>';
      this.dictationButton.title = "Detener dictado";
      this.showTooltip(
        this.commandMode ? "Modo comando activado" : "Escuchando...",
        this.commandMode ? "command" : "status"
      );
      this.updateFeedback("");

      // Show confidence indicator
      if (this.confidenceIndicator) {
        this.confidenceIndicator.style.display = "block";
      }

      chrome.storage.sync.set({ isDictationActive: true });
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";
      let confidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        confidence = event.results[i][0].confidence;

        // Update confidence indicator
        if (this.confidenceIndicator) {
          const confidenceLevel =
            this.confidenceIndicator.querySelector(".confidence-level");
          confidenceLevel.style.width = `${confidence * 100}%`;

          // Change color based on confidence
          if (confidence < 0.5) {
            confidenceLevel.style.background = "#db4437"; // red
          } else if (confidence < 0.7) {
            confidenceLevel.style.background = "#f4b400"; // yellow
          } else {
            confidenceLevel.style.background = this.userSettings.accentColor;
          }
        }

        if (event.results[i].isFinal) {
          finalTranscript += transcript;

          // Auto-learning for English terms
          if (
            this.userSettings.enableLearning &&
            this.currentLanguage.startsWith("es")
          ) {
            this.autoLearnEnglishTerms(transcript);
          }
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        this.updateFeedback(interimTranscript);
      }

      if (finalTranscript) {
        // Check if we're in command mode
        if (this.commandMode) {
          this.processCommand(finalTranscript);
        } else {
          // Apply confidence threshold filtering
          if (confidence >= this.userSettings.confidenceThreshold) {
            const processedText = this.processText(finalTranscript);
            this.insertText(processedText);
          } else {
            // Suggest correction for low confidence result
            if (this.userSettings.autoCorrect) {
              this.suggestCorrection(finalTranscript);
            } else {
              this.insertText(this.processText(finalTranscript));
            }
          }
        }
        this.updateFeedback("");
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Error en reconocimiento:", event.error);
      this.showTooltip(
        "Error: " + this.getErrorDescription(event.error),
        "error"
      );

      // For network errors, we might want to retry a few times before giving up
      if (
        event.error === "network" &&
        this.recognitionRetryCount < this.maxRecognitionRetries
      ) {
        this.recognitionRetryCount++;
        this.showTooltip(
          `Reintentando conexión (${this.recognitionRetryCount}/${this.maxRecognitionRetries})...`,
          "status"
        );
        setTimeout(() => {
          if (this.isListening) {
            try {
              this.recognition.start();
            } catch (e) {
              this.stopDictation();
            }
          }
        }, 1000);
      } else {
        this.stopDictation();
      }
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        if (this.userSettings.continuousMode) {
          requestAnimationFrame(() => {
            if (this.isListening) {
              try {
                this.recognition.start();
                this.recognitionRetryCount = 0; // Reset retry counter on successful restart
              } catch (e) {
                console.error("Error al reiniciar reconocimiento:", e);
                this.stopDictation();
              }
            }
          });
        } else {
          this.stopDictation();
        }
      }
    };
  }

  showControlPanelIfEnabled() {
    if (this.userSettings.showControlPanel && this.controlPanel) {
      // Reset language dropdown state
      const selector = this.controlPanel.querySelector(".language-selector");
      if (selector) {
        selector.style.display = "none";
      }

      // Update command mode button visual state
      const commandBtn = document.getElementById("vd-command-btn");
      if (commandBtn) {
        if (this.commandMode) {
          commandBtn.style.color = "#4285f4";
          commandBtn.title = "Salir del modo comando";
        } else {
          commandBtn.style.color = "";
          commandBtn.title = "Modo comando";
        }
      }

      // Show the control panel
      this.controlPanel.style.display = "block";
    }
  }

  stopDictation() {
    this.isListening = false;
    this.lastSentenceEndedWithPunctuation = false;

    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (e) {
        console.log("Error al detener reconocimiento:", e);
      }
    }

    if (this.dictationButton) {
      this.dictationButton.classList.remove("recording");
      this.dictationButton.classList.remove("command-mode");
      this.dictationButton.innerHTML = '<i class="fas fa-microphone"></i>';
      this.dictationButton.title = "Iniciar dictado";
    }

    // Hide confidence indicator
    if (this.confidenceIndicator) {
      this.confidenceIndicator.style.display = "none";
    }

    // Hide control panel
    if (this.controlPanel) {
      this.controlPanel.style.display = "none";
    }

    this.showTooltip("Dictado detenido", "status");
    this.updateFeedback("");
    chrome.storage.sync.set({ isDictationActive: false });
  }

  toggleCommandMode() {
    this.commandMode = !this.commandMode;

    if (this.commandMode) {
      if (this.dictationButton) {
        this.dictationButton.classList.add("command-mode");
      }
      this.showTooltip("Modo comando activado", "command");
    } else {
      if (this.dictationButton) {
        this.dictationButton.classList.remove("command-mode");
      }
      this.showTooltip("Modo dictado activado", "status");
    }

    // Update control panel if visible
    const commandBtn = document.getElementById("vd-command-btn");
    if (commandBtn) {
      commandBtn.style.color = this.commandMode ? "#4285f4" : "";
    }

    return "";
  }

  // Process voice commands
  processCommand(text) {
    if (!text || !this.userSettings.enableVoiceCommands) return;

    const langCode = this.currentLanguage.substring(0, 2);
    const commandsMap = this.commandsMap[langCode] || this.commandsMap.en;

    const command = text.trim().toLowerCase();

    // First check for exact match
    if (commandsMap[command]) {
      commandsMap[command]();
      this.showTooltip(`Comando ejecutado: ${command}`, "command");
      return;
    }

    // Then check for partial matches
    for (const [cmdText, cmdFunc] of Object.entries(commandsMap)) {
      if (command.includes(cmdText)) {
        cmdFunc();
        this.showTooltip(`Comando ejecutado: ${cmdText}`, "command");
        return;
      }
    }

    // If command not recognized, show message
    this.showTooltip(`Comando no reconocido: ${command}`, "error");
  }

  // Cursor movement helpers
  moveCursorToStart() {
    if (!this.activeElement) return;

    if (this.activeElement.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(this.activeElement);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      this.activeElement.selectionStart = this.activeElement.selectionEnd = 0;
    }
  }

  moveCursorToEnd() {
    if (!this.activeElement) return;

    if (this.activeElement.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(this.activeElement);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      this.activeElement.selectionStart = this.activeElement.selectionEnd =
        this.activeElement.value.length;
    }
  }

  // Keyboard simulation
  simulateKeyboard(options = {}) {
    if (!this.activeElement) return;

    const evt = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: options.key || "",
      code: options.code || "",
      ctrlKey: options.ctrlKey || false,
      shiftKey: options.shiftKey || false,
      altKey: options.altKey || false,
      metaKey: options.metaKey || false,
    });

    this.activeElement.dispatchEvent(evt);
  }

  processText(text) {
    if (!text.trim()) return "";

    const langCode = this.currentLanguage.substring(0, 2);
    const punctuationRules =
      this.punctuationMap[langCode] || this.punctuationMap.es;
    const englishTerms = this.punctuationMap["en"];
    let processed = text.trim();

    // Apply dictionary corrections if enabled
    if (this.userSettings.autoCorrect) {
      this.dictionaryCorrections.forEach((correct, incorrect) => {
        const regex = new RegExp(`\\b${incorrect}\\b`, "gi");
        processed = processed.replace(regex, correct);
      });
    }

    // Special text commands
    const specialCommands = {
      "borrar última palabra": this.handleDeleteLastWord.bind(this),
      "delete last word": this.handleDeleteLastWord.bind(this),
      mayúscula: this.handleCapitalizeNextWord.bind(this),
      capitalize: this.handleCapitalizeNextWord.bind(this),
      minúscula: this.handleLowercaseNextWord.bind(this),
      lowercase: this.handleLowercaseNextWord.bind(this),
    };

    for (const [command, handler] of Object.entries(specialCommands)) {
      if (processed.toLowerCase().endsWith(command)) {
        return handler(
          processed.substring(0, processed.length - command.length).trim()
        );
      }
    }

    // Create a regex pattern for all punctuation rules and preserved terms
    const punctuationPattern = Object.keys(punctuationRules)
      .map((command) => `\\s*\\b${command}\\b\\s*`)
      .join("|");

    const punctuationSymbolsPattern = "\\s+([.,;:?!)]|$)";

    // Add English terms pattern if preservation is enabled
    const englishTermsPattern = this.userSettings.preserveEnglish
      ? "|" +
        Object.keys(englishTerms)
          .filter((term) => term.length > 2)
          .map((term) => `\\b${term}\\b`)
          .join("|")
      : "";

    // Combined pattern
    const fullPattern = new RegExp(
      punctuationPattern +
        "|" +
        punctuationSymbolsPattern +
        englishTermsPattern,
      "gi"
    );

    // Process text with the pattern
    processed = processed.replace(fullPattern, (match) => {
      const lowerMatch = match.toLowerCase().trim();

      // Check for preserved English terms
      if (this.userSettings.preserveEnglish && englishTerms[lowerMatch]) {
        return match; // Keep original capitalization
      }

      // Check for punctuation commands
      if (punctuationRules[lowerMatch]) {
        return punctuationRules[lowerMatch];
      }

      // Handle trailing punctuation
      return match.trim().replace(/([.,;:?!)])\s*$/, "$1 ");
    });

    // Auto-capitalize sentences
    if (
      this.userSettings.autoCapitalize &&
      this.lastSentenceEndedWithPunctuation
    ) {
      processed = processed.charAt(0).toUpperCase() + processed.slice(1);
    }

    // Clean up extra spaces
    processed = processed.replace(this.consecutiveSpacesRegex, " ");

    // Check if text ends with punctuation
    const endsWithPunctuation = this.sentenceEndingPunctuation.has(
      processed.charAt(processed.length - 1)
    );

    // Fix spacing around punctuation
    processed = processed
      .replace(/([¿¡({\[])\s+/g, "$1") // No space after opening symbols
      .replace(/\s+([.,;:?!)}\\]])\s*/g, "$1 ") // Space after closing symbols
      .replace(/([.,;:?!)}\\]])(?!\s|$)/g, "$1 "); // Add space if missing

    // Add space at end if needed for continuous dictation
    if (!endsWithPunctuation && !/[-\s]\s*$/.test(processed)) {
      processed += " ";
    }

    // Update sentence state
    this.lastSentenceEndedWithPunctuation = endsWithPunctuation;

    return processed;
  }

  // Suggestions for corrections when confidence is low
  suggestCorrection(text) {
    if (!text.trim()) return;

    // Check in dictionary corrections first
    const words = text.toLowerCase().split(/\s+/);
    let corrected = false;

    let correctedText = words
      .map((word) => {
        // Skip very short words
        if (word.length <= 2) return word;

        // Check in dictionary
        if (this.dictionaryCorrections.has(word)) {
          corrected = true;
          return this.dictionaryCorrections.get(word);
        }

        // Future enhancement: implement fuzzy matching or API for better suggestions
        return word;
      })
      .join(" ");

    if (corrected) {
      // Process with regular rules after corrections
      this.insertText(this.processText(correctedText));
    } else {
      // Just apply regular processing if no corrections found
      this.insertText(this.processText(text));
    }
  }

  handleDeleteLastWord(text) {
    const richTextHandler = this.getRichTextHandler(this.activeElement);
    if (richTextHandler && richTextHandler.deleteLastWord) {
      richTextHandler.deleteLastWord();
      return text;
    }

    if (!this.activeElement) return text;

    if (this.activeElement.isContentEditable) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const textContent = range.startContainer.textContent || "";
        const lastSpace = textContent.lastIndexOf(" ", range.startOffset - 2);

        if (lastSpace > -1) {
          range.setStart(range.startContainer, lastSpace + 1);
        } else {
          range.setStart(range.startContainer, 0);
        }

        range.deleteContents();
        this.triggerInputEvent();
      }
    } else {
      const value = this.activeElement.value;
      const cursorPos = this.activeElement.selectionStart;
      const lastSpace = value.lastIndexOf(" ", cursorPos - 2);

      if (lastSpace > -1) {
        this.activeElement.value =
          value.substring(0, lastSpace + 1) + value.substring(cursorPos);
        this.activeElement.selectionStart = this.activeElement.selectionEnd =
          lastSpace + 1;
      } else {
        this.activeElement.value = value.substring(cursorPos);
        this.activeElement.selectionStart = this.activeElement.selectionEnd = 0;
      }

      this.triggerInputEvent();
    }

    return text;
  }

  handleCapitalizeNextWord(text) {
    this.lastSentenceEndedWithPunctuation = true;
    return text + " ";
  }

  handleLowercaseNextWord(text) {
    this.lastSentenceEndedWithPunctuation = false;
    return text + " ";
  }

  insertText(text) {
    if (!this.activeElement || !text) return;

    try {
      // Primero intentar con manejadores especializados
      const richTextHandler = this.getRichTextHandler(this.activeElement);
      if (richTextHandler) {
        if (text === "") {
          if (richTextHandler.deleteLastWord) {
            richTextHandler.deleteLastWord();
          }
          return;
        }

        if (richTextHandler.insert(text)) {
          this.triggerInputEvent();
          return;
        }
      }

      // Manejo estándar para contentEditable
      if (this.activeElement.isContentEditable) {
        const selection = window.getSelection();

        if (text === "") {
          document.execCommand("delete", false);
          return;
        }

        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);

          if (text === "\n" || text === "\n\n") {
            const br = document.createElement("br");
            range.deleteContents();
            range.insertNode(br);

            if (text === "\n\n") {
              const newRange = document.createRange();
              newRange.setStartAfter(br);
              newRange.insertNode(document.createElement("br"));
              range.setStartAfter(br.nextSibling);
            } else {
              range.setStartAfter(br);
            }

            range.collapse(true);
          } else {
            range.deleteContents();
            const textNode = document.createTextNode(text);
            range.insertNode(textNode);
            range.setStartAfter(textNode);
          }

          selection.removeAllRanges();
          selection.addRange(range);
        } else {
          document.execCommand("insertText", false, text);
        }

        this.triggerInputEvent();
      } else {
        // Manejo estándar para inputs/textarea
        const start = this.activeElement.selectionStart;
        const end = this.activeElement.selectionEnd;
        const value = this.activeElement.value;

        this.activeElement.value =
          value.substring(0, start) + text + value.substring(end);
        this.activeElement.selectionStart = this.activeElement.selectionEnd =
          start + text.length;

        this.triggerInputEvent();
      }

      const lastChar = text.trim().charAt(text.trim().length - 1);
      this.lastSentenceEndedWithPunctuation =
        this.sentenceEndingPunctuation.has(lastChar);
    } catch (error) {
      console.error("Error al insertar texto:", error);
      this.showTooltip("Error al insertar texto", "error");
    }
  }

  triggerInputEvent() {
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      inputType: "insertText",
    });
    this.activeElement.dispatchEvent(inputEvent);

    const changeEvent = new Event("change", { bubbles: true });
    this.activeElement.dispatchEvent(changeEvent);
  }

  updateFeedback(text) {
    if (!this.feedbackElement) return;

    this.feedbackElement.textContent = text;
    this.feedbackElement.style.opacity = text ? "1" : "0";

    if (text) {
      setTimeout(() => {
        if (this.feedbackElement.textContent === text) {
          this.feedbackElement.style.opacity = "0";
        }
      }, 2000);
    }
  }

  showTooltip(message, type = "status") {
    if (!this.tooltip) return;

    this.tooltip.textContent = message;
    this.tooltip.className = type;
    this.tooltip.style.opacity = "1";

    setTimeout(() => {
      this.tooltip.style.opacity = "0";
    }, this.userSettings.tooltipDuration);
  }

  getErrorDescription(error) {
    const errors = {
      "no-speech": "No se detectó habla",
      "audio-capture": "No se pudo acceder al micrófono",
      "not-allowed": "Permiso denegado",
      "language-not-supported": "Idioma no soportado",
      aborted: "Reconocimiento abortado",
      network: "Error de red",
      "audio-busy": "Micrófono ocupado",
      "service-not-available": "Servicio no disponible",
      "service-not-allowed": "Servicio no permitido",
    };
    return errors[error] || "Error desconocido";
  }

  injectFontAwesome() {
    if (!document.head.querySelector("#fa-cdn")) {
      const link = document.createElement("link");
      link.id = "fa-cdn";
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
      link.integrity =
        "sha512-iecdLmaskl7CVkqkXNQ/ZH/XLlvWZOJyj7Yy7tcenmpD1ypASozpmT/E0iPtmFIB46ZmdtAc9eNBvH0H/ZpiBw==";
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    }
  }

  async checkMicrophonePermission() {
    try {
      if (navigator.permissions) {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone",
        });
        return permissionStatus.state === "granted";
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  }

  autoLearnEnglishTerms(text) {
    if (!this.userSettings.enableLearning || !this.userSettings.preserveEnglish)
      return;

    // Expresión regular para detectar palabras en inglés (básica)
    const englishWordRegex = /\b([A-Za-z]{3,})\b/g;
    let match;

    while ((match = englishWordRegex.exec(text)) !== null) {
      const word = match[1].toLowerCase();

      // Si no está en nuestro mapa de inglés y no es una palabra común en español
      if (
        !this.punctuationMap["en"][word] &&
        !this.punctuationMap["es"][word]
      ) {
        this.learnedTerms.add(word);
        this.punctuationMap["en"][word] = word;
      }
    }

    // Guardar términos aprendidos periódicamente
    if (this.learnedTerms.size % 5 === 0) {
      chrome.storage.sync.set({
        learnedTerms: Array.from(this.learnedTerms),
      });
    }
  }

  setupLanguage() {
    chrome.storage.sync.get(["language"], (data) => {
      if (data.language) {
        this.currentLanguage = data.language;
      }
    });
  }

  destroy() {
    this.stopDictation();

    const events = [
      "focusin",
      "click",
      "scroll",
      "resize",
      "mousemove",
      "keydown",
      "touchstart",
    ];
    events.forEach((event) => {
      document.removeEventListener(event, this.handleFocusChange);
      window.removeEventListener(event, this.updateButtonPosition);
    });

    if (this.observer) this.observer.disconnect();
    if (this.mutationObserver) this.mutationObserver.disconnect();
    if (this.dictationButton) this.dictationButton.remove();
    if (this.tooltip) this.tooltip.remove();
    if (this.feedbackElement) this.feedbackElement.remove();
    if (this.settingsPanel) this.settingsPanel.remove();
    if (this.controlPanel) this.controlPanel.remove();
    if (this.confidenceIndicator) this.confidenceIndicator.remove();
    if (this.idleTimer) clearTimeout(this.idleTimer);

    Object.keys(this.throttleTimers).forEach((key) => {
      clearTimeout(this.throttleTimers[key]);
    });

    this.observedElements = new WeakMap();
    this.currentObservations = 0;
  }
}

// Inicializar la extensión
const voiceDictation = new VoiceDictation();

// Para desarrollo: exponer la instancia
if (typeof window !== "undefined") {
  window.voiceDictation = voiceDictation;
}

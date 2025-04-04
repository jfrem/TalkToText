// Voice Dictation Extension - Options Page Script
document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements - General
    const autoCapitalize = document.getElementById('autoCapitalize');
    const preserveEnglish = document.getElementById('preserveEnglish');
    const enableLearning = document.getElementById('enableLearning');
    const autoCorrect = document.getElementById('autoCorrect');
    const continuousMode = document.getElementById('continuousMode');
    const enableCommands = document.getElementById('enableCommands');
    
    // DOM Elements - Appearance
    const buttonPosition = document.getElementById('buttonPosition');
    const showControlPanel = document.getElementById('showControlPanel');
    const accentColor = document.getElementById('accentColor');
    
    // DOM Elements - Advanced
    const confidenceThreshold = document.getElementById('confidenceThreshold');
    const confidenceValue = document.getElementById('confidenceValue');
    const idleTimeout = document.getElementById('idleTimeout');
    const defaultLanguage = document.getElementById('defaultLanguage');
    
    // DOM Elements - Dictionary
    const learnedTermsList = document.getElementById('learnedTermsList');
    const newTerm = document.getElementById('newTerm');
    const addTerm = document.getElementById('addTerm');
    const correctionsList = document.getElementById('correctionsList');
    const incorrectWord = document.getElementById('incorrectWord');
    const correctWord = document.getElementById('correctWord');
    const addCorrection = document.getElementById('addCorrection');
    
    // DOM Elements - Actions
    const resetSettings = document.getElementById('resetSettings');
    const saveSettings = document.getElementById('saveSettings');
    
    // State
    let userSettings = {
      buttonPosition: 'right',
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
      accentColor: '#1a3636'
    };
    
    let currentLanguage = 'es-ES';
    let learnedTerms = [];
    let dictionaryCorrections = [];
    
    // Load settings from storage
    function loadSettings() {
      chrome.storage.sync.get(
        ['language', 'userSettings', 'learnedTerms', 'dictionaryCorrections'], 
        (data) => {
          // Set current language
          currentLanguage = data.language || 'es-ES';
          defaultLanguage.value = currentLanguage;
          
          // Set user settings
          if (data.userSettings) {
            userSettings = { ...userSettings, ...data.userSettings };
            
            // Update UI with loaded settings
            autoCapitalize.checked = userSettings.autoCapitalize;
            preserveEnglish.checked = userSettings.preserveEnglish;
            enableLearning.checked = userSettings.enableLearning;
            autoCorrect.checked = userSettings.autoCorrect;
            continuousMode.checked = userSettings.continuousMode;
            enableCommands.checked = userSettings.enableVoiceCommands;
            
            buttonPosition.value = userSettings.buttonPosition;
            showControlPanel.checked = userSettings.showControlPanel;
            accentColor.value = userSettings.accentColor;
            
            confidenceThreshold.value = userSettings.confidenceThreshold;
            confidenceValue.textContent = `${Math.round(userSettings.confidenceThreshold * 100)}%`;
            idleTimeout.value = userSettings.idleTimeout;
          }
          
          // Load learned terms
          if (data.learnedTerms) {
            learnedTerms = data.learnedTerms;
            updateLearnedTermsList();
          }
          
          // Load dictionary corrections
          if (data.dictionaryCorrections) {
            dictionaryCorrections = data.dictionaryCorrections;
            updateCorrectionsList();
          }
        }
      );
    }
    
    // Save settings to storage
    function saveSettingsToStorage() {
      // Collect settings from UI
      userSettings = {
        autoCapitalize: autoCapitalize.checked,
        preserveEnglish: preserveEnglish.checked,
        enableLearning: enableLearning.checked,
        autoCorrect: autoCorrect.checked,
        continuousMode: continuousMode.checked,
        enableVoiceCommands: enableCommands.checked,
        
        buttonPosition: buttonPosition.value,
        showControlPanel: showControlPanel.checked,
        accentColor: accentColor.value,
        
        confidenceThreshold: parseFloat(confidenceThreshold.value),
        idleTimeout: parseInt(idleTimeout.value),
        
        // Preserve existing settings that don't have UI controls
        tooltipDuration: userSettings.tooltipDuration
      };
      
      // Save to storage
      chrome.storage.sync.set({ 
        userSettings,
        language: defaultLanguage.value 
      });
      
      // Update background script
      chrome.runtime.sendMessage({ 
        action: "updateSettings", 
        settings: userSettings 
      });
      
      // Show toast notification
      showToast('Configuración guardada correctamente');
    }
    
    // Update learned terms list UI
    function updateLearnedTermsList() {
      learnedTermsList.innerHTML = '';
      
      if (learnedTerms.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'term-item';
        emptyItem.textContent = 'No hay términos guardados';
        emptyItem.style.color = '#888';
        emptyItem.style.fontStyle = 'italic';
        emptyItem.style.justifyContent = 'center';
        learnedTermsList.appendChild(emptyItem);
        return;
      }
      
      learnedTerms.sort().forEach(term => {
        const termItem = document.createElement('div');
        termItem.className = 'term-item';
        
        const termText = document.createElement('span');
        termText.textContent = term;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = 'Eliminar término';
        removeBtn.addEventListener('click', () => {
          removeTerm(term);
        });
        
        termItem.appendChild(termText);
        termItem.appendChild(removeBtn);
        learnedTermsList.appendChild(termItem);
      });
    }
    
    // Add new term
    function addNewTerm() {
      const term = newTerm.value.trim();
      
      if (term && !learnedTerms.includes(term.toLowerCase())) {
        learnedTerms.push(term.toLowerCase());
        chrome.storage.sync.set({ learnedTerms });
        newTerm.value = '';
        updateLearnedTermsList();
        showToast(`Término "${term}" añadido correctamente`);
      } else if (learnedTerms.includes(term.toLowerCase())) {
        showToast(`El término "${term}" ya existe`, 'error');
      }
    }
    
    // Remove term
    function removeTerm(term) {
      learnedTerms = learnedTerms.filter(t => t !== term);
      chrome.storage.sync.set({ learnedTerms });
      updateLearnedTermsList();
      showToast(`Término "${term}" eliminado`);
    }
    
    // Update corrections list UI
    function updateCorrectionsList() {
      correctionsList.innerHTML = '';
      
      if (dictionaryCorrections.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'term-item';
        emptyItem.textContent = 'No hay correcciones guardadas';
        emptyItem.style.color = '#888';
        emptyItem.style.fontStyle = 'italic';
        emptyItem.style.justifyContent = 'center';
        correctionsList.appendChild(emptyItem);
        return;
      }
      
      dictionaryCorrections.sort((a, b) => a[0].localeCompare(b[0])).forEach(([incorrect, correct]) => {
        const correctionItem = document.createElement('div');
        correctionItem.className = 'term-item';
        
        const correctionText = document.createElement('span');
        correctionText.innerHTML = `<span style="color: #d32f2f; text-decoration: line-through;">${incorrect}</span> → <span style="color: #388e3c;">${correct}</span>`;
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.title = 'Eliminar corrección';
        removeBtn.addEventListener('click', () => {
          removeCorrection(incorrect);
        });
        
        correctionItem.appendChild(correctionText);
        correctionItem.appendChild(removeBtn);
        correctionsList.appendChild(correctionItem);
      });
    }
    
    // Add new correction
    function addNewCorrection() {
      const incorrect = incorrectWord.value.trim().toLowerCase();
      const correct = correctWord.value.trim();
      
      if (incorrect && correct) {
        // Check if correction already exists
        const exists = dictionaryCorrections.some(([word]) => word === incorrect);
        
        if (!exists) {
          dictionaryCorrections.push([incorrect, correct]);
          chrome.storage.sync.set({ 
            dictionaryCorrections
          });
          
          incorrectWord.value = '';
          correctWord.value = '';
          updateCorrectionsList();
          showToast(`Corrección añadida: "${incorrect}" → "${correct}"`);
        } else {
          // Update existing correction
          dictionaryCorrections = dictionaryCorrections.map(
            ([word, corr]) => word === incorrect ? [word, correct] : [word, corr]
          );
          chrome.storage.sync.set({ dictionaryCorrections });
          
          incorrectWord.value = '';
          correctWord.value = '';
          updateCorrectionsList();
          showToast(`Corrección actualizada: "${incorrect}" → "${correct}"`);
        }
      }
    }
    
    // Remove correction
    function removeCorrection(incorrect) {
      dictionaryCorrections = dictionaryCorrections.filter(([word]) => word !== incorrect);
      chrome.storage.sync.set({ dictionaryCorrections });
      updateCorrectionsList();
      showToast(`Corrección eliminada para "${incorrect}"`);
    }
    
    // Reset settings to defaults
    function resetAllSettings() {
      if (confirm('¿Estás seguro de que deseas restablecer toda la configuración a los valores predeterminados? Esto también eliminará los términos aprendidos y las correcciones.')) {
        userSettings = {
          buttonPosition: 'right',
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
          accentColor: '#1a3636'
        };
        
        // Reset language to default
        currentLanguage = 'es-ES';
        
        // Clear learned terms and corrections
        learnedTerms = [];
        dictionaryCorrections = [];
        
        // Save all reset values to storage
        chrome.storage.sync.set({ 
          userSettings, 
          language: currentLanguage,
          learnedTerms,
          dictionaryCorrections 
        });
        
        // Notify background script
        chrome.runtime.sendMessage({ action: "resetSettings" });
        
        // Update UI
        loadSettings();
        
        showToast('Configuración restablecida correctamente');
      }
    }
    
    // Show toast notification
    function showToast(message, type = 'success') {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      
      if (type === 'error') {
        toast.style.backgroundColor = '#d32f2f';
      } else {
        toast.style.backgroundColor = '#4CAF50';
      }
      
      toast.className = 'show';
      
      // After 3 seconds, remove the show class
      setTimeout(() => { 
        toast.className = toast.className.replace('show', ''); 
      }, 3000);
    }
    
    // Configure event listeners
    function setupEventListeners() {
      // Confidence threshold slider
      confidenceThreshold.addEventListener('input', () => {
        confidenceValue.textContent = `${Math.round(confidenceThreshold.value * 100)}%`;
      });
      
      // Add term button
      addTerm.addEventListener('click', addNewTerm);
      newTerm.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addNewTerm();
      });
      
      // Add correction button
      addCorrection.addEventListener('click', addNewCorrection);
      correctWord.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addNewCorrection();
      });
      
      // Save button
      saveSettings.addEventListener('click', saveSettingsToStorage);
      
      // Reset button
      resetSettings.addEventListener('click', resetAllSettings);
    }
    
    // Initialize
    loadSettings();
    setupEventListeners();
  });
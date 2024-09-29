document.addEventListener("DOMContentLoaded", () => {
    const startStopButton = document.getElementById("startStop");
    const clearButton = document.getElementById("clear");
    const repeatButton = document.getElementById("repeat");
    const copyButton = document.getElementById("copy");
    const textArea = document.getElementById("text");
    const statusDiv = document.getElementById("status");
    const languageSelect = document.getElementById("language");

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    let lastSpeechResult = "";
    let timeout;
    let previousSentences = [];
    let isDictating = false;

    const setStatusMessage = (message, isError = false) => {
        statusDiv.textContent = message;
        statusDiv.style.color = isError ? "red" : "black";
    };

    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onstart = () => {
        isDictating = true;
        setStatusMessage("Dictado en curso...");
        updateButtonAppearance();
    };

    recognition.onresult = (event) => {
        clearTimeout(timeout);
        for (const result of event.results) {
            if (result.isFinal) {
                lastSpeechResult = result[0].transcript.trim();
                if (lastSpeechResult) {
                    const processedText = processText(lastSpeechResult);
                    const activeField = document.activeElement;

                    if (activeField && (activeField.matches('input[type="text"]') || activeField.matches('textarea') || activeField.isContentEditable)) {
                        if (activeField.isContentEditable) {
                            activeField.innerHTML += processedText + " "; // Para divs editables
                        } else {
                            activeField.value += processedText + " "; // Para inputs y textareas
                        }
                    } else {
                        textArea.value += processedText + " "; // Para el textarea de la extensión
                    }
                    updatePreviousSentences(processedText);
                }
            }
        }
        timeout = setTimeout(() => {
            recognition.stop();
        }, 2000);
    };

    recognition.onend = () => {
        isDictating = false;
        setStatusMessage("Dictado detenido.");
        updateButtonAppearance();
    };

    recognition.onerror = (event) => {
        const errorMessages = {
            "no-speech": "No se detectó habla. Intenta de nuevo.",
            "audio-capture": "No se capturó audio. Verifica tu micrófono.",
            "not-allowed": "Permiso denegado para usar el micrófono.",
            "service-not-allowed": "El servicio no está permitido en este dispositivo.",
            "network": "Error de red. Verifica tu conexión.",
            "other": "Error desconocido. Intenta de nuevo.",
        };
        setStatusMessage(errorMessages[event.error] || "Error desconocido", true);
        console.log(`Error de reconocimiento: ${event.error}`);
    };

    startStopButton.addEventListener("click", async () => {
        if (isDictating) {
            recognition.stop();
        } else {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    await navigator.mediaDevices.getUserMedia({ audio: true });
                    recognition.lang = languageSelect.value;
                    recognition.start();
                } catch (error) {
                    handleMicrophoneError(error);
                }
            } else {
                setStatusMessage("El acceso al micrófono no es soportado en este navegador.", true);
            }
        }
    });

    repeatButton.addEventListener("click", () => {
        if (previousSentences.length > 0) {
            const lastSentence = previousSentences[previousSentences.length - 1];
            const activeField = document.activeElement;

            if (activeField && (activeField.matches('input[type="text"]') || activeField.matches('textarea') || activeField.isContentEditable)) {
                if (activeField.isContentEditable) {
                    activeField.innerHTML += lastSentence + " "; // Agregar al div editable
                } else {
                    activeField.value += lastSentence + " "; // Agregar al campo activo
                }
            } else {
                textArea.value += lastSentence + " "; // Agregar al textarea
            }
            setStatusMessage("Última frase repetida.");
        } else {
            setStatusMessage("No hay frases para repetir.", true);
        }
    });

    copyButton.addEventListener("click", () => {
        navigator.clipboard.writeText(textArea.value).then(() => {
            setStatusMessage("Texto copiado al portapapeles.");
        }).catch(err => {
            setStatusMessage("Error al copiar el texto.", true);
            console.error("Error al copiar:", err);
        });
    });

    clearButton.addEventListener("click", () => {
        if (confirm("¿Estás seguro de que deseas limpiar el texto?")) {
            textArea.value = "";
            lastSpeechResult = "";
            previousSentences = []; // Limpiar historial de frases
            setStatusMessage("Texto borrado.");
        }
    });

    languageSelect.addEventListener("change", (event) => {
        recognition.lang = event.target.value;
        setStatusMessage("Idioma cambiado a: " + event.target.value);
    });

    const processText = (text) => {
        const punctuationPatterns = {
            " punto ": ". ",
            " coma ": ", ",
            " signo de interrogación ": "? ",
            " signo de exclamación ": "! ",
            " y ": " y ",
        };
        const pattern = new RegExp(Object.keys(punctuationPatterns).join("|"), "g");
        return text.replace(pattern, (matched) => punctuationPatterns[matched] || matched);
    };

    const updatePreviousSentences = (sentence) => {
        if (previousSentences.length >= 5) {
            previousSentences.shift(); // Mantener solo las últimas 5 frases
        }
        previousSentences.push(sentence);
    };

    const updateButtonAppearance = () => {
        startStopButton.innerHTML = isDictating
            ? `<i class="fas fa-stop"></i> Detener`
            : `<i class="fas fa-microphone"></i> Iniciar`;
        startStopButton.style.backgroundColor = isDictating ? "#dc4c64" : "#1A3636";
    };

    const handleMicrophoneError = (error) => {
        if (error.name === 'NotAllowedError') {
            setStatusMessage("Permiso denegado para usar el micrófono. Asegúrate de haber concedido los permisos en el navegador.", true);
        } else {
            setStatusMessage("Error al acceder al micrófono.", true);
        }
        console.error("Error al acceder al micrófono:", error);
    };
});

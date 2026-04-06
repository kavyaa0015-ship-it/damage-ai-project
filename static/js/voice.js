/**
 * DamageAI — Voice Assistant
 * Uses Web Speech API for voice commands and spoken responses
 */

const VoiceAssistant = (() => {
    let recognition = null;
    let isListening = false;
    let synthesis = window.speechSynthesis;

    const voiceBtn = document.getElementById('voice-btn');
    const statusBar = document.getElementById('voice-status-bar');
    const statusText = document.getElementById('voice-status-text');

    const COMMANDS = {
        'analyse damage': () => executeCommand('Analyzing damage...', App.startAnalysis),
        'analyze damage': () => executeCommand('Analyzing damage...', App.startAnalysis),
        'detect damage': () => executeCommand('Running damage detection...', App.startAnalysis),
        'show risk analysis': () => executeCommand('Showing risk analysis...', () => {
            const riskSection = document.getElementById('risk-analysis-section');
            if (riskSection) riskSection.scrollIntoView({ behavior: 'smooth' });
        }),
        'show risk': () => executeCommand('Showing risk analysis...', () => {
            const riskSection = document.getElementById('risk-analysis-section');
            if (riskSection) riskSection.scrollIntoView({ behavior: 'smooth' });
        }),
        'show solution': () => executeCommand('Showing recommended solution...', () => {
            const riskSection = document.getElementById('risk-analysis-section');
            if (riskSection) riskSection.scrollIntoView({ behavior: 'smooth' });
        }),
        'download image': () => executeCommand('Downloading inspection image...', () => {
            const result = App.getCurrentResult();
            if (result) Detection.downloadImage(result.detected_image);
            else speak('No detection result available. Please analyze an image first.');
        }),
        'download report': () => executeCommand('Generating PDF report...', () => {
            const result = App.getCurrentResult();
            if (result) PDFReport.generate(result);
            else speak('No detection result available. Please analyze an image first.');
        }),
        'clear results': () => executeCommand('Clearing results...', App.resetAnalysis),
        'new analysis': () => executeCommand('Starting new analysis...', App.resetAnalysis),
        'open history': () => executeCommand('Opening inspection history...', () => App.switchTab('history')),
        'show history': () => executeCommand('Opening inspection history...', () => App.switchTab('history')),
        'clear history': () => executeCommand('Clearing inspection history...', () => {
            History.clearAll();
            speak('Inspection history cleared successfully.');
        }),
        'open road map': () => executeCommand('Opening road damage map...', () => App.switchTab('map')),
        'open map': () => executeCommand('Opening road damage map...', () => App.switchTab('map')),
        'show damage locations': () => executeCommand('Showing damage locations...', () => {
            App.switchTab('map');
            setTimeout(() => DamageMap.fitAllMarkers(), 500);
        }),
        'show locations': () => executeCommand('Showing damage locations...', () => {
            App.switchTab('map');
            setTimeout(() => DamageMap.fitAllMarkers(), 500);
        })
    };

    function init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log('Speech Recognition not supported in this browser.');
            voiceBtn.title = 'Voice not supported in this browser';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            voiceBtn.classList.add('listening');
            statusBar.classList.add('active');
            statusText.textContent = '🎤 Listening...';
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase().trim();
            statusText.textContent = `Command: "${transcript}"`;

            // Find matching command
            let matched = false;
            for (const [cmd, action] of Object.entries(COMMANDS)) {
                if (transcript.includes(cmd)) {
                    action();
                    matched = true;
                    break;
                }
            }

            if (!matched) {
                statusText.textContent = `Unknown command: "${transcript}"`;
                speak(`Sorry, I didn't understand the command: ${transcript}`);
                setTimeout(hideStatusBar, 3000);
            }
        };

        recognition.onerror = (event) => {
            console.log('Speech recognition error:', event.error);
            statusText.textContent = `Error: ${event.error}`;
            setTimeout(hideStatusBar, 2500);
        };

        recognition.onend = () => {
            isListening = false;
            voiceBtn.classList.remove('listening');
        };

        voiceBtn.addEventListener('click', toggleListening);
    }

    function toggleListening() {
        if (isListening) {
            recognition.stop();
            hideStatusBar();
        } else {
            recognition.start();
        }
    }

    function executeCommand(statusMsg, action) {
        statusText.textContent = statusMsg;
        setTimeout(() => {
            action();
            setTimeout(hideStatusBar, 2000);
        }, 500);
    }

    function hideStatusBar() {
        statusBar.classList.remove('active');
    }

    function speak(text) {
        if (!synthesis) return;
        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.volume = 0.9;
        synthesis.speak(utterance);
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

    return {
        speak,
        toggleListening
    };
})();

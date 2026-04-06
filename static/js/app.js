/**
 * DamageAI — Main Application Controller
 * Handles navigation, file upload, and orchestration between modules
 */

const App = (() => {
    // State
    let currentFile = null;
    let currentResult = null;
    let userLocation = null;

    // DOM Elements
    const navBtns = document.querySelectorAll('.nav-btn[data-tab]');
    const panels = document.querySelectorAll('.tab-panel');
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input');
    const chooseBtn = document.getElementById('choose-file-btn');
    const previewDiv = document.getElementById('file-preview');
    const previewImg = document.getElementById('preview-image');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeBtn = document.getElementById('remove-file');
    const analyzeBtn = document.getElementById('analyze-btn');
    const uploadSection = document.getElementById('upload-section');
    const loadingSection = document.getElementById('loading-section');
    const resultsSection = document.getElementById('results-section');
    const newAnalysisBtn = document.getElementById('new-analysis-btn');
    const progressFill = document.getElementById('progress-fill');

    function init() {
        setupNavigation();
        setupUpload();
        setupAnalyze();
        getUserLocation();

        // New analysis button
        newAnalysisBtn.addEventListener('click', resetAnalysis);
    }

    // ---- Navigation ----
    function setupNavigation() {
        navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                switchTab(tab);
            });
        });
    }

    function switchTab(tab) {
        navBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        const activeBtn = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
        const activePanel = document.getElementById(`panel-${tab}`);

        if (activeBtn) activeBtn.classList.add('active');
        if (activePanel) activePanel.classList.add('active');

        // Initialize map when switching to map tab
        if (tab === 'map') {
            DamageMap.initMap();
        }

        // Refresh history when switching to history tab
        if (tab === 'history') {
            History.render();
        }
    }

    // ---- File Upload ----
    function setupUpload() {
        // Click to browse
        chooseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });

        dropzone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        // Drag and drop
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // Remove file
        removeBtn.addEventListener('click', removeFile);
    }

    function handleFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp'];
        if (!validTypes.includes(file.type)) {
            showToast('Please upload a PNG, JPG, WEBP, or BMP image.');
            return;
        }

        if (file.size > 20 * 1024 * 1024) {
            showToast('File size exceeds 20MB limit.');
            return;
        }

        currentFile = file;

        // Show preview
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            dropzone.style.display = 'none';
            previewDiv.style.display = 'flex';
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            analyzeBtn.disabled = false;
        };
        reader.readAsDataURL(file);
    }

    function removeFile() {
        currentFile = null;
        fileInput.value = '';
        previewImg.src = '';
        dropzone.style.display = 'flex';
        previewDiv.style.display = 'none';
        analyzeBtn.disabled = true;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ---- Analysis ----
    function setupAnalyze() {
        analyzeBtn.addEventListener('click', startAnalysis);
    }

    async function startAnalysis() {
        if (!currentFile) {
            showToast('Please upload an image first.');
            return;
        }

        // Show loading
        uploadSection.style.display = 'none';
        resultsSection.style.display = 'none';
        loadingSection.style.display = 'block';

        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressFill.style.width = progress + '%';
        }, 300);

        try {
            // Get or generate device ID for spam protection logic
            let deviceId = localStorage.getItem('damageai_device_id');
            if (!deviceId) {
                deviceId = 'DEV-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                localStorage.setItem('damageai_device_id', deviceId);
            }

            // Get location before upload (or use dummy location if unavailable)
            let lat = userLocation ? userLocation.lat : 11.9416 + (Math.random() - 0.5) * 0.01;
            let lng = userLocation ? userLocation.lng : 79.8083 + (Math.random() - 0.5) * 0.01;

            const formData = new FormData();
            formData.append('image', currentFile);
            formData.append('device_id', deviceId);
            formData.append('latitude', lat);
            formData.append('longitude', lng);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                clearInterval(progressInterval);
                progressFill.style.width = '100%';

                currentResult = result;

                setTimeout(() => {
                    loadingSection.style.display = 'none';
                    resultsSection.style.display = 'block';
                    Detection.displayResults(result);

                    // Save to history
                    History.save(result, previewImg.src);

                    // Add marker to map
                    DamageMap.addDamageMarker(result);

                    // Voice feedback
                    if (typeof VoiceAssistant !== 'undefined') {
                        VoiceAssistant.speak(
                            `Damage detected. ${result.damage_type}. Severity level ${result.severity.toLowerCase()}. Safety score ${result.safety_score} out of 100.`
                        );
                    }
                }, 500);
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
        } catch (error) {
            clearInterval(progressInterval);
            loadingSection.style.display = 'none';
            uploadSection.style.display = 'block';
            showToast('Analysis failed: ' + error.message);
            console.error('Analysis error:', error);
        }
    }

    function resetAnalysis() {
        resultsSection.style.display = 'none';
        uploadSection.style.display = 'block';
        removeFile();
        currentResult = null;
    }

    // ---- Location ----
    function getUserLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userLocation = {
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    };
                },
                () => {
                    console.log('Location access denied, using default.');
                }
            );
        }
    }

    // ---- Toast ----
    function showToast(message) {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toast-message');
        toastMsg.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // Public API
    return {
        init,
        switchTab,
        startAnalysis,
        resetAnalysis,
        showToast,
        getCurrentResult: () => currentResult,
        getPreviewSrc: () => previewImg.src
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', App.init);

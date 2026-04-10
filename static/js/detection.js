/**
 * DamageAI — Detection Results Display
 * Renders detection results, metrics, and risk analysis
 */

const Detection = (() => {

    function displayResults(result) {
        // Set metric values
        document.getElementById('val-damage-type').textContent = result.damage_type;
        document.getElementById('val-confidence').textContent = result.confidence + '%';
        document.getElementById('val-severity').textContent = result.severity;
        document.getElementById('val-safety').textContent = result.safety_score + '/100';
        document.getElementById('val-area').textContent = result.damage_area_pct + '%';
        document.getElementById('val-regions').textContent = result.num_regions;
        document.getElementById('val-size').textContent = result.size && result.size !== 'N/A' ? result.size : '—';
        document.getElementById('val-cost').textContent = result.estimated_cost ? ('₹' + result.estimated_cost.toLocaleString('en-IN')) : '—';

        // Apply severity styling
        applySeverityStyles(result.severity);

        // Set images
        document.getElementById('original-result-img').src = `/uploads/${result.original_image}`;
        document.getElementById('detected-result-img').src = `/uploads/${result.detected_image}`;

        // Risk analysis
        document.getElementById('risk-text').textContent = result.risk_analysis;
        document.getElementById('solution-text').textContent = result.recommended_solution;

        // Safety score visual
        updateSafetyVisual(result.safety_score, result.severity);

        // Setup download buttons
        setupDownloads(result);
    }

    function applySeverityStyles(severity) {
        const severityCard = document.getElementById('metric-severity');
        const safetyCard = document.getElementById('metric-safety');

        // Remove old classes
        ['severity-severe', 'severity-moderate', 'severity-minor', 'severity-low'].forEach(cls => {
            severityCard.classList.remove(cls);
            safetyCard.classList.remove(cls);
        });

        const classMap = {
            'SEVERE': 'severity-severe',
            'MODERATE': 'severity-moderate',
            'MINOR': 'severity-minor',
            'LOW': 'severity-low'
        };

        const cls = classMap[severity] || 'severity-moderate';
        severityCard.classList.add(cls);
        safetyCard.classList.add(cls);
    }

    function updateSafetyVisual(score, severity) {
        const fill = document.getElementById('safety-bar-fill');
        const explanation = document.getElementById('safety-explanation');

        // Fill from right — higher score means less fill (safer)
        const fillWidth = 100 - score;
        setTimeout(() => {
            fill.style.width = fillWidth + '%';
        }, 300);

        const explanations = {
            'SEVERE': `Severe Damage — Score ${score}/100. Unsafe condition detected. Immediate maintenance required.`,
            'MODERATE': `Moderate Damage — Score ${score}/100. Deterioration observed. Schedule maintenance soon.`,
            'MINOR': `Minor Damage — Score ${score}/100. Minor issues detected. Monitor and plan maintenance.`,
            'LOW': `Low Damage — Score ${score}/100. Condition is acceptable. Routine monitoring recommended.`
        };

        explanation.textContent = explanations[severity] || explanations['MODERATE'];
    }

    function setupDownloads(result) {
        // Download inspection image
        const downloadImgBtn = document.getElementById('download-image-btn');
        downloadImgBtn.onclick = () => {
            downloadImage(result.detected_image);
        };

        // Download PDF report
        const downloadPdfBtn = document.getElementById('download-pdf-btn');
        downloadPdfBtn.onclick = () => {
            PDFReport.generate(result);
        };
    }

    function downloadImage(detectedImageFilename) {
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const downloadName = `damage_detection_report_${timestamp}.png`;

        const link = document.createElement('a');
        link.href = `/uploads/${detectedImageFilename}`;
        link.download = downloadName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        App.showToast('Inspection image downloaded successfully.');

        if (typeof VoiceAssistant !== 'undefined') {
            VoiceAssistant.speak('Detected image downloaded.');
        }
    }

    return {
        displayResults,
        downloadImage
    };
})();

/**
 * DamageAI — PDF Report Generator
 * Generates professional government-style inspection reports using jsPDF
 */

const PDFReport = (() => {

    function generate(result) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const margin = 20;
        const contentWidth = pageWidth - 2 * margin;
        let y = 0;

        // ---- HEADER ----
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, pageWidth, 38, 'F');

        doc.setFillColor(59, 130, 246);
        doc.rect(0, 38, pageWidth, 3, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('AI STRUCTURAL DAMAGE', pageWidth / 2, 16, { align: 'center' });
        doc.text('INSPECTION REPORT', pageWidth / 2, 26, { align: 'center' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 190, 210);
        doc.text(`Report ID: ${result.report_id}`, margin, 34);
        doc.text(`Date: ${result.inspection_date}`, pageWidth / 2, 34, { align: 'center' });
        doc.text(`System: DamageAI v${result.system_version}`, pageWidth - margin, 34, { align: 'right' });

        y = 50;

        // ---- INSPECTION SUMMARY ----
        y = sectionTitle(doc, 'INSPECTION SUMMARY', y);

        // Summary table
        const summaryData = [
            ['Inspection ID', result.inspection_id],
            ['Damage Type', result.damage_type],
            ['Confidence', result.confidence + '%'],
            ['Severity Level', result.severity],
            ['Safety Score', result.safety_score + '/100'],
            ['Damage Area', result.damage_area_pct + '%'],
            ['Regions Detected', String(result.num_regions)],
            ['AI Model', result.ai_model],
            ['Inspection Date', result.inspection_date]
        ];

        if (result.latitude && result.longitude) {
            summaryData.push(['Location', `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`]);
        }

        y = drawTable(doc, summaryData, margin, y, contentWidth);
        y += 8;

        // ---- SAFETY IMPACT SCORE ----
        y = sectionTitle(doc, 'SAFETY IMPACT SCORE', y);

        // Safety bar
        const barX = margin;
        const barW = contentWidth;
        const barH = 8;

        // Background gradient simulation
        const steps = 40;
        const stepW = barW / steps;
        for (let i = 0; i < steps; i++) {
            const ratio = i / steps;
            let r, g, b;
            if (ratio < 0.33) {
                r = 239; g = Math.floor(68 + ratio * 3 * 180); b = 68;
            } else if (ratio < 0.66) {
                r = Math.floor(239 - (ratio - 0.33) * 3 * 200); g = 179; b = 8;
            } else {
                r = 34; g = Math.floor(197 - (ratio - 0.66) * 3 * 50); b = 94;
            }
            doc.setFillColor(r, g, b);
            doc.rect(barX + i * stepW, y, stepW + 0.5, barH, 'F');
        }

        // Score marker
        const markerX = barX + (result.safety_score / 100) * barW;
        doc.setFillColor(0, 0, 0);
        doc.triangle(markerX - 2, y + barH + 4, markerX + 2, y + barH + 4, markerX, y + barH, 'F');

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text('Critical', barX, y + barH + 8);
        doc.text('Moderate', barX + barW / 2, y + barH + 8, { align: 'center' });
        doc.text('Safe', barX + barW, y + barH + 8, { align: 'right' });

        y += barH + 14;

        // Severity message
        const severityColors = {
            'SEVERE': [239, 68, 68],
            'MODERATE': [249, 115, 22],
            'MINOR': [234, 179, 8],
            'LOW': [34, 197, 94]
        };
        const sColor = severityColors[result.severity] || [200, 200, 200];
        doc.setTextColor(sColor[0], sColor[1], sColor[2]);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');

        const severityMessages = {
            'SEVERE': 'Severe Damage — Unsafe condition detected. Immediate maintenance required.',
            'MODERATE': 'Moderate Damage — Deterioration observed. Schedule maintenance soon.',
            'MINOR': 'Minor Damage — Minor issues detected. Monitor and plan maintenance.',
            'LOW': 'Low Damage — Condition is acceptable. Routine monitoring recommended.'
        };
        doc.text(severityMessages[result.severity] || '', margin, y);
        y += 12;

        // ---- INSPECTION IMAGES ----
        y = sectionTitle(doc, 'INSPECTION IMAGES', y);

        // We'll place placeholders since we can't easily load cross-origin images in jsPDF
        const imgW = (contentWidth - 10) / 2;
        const imgH = 50;

        doc.setFillColor(230, 230, 230);
        doc.rect(margin, y, imgW, imgH, 'F');
        doc.rect(margin + imgW + 10, y, imgW, imgH, 'F');

        // Try loading actual images
        try {
            const originalImg = document.getElementById('original-result-img');
            const detectedImg = document.getElementById('detected-result-img');

            if (originalImg && originalImg.complete && originalImg.naturalWidth > 0) {
                const canvas1 = imageToCanvas(originalImg);
                if (canvas1) {
                    doc.addImage(canvas1.toDataURL('image/jpeg', 0.8), 'JPEG', margin, y, imgW, imgH);
                }
            }

            if (detectedImg && detectedImg.complete && detectedImg.naturalWidth > 0) {
                const canvas2 = imageToCanvas(detectedImg);
                if (canvas2) {
                    doc.addImage(canvas2.toDataURL('image/jpeg', 0.8), 'JPEG', margin + imgW + 10, y, imgW, imgH);
                }
            }
        } catch (e) {
            console.log('Could not embed images in PDF:', e);
        }

        y += imgH + 4;

        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'italic');
        doc.text('Original Image', margin + imgW / 2, y, { align: 'center' });
        doc.text('AI Detected Damage', margin + imgW + 10 + imgW / 2, y, { align: 'center' });
        y += 10;

        // ---- PREDICTIVE RISK ANALYSIS ----
        y = sectionTitle(doc, 'PREDICTIVE RISK ANALYSIS', y);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(50, 50, 50);
        doc.text('AI Risk Prediction:', margin, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);
        const riskLines = doc.splitTextToSize(result.risk_analysis, contentWidth);
        doc.text(riskLines, margin, y);
        y += riskLines.length * 4.5 + 6;

        // Check if we need a new page
        if (y > 250) {
            doc.addPage();
            y = 20;
        }

        // ---- RECOMMENDED ACTIONS ----
        y = sectionTitle(doc, 'RECOMMENDED ACTIONS', y);

        const actions = [
            'Document all damage with timestamped photographs for infrastructure records.',
            'Schedule follow-up inspection within recommended timeframe.',
            'IMMEDIATE ACTION: Restrict traffic in affected area if risk increases.',
            'Conduct structural assessment by a certified civil engineer.',
            'Notify local road maintenance authority immediately.'
        ];

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 60, 60);

        actions.forEach((action, i) => {
            const lines = doc.splitTextToSize(`${i + 1}. ${action}`, contentWidth - 5);
            if (i === 2) {
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(239, 68, 68);
            }
            doc.text(lines, margin + 2, y);
            y += lines.length * 4.5 + 2;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(60, 60, 60);
        });

        y += 6;

        // ---- SOLUTION ----
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(34, 139, 94);
        doc.text('Recommended Solution:', margin, y);
        y += 5;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        const solLines = doc.splitTextToSize(result.recommended_solution, contentWidth);
        doc.text(solLines, margin, y);
        y += solLines.length * 4.5 + 10;

        // ---- FOOTER ----
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFillColor(245, 245, 250);
            doc.rect(0, 282, pageWidth, 15, 'F');
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 130);
            doc.setFont('helvetica', 'italic');
            doc.text(
                'This report is automatically generated by the AI Smart Damage Detection System and is intended for preliminary inspection purposes.',
                pageWidth / 2, 288, { align: 'center' }
            );
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, 293, { align: 'right' });
        }

        // Save
        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        doc.save(`inspection_report_${timestamp}.pdf`);

        App.showToast('Inspection report downloaded successfully.');
        if (typeof VoiceAssistant !== 'undefined') {
            VoiceAssistant.speak('Inspection report downloaded successfully.');
        }
    }

    function sectionTitle(doc, title, y) {
        doc.setFillColor(30, 41, 59);
        doc.rect(20, y - 1, 170, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 24, y + 5);
        return y + 12;
    }

    function drawTable(doc, data, x, y, width) {
        const colWidth = width / 2;
        const rowH = 7;

        data.forEach((row, i) => {
            const bgColor = i % 2 === 0 ? [248, 250, 255] : [255, 255, 255];
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.rect(x, y, width, rowH, 'F');

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(60, 60, 80);
            doc.text(row[0], x + 4, y + 5);

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(30, 30, 50);
            doc.text(row[1], x + colWidth + 4, y + 5);

            y += rowH;
        });

        // Border
        doc.setDrawColor(200, 200, 220);
        doc.rect(x, y - data.length * rowH, width, data.length * rowH, 'S');

        return y;
    }

    function imageToCanvas(img) {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            return canvas;
        } catch (e) {
            return null;
        }
    }

    return { generate };
})();

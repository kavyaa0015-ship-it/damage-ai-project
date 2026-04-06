/**
 * DamageAI — Inspection History Manager
 * Uses LocalStorage to persist inspection records
 */

const History = (() => {
    const STORAGE_KEY = 'damageai_history';

    // Filter state
    let filters = {
        type: 'all',
        severity: 'all',
        status: 'all'
    };

    function getHistory() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    }

    function save(result, originalImageSrc) {
        const history = getHistory();
        const record = {
            id: result.inspection_id,
            report_id: result.report_id,
            damage_type: result.damage_type,
            confidence: result.confidence,
            severity: result.severity,
            safety_score: result.safety_score,
            damage_area_pct: result.damage_area_pct,
            num_regions: result.num_regions,
            inspection_date: result.inspection_date,
            original_image: result.original_image,
            detected_image: result.detected_image,
            risk_analysis: result.risk_analysis,
            recommended_solution: result.recommended_solution,
            ai_model: result.ai_model,
            system_version: result.system_version,
            latitude: result.latitude,
            longitude: result.longitude,
            thumbnail: originalImageSrc,  // base64 thumbnail for offline display
            repair_status: result.repair_status || 'Pending' // Default to pending
        };

        history.unshift(record);

        // Keep max 50 records
        if (history.length > 50) {
            history.splice(50);
        }

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        } catch (e) {
            // If storage full, remove oldest entries
            if (history.length > 10) {
                history.splice(10);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
            }
        }
    }

    function init() {
        // Setup filter listeners
        const typeFilter = document.getElementById('filter-type');
        const sevFilter = document.getElementById('filter-severity');
        const statusFilter = document.getElementById('filter-status');

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                filters.type = e.target.value;
                render();
            });
        }

        if (sevFilter) {
            sevFilter.addEventListener('change', (e) => {
                filters.severity = e.target.value;
                render();
            });
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                filters.status = e.target.value;
                render();
            });
        }
    }

    function render() {
        const history = getHistory();
        const tbody = document.getElementById('history-tbody');
        const emptyState = document.getElementById('history-empty');
        const tableContainer = document.querySelector('.table-container .history-table');
        const clearBtn = document.getElementById('clear-history-btn');

        if (!tbody) return;

        // Clear existing rows
        tbody.innerHTML = '';

        if (history.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            clearBtn.style.display = 'none';
            return;
        }

        // Apply filters
        const filteredHistory = history.filter(record => {
            const matchType = filters.type === 'all' || record.damage_type === filters.type;
            const matchSev = filters.severity === 'all' || record.severity === filters.severity;
            const matchStatus = filters.status === 'all' || (record.repair_status || 'Pending') === filters.status;
            return matchType && matchSev && matchStatus;
        });

        if (filteredHistory.length === 0) {
            tableContainer.style.display = 'none';
            emptyState.style.display = 'flex';
            emptyState.querySelector('h3').textContent = 'No Matches Found';
            emptyState.querySelector('p').textContent = 'Try adjusting your filters';
            clearBtn.style.display = 'inline-flex';
            return;
        }

        tableContainer.style.display = 'table';
        emptyState.style.display = 'none';
        clearBtn.style.display = 'inline-flex';

        filteredHistory.forEach((record) => {
            const row = createRow(record);
            tbody.appendChild(row);
        });

        // Clear history button — opens custom modal
        clearBtn.onclick = () => {
            showConfirmModal();
        };
    }

    function showConfirmModal() {
        const modal = document.getElementById('confirm-modal');
        const cancelBtn = document.getElementById('modal-cancel-btn');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        modal.classList.add('active');

        // Close on Cancel
        cancelBtn.onclick = () => {
            modal.classList.remove('active');
        };

        // Close on overlay click
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        };

        // Confirm clear
        confirmBtn.onclick = () => {
            modal.classList.remove('active');
            clearAll();
            App.showToast('Inspection history cleared successfully.');
            if (typeof VoiceAssistant !== 'undefined') {
                VoiceAssistant.speak('Inspection history cleared successfully.');
            }
        };
    }

    function createRow(record) {
        const tr = document.createElement('tr');

        const severityClass = record.severity.toLowerCase();
        const imgSrc = record.thumbnail || `/uploads/${record.detected_image}`;

        // Ensure legacy records have a repair status
        const currentStatus = record.repair_status || 'Pending';

        // Format GPS nicely
        const lat = record.latitude.toFixed(4);
        const lon = record.longitude.toFixed(4);

        tr.innerHTML = `
            <td class="history-cell-img">
                <img src="${imgSrc}" alt="Thumbnail" onerror="this.style.background='var(--bg-panel)';this.alt='N/A';">
            </td>
            <td>
                <strong>${record.damage_type}</strong>
                <div class="table-subtext">id: ${record.id.substring(0, 8)}</div>
            </td>
            <td>
                <span class="severity-badge ${severityClass}">${record.severity}</span>
            </td>
            <td>
                <div class="gps-coords">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${lat}, ${lon}
                </div>
            </td>
            <td>
                <div class="date-text text-nowrap">${record.inspection_date.split(' ')[0]}</div>
                <div class="table-subtext">${record.inspection_date.split(' ')[1]}</div>
            </td>
            <td>
                <select class="status-dropdown status-${currentStatus.replace(/\s+/g, '').toLowerCase()}">
                    <option value="Pending" ${currentStatus === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${currentStatus === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Repaired" ${currentStatus === 'Repaired' ? 'selected' : ''}>Repaired</option>
                </select>
            </td>
            <td>
                <div class="table-actions">
                    <button class="btn-icon btn-view-map" title="View on Map">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line></svg>
                    </button>
                    <button class="btn-icon btn-view-report" title="View Inspection">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    <button class="btn-icon btn-dl-pdf" title="Download PDF">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </button>
                </div>
            </td>
        `;

        // Handle Status Change
        const statusSelect = tr.querySelector('.status-dropdown');
        statusSelect.addEventListener('change', (e) => {
            const newStatus = e.target.value;
            // Update class for styling
            statusSelect.className = `status-dropdown status-${newStatus.replace(/\s+/g, '').toLowerCase()}`;
            updateRepairStatus(record.id, newStatus);
        });

        // Handle view full result
        tr.querySelector('.btn-view-report').addEventListener('click', () => {
            viewRecord(record);
        });

        // Handle view on map
        tr.querySelector('.btn-view-map').addEventListener('click', () => {
            App.switchTab('map');
            // Assuming DamageMap exposes a focus method or we just let it re-init and center later
            // We'll focus manually if possible:
            if (typeof DamageMap !== 'undefined' && DamageMap.focusCoordinate) {
                DamageMap.focusCoordinate(record.latitude, record.longitude);
            }
        });

        // Handle Download PDF
        tr.querySelector('.btn-dl-pdf').addEventListener('click', () => {
            PDFReport.generate(record);
        });

        return tr;
    }

    function updateRepairStatus(recordId, newStatus) {
        const history = getHistory();
        const index = history.findIndex(r => r.id === recordId);
        if (index !== -1) {
            history[index].repair_status = newStatus;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));

            // Show toast without re-rendering the whole table so user doesn't lose focus
            App.showToast(`Status updated to ${newStatus}`);
        }
    }

    function viewRecord(record) {
        App.switchTab('detect');

        const uploadSection = document.getElementById('upload-section');
        const resultsSection = document.getElementById('results-section');

        uploadSection.style.display = 'none';
        resultsSection.style.display = 'block';

        Detection.displayResults(record);
    }

    function clearAll() {
        localStorage.removeItem(STORAGE_KEY);
        render();
    }

    return {
        init,
        save,
        render,
        clearAll,
        getHistory
    };
})();

// Initialize DOM listeners once loaded
document.addEventListener('DOMContentLoaded', () => {
    History.init();
});

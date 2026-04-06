/**
 * DamageAI — Road Damage Map
 * Interactive map using Leaflet.js + OpenStreetMap
 * Displays color-coded damage markers with GPS locations
 */

const DamageMap = (() => {
    let map = null;
    let markers = [];
    let markerGroup = null;
    let isInitialized = false;

    const STORAGE_KEY = 'damageai_map_markers';

    const SEVERITY_COLORS = {
        'SEVERE': '#ef4444',
        'MODERATE': '#f97316',
        'MINOR': '#eab308',
        'LOW': '#22c55e'
    };

    function initMap() {
        if (isInitialized && map) {
            map.invalidateSize();
            return;
        }

        const mapEl = document.getElementById('damage-map');
        if (!mapEl) return;

        // Default center (will update if GPS available)
        map = L.map('damage-map', {
            zoomControl: true
        }).setView([11.9416, 79.8083], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);

        markerGroup = L.featureGroup().addTo(map);

        // Try to center on user location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    map.setView([latitude, longitude], 14);

                    // User location marker
                    const userIcon = L.divIcon({
                        className: 'user-location-marker',
                        html: `<div style="
                            width: 16px;
                            height: 16px;
                            background: #3b82f6;
                            border: 3px solid white;
                            border-radius: 50%;
                            box-shadow: 0 0 10px rgba(59,130,246,0.5);
                        "></div>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                    });

                    L.marker([latitude, longitude], { icon: userIcon })
                        .addTo(map)
                        .bindPopup('<strong>Your Location</strong>')
                        .openPopup();
                },
                () => {
                    console.log('Could not get user location for map.');
                }
            );
        }

        // Load saved markers
        loadSavedMarkers();

        isInitialized = true;
    }

    function createMarkerIcon(severity) {
        const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS['MODERATE'];
        return L.divIcon({
            className: 'damage-marker',
            html: `<div style="
                width: 24px;
                height: 24px;
                background: ${color};
                border: 3px solid white;
                border-radius: 50%;
                box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 12px ${color}40;
                display: flex;
                align-items: center;
                justify-content: center;
            ">
                <div style="
                    width: 8px;
                    height: 8px;
                    background: white;
                    border-radius: 50%;
                    opacity: 0.8;
                "></div>
            </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -15]
        });
    }

    function addDamageMarker(result) {
        const lat = result.latitude;
        const lng = result.longitude;

        if (!lat || !lng) return;

        const markerData = {
            lat,
            lng,
            damage_type: result.damage_type,
            severity: result.severity,
            safety_score: result.safety_score,
            confidence: result.confidence,
            inspection_date: result.inspection_date,
            inspection_id: result.inspection_id
        };

        // Save to storage
        saveMarker(markerData);

        // Add to map if initialized
        if (map && markerGroup) {
            placeMarker(markerData);
        }
    }

    function placeMarker(data) {
        const icon = createMarkerIcon(data.severity);

        const severityColors = {
            'SEVERE': '#ef4444',
            'MODERATE': '#f97316',
            'MINOR': '#eab308',
            'LOW': '#22c55e'
        };
        const badgeColor = severityColors[data.severity] || '#94a3b8';

        const popup = L.popup({
            className: 'damage-popup'
        }).setContent(`
            <div style="
                font-family: 'Inter', sans-serif;
                min-width: 220px;
                padding: 4px;
            ">
                <div style="
                    background: #1a2035;
                    color: white;
                    padding: 10px 14px;
                    border-radius: 8px;
                    margin-bottom: 0;
                ">
                    <div style="font-size: 14px; font-weight: 700; margin-bottom: 8px;">
                        ${data.damage_type}
                    </div>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                        <span style="
                            background: ${badgeColor}22;
                            color: ${badgeColor};
                            padding: 2px 8px;
                            border-radius: 12px;
                            font-size: 11px;
                            font-weight: 700;
                        ">${data.severity}</span>
                        <span style="
                            background: rgba(59,130,246,0.15);
                            color: #3b82f6;
                            padding: 2px 8px;
                            border-radius: 12px;
                            font-size: 11px;
                            font-weight: 600;
                        ">Score: ${data.safety_score}/100</span>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; line-height: 1.6;">
                        📍 ${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}<br>
                        🕐 ${data.inspection_date}<br>
                        📊 Confidence: ${data.confidence}%
                    </div>
                </div>
            </div>
        `);

        const marker = L.marker([data.lat, data.lng], { icon }).bindPopup(popup);
        markerGroup.addLayer(marker);
        markers.push(marker);
    }

    function loadSavedMarkers() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const savedMarkers = JSON.parse(data);
                savedMarkers.forEach(m => placeMarker(m));
            }
        } catch {
            console.log('Could not load saved map markers.');
        }
    }

    function saveMarker(markerData) {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            const savedMarkers = data ? JSON.parse(data) : [];
            savedMarkers.push(markerData);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedMarkers));
        } catch {
            console.log('Could not save map marker.');
        }
    }

    function fitAllMarkers() {
        if (map && markerGroup && markerGroup.getLayers().length > 0) {
            map.fitBounds(markerGroup.getBounds().pad(0.1));
        }
    }

    function clearMarkers() {
        if (markerGroup) markerGroup.clearLayers();
        markers = [];
        localStorage.removeItem(STORAGE_KEY);
    }

    function focusCoordinate(lat, lng) {
        if (map) {
            // Optional: flyTo gives a nice smooth animation
            map.flyTo([lat, lng], 17, {
                animate: true,
                duration: 1.5
            });
            // Also find and open the corresponding popup if the marker exists
            markers.forEach(m => {
                const pos = m.getLatLng();
                if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lng) < 0.0001) {
                    setTimeout(() => m.openPopup(), 1500); // open after fly delay
                }
            });
        }
    }

    return {
        initMap,
        addDamageMarker,
        fitAllMarkers,
        clearMarkers,
        focusCoordinate
    };
})();

// ===== WAIT FOR EVERYTHING TO LOAD =====
window.addEventListener('load', function() {
    'use strict';

    console.log('Travel Route Planner starting...');

    // ===== DOM REFS =====
    const originInput = document.getElementById('originInput');
    const destInput = document.getElementById('destInput');
    const dateInput = document.getElementById('dateInput');
    const travelModeSelect = document.getElementById('travelMode');
    const findBtn = document.getElementById('findRouteBtn');
    const resetBtn = document.getElementById('resetBtn');
    const currentLocationBtn = document.getElementById('currentLocationBtn');
    const darkModeBtn = document.getElementById('darkModeBtn');
    const errorBanner = document.getElementById('errorBanner');
    const errorMsg = document.getElementById('errorMessage');
    const mapContainer = document.getElementById('map');

    const distanceVal = document.getElementById('distanceVal');
    const timeVal = document.getElementById('timeVal');
    const modeDisplay = document.getElementById('modeDisplay');
    const weatherCondition = document.getElementById('weatherCondition');
    const weatherIcon = document.getElementById('weatherIcon');
    const tempVal = document.getElementById('tempVal');
    const rainProb = document.getElementById('rainProb');
    const weatherDate = document.getElementById('weatherDate');
    const turnContainer = document.getElementById('turnContainer');
    const turnList = document.getElementById('turnList');
    const modeBadge = document.getElementById('modeBadge');

    // ===== MAP VARIABLES =====
    let map = null;
    let routeLayer = null;
    let markerLayer = null;
    let mapInitialized = false;
    let currentLocationMarker = null;
    let isDarkMode = false;

    // ===== TRAVEL MODE MAPPING =====
    const modeMapping = {
        'car': { icon: '🚗', label: 'Driving', graphhopper: 'car', speed: 50 },
        'walk': { icon: '🚶', label: 'Walking', graphhopper: 'walk', speed: 5 }
    };

    // ===== CHECK IF LEAFLET LOADED =====
    function isLeafletLoaded() {
        return typeof L !== 'undefined' && L.version;
    }

    // ===== INIT MAP =====
    function initMap() {
        try {
            if (!isLeafletLoaded()) {
                console.error('Leaflet not loaded!');
                return false;
            }

            if (map) {
                map.invalidateSize();
                mapInitialized = true;
                return true;
            }

            if (!mapContainer) {
                console.error('Map container not found');
                return false;
            }

            mapContainer.innerHTML = '';

            map = L.map('map', {
                center: [12.8797, 121.7740],
                zoom: 6,
                zoomControl: true
            });

          const tiles = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }
);

tiles.on('tileerror', function (event) {
    console.error('Map tile failed to load:', event);
});

tiles.addTo(map);

            markerLayer = L.layerGroup().addTo(map);
            mapInitialized = true;

            setTimeout(function() {
                if (map) {
                    map.invalidateSize();
                    console.log('Map size updated');
                }
            }, 300);

            console.log('Map initialized successfully!');
            return true;
        } catch (error) {
            console.error('Error initializing map:', error);
            return false;
        }
    }

    // ===== DARK MODE =====
    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode', isDarkMode);
        darkModeBtn.textContent = isDarkMode ? '☀️ Light' : '🌙 Dark';
        localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false');
        
        // Update map tiles for dark mode
        if (map) {
            map.eachLayer(function(layer) {
                if (layer instanceof L.TileLayer) {
                    map.removeLayer(layer);
                }
            });
            
            const tileUrl = isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
            const attribution = isDarkMode
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; CartoDB'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
            
            L.tileLayer(tileUrl, {
                attribution: attribution,
                maxZoom: 19
            }).addTo(map);
        }
    }

    // ===== CURRENT LOCATION =====
    function getCurrentLocation() {
        if (!navigator.geolocation) {
            showError('Geolocation is not supported by your browser.');
            return;
        }

        showError('📍 Getting your location...');
        findBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                // Remove old location marker
                if (currentLocationMarker) {
                    map.removeLayer(currentLocationMarker);
                }
                
                // Add new marker
                currentLocationMarker = L.marker([lat, lon], {
                    icon: L.divIcon({
                        className: 'current-location-marker',
                        html: '📍',
                        iconSize: [30, 30]
                    })
                }).bindPopup('📍 You are here').addTo(map);
                
                map.setView([lat, lon], 13);
                hideError();
                findBtn.disabled = false;
                
                // Try to reverse geocode for the origin
                reverseGeocode(lat, lon);
            },
            function(error) {
                showError('Unable to get your location: ' + error.message);
                findBtn.disabled = false;
            }
        );
    }

    // ===== REVERSE GEOCODE =====
    async function reverseGeocode(lat, lon) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`;
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'TravelPlanner/1.0' }
            });
            
            if (resp.ok) {
                const data = await resp.json();
                if (data.display_name) {
                    originInput.value = data.display_name.split(',')[0].trim();
                }
            }
        } catch (e) {
            console.log('Reverse geocode failed');
        }
    }

    // ===== HELPERS =====
    function clearRouteAndMarkers() {
        try {
            if (routeLayer && map) {
                map.removeLayer(routeLayer);
                routeLayer = null;
            }
            if (markerLayer && map) {
                markerLayer.clearLayers();
            }
        } catch (error) {
            console.error('Error clearing route:', error);
        }
        turnContainer.style.display = 'none';
        turnList.innerHTML = '';
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorBanner.classList.add('show');
        clearTimeout(window.errorTimeout);
        window.errorTimeout = setTimeout(function() {
            errorBanner.classList.remove('show');
        }, 6000);
    }

    function hideError() {
        errorBanner.classList.remove('show');
    }

    function resetResults() {
        distanceVal.textContent = '—';
        timeVal.textContent = '—';
        weatherCondition.textContent = '—';
        weatherIcon.textContent = '🌡️';
        tempVal.textContent = '—';
        rainProb.textContent = '—';
        weatherDate.textContent = '—';
        turnContainer.style.display = 'none';
        turnList.innerHTML = '';
    }

    // ===== 1. GEOCODE =====
    const knownLocations = {
        'manila': { lat: 14.5995, lon: 120.9842 },
        'manila, philippines': { lat: 14.5995, lon: 120.9842 },
        'baguio': { lat: 16.4023, lon: 120.5960 },
        'baguio, philippines': { lat: 16.4023, lon: 120.5960 },
        'cebu': { lat: 10.3157, lon: 123.8854 },
        'cebu, philippines': { lat: 10.3157, lon: 123.8854 },
        'davao': { lat: 7.1907, lon: 125.4553 },
        'davao, philippines': { lat: 7.1907, lon: 125.4553 },
        'quezon city': { lat: 14.6760, lon: 121.0437 },
        'makati': { lat: 14.5547, lon: 121.0244 },
        'iloilo': { lat: 10.7202, lon: 122.5621 },
        'bacolod': { lat: 10.6407, lon: 122.9497 },
        'cagayan de oro': { lat: 8.4542, lon: 124.6319 }
    };

    async function geocode(address) {
        const normalized = address.toLowerCase().trim();
        
        if (knownLocations[normalized]) {
            return knownLocations[normalized];
        }

        try {
            const url = `https://geocode.xyz/${encodeURIComponent(address)}?json=1`;
            const resp = await fetch(url);
            
            if (resp.ok) {
                const data = await resp.json();
                if (!data.error && data.latt && data.longt) {
                    const lat = parseFloat(data.latt);
                    const lon = parseFloat(data.longt);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        return { lat, lon };
                    }
                }
            }
        } catch (e) {}

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'TravelPlanner/1.0',
                    'Accept': 'application/json'
                }
            });
            
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.length > 0) {
                    const lat = parseFloat(data[0].lat);
                    const lon = parseFloat(data[0].lon);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        return { lat, lon };
                    }
                }
            }
        } catch (e) {}

        throw new Error(`Could not find location: "${address}". Please check spelling.`);
    }

    // ===== 2. ROUTE =====
    async function getRoute(startLon, startLat, endLon, endLat, mode) {
        const modeType = modeMapping[mode]?.graphhopper || 'car';
        
        try {
            const url = `https://graphhopper.com/api/1/route?point=${startLat},${startLon}&point=${endLat},${endLon}&vehicle=${modeType}&key=da5d6548-51bd-4aec-8bfa-6ec0ce8ef3a1&points_encoded=false&instructions=true`;
            
            console.log('Fetching route from GraphHopper...');
            const resp = await fetch(url);
            
            if (!resp.ok) {
                throw new Error(`Route service error: ${resp.status}`);
            }
            
            const data = await resp.json();
            
            if (!data.paths || data.paths.length === 0) {
                throw new Error('No route found');
            }
            
            const path = data.paths[0];
            const points = path.points.coordinates;
            const coords = points.map(c => [c[1], c[0]]);
            const distanceKm = path.distance / 1000;
            const durationMin = path.time / 60000;
            
            // Extract instructions for turn-by-turn
            const instructions = path.instructions || [];
            const turns = instructions.map(inst => ({
                text: inst.text || '',
                distance: inst.distance || 0,
                sign: inst.sign || 0,
                time: inst.time || 0
            }));
            
            return { coords, distanceKm, durationMin, turns };
        } catch (error) {
            console.log('GraphHopper failed, using straight line fallback');
            
            const coords = [[startLat, startLon], [endLat, endLon]];
            
            const R = 6371;
            const dLat = (endLat - startLat) * Math.PI / 180;
            const dLon = (endLon - startLon) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distanceKm = R * c;
            const speed = modeMapping[mode]?.speed || 50;
            const durationMin = (distanceKm / speed) * 60;
            
            return { coords, distanceKm, durationMin, turns: [] };
        }
    }

    // ===== 3. WEATHER =====
    async function getWeather(lat, lon, dateStr) {
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&start_date=${dateStr}&end_date=${dateStr}&timezone=Asia/Manila`;
            
            const resp = await fetch(url);
            if (!resp.ok) throw new Error('Weather API error');
            
            const data = await resp.json();
            if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
                throw new Error('No weather data for this date');
            }
            
            const idx = 0;
            const code = data.daily.weathercode[idx];
            const maxTemp = data.daily.temperature_2m_max[idx];
            const minTemp = data.daily.temperature_2m_min[idx];
            const rainProbVal = data.daily.precipitation_probability_max[idx] || 0;

            const weatherMap = {
                0: { icon: '☀️', label: 'Clear' },
                1: { icon: '🌤️', label: 'Mainly clear' },
                2: { icon: '⛅', label: 'Partly cloudy' },
                3: { icon: '☁️', label: 'Overcast' },
                45: { icon: '🌫️', label: 'Fog' },
                48: { icon: '🌫️', label: 'Fog' },
                51: { icon: '🌧️', label: 'Light drizzle' },
                53: { icon: '🌧️', label: 'Moderate drizzle' },
                55: { icon: '🌧️', label: 'Dense drizzle' },
                61: { icon: '🌦️', label: 'Light rain' },
                63: { icon: '🌧️', label: 'Moderate rain' },
                65: { icon: '🌧️', label: 'Heavy rain' },
                71: { icon: '🌨️', label: 'Light snow' },
                73: { icon: '🌨️', label: 'Snow' },
                75: { icon: '❄️', label: 'Heavy snow' },
                80: { icon: '🌦️', label: 'Rain showers' },
                81: { icon: '🌧️', label: 'Showers' },
                82: { icon: '⛈️', label: 'Heavy showers' },
                95: { icon: '⛈️', label: 'Thunderstorm' },
                96: { icon: '⛈️', label: 'Thunderstorm' },
                99: { icon: '⛈️', label: 'Thunderstorm' }
            };
            
            const weather = weatherMap[code] || { icon: '🌡️', label: `Code ${code}` };
            return { 
                icon: weather.icon,
                condition: weather.label,
                maxTemp, 
                minTemp, 
                rainProb: rainProbVal 
            };
        } catch (error) {
            throw new Error('Could not fetch weather data. Please try again.');
        }
    }

    // ===== DISPLAY TURN-BY-TURN =====
    function displayTurns(turns) {
        if (!turns || turns.length === 0) {
            turnContainer.style.display = 'none';
            return;
        }

        turnContainer.style.display = 'block';
        turnList.innerHTML = '';

        const turnIcons = {
            0: '⬆️',  // Straight
            1: '↗️',  // Slight right
            2: '➡️',  // Right
            3: '↘️',  // Sharp right
            4: '🔄',  // Turn around
            5: '↖️',  // Sharp left
            6: '⬅️',  // Left
            7: '↙️'   // Slight left
        };

        turns.forEach(function(turn, index) {
            if (!turn.text) return;
            
            const div = document.createElement('div');
            div.className = 'turn-item';
            
            const icon = turnIcons[turn.sign] || '➡️';
            const distance = turn.distance ? (turn.distance / 1000).toFixed(1) + 'km' : '';
            
            div.innerHTML = `
                <span class="turn-icon">${icon}</span>
                <span>${turn.text}</span>
                <span class="turn-distance">${distance}</span>
            `;
            
            turnList.appendChild(div);
        });

        if (turnList.children.length === 0) {
            turnContainer.style.display = 'none';
        }
    }

    // ===== MAIN: FIND ROUTE =====
    async function handleFindRoute() {
        console.log('Find Route clicked');
        hideError();
        clearRouteAndMarkers();
        resetResults();

        if (!isLeafletLoaded()) {
            showError('Map library is loading. Please wait and try again.');
            return;
        }

        if (!map || !mapInitialized) {
            const success = initMap();
            if (!success) {
                showError('Failed to initialize map. Please refresh the page.');
                return;
            }
        }

        const origin = originInput.value.trim();
        const dest = destInput.value.trim();
        const dateVal = dateInput.value;
        const mode = travelModeSelect.value;

        if (!origin || !dest) {
            showError('Please fill both origin and destination.');
            return;
        }
        if (!dateVal) {
            showError('Please select a visit date.');
            return;
        }
        
        const today = new Date().toISOString().slice(0, 10);
        if (dateVal < today) {
            showError('Please choose today or a future date.');
            return;
        }

        try {
            findBtn.textContent = '⏳ Loading...';
            findBtn.disabled = true;

            const originCoords = await geocode(origin);
            const destCoords = await geocode(dest);

            const routeData = await getRoute(
                originCoords.lon, originCoords.lat,
                destCoords.lon, destCoords.lat,
                mode
            );

            // Update mode display
            const modeInfo = modeMapping[mode] || modeMapping['car'];
            modeDisplay.textContent = modeInfo.icon + ' ' + modeInfo.label;
            modeBadge.textContent = modeInfo.icon + ' ' + modeInfo.label;

            // Draw markers
            L.marker([originCoords.lat, originCoords.lon])
                .bindPopup('📍 Origin: ' + origin)
                .addTo(markerLayer);
            
            L.marker([destCoords.lat, destCoords.lon])
                .bindPopup('🏁 Destination: ' + dest)
                .addTo(markerLayer);

            // Draw route
            routeLayer = L.polyline(routeData.coords, {
                color: isDarkMode ? '#60a5fa' : '#2563eb',
                weight: 5,
                opacity: 0.8
            }).addTo(map);
            
            map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] });

            // Update route info
            distanceVal.textContent = routeData.distanceKm.toFixed(1) + ' km';
            const hours = Math.floor(routeData.durationMin / 60);
            const mins = Math.round(routeData.durationMin % 60);
            timeVal.textContent = hours > 0 ? `${hours}h ${mins}m` : `${mins} min`;

            // Display turn-by-turn
            displayTurns(routeData.turns);

            // Get weather
            const weather = await getWeather(destCoords.lat, destCoords.lon, dateVal);
            
            weatherIcon.textContent = weather.icon;
            weatherCondition.textContent = weather.condition;
            tempVal.textContent = `${weather.maxTemp}° / ${weather.minTemp}°`;
            rainProb.textContent = weather.rainProb + '%';
            
            const dateObj = new Date(dateVal + 'T00:00:00');
            weatherDate.textContent = dateObj.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });

            console.log('Route and weather complete!');

        } catch (err) {
            console.error('Error:', err.message);
            showError(err.message || 'Something went wrong. Please try again.');
            resetResults();
            clearRouteAndMarkers();
        } finally {
            findBtn.textContent = '🚀 Find Route';
            findBtn.disabled = false;
        }
    }

    // ===== RESET =====
    function resetApp() {
        console.log('Reset clicked');
        hideError();
        clearRouteAndMarkers();
        resetResults();
        
        if (map && mapInitialized) {
            map.setView([12.8797, 121.7740], 6);
            setTimeout(function() {
                if (map) map.invalidateSize();
            }, 100);
        }

        originInput.value = 'Manila, Philippines';
        destInput.value = 'Baguio, Philippines';
        travelModeSelect.value = 'car';
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        dateInput.value = futureDate.toISOString().slice(0, 10);
        
        modeDisplay.textContent = '🚗 Driving';
        modeBadge.textContent = '🚗 Driving';
    }

    // ===== SET DEFAULT DATE =====
    function setDefaultDate() {
        if (!dateInput.value) {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            dateInput.value = d.toISOString().slice(0, 10);
        }
    }

    // ===== EVENT LISTENERS =====
    findBtn.addEventListener('click', handleFindRoute);
    resetBtn.addEventListener('click', resetApp);
    currentLocationBtn.addEventListener('click', getCurrentLocation);
    darkModeBtn.addEventListener('click', toggleDarkMode);
    travelModeSelect.addEventListener('change', function() {
        const mode = this.value;
        const modeInfo = modeMapping[mode] || modeMapping['car'];
        modeDisplay.textContent = modeInfo.icon + ' ' + modeInfo.label;
        modeBadge.textContent = modeInfo.icon + ' ' + modeInfo.label;
    });

    // ===== INITIALIZATION =====
    function initializeApp() {
        console.log('Initializing app...');
        setDefaultDate();
        
        // Check for saved dark mode
        if (localStorage.getItem('darkMode') === 'true') {
            toggleDarkMode();
        }
        
        if (!isLeafletLoaded()) {
            showError('Map library is loading... Please wait.');
            setTimeout(function() {
                if (isLeafletLoaded()) {
                    initMap();
                    handleFindRoute();
                } else {
                    showError('Map library failed to load. Please refresh.');
                }
            }, 2000);
            return;
        }

        setTimeout(function() {
            const mapSuccess = initMap();
            if (mapSuccess) {
                setTimeout(function() {
                    handleFindRoute();
                }, 400);
            } else {
                showError('Map failed to load. Please refresh the page.');
            }
        }, 300);
    }

    initializeApp();

    window.addEventListener('resize', function() {
        if (map && mapInitialized) {
            map.invalidateSize();
        }
    });

    console.log('Travel Route Planner loaded successfully!');
    console.log('Leaflet loaded:', isLeafletLoaded());
});
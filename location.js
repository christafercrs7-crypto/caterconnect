// Global variable to store current coordinates across files
let userCoordinates = null;
let debounceTimer = null;
let activeFetchController = null;

/**
 * Calculates distance in kilometers between two GPS coordinates using the Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lat1 === null || lon1 === undefined || lon1 === null || 
        lat2 === undefined || lat2 === null || lon2 === undefined || lon2 === null) {
        return null;
    }
    
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
}

/**
 * Fetches the user's current GPS position and performs reverse geocoding
 * Returns a Promise with the coordinates and formatted area name
 */
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error("Geolocation is not supported by your browser."));
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                userCoordinates = { lat, lon };

                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`
                    );

                    if (!response.ok) throw new Error("Network response was not ok");

                    const data = await response.json();
                    const address = data.address || {};

                    // Extract best available area name
                    const areaName = address.city || 
                                     address.town || 
                                     address.village || 
                                     address.suburb || 
                                     address.county || 
                                     address.state || 
                                     "Current Location";

                    resolve({ coordinates: userCoordinates, areaName });
                } catch (err) {
                    console.warn("Geocoding failed, falling back to raw coordinates:", err);
                    resolve({ 
                        coordinates: userCoordinates, 
                        areaName: `${lat.toFixed(4)}, ${lon.toFixed(4)}` 
                    });
                }
            },
            (error) => {
                let errMsg = "Unable to retrieve location.";
                if (error.code === error.PERMISSION_DENIED) {
                    errMsg = "Location permission was denied. Please allow location access in your browser settings.";
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    errMsg = "Location information is unavailable.";
                } else if (error.code === error.TIMEOUT) {
                    errMsg = "Location request timed out. Please try again.";
                }
                reject(new Error(errMsg));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

/**
 * Searches locations via Nominatim API and populates the dropdown list
 */
function setupLocationAutocomplete(inputElement, dropdownElement, onSelectCallback) {
    if (!inputElement || !dropdownElement) return;

    // Helper functions for dropdown state
    const hideDropdown = () => {
        dropdownElement.innerHTML = '';
        dropdownElement.classList.add('hide');
        dropdownElement.style.display = 'none';
    };

    const showDropdown = () => {
        dropdownElement.classList.remove('hide');
        dropdownElement.style.display = 'block';
    };

    // Listen for user typing in search bar
    inputElement.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        // Abort previous timer and fetch request
        clearTimeout(debounceTimer);
        if (activeFetchController) {
            activeFetchController.abort();
        }

        if (query.length < 3) {
            hideDropdown();
            return;
        }

        // Debounce requests by 350ms
        debounceTimer = setTimeout(async () => {
            activeFetchController = new AbortController();

            try {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`,
                    { signal: activeFetchController.signal }
                );

                if (!response.ok) throw new Error("Search API request failed");

                const data = await response.json();

                // Re-verify query length in case user backspaced while waiting
                if (inputElement.value.trim().length < 3) {
                    hideDropdown();
                    return;
                }

                dropdownElement.innerHTML = '';

                if (!data || data.length === 0) {
                    hideDropdown();
                    return;
                }

                data.forEach(item => {
                    const itemOption = document.createElement('div');
                    itemOption.className = 'location-dropdown-item';
                    
                    const displayName = item.display_name;
                    
                    itemOption.innerHTML = `
                        <i class="fa-solid fa-location-dot"></i>
                        <span class="truncate">${displayName}</span>
                    `;

                    itemOption.addEventListener('click', (event) => {
                        event.stopPropagation();

                        const selectedName = item.address?.city || 
                                             item.address?.town || 
                                             item.address?.village || 
                                             item.name || 
                                             displayName.split(',')[0];

                        inputElement.value = selectedName;
                        
                        // Update global user coordinates
                        userCoordinates = {
                            lat: parseFloat(item.lat),
                            lon: parseFloat(item.lon)
                        };

                        hideDropdown();

                        if (typeof onSelectCallback === 'function') {
                            onSelectCallback(userCoordinates, selectedName);
                        }
                    });

                    dropdownElement.appendChild(itemOption);
                });

                showDropdown();

            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Autocomplete fetch error:", error);
                    hideDropdown();
                }
            }
        }, 350);
    });

    // Close dropdown when clicking anywhere outside
    document.addEventListener('click', (event) => {
        if (!inputElement.contains(event.target) && !dropdownElement.contains(event.target)) {
            hideDropdown();
        }
    });

    // Close dropdown on Escape key
    inputElement.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            hideDropdown();
        }
    });
}
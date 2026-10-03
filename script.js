// Global Application State
let activeCategory = 'all';
let rawCaterersData = [];

// Initialize DOM Events
document.addEventListener('DOMContentLoaded', () => {
    initHomeGreeting();
    initApp();
});

function initHomeGreeting() {
    const greeting = document.getElementById('homeGreetingName');
    if (!greeting) return;

    const client = window.caterConnectSupabase;
    if (!client) {
        console.error('Home greeting initialization failed: Supabase client is unavailable.');
        return;
    }

    let updateSequence = 0;

    async function renderGreeting(session) {
        const sequence = ++updateSequence;
        const user = session?.user;

        if (!user) {
            greeting.textContent = 'Guest';
            setHomeAvatar(null);
            return;
        }

        const metadataName = user.user_metadata?.full_name?.trim();
        const fallbackName = metadataName || user.email?.split('@')[0] || 'User';
        greeting.textContent = `Welcome ${fallbackName}`;
        setHomeAvatar(user.user_metadata?.avatar_url);

        let { data: profile, error } = await client
            .from('users')
            .select('username, avatar_url')
            .eq('auth_id', user.id)
            .maybeSingle();

        if (sequence !== updateSequence) return;
        if (error?.code === '42703') {
            const fallbackResult = await client
                .from('users')
                .select('username')
                .eq('auth_id', user.id)
                .maybeSingle();
            profile = fallbackResult.data;
            error = fallbackResult.error;
        }

        if (sequence !== updateSequence) return;
        if (error) {
            console.warn('Unable to load the username for the home greeting:', error);
            return;
        }

        const username = profile?.username?.trim();
        greeting.textContent = `Welcome ${username || fallbackName}`;
        setHomeAvatar(profile?.avatar_url || user.user_metadata?.avatar_url);
    }

    function setHomeAvatar(avatarUrl) {
        const image = document.getElementById('homeUserAvatar');
        const fallback = document.getElementById('homeAvatarFallback');
        if (!image || !fallback) return;

        if (avatarUrl) {
            image.onerror = () => {
                image.classList.add('hidden');
                fallback.classList.remove('hidden');
            };
            image.src = avatarUrl;
            image.classList.remove('hidden');
            fallback.classList.add('hidden');
        } else {
            image.onerror = null;
            image.removeAttribute('src');
            image.classList.add('hidden');
            fallback.classList.remove('hidden');
        }
    }

    client.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
            console.error('Unable to load the home greeting session:', error);
            return;
        }
        void renderGreeting(session);
    }).catch((error) => {
        console.error('Unable to load the home greeting session:', error);
    });

    client.auth.onAuthStateChange((_event, session) => {
        window.setTimeout(() => {
            void renderGreeting(session);
        }, 0);
    });
}

function initApp() {
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchInput');
    const locationInput = document.getElementById('locationInput');
    const detectLocationBtn = document.getElementById('detectLocationBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const menuModal = document.getElementById('menuModal');

    if (searchBtn) searchBtn.addEventListener('click', filterCaterers);
    if (searchInput) searchInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') filterCaterers(); });
    if (locationInput) locationInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') filterCaterers(); });

    if (detectLocationBtn) {
        detectLocationBtn.addEventListener('click', detectUserLocation);
    }

    if (closeModalBtn && menuModal) {
        closeModalBtn.addEventListener('click', () => {
            menuModal.classList.add('hidden');
        });
        menuModal.addEventListener('click', (e) => {
            if (e.target === menuModal) menuModal.classList.add('hidden');
        });
    }

    fetchCateringServices();
}

// Fetch Caterers from Supabase or Fallback
async function fetchCateringServices() {
    const loading = document.getElementById('loading');
    const resultsContainer = document.getElementById('resultsContainer');

    if (loading) loading.classList.remove('hide');
    if (resultsContainer) resultsContainer.innerHTML = '';

    let loadError = null;
    try {
        const client = window.caterConnectSupabase;
        if (!client) throw new Error('Supabase client is unavailable.');

        const { data, error } = await client
            .from('caterers1')
            .select('*');

        if (error) throw error;
        rawCaterersData = data || [];
    } catch (err) {
        console.error('Unable to load catering services from the database:', err);
        loadError = err;
        rawCaterersData = [];
    } finally {
        if (loading) loading.classList.add('hide');
        if (loadError) {
            const resultCount = document.getElementById('resultCount');
            if (resultCount) resultCount.textContent = '';
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="col-span-full rounded-2xl border border-red-100 bg-red-50 p-5 text-center text-sm font-medium text-red-700" role="alert">
                        Unable to load caterers right now. Please try again later.
                    </div>
                `;
            }
        } else {
            renderCaterers(rawCaterersData);
        }
    }
}

// Render Caterers to Grid
function renderCaterers(dataList) {
    const resultsContainer = document.getElementById('resultsContainer');
    const resultCount = document.getElementById('resultCount');

    if (!resultsContainer) return;
    resultsContainer.innerHTML = '';

    if (resultCount) {
        resultCount.textContent = `${dataList.length} Caterer${dataList.length === 1 ? '' : 's'}`;
    }

    if (!dataList || dataList.length === 0) {
        resultsContainer.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fa-solid fa-utensils-slash text-4xl text-slate-300 mb-3"></i>
                <h3 class="text-base font-bold text-slate-700">No Caterers Found</h3>
                <p class="text-xs text-slate-400 mt-1">Try adjusting your search criteria or filters.</p>
            </div>
        `;
        return;
    }

    dataList.forEach(caterer => {
        const name = getCatererValue(caterer, 'name') || 'Unnamed Caterer';
        const location = getCatererValue(caterer, 'location') || 'Location N/A';
        const description = getCatererValue(caterer, 'description') || 'No description available.';
        const imageUrl = getCatererValue(caterer, 'image_url');
        const rating = getCatererValue(caterer, 'rating') || '4.8';
        const priceTier = getCatererValue(caterer, 'price_tier', 'prize_tier') || '$$';
        const specialty = getCatererValue(caterer, 'specialty', 'speciality', 'category') || 'General Events';
        const minGuests = getCatererValue(caterer, 'min_guests');
        const catererLat = getCatererValue(caterer, 'latitude');
        const catererLon = getCatererValue(caterer, 'longitude');

        let distanceBadgeHTML = '';
        if (userCoordinates && catererLat && catererLon) {
            const distanceKm = calculateDistance(userCoordinates.lat, userCoordinates.lon, catererLat, catererLon);
            if (distanceKm !== null) {
                distanceBadgeHTML = `
                    <span class="text-[11px] font-bold bg-orange-50 text-orange-600 px-2.5 py-0.5 rounded-full border border-orange-100 inline-flex items-center ml-2">
                        <i class="fa-solid fa-route mr-1"></i> ${distanceKm} km
                    </span>
                `;
            }
        }

        const card = document.createElement('div');
        card.className = 'db-card';

        const safeImageUrl = /^https?:\/\//i.test(imageUrl) ? imageUrl : '';
        const bgStyle = safeImageUrl
            ? `background-image: url('${escapeHtml(safeImageUrl)}');`
            : `background: linear-gradient(135deg, #f97316 0%, #ef4444 100%);`;

        const overlayClass = safeImageUrl ? 'db-card-overlay' : 'db-card-fallback-overlay';

        card.innerHTML = `
            <div class="db-card-header" style="${bgStyle}">
                <div class="${overlayClass}"></div>
                <div class="db-card-top-badges">
                    <span class="db-badge-rating">
                        <i class="fa-solid fa-star text-amber-400 mr-1.5"></i> ${escapeHtml(String(rating))}
                    </span>
                    <span class="db-badge-price">
                        ${escapeHtml(String(priceTier))}
                    </span>
                </div>
            </div>

            <div class="db-card-body">
                <div>
                    <h3 class="db-card-title">${escapeHtml(String(name))}</h3>
                    <p class="db-card-location flex items-center flex-wrap">
                        <span><i class="fa-solid fa-location-dot mr-1.5 text-slate-400"></i>${escapeHtml(String(location))}</span>
                        ${distanceBadgeHTML}
                    </p>
                    <p class="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-3">
                        ${escapeHtml(String(description))}
                    </p>
                </div>

                <div>
                    <div class="flex flex-wrap gap-2 my-2">
                        <span class="db-specialty-tag">${escapeHtml(String(specialty))}</span>
                        ${minGuests ? `<span class="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-semibold"><i class="fa-solid fa-users text-slate-400 mr-1"></i>Min ${escapeHtml(String(minGuests))} Pax</span>` : ''}
                    </div>
                    
                    <div class="db-card-footer">
                        <span class="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                            <i class="fa-solid fa-circle-check text-green-500"></i> Verified
                        </span>
                        <button class="view-menu-btn">
                            <span>View Menu</span>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const viewMenuBtn = card.querySelector('.view-menu-btn');
        if (viewMenuBtn) {
            viewMenuBtn.addEventListener('click', () => {
                openMenuModal(caterer);
            });
        }

        resultsContainer.appendChild(card);
    });
}

// Category Chip Selection
function selectCategory(buttonElement, categoryKey) {
    document.querySelectorAll('.category-chip').forEach(btn => btn.classList.remove('active'));
    if (buttonElement) buttonElement.classList.add('active');
    activeCategory = categoryKey;
    filterCaterers();
}

// Filtering Logic
function filterCaterers() {
    const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
    const locationVal = (document.getElementById('locationInput')?.value || '').toLowerCase().trim();

    const filtered = rawCaterersData.filter(caterer => {
        const name = (getCatererValue(caterer, 'name') || '').toLowerCase();
        const desc = (getCatererValue(caterer, 'description') || '').toLowerCase();
        const spec = (getCatererValue(caterer, 'specialty', 'category') || '').toLowerCase();
        const loc = (getCatererValue(caterer, 'location') || '').toLowerCase();

        const matchesSearch = !searchVal || name.includes(searchVal) || desc.includes(searchVal) || spec.includes(searchVal);
        const matchesLocation = !locationVal || loc.includes(locationVal);
        const matchesCategory = activeCategory === 'all' || spec.includes(activeCategory) || (caterer.category && caterer.category === activeCategory);

        return matchesSearch && matchesLocation && matchesCategory;
    });

    renderCaterers(filtered);
}

// Geolocation Detection
function detectUserLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    const detectBtn = document.getElementById('detectLocationBtn');
    if (detectBtn) detectBtn.classList.add('animate-spin');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            userCoordinates = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            if (detectBtn) detectBtn.classList.remove('animate-spin');
            filterCaterers();
        },
        () => {
            if (detectBtn) detectBtn.classList.remove('animate-spin');
            alert('Unable to retrieve location. Please type your city manually.');
        }
    );
}

// Modal Menu Details
function openMenuModal(caterer) {
    const modal = document.getElementById('menuModal');
    const modalContent = document.getElementById('modalContent');
    if (!modal || !modalContent) return;

    const name = getCatererValue(caterer, 'name') || 'Caterer Menu';
    const items = caterer.menu_items || ["Standard Buffet Menu", "Live Starters Counter", "Dessert Bar"];

    modalContent.innerHTML = `
        <h3 class="text-2xl font-black text-slate-800 mb-2">${escapeHtml(String(name))}</h3>
        <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Curated Offerings & Menu</p>
        
        <div class="space-y-2 mb-6">
            ${items.map(item => `
                <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm font-semibold text-slate-700">
                    <i class="fa-solid fa-utensils text-orange-500"></i>
                    <span>${escapeHtml(String(item))}</span>
                </div>
            `).join('')}
        </div>

        <div class="pt-4 border-t border-slate-100 flex justify-end">
            <button onclick="document.getElementById('menuModal').classList.add('hidden')" class="primary-action-btn px-6 py-2.5 text-sm">
                Request Booking Quote
            </button>
        </div>
    `;

    modal.classList.remove('hidden');
}

// Utility Helper Functions
function getCatererValue(obj, ...keys) {
    for (const key of keys) {
        if (obj && obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
    }
    return null;
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
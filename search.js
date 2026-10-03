document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchBarInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (!searchInput) return;

    // Trigger search input handler
    searchInput.addEventListener('input', () => {
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', searchInput.value.trim() === '');
        }
        handleSearchInput();
    });

    clearBtn?.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.classList.add('hidden');
        resetToInitialState();
    });

    // Close menu modal listeners
    document.getElementById('closeModalBtn')?.addEventListener('click', closeMenuModal);
    document.getElementById('menuModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'menuModal') closeMenuModal();
    });
});

let searchDebounceTimer = null;
let activeCategoryFilter = '';

function filterByCategory(buttonEl, category) {
    document.querySelectorAll('.category-chip').forEach(chip => chip.classList.remove('active'));
    buttonEl.classList.add('active');
    activeCategoryFilter = category;
    handleSearchInput();
}

function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        executeSearch();
    }, 300);
}

async function executeSearch() {
    const query = document.getElementById('searchBarInput')?.value.trim() || '';

    const initialState = document.getElementById('initialSearchState');
    const loadingState = document.getElementById('searchLoadingState');
    const invalidState = document.getElementById('invalidSearchState');
    const resultsGrid = document.getElementById('searchResultsGrid');
    const invalidMsg = document.getElementById('invalidMessageText');

    // State 1: If input query and category are empty -> Show Dimmed Logo & Quote
    if (!query && !activeCategoryFilter) {
        resetToInitialState();
        return;
    }

    // Toggle to Loading State
    initialState?.classList.add('hidden');
    invalidState?.classList.add('hidden');
    resultsGrid?.classList.add('hidden');
    loadingState?.classList.remove('hidden');

    try {
        const client = window.caterConnectSupabase;
        if (!client) throw new Error('Supabase client unavailable');

        const { data: caterers, error } = await client.from('caterers1').select('*');
        if (error) throw error;

        loadingState?.classList.add('hidden');

        // Filter caterers based on text query and category
        const matches = (caterers || []).filter(caterer => {
            const name = String(getCatererValue(caterer, 'name')).toLowerCase();
            const location = String(getCatererValue(caterer, 'location')).toLowerCase();
            const category = String(getCatererValue(caterer, 'category', 'specialty', 'description')).toLowerCase();
            const searchQuery = query.toLowerCase();

            const matchesText = !query || name.includes(searchQuery) || location.includes(searchQuery) || category.includes(searchQuery);
            const matchesCategory = !activeCategoryFilter || category.includes(activeCategoryFilter.toLowerCase());

            return matchesText && matchesCategory;
        });

        // State 3: Invalid / No Results
        if (matches.length === 0) {
            if (invalidMsg) {
                invalidMsg.textContent = query 
                    ? `No caterers found for "${query}".`
                    : 'No caterers match the selected category.';
            }
            invalidState?.classList.remove('hidden');
            return;
        }

        // State 2: Display Results
        renderSearchResults(matches);
        resultsGrid?.classList.remove('hidden');

    } catch (err) {
        console.error('Search failed:', err);
        loadingState?.classList.add('hidden');
        if (invalidMsg) {
            invalidMsg.textContent = 'Invalid search request. Please try again.';
        }
        invalidState?.classList.remove('hidden');
    }
}

function resetToInitialState() {
    document.getElementById('initialSearchState')?.classList.remove('hidden');
    document.getElementById('searchLoadingState')?.classList.add('hidden');
    document.getElementById('invalidSearchState')?.classList.add('hidden');
    const resultsGrid = document.getElementById('searchResultsGrid');
    if (resultsGrid) {
        resultsGrid.innerHTML = '';
        resultsGrid.classList.add('hidden');
    }
}

function renderSearchResults(caterers) {
    const resultsGrid = document.getElementById('searchResultsGrid');
    if (!resultsGrid) return;

    resultsGrid.innerHTML = caterers.map((caterer) => {
        const name = getCatererValue(caterer, 'name') || 'Unnamed Caterer';
        const location = getCatererValue(caterer, 'location') || 'Location N/A';
        const rating = getCatererValue(caterer, 'rating') || 'New';
        const rawImage = getCatererValue(caterer, 'image_url');
        const specialty = getCatererValue(caterer, 'specialty', 'category') || 'General Events';
        const pricePerPlate = getCatererValue(caterer, 'price_per_plate') || '15';

        const imageHtml = /^https?:\/\//i.test(rawImage)
            ? `<img src="${escapeHtml(rawImage)}" alt="${escapeHtml(name)}" class="w-28 h-28 object-cover rounded-2xl flex-shrink-0">`
            : `<div class="w-28 h-28 bg-gradient-to-tr from-orange-500 to-red-500 rounded-2xl flex items-center justify-center text-white flex-shrink-0"><i class="fa-solid fa-utensils text-2xl"></i></div>`;

        return `
        <div class="bg-white p-3.5 rounded-3xl border border-slate-100 shadow-sm flex gap-3.5 items-center">
            ${imageHtml}
            <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                    <div class="flex items-center justify-between gap-1">
                        <h3 class="font-bold text-slate-800 text-sm truncate">${escapeHtml(name)}</h3>
                        <span class="text-[11px] font-bold text-amber-500 flex items-center gap-0.5">
                            <i class="fa-solid fa-star text-[10px]"></i> ${escapeHtml(rating)}
                        </span>
                    </div>
                    <p class="text-xs text-slate-400 mt-0.5 flex items-center truncate">
                        <i class="fa-solid fa-location-dot text-orange-500 text-[10px] mr-1"></i> ${escapeHtml(location)}
                    </p>
                    <span class="inline-block mt-1.5 px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-md">
                        ${escapeHtml(specialty)}
                    </span>
                </div>
                <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-50">
                    <span class="text-xs font-bold text-slate-700">$${escapeHtml(pricePerPlate)}<span class="text-[10px] font-normal text-slate-400">/plate</span></span>
                    <button type="button" class="btn-view-menu text-xs font-bold text-orange-500 hover:text-orange-600 px-3 py-1 rounded-xl bg-orange-50">
                        View Menu
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');

    resultsGrid.querySelectorAll('.btn-view-menu').forEach((btn, idx) => {
        btn.addEventListener('click', () => openMenuModal(caterers[idx]));
    });
}

function getCatererValue(caterer, ...keys) {
    for (const key of keys) {
        const value = caterer?.[key] ?? caterer?.[key.toUpperCase()];
        if (value !== null && value !== undefined && value !== '') return value;
    }
    return '';
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[c]);
}

function openMenuModal(caterer) {
    const modal = document.getElementById('menuModal');
    if (!modal) return;

    document.getElementById('modalCatererName').textContent = getCatererValue(caterer, 'name') || 'Caterer';
    document.getElementById('modalCatererMeta').textContent = `${getCatererValue(caterer, 'location') || 'Location N/A'} • Rating: ${getCatererValue(caterer, 'rating') || 'New'}`;
    
    document.getElementById('modalMenuContent').innerHTML = `
        <div class="text-center py-6 text-slate-500">
            <i class="fa-solid fa-utensils text-2xl mb-2 text-slate-300 block"></i>
            <p class="text-xs font-medium">Standard custom menu available upon request.</p>
        </div>
    `;

    modal.classList.remove('hide');
    document.body.style.overflow = 'hidden';
}

function closeMenuModal() {
    const modal = document.getElementById('menuModal');
    if (modal) {
        modal.classList.add('hide');
        document.body.style.overflow = '';
    }
}
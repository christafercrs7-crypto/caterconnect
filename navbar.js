// Local database dictionary mapping tab keys to SVG shapes
const svgLibrary = {
    home: `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="currentColor"/></svg>`,
    search: `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="currentColor"/></svg>`,
    bookings: `<svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" fill="currentColor"/></svg>`,
    account: `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg>`
};

const fallbackNavbar = `
    <nav class="navbar" id="bottomNavbar">
        <div class="bead-tracker" id="beadTracker">
            <div class="cutout-left"></div>
            <div class="bead" id="beadContent">${svgLibrary.home}</div>
            <div class="cutout-right"></div>
        </div>
        <ul class="nav-list">
            <li class="nav-item active" onclick="moveBead(this, 'home', 'Home')">
                ${svgLibrary.home}<span class="label">Home</span>
            </li>
            <li class="nav-item" onclick="moveBead(this, 'search', 'Search')">
                ${svgLibrary.search}
            </li>
            <li class="nav-item" onclick="moveBead(this, 'bookings', 'Bookings')">
                ${svgLibrary.bookings}
            </li>
            <li class="nav-item" onclick="moveBead(this, 'account', 'Account')">
                ${svgLibrary.account}
            </li>
        </ul>
    </nav>`;

async function loadNavbar() {
    // Check for both possible mount IDs to ensure compatibility across all pages
    const mount = document.getElementById('nav-placeholder') || document.getElementById('navbarMount');

    if (!mount) return;

    try {
        const response = await fetch('navbar.html');

        if (!response.ok) throw new Error(`Unable to load navbar: ${response.status}`);

        mount.innerHTML = await response.text();
        setActivePageTab();
        alignBeadToActive();
        if (window.location.hash === '#bookings') {
            const bookingsItem = document.querySelector('.nav-item[onclick*="bookings"]');
            if (bookingsItem) moveBead(bookingsItem, 'bookings', 'Bookings');
        }
    } catch (error) {
        console.warn('navbar.html could not be loaded; using the local fallback.', error);
        mount.innerHTML = fallbackNavbar;
        setActivePageTab();
        alignBeadToActive();
        if (window.location.hash === '#bookings') {
            const bookingsItem = document.querySelector('.nav-item[onclick*="bookings"]');
            if (bookingsItem) moveBead(bookingsItem, 'bookings', 'Bookings');
        }
    }
}

function setActivePageTab() {
    const path = window.location.pathname;
    const targetKey = path.endsWith('profile.html')
        ? 'account'
        : path.endsWith('search.html')
            ? 'search'
            : 'home';
    const targetLabel = targetKey.charAt(0).toUpperCase() + targetKey.slice(1);
    const targetItem = document.querySelector(`.nav-item[onclick*="'${targetKey}'"]`);

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        item.querySelector('.label')?.remove();
    });

    if (targetItem) {
        targetItem.classList.add('active');
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = targetLabel;
        targetItem.appendChild(label);
    }

    const beadContent = document.getElementById('beadContent');
    if (beadContent && svgLibrary[targetKey]) {
        beadContent.innerHTML = svgLibrary[targetKey];
    }
}

/**
 * Moves glowing bead tracker over selected tab and switches page content view
 */
function moveBead(element, key, labelText) {
    if (key === 'account') {
        if (window.location.pathname.endsWith('profile.html')) return;
        window.location.href = 'profile.html';
        return;
    }

    if (key === 'search') {
        if (window.location.pathname.endsWith('search.html')) return;
        window.location.href = 'search.html';
        return;
    }

    if (key === 'home') {
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/' && !window.location.pathname.endsWith('/')) {
            window.location.href = 'index.html';
            return;
        }
    }

    if (!document.getElementById(`view-${key}`)) {
        return;
    }

    // 1. Remove active state & label from all items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const existingLabel = item.querySelector('.label');
        if (existingLabel) existingLabel.remove();
    });

    // 2. Set current target tab as active
    element.classList.add('active');

    // 3. Dynamically append text label underneath active tab
    const label = document.createElement('span');
    label.className = 'label';
    label.innerText = labelText;
    element.appendChild(label);

    // 4. Recalculate bead position relative to active element center
    const tracker = document.getElementById('beadTracker');
    if (tracker) {
        const targetX = element.offsetLeft + (element.offsetWidth / 2) - (tracker.offsetWidth / 2);
        tracker.style.transform = `translateX(${targetX}px)`;
    }

    // 5. Crossfade SVG icon inside floating bead
    const beadContent = document.getElementById('beadContent');
    if (beadContent) {
        const targetSvg = beadContent.querySelector('svg');
        if (targetSvg) targetSvg.style.opacity = '0';

        setTimeout(() => {
            if (svgLibrary[key]) {
                beadContent.innerHTML = svgLibrary[key];
            }
        }, 150);
    }

    // 6. Switch main application view
    switchAppView(key);
    if (key === 'bookings' && typeof loadMyBookings === 'function') {
        loadMyBookings();
    }
}

/**
 * Handles toggling between home content and blank views for other tabs
 */
function switchAppView(viewKey) {
    const views = document.querySelectorAll('.app-view');
    views.forEach(view => view.classList.remove('active-view'));

    const selectedView = document.getElementById(`view-${viewKey}`);
    if (selectedView) {
        selectedView.classList.add('active-view');
    }
}

// Automatically align bead tracker over default active tab on page load and window resize
function alignBeadToActive() {
    const defaultActive = document.querySelector('.nav-item.active');
    const tracker = document.getElementById('beadTracker');

    if (defaultActive && tracker) {
        const targetX = defaultActive.offsetLeft + (defaultActive.offsetWidth / 2) - (tracker.offsetWidth / 2);
        tracker.style.transform = `translateX(${targetX}px)`;
    }
}

window.addEventListener('DOMContentLoaded', loadNavbar);
window.addEventListener('resize', alignBeadToActive);
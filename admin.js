/**
 * admin.js
 * Supabase Integration, Real-Time Data Sync & Dynamic Admin Rendering
 */

function escapeAdminHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

async function enforceAdminGuard() {
    const client = window.caterConnectSupabase;
    const { data: { session }, error: authError } = await client.auth.getSession();
    if (authError) {
        console.error('Unable to verify the admin session:', authError);
        alert(`Unable to verify your session: ${authError.message}`);
        window.location.href = 'login.html';
        return false;
    }
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }

    const { data: profile, error: profileError } = await client
        .from('users')
        .select('role')
        .eq('auth_id', session.user.id)
        .maybeSingle();

    if (profileError) {
        console.error('Unable to verify admin role:', profileError);
        alert(`Unable to verify admin permissions: ${profileError.message}`);
        window.location.href = 'index.html';
        return false;
    }
    if (!profile || profile.role !== 'admin') {
        alert('Access Denied: You do not have permission to view the Admin Panel.');
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

/**
 * Real-time Supabase Data Sync
 * Subscribes to live database changes across users, caterers, and bookings.
 */
function setupRealtimeSubscriptions() {
    const client = window.caterConnectSupabase;

    client
        .channel('admin-realtime-changes')
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'bookings' },
            () => {
                console.log('Realtime change detected in bookings table');
                refreshActiveSection();
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'users' },
            () => {
                console.log('Realtime change detected in users table');
                refreshActiveSection();
            }
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'caterers1' },
            () => {
                console.log('Realtime change detected in caterers table');
                refreshActiveSection();
            }
        )
        .subscribe();
}

function refreshActiveSection() {
    const activeNav = document.querySelector('.nav-links li.active a');
    if (activeNav) {
        const targetId = activeNav.getAttribute('href').substring(1);
        loadSection(targetId);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    enforceAdminGuard().then(async authorized => {
        if (!authorized) return;

        const { data: { session } } = await window.caterConnectSupabase.auth.getSession();
        const { data: profile } = await window.caterConnectSupabase
            .from('users')
            .select('username')
            .eq('auth_id', session.user.id)
            .maybeSingle();
        const displayName = profile?.username || session.user.email || 'Admin';
        const profileName = document.querySelector('.admin-profile span');
        const welcome = document.querySelector('#template-dashboard .content-header p');
        if (profileName) profileName.textContent = displayName;
        if (welcome) welcome.textContent = `Welcome back, ${displayName}! Here’s what’s happening today.`;

        // Initialize default view
        loadSection('dashboard');

        // Enable real-time database listener
        setupRealtimeSubscriptions();

        const adminSearch = document.getElementById('adminSearchInput');
        adminSearch?.addEventListener('input', filterAdminRows);

        const sidebarLinks = document.querySelectorAll('.nav-links li a');
        const pageTitleElement = document.querySelector('.top-bar h1');
        const toggleSidebarBtn = document.querySelector('.toggle-sidebar');
        const sidebarElement = document.querySelector('.sidebar');

        // Navigation Click Handling
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href').substring(1);

                if (targetId === 'logout') {
                    if (confirm('Are you sure you want to logout?')) {
                        window.caterConnectSupabase.auth.signOut().then(({ error }) => {
                            if (error) {
                                console.error('Admin sign out failed:', error);
                                alert(`Sign out failed: ${error.message}`);
                                return;
                            }
                            window.location.href = 'login.html';
                        });
                    }
                    e.preventDefault();
                    return;
                }

                e.preventDefault();
                sidebarLinks.forEach(l => l.parentElement.classList.remove('active'));
                link.parentElement.classList.add('active');
                pageTitleElement.textContent = link.textContent.trim();
                
                loadSection(targetId);
            });
        });

        // Sidebar Toggle
        if (toggleSidebarBtn && sidebarElement) {
            toggleSidebarBtn.addEventListener('click', () => {
                sidebarElement.classList.toggle('hidden');
            });
        }
    }).catch(error => {
        console.error('Admin panel initialization failed:', error);
        alert(`Admin panel initialization failed: ${error.message}`);
    });
});

// SECTION LOADING & ASYNC DATA FETCHING
async function loadSection(sectionName) {
    const contentLoader = document.getElementById('content-loader');
    const templateId = `template-${sectionName}`;
    const templateContent = document.getElementById(templateId);

    if (templateContent) {
        contentLoader.innerHTML = '';
        
        // Clone the inner DocumentFragment from the template
        const clonedContent = templateContent.content.cloneNode(true);
        contentLoader.appendChild(clonedContent);
        
        const activeContainer = contentLoader.firstElementChild;

        // Show loading state in tables
        if (activeContainer) {
            const tableBodies = activeContainer.querySelectorAll('tbody');
            tableBodies.forEach(tbody => {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading database records...</td></tr>';
            });
        }

        // Fetch real data based on section
        switch (sectionName) {
            case 'dashboard':
                await fetchAndRenderDashboard(contentLoader);
                break;
            case 'users':
                await fetchAndRenderUsers(contentLoader);
                break;
            case 'caterers':
                await fetchAndRenderCaterers(contentLoader);
                break;
            case 'bookings':
                await fetchAndRenderBookings(contentLoader);
                break;
        }
        filterAdminRows();
    }
}

function filterAdminRows() {
    const query = document.getElementById('adminSearchInput')?.value.trim().toLowerCase() || '';
    document.querySelectorAll('#content-loader tbody tr').forEach(row => {
        row.classList.toggle('hidden', query !== '' && !row.textContent.toLowerCase().includes(query));
    });
}

// ==========================================
// DATABASE FETCH & RENDER FUNCTIONS
// ==========================================

/** USERS TABLE */
async function fetchAndRenderUsers(container) {
    const tableBody = container.querySelector('#users-table-body');
    if (!tableBody) return;

    const { data: users, error } = await window.caterConnectSupabase
        .from('users')
        .select('id, auth_id, username, email, join_date, role')
        .order('join_date', { ascending: false });

    if (error) {
        console.error('Error fetching users:', error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-red-500 py-4 text-center">Error loading users: ${escapeAdminHtml(error.message)}</td></tr>`;
        return;
    }

    if (!users || users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No users found in database.</td></tr>';
        return;
    }

    tableBody.innerHTML = users.map(user => `
        <tr>
            <td class="font-medium text-slate-800">${escapeAdminHtml(user.auth_id || user.id || 'N/A')}</td>
            <td class="font-medium text-slate-800">${escapeAdminHtml(user.username || 'No Name')}</td>
            <td>${escapeAdminHtml(user.email)}</td>
            <td>${escapeAdminHtml(user.join_date || 'Unknown')}</td>
            <td>0</td>
            <td><span class="status-pill status-active">Active</span></td>
            <td>
                <button class="action-btn text-red-500" onclick="alert('Feature coming soon!')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

/** DASHBOARD OVERVIEW */
async function fetchAndRenderDashboard(container) {
    const [usersResult, caterersResult, bookingsResult] = await Promise.all([
        window.caterConnectSupabase.from('users').select('id', { count: 'exact', head: true }),
        window.caterConnectSupabase.from('caterers1').select('*', { count: 'exact', head: true }),
        window.caterConnectSupabase.from('bookings').select('id', { count: 'exact', head: true })
    ]);
    const countError = usersResult.error || caterersResult.error || bookingsResult.error;
    if (countError) {
        console.error('Unable to load dashboard totals:', countError);
        container.querySelector('.metrics-grid')?.insertAdjacentHTML(
            'beforebegin',
            `<p class="text-red-600 mb-4" role="alert">Unable to load dashboard totals: ${escapeAdminHtml(countError.message)}</p>`
        );
    }

    const usersCountEl = container.querySelector('#dash-users-count');
    const caterersCountEl = container.querySelector('#dash-caterers-count');
    const bookingsCountEl = container.querySelector('#dash-bookings-count');
    const revenueCountEl = container.querySelector('#dash-revenue-count');

    if (usersCountEl) usersCountEl.textContent = usersResult.count || 0;
    if (caterersCountEl) caterersCountEl.textContent = caterersResult.count || 0;
    if (bookingsCountEl) bookingsCountEl.textContent = bookingsResult.count || 0;
    if (revenueCountEl) revenueCountEl.textContent = '0';

    const recentTable = container.querySelector('#dashboard-bookings-table');
    if (recentTable) {
        recentTable.innerHTML = '<table class="data-table"><tbody id="dash-bookings-table-body"><tr><td class="text-center py-4"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading recent bookings...</td></tr></tbody></table>';
        const tableBody = recentTable.querySelector('#dash-bookings-table-body');
        const { data: recentBookings, error } = await window.caterConnectSupabase
            .from('bookings')
            .select('id, created_at, user_id, caterer_name, total_price, status')
            .order('created_at', { ascending: false })
            .limit(3);
        
        if (error) {
            console.error('Unable to load recent bookings:', error);
            tableBody.innerHTML = `<tr><td class="text-red-500 py-4 text-center">Unable to load recent bookings: ${escapeAdminHtml(error.message)}</td></tr>`;
            return;
        }
        if (!recentBookings?.length) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">No recent bookings found.</td></tr>';
            return;
        }

        tableBody.innerHTML = recentBookings.map(b => `
            <tr>
                <td class="font-medium text-slate-800">${escapeAdminHtml(b.id)}</td>
                <td>${b.created_at ? b.created_at.split('T')[0] : 'N/A'}</td>
                <td>${escapeAdminHtml(b.user_id || 'Unknown')}</td>
                <td>${escapeAdminHtml(b.caterer_name || 'Unknown')}</td>
                <td>$${escapeAdminHtml(b.total_price || 0)}</td>
                <td><span class="status-pill status-pending">${escapeAdminHtml(b.status || 'Pending')}</span></td>
            </tr>
        `).join('');
    }
}

/** CATERERS TABLE */
async function fetchAndRenderCaterers(container) {
    const tableBody = container.querySelector('#caterers-table-body');
    if (!tableBody) return;

    const { data: caterers, error } = await window.caterConnectSupabase.from('caterers1').select('*');

    if (error) {
        console.error('Error fetching caterers:', error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-red-500 py-4 text-center">Error loading caterers: ${escapeAdminHtml(error.message)}</td></tr>`;
        return;
    }

    if (!caterers || caterers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-gray-500 py-4">No caterers found in database.</td></tr>';
        return;
    }

    tableBody.innerHTML = caterers.map(c => `
        <tr>
            <td class="font-medium text-slate-800">${escapeAdminHtml(c.ID || c.id || 'N/A')}</td>
            <td class="font-medium text-slate-800">${escapeAdminHtml(c.NAME || c.name || 'N/A')}</td>
            <td>${escapeAdminHtml(c.OWNER_NAME || c.owner_name || 'N/A')}</td>
            <td>${escapeAdminHtml(c.LOCATION || c.location || 'N/A')}</td>
            <td class="text-orange-600 font-semibold"><i class="fa-solid fa-star text-xs"></i> ${escapeAdminHtml(c.RATING || c.rating || 'New')}</td>
            <td><span class="status-pill status-active">Active</span></td>
            <td><button class="action-btn text-red-500"><i class="fa-solid fa-trash-can"></i></button></td>
        </tr>
    `).join('');
}

/** BOOKINGS TABLE */
async function fetchAndRenderBookings(container) {
    const tableBody = container.querySelector('#bookings-table-body');
    if (!tableBody) return;

    const { data: bookings, error } = await window.caterConnectSupabase
        .from('bookings')
        .select('id, user_id, caterer_name, event_date, guest_count, total_price, status')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching bookings:', error);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-red-500 py-4 text-center">Error loading bookings: ${escapeAdminHtml(error.message)}</td></tr>`;
        return;
    }

    if (!bookings || bookings.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-4">No bookings found in database.</td></tr>';
        return;
    }

    tableBody.innerHTML = bookings.map(b => `
        <tr>
            <td class="font-medium text-slate-800">${escapeAdminHtml(b.id)}</td>
            <td>${escapeAdminHtml(b.user_id || 'N/A')}</td>
            <td>${escapeAdminHtml(b.caterer_name || 'N/A')}</td>
            <td>${escapeAdminHtml(b.event_date || 'N/A')}</td>
            <td>${escapeAdminHtml(b.guest_count || 0)}</td>
            <td class="font-bold text-orange-600">$${escapeAdminHtml(b.total_price || 0)}</td>
            <td><span class="status-pill status-pending">${escapeAdminHtml(b.status || 'Pending')}</span></td>
            <td><button class="action-btn text-green-500" data-confirm-booking="${escapeAdminHtml(b.id)}" title="Confirm Booking" ${b.status === 'confirmed' ? 'disabled' : ''}><i class="fa-solid fa-check"></i></button></td>
        </tr>
    `).join('');

    tableBody.querySelectorAll('[data-confirm-booking]').forEach(button => {
        button.addEventListener('click', async () => {
            button.disabled = true;
            const { error: updateError } = await window.caterConnectSupabase
                .from('bookings')
                .update({ status: 'confirmed' })
                .eq('id', button.dataset.confirmBooking);
            if (updateError) {
                console.error('Unable to confirm booking:', updateError);
                alert(`Unable to confirm booking: ${updateError.message}`);
                button.disabled = false;
                return;
            }
            await loadSection('bookings');
        });
    });
}
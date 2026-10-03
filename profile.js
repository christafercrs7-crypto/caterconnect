document.addEventListener('DOMContentLoaded', async () => {
    const client = window.caterConnectSupabase;
    if (!client) {
        console.error('Profile page initialization failed: Supabase client is unavailable.');
        return;
    }

    // Main Layout Elements
    const guestContent = document.getElementById('guestContent');
    const profileContent = document.getElementById('profileContent');
    const userNameElement = document.getElementById('userName');
    const userSubtextElement = document.getElementById('userSubtext');
    const adminLink = document.getElementById('admin-panel-link');

    // Avatar DOM Elements
    const headerUserAvatar = document.getElementById('headerUserAvatar');
    const headerAvatarFallback = document.getElementById('headerAvatarFallback');
    const modalUserAvatar = document.getElementById('modalUserAvatar');
    const modalAvatarFallback = document.getElementById('modalAvatarFallback');
    const btnAvatarUpload = document.getElementById('btnAvatarUpload');
    const avatarFileInput = document.getElementById('avatarFileInput');

    // Personal Info Modal Elements
    const personalInfoModal = document.getElementById('personalInfoModal');
    const btnPersonalInfo = document.getElementById('btnPersonalInfo');
    const btnClosePersonalInfo = document.getElementById('btnClosePersonalInfo');
    const editUsernameInput = document.getElementById('editUsernameInput');
    const editPhoneInput = document.getElementById('editPhoneInput');
    const editEmailInput = document.getElementById('editEmailInput');
    const joinDateInput = document.getElementById('joinDateInput');
    
    const btnToggleEditUsername = document.getElementById('btnToggleEditUsername');
    const btnToggleEditPhone = document.getElementById('btnToggleEditPhone');
    const btnSaveProfile = document.getElementById('btnSaveProfile');
    const personalInfoForm = document.getElementById('personalInfoForm');
    const btnResetPassword = document.getElementById('btnResetPassword');

    let currentUserSession = null;
    let currentUserProfile = null;

    // Load User Data & Sync across UI Headers
    async function loadUserData() {
        try {
            const { data: { session }, error: sessionError } = await client.auth.getSession();
            if (sessionError) throw sessionError;

            if (!session) {
                guestContent?.classList.remove('hidden');
                profileContent?.classList.add('hidden');
                return;
            }

            currentUserSession = session;
            guestContent?.classList.add('hidden');
            profileContent?.classList.remove('hidden');

            // Defensive Query for users table
            let profile = null;
            let queryResult = await client
                .from('users')
                .select('username, email, role, avatar_url, phone, created_at')
                .eq('auth_id', session.user.id)
                .maybeSingle();

            if (queryResult.error && queryResult.error.code === '42703') {
                const fallbackResult = await client
                    .from('users')
                    .select('username, email, role, created_at')
                    .eq('auth_id', session.user.id)
                    .maybeSingle();
                if (fallbackResult.error) throw fallbackResult.error;
                profile = fallbackResult.data;
            } else if (queryResult.error) {
                throw queryResult.error;
            } else {
                profile = queryResult.data;
            }

            currentUserProfile = profile || {};

            const fullName = profile?.username || session.user.user_metadata?.full_name || 'User';
            const userEmail = profile?.email || session.user.email || '';
            const userPhone = profile?.phone || session.user.user_metadata?.phone || '';
            const avatarUrl = profile?.avatar_url || session.user.user_metadata?.avatar_url;

            // Update Profile Card UI
            if (userNameElement) userNameElement.textContent = fullName;
            if (userSubtextElement) userSubtextElement.textContent = userEmail;
            adminLink?.classList.toggle('hidden', profile?.role !== 'admin');

            // Render Profile & Top Navigation Header Avatars
            renderAvatar(avatarUrl, fullName);

            // Populate Modal Form Fields
            if (editUsernameInput) editUsernameInput.value = fullName;
            if (editEmailInput) editEmailInput.value = userEmail;
            if (editPhoneInput) editPhoneInput.value = userPhone;

            // Format Join Date
            const rawDate = profile?.created_at || session.user.created_at;
            if (joinDateInput && rawDate) {
                joinDateInput.value = new Date(rawDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

        } catch (error) {
            console.error('Unable to load profile data:', error);
            const message = document.getElementById('profileStatusMessage');
            if (message) {
                message.textContent = `Unable to load profile: ${error.message}`;
                message.classList.remove('hidden');
            }
        }
    }

    // Render Avatars in Profile and Top App Navbar Header
    function renderAvatar(url, name = 'User') {
        // 1. Profile Card Avatar
        if (url) {
            if (headerUserAvatar) {
                headerUserAvatar.src = url;
                headerUserAvatar.classList.remove('hidden');
            }
            if (headerAvatarFallback) headerAvatarFallback.classList.add('hidden');

            if (modalUserAvatar) {
                modalUserAvatar.src = url;
                modalUserAvatar.classList.remove('hidden');
            }
            if (modalAvatarFallback) modalAvatarFallback.classList.add('hidden');
        } else {
            if (headerUserAvatar) headerUserAvatar.classList.add('hidden');
            if (headerAvatarFallback) headerAvatarFallback.classList.remove('hidden');

            if (modalUserAvatar) modalUserAvatar.classList.add('hidden');
            if (modalAvatarFallback) modalAvatarFallback.classList.remove('hidden');
        }

        // 2. Top Home/Navbar Header Integration
        updateNavHeaderAvatar(url, name);
    }

    // Sync Top Header Bar (Navbar) Avatar Image and Welcome Text
    function updateNavHeaderAvatar(url, name) {
        const navProfileContainer = document.querySelector('.navbar-profile-slot') || document.querySelector('header .flex.items-center.gap-2') || document.body;
        
        // Target existing icon elements in header
        const navUserIcon = document.querySelector('header i.fa-circle-user, header i.fa-user, #navUserIcon');
        const navGreeting = document.querySelector('#navGreetingText, header span.font-semibold');

        if (navGreeting && name) {
            navGreeting.textContent = `Hello ${name}`;
        }

        if (navUserIcon && url) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = name;
            img.className = 'avatar-nav-img';
            navUserIcon.parentNode.replaceChild(img, navUserIcon);
        }
    }

    // Modal Events
    btnPersonalInfo?.addEventListener('click', () => {
        personalInfoModal?.classList.add('active');
    });

    btnClosePersonalInfo?.addEventListener('click', () => {
        personalInfoModal?.classList.remove('active');
        resetEditState();
    });

    personalInfoModal?.addEventListener('click', (e) => {
        if (e.target === personalInfoModal) {
            personalInfoModal.classList.remove('active');
            resetEditState();
        }
    });

    // Username Edit Toggle
    btnToggleEditUsername?.addEventListener('click', () => {
        const isDisabled = editUsernameInput.hasAttribute('disabled');
        if (isDisabled) {
            editUsernameInput.removeAttribute('disabled');
            editUsernameInput.focus();
            btnToggleEditUsername.textContent = 'Cancel';
            btnSaveProfile?.classList.remove('hidden');
        } else {
            editUsernameInput.setAttribute('disabled', 'true');
            editUsernameInput.value = currentUserProfile?.username || currentUserSession?.user?.user_metadata?.full_name || '';
            btnToggleEditUsername.textContent = 'Edit';
            checkShowSaveButton();
        }
    });

    // Mobile Number Edit Toggle
    btnToggleEditPhone?.addEventListener('click', () => {
        const isDisabled = editPhoneInput.hasAttribute('disabled');
        if (isDisabled) {
            editPhoneInput.removeAttribute('disabled');
            editPhoneInput.focus();
            btnToggleEditPhone.textContent = 'Cancel';
            btnSaveProfile?.classList.remove('hidden');
        } else {
            editPhoneInput.setAttribute('disabled', 'true');
            editPhoneInput.value = currentUserProfile?.phone || currentUserSession?.user?.user_metadata?.phone || '';
            btnToggleEditPhone.textContent = 'Edit';
            checkShowSaveButton();
        }
    });

    function checkShowSaveButton() {
        const usernameEditable = !editUsernameInput?.hasAttribute('disabled');
        const phoneEditable = !editPhoneInput?.hasAttribute('disabled');
        if (!usernameEditable && !phoneEditable) {
            btnSaveProfile?.classList.add('hidden');
        }
    }

    function resetEditState() {
        if (editUsernameInput) {
            editUsernameInput.setAttribute('disabled', 'true');
            editUsernameInput.value = currentUserProfile?.username || currentUserSession?.user?.user_metadata?.full_name || '';
        }
        if (editPhoneInput) {
            editPhoneInput.setAttribute('disabled', 'true');
            editPhoneInput.value = currentUserProfile?.phone || currentUserSession?.user?.user_metadata?.phone || '';
        }
        if (btnToggleEditUsername) btnToggleEditUsername.textContent = 'Edit';
        if (btnToggleEditPhone) btnToggleEditPhone.textContent = 'Edit';
        btnSaveProfile?.classList.add('hidden');
    }

    // Save Profile (Username & Phone)
    personalInfoForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUserSession) return;

        const updatedUsername = editUsernameInput.value.trim();
        const updatedPhone = editPhoneInput.value.trim();

        if (!updatedUsername) {
            alert('Username cannot be empty.');
            return;
        }

        try {
            btnSaveProfile.disabled = true;
            btnSaveProfile.textContent = 'Saving...';

            const { error: dbError } = await client
                .from('users')
                .update({ 
                    username: updatedUsername,
                    phone: updatedPhone
                })
                .eq('auth_id', currentUserSession.user.id);

            if (dbError && dbError.code !== '42703') throw dbError;

            // Sync with auth user metadata
            await client.auth.updateUser({
                data: { 
                    full_name: updatedUsername,
                    phone: updatedPhone 
                }
            });

            alert('Personal information saved successfully!');
            await loadUserData();
            resetEditState();
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert(`Failed to update profile: ${error.message}`);
        } finally {
            btnSaveProfile.disabled = false;
            btnSaveProfile.textContent = 'Save Changes';
        }
    });

    // Reset Password Request
    btnResetPassword?.addEventListener('click', async () => {
        const email = editEmailInput.value;
        if (!email) return;

        if (!confirm(`Send password reset link to ${email}?`)) return;

        try {
            const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/login.html`
            });
            if (error) throw error;
            alert('Password reset link sent to your email.');
        } catch (error) {
            console.error('Password reset failed:', error);
            alert(`Failed to send password reset email: ${error.message}`);
        }
    });

    // Avatar Upload Handler
    btnAvatarUpload?.addEventListener('click', () => {
        avatarFileInput?.click();
    });

    avatarFileInput?.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file || !currentUserSession) return;

        if (file.size > 2 * 1024 * 1024) {
            alert('Please select an image smaller than 2MB.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target.result;
            try {
                const { error: dbError } = await client
                    .from('users')
                    .update({ avatar_url: base64Data })
                    .eq('auth_id', currentUserSession.user.id);

                if (dbError && dbError.code !== '42703') throw dbError;

                await client.auth.updateUser({
                    data: { avatar_url: base64Data }
                });

                renderAvatar(base64Data, currentUserProfile?.username || 'User');
                alert('Profile photo updated successfully!');
            } catch (err) {
                console.error('Failed to save profile photo:', err);
                alert(`Failed to save photo: ${err.message}`);
            }
        };
        reader.readAsDataURL(file);
    });

    // Submenu Buttons
    document.getElementById('btnNotifications')?.addEventListener('click', () => {
        alert('Notifications\n\nYou currently have no unread notifications.');
    });

    document.getElementById('btnAddService')?.addEventListener('click', () => {
        alert('Add Your Service\n\nRegister your catering service to list your menu on CaterConnect.');
    });

    // Sign Out Handler
    document.getElementById('btnSignOut')?.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to sign out?')) return;
        const { error } = await client.auth.signOut();
        if (error) {
            console.error('Sign out failed:', error);
            alert(`Sign out failed: ${error.message}`);
            return;
        }
        window.location.href = 'login.html';
    });

    loadUserData();
});
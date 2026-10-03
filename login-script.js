document.addEventListener('DOMContentLoaded', () => {
    const client = window.caterConnectSupabase;
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('errorMessage');
    const submitButton = document.getElementById('submitBtn');
    const togglePasswordButton = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');

    if (!client || !loginForm || !emailInput || !passwordInput) {
        console.error('Login page initialization failed: required elements or Supabase client missing.');
        return;
    }

    togglePasswordButton?.addEventListener('click', () => {
        const showPassword = passwordInput.type === 'password';
        passwordInput.type = showPassword ? 'text' : 'password';
        eyeIcon?.classList.toggle('fa-eye', !showPassword);
        eyeIcon?.classList.toggle('fa-eye-slash', showPassword);
    });

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorMessage?.classList.add('hidden');

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        if (!email || !password) {
            showError('Please fill in both email and password.');
            return;
        }

        const originalButtonText = submitButton?.textContent || 'Sign In';
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Signing in...';
        }

        try {
            // 1. Authenticate with Supabase Auth
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (!data.user) throw new Error('Sign in succeeded but no authenticated user was returned.');

            // 2. Fetch role from public.users table
            let { data: profile, error: profileError } = await client
                .from('users')
                .select('role')
                .eq('auth_id', data.user.id)
                .maybeSingle();

            if (profileError) {
                throw new Error(`Unable to load account role: ${profileError.message}`);
            }

            // 3. Self-healing fallback: Create profile row if table was previously empty
            if (!profile) {
                const fallbackName = data.user.user_metadata?.full_name || email.split('@')[0];
                const { data: newProfile, error: createError } = await client
                    .from('users')
                    .insert({
                        auth_id: data.user.id,
                        email: data.user.email,
                        username: fallbackName,
                        role: 'user',
                        join_date: new Date().toISOString().split('T')[0]
                    })
                    .select('role')
                    .single();

                if (createError) {
                    throw new Error(`Failed to initialize account profile: ${createError.message}`);
                }
                profile = newProfile;
            }

            // 4. Integrated Redirection based on role
            if (profile.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error('Login failed:', error);
            showError(error.message || 'An unexpected error occurred during sign in.');
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            }
        }
    });

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
        } else {
            alert(message);
        }
    }
});
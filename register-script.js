document.addEventListener('DOMContentLoaded', () => {
    const client = window.caterConnectSupabase;
    const registerForm = document.getElementById('registerForm');
    const submitButton = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const passwordInput = document.getElementById('password');
    const togglePasswordButton = document.getElementById('togglePassword');
    const eyeIcon = document.getElementById('eyeIcon');

    if (!client || !registerForm || !submitButton || !messageBox) {
        console.error('Registration page initialization failed: required elements or Supabase client are missing.');
        return;
    }

    togglePasswordButton?.addEventListener('click', () => {
        const showPassword = passwordInput.type === 'password';
        passwordInput.type = showPassword ? 'text' : 'password';
        eyeIcon?.classList.toggle('fa-eye', !showPassword);
        eyeIcon?.classList.toggle('fa-eye-slash', showPassword);
    });

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        messageBox.className = 'text-sm font-medium hidden text-center';

        const fullName = document.getElementById('fullName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = passwordInput.value;
        const originalButtonText = submitButton.textContent;

        submitButton.disabled = true;
        submitButton.textContent = 'Creating Account...';

        try {
            const { error } = await client.auth.signUp({
                email,
                password,
                options: { data: { full_name: fullName } }
            });
            if (error) throw error;

            messageBox.textContent = 'Account created successfully. Check your email if verification is required, then sign in.';
            messageBox.classList.add('text-green-600');
            messageBox.classList.remove('hidden');
            window.setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } catch (error) {
            console.error('Registration failed:', error);
            messageBox.textContent = error.message || 'Unable to create your account.';
            messageBox.classList.add('text-red-500');
            messageBox.classList.remove('hidden');
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
});

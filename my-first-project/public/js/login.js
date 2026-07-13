document.addEventListener('DOMContentLoaded', () => {
    setupPasswordToggle();
    setupLoginForm();
    setupRememberMe();
});

function setupPasswordToggle() {
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');

    if (!togglePassword || !passwordInput) return;

    togglePassword.addEventListener('click', () => {
        const nextType = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = nextType;
        togglePassword.textContent = nextType === 'password' ? 'Show' : 'Hide';
    });
}

function setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showNotification('Please fill in username/email and password.', 'error');
            return;
        }

        await loginRequest(email, password);
    });

    document.querySelectorAll('.demo-login-btn').forEach((button) => {
        button.addEventListener('click', async () => {
            const demoEmail = button.dataset.email;
            const demoPassword = button.dataset.password || 'demo123';

            document.getElementById('email').value = demoEmail;
            document.getElementById('password').value = demoPassword;

            await loginRequest(demoEmail, demoPassword);
        });
    });
}

async function loginRequest(email, password) {
    const submitBtn = document.querySelector('#loginForm button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
    }

    try {
        const response = await fetch('/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showNotification(data.message || 'Login failed.', 'error');
            resetSubmitButton(submitBtn, originalText);
            return;
        }

        const user = data.user || {};
        localStorage.setItem('userEmail', user.email || email);
        localStorage.setItem('userName', user.name || email);
        localStorage.setItem('userRole', user.role || 'user');
        localStorage.setItem('username', user.username || email);
        localStorage.setItem('userDepartment', user.department || 'Operations');
        localStorage.setItem('userPhone', user.phone || '');
        localStorage.setItem('isLoggedIn', 'true');

        const rememberMe = document.getElementById('rememberMe');
        if (rememberMe && rememberMe.checked) {
            localStorage.setItem('savedEmail', email);
        } else {
            localStorage.removeItem('savedEmail');
        }

        showNotification('Login successful.', 'success');

        setTimeout(() => {
            window.location.href = user.dashboard || '/pages/operations.html';
        }, 350);
    } catch (error) {
        console.error('Login request failed:', error);
        showNotification('Login server is not responding. Please make sure the server is running.', 'error');
        resetSubmitButton(submitBtn, originalText);
    }
}

function resetSubmitButton(submitBtn, originalText) {
    if (!submitBtn) return;
    submitBtn.disabled = false;
    submitBtn.textContent = originalText || 'Sign in';
}

function setupRememberMe() {
    const rememberMe = document.getElementById('rememberMe');
    const emailInput = document.getElementById('email');
    if (!rememberMe || !emailInput) return;

    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberMe.checked = true;
    }
}

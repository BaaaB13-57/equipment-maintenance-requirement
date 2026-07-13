// ========================================
// Common JavaScript Utilities
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeCommonFeatures();
});

function initializeCommonFeatures() {
    checkPageAuthentication();
    displayStoredUserName();
    setupSidebarToggle();
    setupLogout();
    setupUserMenu();
}

function checkPageAuthentication() {
    const isLoginPage = window.location.pathname.endsWith('/login.html');
    if (!isLoginPage && !localStorage.getItem('isLoggedIn')) {
        window.location.href = 'login.html';
    }
}

function displayStoredUserName() {
    const nameEl = document.getElementById('userDisplayName');
    if (!nameEl) return;

    const savedName = localStorage.getItem('userName');
    const email = localStorage.getItem('userEmail');

    if (savedName) {
        nameEl.textContent = savedName;
    } else if (email) {
        const name = email.split('@')[0].replace(/[._]/g, ' ');
        nameEl.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    }
}

// ========================================
// Sidebar Toggle
// ========================================

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('toggleBtn');
    const sidebar = document.querySelector('.sidebar');

    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });

        // Close sidebar when nav item is clicked
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                }
            });
        });
    }
}

// ========================================
// Logout Functionality
// ========================================

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutItem = document.querySelector('.logout-item');

    [logoutBtn, logoutItem].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                localStorage.removeItem('isLoggedIn');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userName');
                localStorage.removeItem('userRole');
                window.location.href = 'login.html';
            });
        }
    });
}

// ========================================
// User Menu
// ========================================

function setupUserMenu() {
    const userBtn = document.querySelector('.user-btn');
    const userDropdown = document.querySelector('.user-dropdown');

    if (userBtn && userDropdown) {
        userBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-menu')) {
                userDropdown.classList.remove('active');
            }
        });
    }
}

// ========================================
// Notification Handler
// ========================================

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// Helper Functions
// ========================================

function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

console.log('Common utilities loaded');

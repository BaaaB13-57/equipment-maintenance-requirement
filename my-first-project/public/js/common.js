// ========================================
// Common JavaScript Utilities
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    initializeCommonFeatures();
});

function initializeCommonFeatures() {
    checkPageAuthentication();
    setupDashboardHeader();
    setupSidebarProfile();
    setupSidebarToggle();
    setupLogout();
    setupUserMenu();
    showDashboardAuthorizationNotice();
}

function showDashboardAuthorizationNotice() {
    const reason = new URLSearchParams(window.location.search).get('reason');
    if (reason === 'forbidden') {
        showNotification('Not authorized for that dashboard. You were returned to your authorized dashboard.', 'error');
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    }
}

let currentUserPromise;
function getCurrentUser() {
    if (!currentUserPromise) {
        currentUserPromise = fetch('/users/session')
            .then(response => response.ok ? response.json() : Promise.reject(new Error('Session unavailable')))
            .then(data => data.user)
            .catch(error => {
                console.error('Could not load the current user:', error);
                return {
                    name: localStorage.getItem('userName') || 'User',
                    email: localStorage.getItem('userEmail') || '',
                    role: localStorage.getItem('userRole') || 'user'
                };
            });
    }
    return currentUserPromise;
}

function dashboardRoleFromPage() {
    if (location.pathname.includes('admin')) return 'admin';
    if (location.pathname.includes('technicians')) return 'technician';
    return 'user';
}

function setupDashboardHeader() {
    const header = document.querySelector('.dashboard-header');
    const toggle = document.querySelector('.sidebar-toggle');
    if (!header) return;

    header.classList.add('shared-dashboard-header');
    const headingGroup = header.firstElementChild;
    const title = headingGroup?.querySelector('h1');
    const subtitle = headingGroup?.querySelector('.dashboard-subtitle');
    if (headingGroup) headingGroup.classList.add('dashboard-heading-group');
    if (title) title.id = 'dynamicDashboardTitle';

    const utilities = document.createElement('div');
    utilities.className = 'dashboard-header-utilities';
    utilities.innerHTML = `
        <button type="button" class="dashboard-notification-button" aria-label="View notifications" aria-haspopup="true" aria-expanded="false">
            <svg class="dashboard-notification-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
            </svg><span class="dashboard-notification-badge">0</span>
        </button>`;
    header.appendChild(utilities);
    if (toggle) {
        const sidebar = document.querySelector('.dashboard-sidebar');
        const placeSidebarToggle = () => {
            if (window.matchMedia('(min-width: 1201px)').matches && sidebar) sidebar.prepend(toggle);
            else header.prepend(toggle);
        };
        placeSidebarToggle();
        window.addEventListener('resize', placeSidebarToggle);
    }

    const roleConfig = {
        user: { title: 'User Dashboard', section: 'notifications', selector: '[data-user-section-link="notifications"]' },
        admin: { title: 'Admin Dashboard', section: 'adminReview', selector: '[data-admin-section-link="adminReview"]' },
        technician: { title: 'Technician Dashboard', section: 'assignedRequests', selector: '[data-technician-section-link="assignedRequests"]' }
    };

    getCurrentUser().then(user => {
        // The dashboard page is already protected by the server. Use the page
        // role here so a stale role in local storage cannot disable its bell.
        const role = dashboardRoleFromPage();
        const config = roleConfig[role] || roleConfig.user;
        if (title) title.textContent = config.title;
        if (subtitle) subtitle.textContent = `Welcome back, ${user.name || 'User'}`;
        const notificationButton = utilities.querySelector('.dashboard-notification-button');
        if (notificationButton && role !== 'user') {
            setupAdminHeaderNotifications(notificationButton, role);
        }
        updateHeaderNotificationCount(role);
        new MutationObserver(mutations => {
            if (mutations.some(mutation => !mutation.target.closest?.('.shared-dashboard-header'))) {
                updateHeaderNotificationCount(role);
            }
        }).observe(document.querySelector('.dashboard-main'), {
            subtree: true,
            childList: true
        });
    });

    const sectionTitles = {
        dashboard: { user: 'User Dashboard', admin: 'Admin Dashboard', technician: 'Technician Dashboard' },
        sendRequest: 'Send Request', myRequests: 'My Requests', requestStatus: 'Request Status', notifications: 'Notifications', profile: 'Profile',
        allRequests: 'All Requests', adminReview: 'Assign Technician', assignTechnicians: 'Open Jobs', manageEquipment: 'Equipment', manageUsers: 'Users', reports: 'Reports',
        assignedRequests: 'Assigned Tasks', problemDetails: 'Problem Details', repairWork: 'Repair Work', repairNotes: 'Technician Message', completedWork: 'Completed Tasks'
    };
    const updateTitle = () => {
        const active = document.querySelector('.user-dashboard-section.active, .admin-dashboard-section.active, .technician-dashboard-section.active');
        if (!active || !title) return;
        const mapped = sectionTitles[active.id];
        title.textContent = typeof mapped === 'object' ? mapped[dashboardRoleFromPage()] : (mapped || 'Dashboard');
    };
    new MutationObserver(updateTitle).observe(document.querySelector('.dashboard-main'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    updateTitle();

}

async function setupAdminHeaderNotifications(bell, role = 'admin') {
    const notificationBadge = bell.querySelector('.dashboard-notification-badge');
    notificationBadge.dataset.notificationManaged = 'true';
    notificationBadge.hidden = true;
    const menu = document.createElement('div');
    menu.className = 'dashboard-notification-menu';
    const dropdown = document.createElement('div');
    dropdown.className = 'header-notification-dropdown';
    dropdown.setAttribute('role', 'dialog');
    dropdown.setAttribute('aria-label', `${role === 'technician' ? 'Technician' : 'Admin'} notifications`);
    dropdown.innerHTML = `
        <div class="header-notification-dropdown-head">
            <div class="notification-dropdown-title"><strong>${role === 'technician' ? 'Technician Notifications' : 'Admin Notifications'}</strong><span>${role === 'technician' ? 'New maintenance assignments from Admin' : 'New requests and technician repair activity'}</span></div>
            <button type="button" class="notification-action" data-admin-read-all>Mark all read</button>
            ${role === 'admin' ? `<div class="admin-notification-legend" aria-label="Notification color categories">
                <button type="button" class="admin-notification-key maintenance" data-admin-notification-filter="maintenance" aria-pressed="false">Required Maintenance</button>
                <button type="button" class="admin-notification-key repair" data-admin-notification-filter="repair" aria-pressed="false">Technician Repair</button>
            </div>` : `<div class="technician-notification-legend">
                <button type="button" class="technician-notification-key" data-admin-notification-filter="assignment" aria-pressed="false"><strong>Purple</strong> — New maintenance assignments from Admin</button>
            </div>`}
        </div>
        <div class="notification-items" data-admin-notification-list></div>`;
    bell.parentNode.insertBefore(menu, bell);
    menu.append(bell, dropdown);
    const list = dropdown.querySelector('[data-admin-notification-list]');
    let activeFilter = '';

    const applyFilter = () => {
        let visibleCount = 0;
        list.querySelectorAll('[data-admin-notification-id]').forEach(item => {
            const isMaintenance = item.classList.contains('notification-new_request');
            const isAssignment = item.classList.contains('notification-work_assigned');
            const visible = !activeFilter
                || (activeFilter === 'maintenance' && isMaintenance)
                || (activeFilter === 'repair' && !isMaintenance && !isAssignment)
                || (activeFilter === 'assignment' && isAssignment);
            item.hidden = !visible;
            if (visible) visibleCount += 1;
        });
        let empty = list.querySelector('[data-admin-filter-empty]');
        if (activeFilter && visibleCount === 0) {
            if (!empty) {
                empty = document.createElement('article');
                empty.className = 'notification-item';
                empty.dataset.adminFilterEmpty = 'true';
                list.appendChild(empty);
            }
            const category = activeFilter === 'maintenance' ? 'required maintenance' : activeFilter === 'assignment' ? 'maintenance assignment' : 'technician repair';
            empty.innerHTML = `<div><h3>No ${category} notifications</h3><p>New notifications in this category will appear here.</p></div>`;
        } else empty?.remove();
    };

    const request = async (url, method = 'GET') => {
        const response = await fetch(url, { method, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Notification request failed');
        return result;
    };
    const load = async () => {
        try {
            const result = await request('/notifications');
            const notifications = result.notifications || [];
            const unreadCount = result.unreadCount || 0;
            notificationBadge.textContent = String(unreadCount);
            notificationBadge.hidden = unreadCount === 0;
            list.innerHTML = notifications.length ? notifications.map(notification => `
                <article class="notification-item stored-notification admin-notification notification-${notification.type} ${notification.readAt ? '' : 'unread'}" tabindex="0" data-admin-notification-id="${notification._id}" data-request-id="${notification.requestId}">
                    <div class="stored-notification-content">
                        <h3>${escapeHtml(notification.title)}</h3>
                        <p>${escapeHtml(notification.message)}</p>
                        <span>${escapeHtml(notification.requestId)} · ${formatDashboardNotificationTime(notification.createdAt)} · ${notification.readAt ? 'Read' : 'Unread'}</span>
                    </div>
                    <div class="stored-notification-actions">
                        ${notification.readAt ? '' : `<button type="button" class="notification-action" data-admin-read="${notification._id}">Mark read</button>`}
                        <button type="button" class="notification-action danger" data-admin-delete="${notification._id}">Delete</button>
                    </div>
                </article>`).join('') : `<article class="notification-item"><div><h3>No notifications yet</h3><p>${role === 'technician' ? 'New maintenance assignments will appear here.' : 'New requests and technician repair updates will appear here.'}</p></div></article>`;
            applyFilter();
        } catch (error) {
            console.error('Failed to load admin notifications:', error);
            notificationBadge.hidden = true;
            list.innerHTML = '<article class="notification-item"><div><h3>Notifications unavailable</h3><p>Please try again shortly.</p></div></article>';
        }
    };
    const setOpen = open => {
        menu.classList.toggle('open', open);
        bell.setAttribute('aria-expanded', String(open));
        if (open) load();
    };
    bell.addEventListener('click', event => {
        event.stopPropagation();
        setOpen(!menu.classList.contains('open'));
    });
    dropdown.addEventListener('click', async event => {
        event.stopPropagation();
        const filterButton = event.target.closest('[data-admin-notification-filter]');
        if (filterButton) {
            const selected = filterButton.dataset.adminNotificationFilter;
            activeFilter = activeFilter === selected ? '' : selected;
            dropdown.querySelectorAll('[data-admin-notification-filter]').forEach(button => {
                const active = button.dataset.adminNotificationFilter === activeFilter;
                button.classList.toggle('active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            applyFilter();
            return;
        }
        const read = event.target.closest('[data-admin-read]');
        const remove = event.target.closest('[data-admin-delete]');
        const item = event.target.closest('[data-admin-notification-id]');
        try {
            if (read) await request(`/notifications/${encodeURIComponent(read.dataset.adminRead)}/read`, 'PATCH');
            else if (remove) await request(`/notifications/${encodeURIComponent(remove.dataset.adminDelete)}`, 'DELETE');
            else if (event.target.closest('[data-admin-read-all]')) await request('/notifications/read-all', 'PATCH');
            else if (item) {
                await request(`/notifications/${encodeURIComponent(item.dataset.adminNotificationId)}/read`, 'PATCH');
                if (role === 'technician' && typeof window.openTechnicianAssignmentFromNotification === 'function') {
                    window.openTechnicianAssignmentFromNotification(item.dataset.requestId);
                } else {
                    document.querySelector('[data-admin-section-link="allRequests"]')?.click();
                }
                setOpen(false);
            } else return;
            await load();
        } catch (error) {
            showNotification('Could not update the notification', 'error');
        }
    });
    document.addEventListener('click', () => setOpen(false));
    await load();
}

function formatDashboardNotificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function updateHeaderNotificationCount(role) {
    const badge = document.querySelector('.dashboard-notification-badge');
    if (!badge) return;
    if (badge.dataset.notificationManaged === 'true') return;
    const selectors = {
        user: '#userNotificationList .notification-item',
        admin: '#adminRequestsBody tr, #assignmentList > *',
        technician: '#technicianRequestList > *'
    };
    const count = document.querySelectorAll(selectors[role] || selectors.user).length;
    badge.textContent = String(count);
    badge.hidden = count === 0;
}

function getInitials(name) {
    return String(name || 'User')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part.charAt(0).toUpperCase())
        .join('') || 'US';
}

async function setupSidebarProfile() {
    const sidebar = document.querySelector('.dashboard-sidebar');
    const header = document.querySelector('.dashboard-header');
    const logoutBtn = document.getElementById('logoutBtn');
    if (!sidebar || !header || !logoutBtn) return;

    const profileUrl = document.getElementById('profile') ? '#profile' : '/pages/profile.html';
    const profile = document.createElement('div');
    profile.className = 'sidebar-profile header-profile';
    profile.innerHTML = `
        <button type="button" class="sidebar-profile-trigger" aria-haspopup="menu" aria-expanded="false">
            <span class="sidebar-avatar" aria-hidden="true">US</span>
            <span class="sidebar-profile-copy">
                <strong class="sidebar-profile-name">Loading...</strong>
                <small>View account</small>
            </span>
            <span class="sidebar-profile-chevron" aria-hidden="true">⌃</span>
        </button>
        <div class="sidebar-profile-menu" role="menu">
            <div class="sidebar-role-actions"></div>
            <a href="${profileUrl}" class="sidebar-profile-action" role="menuitem"><span aria-hidden="true">PR</span> Profile</a>
        </div>`;

    const menu = profile.querySelector('.sidebar-profile-menu');
    const profileAction = menu.querySelector('a[href="#profile"]');
    profileAction?.addEventListener('click', event => {
        const existingProfileControl = document.querySelector('[data-user-section="profile"], [data-user-section-link="profile"]');
        if (existingProfileControl) {
            event.preventDefault();
            existingProfileControl.click();
            setOpen(false);
        }
    });
    header.appendChild(profile);

    const trigger = profile.querySelector('.sidebar-profile-trigger');
    const setOpen = open => {
        profile.classList.toggle('open', open);
        trigger.setAttribute('aria-expanded', String(open));
    };
    trigger.addEventListener('click', event => {
        event.stopPropagation();
        setOpen(!profile.classList.contains('open'));
    });
    document.addEventListener('click', event => {
        if (!profile.contains(event.target)) setOpen(false);
    });
    profile.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            setOpen(false);
            trigger.focus();
        }
    });

    const user = await getCurrentUser();

    const name = user?.name || localStorage.getItem('userName') || localStorage.getItem('userEmail')?.split('@')[0] || 'User';
    profile.querySelector('.sidebar-profile-name').textContent = name;
    profile.querySelector('.sidebar-avatar').textContent = getInitials(name);
    const role = user?.role || localStorage.getItem('userRole') || 'user';
    const roleMenus = {};
    const roleMenu = roleMenus[role];
    if (roleMenu) {
        const action = document.createElement('a');
        action.href = location.pathname.endsWith(roleMenu.page)
            ? `#${roleMenu.section}`
            : `/pages/${roleMenu.page}#${roleMenu.section}`;
        action.className = 'sidebar-profile-action';
        action.setAttribute('role', 'menuitem');
        action.innerHTML = `<span aria-hidden="true">${roleMenu.icon}</span> ${roleMenu.label}`;
        action.addEventListener('click', event => {
            if (location.pathname.endsWith(roleMenu.page)) {
                event.preventDefault();
                const sectionLink = sidebar.querySelector(
                    `[data-user-section-link="${roleMenu.section}"], ` +
                    `[data-admin-section-link="${roleMenu.section}"], ` +
                    `[data-technician-section-link="${roleMenu.section}"]`
                );
                sectionLink?.click();
            }
            sidebar.classList.remove('open');
            document.querySelector('.sidebar-backdrop')?.classList.remove('open');
            document.body.classList.remove('sidebar-open');
            document.querySelector('.sidebar-toggle')?.setAttribute('aria-expanded', 'false');
        });
        profile.querySelector('.sidebar-role-actions').appendChild(action);
    }
    if (user?.name) {
        localStorage.setItem('userName', user.name);
        localStorage.setItem('userEmail', user.email || '');
        localStorage.setItem('userRole', user.role || 'user');
    }
}

function checkPageAuthentication() {
    // Dashboard access is enforced by the server using an HttpOnly session cookie.
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
    const toggleBtn = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.dashboard-sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');
    if (!toggleBtn || !sidebar || !backdrop) return;

    const isDesktop = () => window.matchMedia('(min-width: 1201px)').matches;

    const closeSidebar = () => {
        sidebar.classList.remove('open');
        sidebar.classList.remove('expanded');
        backdrop.classList.remove('open');
        sidebar.setAttribute('aria-hidden', String(!isDesktop()));
        backdrop.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('sidebar-open');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-label', 'Open navigation menu');
    };

    const openSidebar = () => {
        sidebar.classList.add(isDesktop() ? 'expanded' : 'open');
        backdrop.classList.add('open');
        sidebar.setAttribute('aria-hidden', 'false');
        backdrop.setAttribute('aria-hidden', 'false');
        document.body.classList.add('sidebar-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
        toggleBtn.setAttribute('aria-label', 'Close navigation menu');
        if (!isDesktop()) sidebar.querySelector('.sidebar-link')?.focus();
    };

    toggleBtn.addEventListener('click', () => {
        if (isDesktop()) {
            const expanded = sidebar.classList.toggle('expanded');
            toggleBtn.setAttribute('aria-expanded', String(expanded));
            toggleBtn.setAttribute('aria-label', expanded ? 'Collapse navigation menu' : 'Expand navigation menu');
            return;
        }
        if (sidebar.classList.contains('open')) closeSidebar();
        else openSidebar();
    });

    backdrop.addEventListener('click', closeSidebar);
    sidebar.querySelectorAll('.sidebar-link, .sidebar-profile-action').forEach(item => {
        item.addEventListener('click', () => {
            if (!isDesktop()) closeSidebar();
        });
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
            toggleBtn.focus();
        }
    });

    window.addEventListener('resize', () => {
        sidebar.classList.remove('open');
        backdrop.classList.remove('open');
        document.body.classList.remove('sidebar-open');
        sidebar.setAttribute('aria-hidden', String(!isDesktop()));
        toggleBtn.setAttribute('aria-expanded', String(sidebar.classList.contains('expanded')));
    });

    closeSidebar();
}

// ========================================
// Logout Functionality
// ========================================

function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    const logoutItem = document.querySelector('.logout-item');

    [logoutBtn, logoutItem].forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await fetch('/users/logout', { method: 'POST' });
                } catch (error) {
                    console.error('Logout request failed:', error);
                }
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
    document.querySelectorAll('.notification-popup').forEach(item => item.remove());
    const notification = document.createElement('div');
    notification.className = `notification-popup notification-${type}`;
    notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    notification.textContent = message;

    document.body.appendChild(notification);

    window.setTimeout(() => {
        notification.classList.add('show');
    }, 20);

    window.setTimeout(() => {
        notification.classList.remove('show');
        window.setTimeout(() => notification.remove(), 180);
    }, 820);
}

function showConfirmPopup(message, confirmLabel = 'Delete') {
    return new Promise(resolve => {
        document.querySelector('.confirmation-overlay')?.remove();
        const overlay = document.createElement('div');
        overlay.className = 'confirmation-overlay';
        overlay.innerHTML = `
            <div class="confirmation-popup" role="alertdialog" aria-modal="true" aria-labelledby="confirmationTitle">
                <h2 id="confirmationTitle">Confirm action</h2>
                <p></p>
                <div class="confirmation-actions">
                    <button type="button" class="btn btn-cancel" data-confirm-cancel>Cancel</button>
                    <button type="button" class="btn confirmation-delete" data-confirm-accept></button>
                </div>
            </div>
        `;
        overlay.querySelector('p').textContent = message;
        overlay.querySelector('[data-confirm-accept]').textContent = confirmLabel;
        document.body.appendChild(overlay);

        const finish = result => {
            overlay.remove();
            resolve(result);
        };
        overlay.querySelector('[data-confirm-cancel]').addEventListener('click', () => finish(false));
        overlay.querySelector('[data-confirm-accept]').addEventListener('click', () => finish(true));
        overlay.addEventListener('click', event => {
            if (event.target === overlay) finish(false);
        });
        overlay.querySelector('[data-confirm-cancel]').focus();
    });
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

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

console.log('Common utilities loaded');

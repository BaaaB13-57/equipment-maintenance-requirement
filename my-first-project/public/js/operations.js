document.addEventListener('DOMContentLoaded', async () => {
    setupUserDashboardMenus();
    restoreUserDashboardSection();
    setupNotificationSystem();
    await loadUserNotifications();
    await loadEquipmentOptions();
    setupEquipmentPhotoUpload();
    setupOperationsRequestForm();
    await setupUserRequests();
    startUserDashboardSync();
    setupProfileForm();
    setDefaultRequestDate();
});

let userEquipment = [];
let userDashboardSyncing = false;

const fallbackUserRequests = [
    {
        id: 'REQ-1042',
        equipment: 'Crusher Unit #03',
        priority: 'high',
        status: 'in-progress',
        requestedDate: '2026-07-08',
        description: 'Technician assigned and repair work started.'
    },
    {
        id: 'REQ-1038',
        equipment: 'Drill Machine #01',
        priority: 'medium',
        status: 'completed',
        requestedDate: '2026-07-06',
        description: 'Oil leak repaired and machine returned to service.'
    },
    {
        id: 'REQ-1035',
        equipment: 'Excavator #05',
        priority: 'low',
        status: 'pending',
        requestedDate: '2026-07-05',
        description: 'Hydraulic inspection is waiting for review.'
    }
];

function setupUserDashboardMenus() {
    const controls = document.querySelectorAll('[data-user-section]');
    const sidebarLinks = document.querySelectorAll('[data-user-section-link]');

    controls.forEach(control => {
        control.addEventListener('click', () => showUserSection(control.dataset.userSection));
    });

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            showUserSection(link.dataset.userSectionLink);
        });
    });
}

function showUserSection(sectionId) {
    document.querySelectorAll('.user-dashboard-section').forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });

    document.querySelectorAll('[data-user-section]').forEach(control => {
        control.classList.toggle('active', control.dataset.userSection === sectionId);
    });

    document.querySelectorAll('[data-user-section-link]').forEach(link => {
        link.classList.toggle('active', link.dataset.userSectionLink === sectionId);
    });

    if (window.location.hash !== `#${sectionId}`) {
        window.history.replaceState(null, '', `#${sectionId}`);
    }

    const section = document.getElementById(sectionId);
    if (section && window.innerWidth <= 780) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function restoreUserDashboardSection() {
    const requestedSection = window.location.hash.slice(1);
    const validSections = Array.from(document.querySelectorAll('.user-dashboard-section')).map(section => section.id);
    showUserSection(validSections.includes(requestedSection) && requestedSection !== 'notifications' ? requestedSection : 'dashboard');
}

function setupOperationsRequestForm() {
    const form = document.getElementById('operationsRequestForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const photoInput = document.getElementById('equipmentPhoto');
        const selectedPhoto = photoInput?.files?.[0];
        const requestData = {
            equipment: document.getElementById('operationEquipment').value,
            maintenanceType: 'corrective',
            priority: document.getElementById('operationUrgency').value,
            description: document.getElementById('operationProblem').value.trim(),
            requestedDate: document.getElementById('operationDate').value,
            estimatedTime: '',
            assignedTo: '',
            requesterName: getUserDashboardName(),
            requesterEmail: getUserDashboardEmail(),
            photoName: selectedPhoto ? selectedPhoto.name : ''
        };

        if (!requestData.equipment || !requestData.description || !requestData.requestedDate) {
            showNotification('Please fill equipment, problem details, and requested date', 'warning');
            return;
        }

        const location = document.getElementById('operationLocation').value.trim();
        requestData.description = `Location: ${location}. ${requestData.description}`;

        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';

        try {
            const response = await fetch('/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            const result = await response.json();

            if (!response.ok) {
                showNotification(result.message || 'Could not create request', 'error');
                submitButton.disabled = false;
                submitButton.textContent = originalText;
                return;
            }

            updateOperationsStatus();
            showNotification('Request sent to Maintenance', 'success');
            showUserSection('myRequests');
            submitButton.disabled = false;
            submitButton.textContent = originalText;
            form.reset();
            resetEquipmentPhotoPreview();

            try {
                await setupUserRequests();
                await loadUserNotifications();
            } catch (refreshError) {
                console.error('Request saved, but dashboard refresh failed:', refreshError);
                if (result.data) {
                    const current = window.currentUserRequests || [];
                    window.currentUserRequests = excludeDuplicateRequestRecords([result.data, ...current]);
                    renderUserRequests(window.currentUserRequests);
                    renderRecentUserRequests(window.currentUserRequests);
                    renderUserDashboardSummary(window.currentUserRequests);
                }
            }
        } catch (error) {
            console.error('Operations request failed:', error);
            showNotification('Could not send the request. Please try again.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    });
}

async function loadEquipmentOptions() {
    const select = document.getElementById('operationEquipment');
    if (!select) return;

    try {
        const response = await fetch('/equipment');
        if (!response.ok) throw new Error('Equipment API unavailable');
        const data = await response.json();
        const equipment = data.equipment || [];
        userEquipment = equipment;
        renderUserDashboardSummary();
        if (!equipment.length) return;

        select.innerHTML = '<option value="">Select equipment</option>' + equipment.map(item => (
            `<option value="${escapeHtml(item.assetId || item.id || item.name)}">${escapeHtml(item.name)}</option>`
        )).join('');
    } catch (error) {
        console.error('Failed to load equipment options:', error);
        renderUserDashboardSummary();
    }
}

function setupEquipmentPhotoUpload() {
    const input = document.getElementById('equipmentPhoto');
    if (!input) return;

    input.addEventListener('change', () => {
        const file = input.files?.[0];
        const preview = document.getElementById('equipmentPhotoPreview');
        if (!preview) return;

        if (!file) {
            resetEquipmentPhotoPreview();
            return;
        }

        if (!file.type.startsWith('image/')) {
            input.value = '';
            resetEquipmentPhotoPreview();
            showNotification('Please upload an image file', 'warning');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            preview.innerHTML = `
                <img src="${reader.result}" alt="Damaged equipment preview">
                <span>${escapeHtml(file.name)}</span>
            `;
        };
        reader.readAsDataURL(file);
    });
}

function resetEquipmentPhotoPreview() {
    const preview = document.getElementById('equipmentPhotoPreview');
    if (preview) {
        preview.innerHTML = '<span>No photo selected</span>';
    }
}

function updateOperationsStatus() {
    document.querySelectorAll('.status-step').forEach(step => {
        step.classList.add('active');
    });
}

async function setupUserRequests() {
    if (userDashboardSyncing) return;
    userDashboardSyncing = true;
    const selectedRequestId = document.getElementById('statusRequestSelect')?.value;

    try {
    const requests = await getUserRequests();
    window.currentUserRequests = requests;
    renderUserRequests(requests);
    renderRecentUserRequests(requests);
    populateStatusSelect(requests, selectedRequestId);
    const selectedRequest = requests.find(request => (request.requestId || request.id) === selectedRequestId) || requests[0];
    renderSelectedRequestStatus(selectedRequest);
    renderUserDashboardSummary(requests);
    } finally {
        userDashboardSyncing = false;
    }
}

function startUserDashboardSync() {
    window.setInterval(() => {
        if (!document.hidden) {
            setupUserRequests();
            loadUserNotifications();
        }
    }, 5000);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setupUserRequests();
            loadUserNotifications();
        }
    });

    window.addEventListener('focus', () => {
        setupUserRequests();
        loadUserNotifications();
    });
}

function renderUserDashboardSummary(requests) {
    const savedRequests = requests || window.currentUserRequests || [];
    if (requests) window.currentUserRequests = requests;

    const pending = savedRequests.filter(request => request.status === 'pending').length;
    const inProgress = savedRequests.filter(request => ['approved', 'assigned', 'inspection', 'in-progress', 'testing'].includes(request.status)).length;
    const completed = savedRequests.filter(request => request.status === 'completed').length;

    setText('userTotalRequestCount', savedRequests.length);
    setText('userPendingRequestCount', pending);
    setText('userInProgressRequestCount', inProgress);
    setText('userCompletedRequestCount', completed);
}

function renderRecentUserRequests(requests) {
    const tbody = document.getElementById('recentUserRequestsBody');
    if (!tbody) return;
    const recent = requests.slice(0, 5);
    if (!recent.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No maintenance requests yet.</td></tr>';
        return;
    }
    tbody.innerHTML = recent.map(request => {
        const requestId = request.requestId || request.id;
        return `<tr>
            <td><strong>${escapeHtml(request.equipment)}</strong><small>${escapeHtml(requestId)}</small></td>
            <td>${formatDate(request.requestedDate || request.dueDate)}</td>
            <td><span class="badge ${escapeHtml(request.priority)}">${capitalize(request.priority)}</span></td>
            <td>${escapeHtml(request.assignedTo && request.assignedTo !== 'Unassigned' ? request.assignedTo : 'Not assigned')}</td>
            <td><span class="status-pill ${escapeHtml(request.status)}">${formatStatus(request.status)}</span></td>
            <td><button type="button" class="request-view-button" data-view-user-request="${escapeHtml(requestId)}">View</button></td>
        </tr>`;
    }).join('');
    tbody.querySelectorAll('[data-view-user-request]').forEach(button => {
        button.addEventListener('click', () => openNotificationRequest(button.dataset.viewUserRequest));
    });
}

let userNotifications = [];
let activeNotificationFilter = '';

function setupNotificationSystem() {
    const list = document.getElementById('userNotificationList');
    const markAllButton = document.getElementById('markAllNotificationsRead');
    const bell = document.querySelector('.dashboard-notification-button');
    if (!list || !bell || list.dataset.ready) return;
    list.dataset.ready = 'true';

    const sourceSection = document.getElementById('notifications');
    const menu = document.createElement('div');
    menu.className = 'dashboard-notification-menu';
    const dropdown = document.createElement('div');
    dropdown.className = 'header-notification-dropdown';
    dropdown.setAttribute('role', 'dialog');
    dropdown.setAttribute('aria-label', 'Recent notifications');
    const dropdownHeader = document.createElement('div');
    dropdownHeader.className = 'header-notification-dropdown-head';
    dropdownHeader.innerHTML = `
        <div class="notification-dropdown-title"><strong>Notifications</strong><span>Maintenance request updates</span></div>
        <div class="notification-type-list" aria-label="Notification categories">
            <button type="button" class="notification-type-chip submitted" data-notification-filter="request_submitted">Request Sent</button>
            <button type="button" class="notification-type-chip updated" data-notification-filter="request_updated">Status Update</button>
            <button type="button" class="notification-type-chip completed" data-notification-filter="repair_completed">Repair Completed</button>
            <button type="button" class="notification-type-chip rejected" data-notification-filter="request_rejected">Request Rejected</button>
            <button type="button" class="notification-type-chip message" data-notification-filter="new_message">New Message</button>
        </div>`;
    const count = document.getElementById('userNotificationCount');
    if (count) dropdownHeader.appendChild(count);
    if (markAllButton) dropdownHeader.appendChild(markAllButton);
    dropdown.append(dropdownHeader, list);
    bell.parentNode.insertBefore(menu, bell);
    menu.append(bell, dropdown);
    sourceSection?.classList.add('hidden');

    const setDropdownOpen = open => {
        menu.classList.toggle('open', open);
        bell.setAttribute('aria-expanded', String(open));
    };
    bell.addEventListener('click', event => {
        event.stopPropagation();
        setDropdownOpen(!menu.classList.contains('open'));
    });
    dropdown.addEventListener('click', event => event.stopPropagation());
    dropdown.querySelectorAll('[data-notification-filter]').forEach(button => {
        button.addEventListener('click', () => {
            activeNotificationFilter = activeNotificationFilter === button.dataset.notificationFilter
                ? ''
                : button.dataset.notificationFilter;
            dropdown.querySelectorAll('[data-notification-filter]').forEach(item => {
                item.classList.toggle('active', item.dataset.notificationFilter === activeNotificationFilter);
                item.setAttribute('aria-pressed', String(item.dataset.notificationFilter === activeNotificationFilter));
            });
            renderStoredUserNotifications(userNotifications, userNotifications.filter(item => !item.readAt).length);
        });
    });
    document.addEventListener('click', () => setDropdownOpen(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && menu.classList.contains('open')) {
            setDropdownOpen(false);
            bell.focus();
        }
    });
    list.addEventListener('click', async event => {
        const deleteButton = event.target.closest('[data-delete-notification]');
        const readButton = event.target.closest('[data-read-notification]');
        const item = event.target.closest('[data-notification-id]');
        try {
            if (deleteButton) {
                event.stopPropagation();
                await notificationRequest(`/notifications/${encodeURIComponent(deleteButton.dataset.deleteNotification)}`, 'DELETE');
            } else if (readButton) {
                event.stopPropagation();
                await markNotificationRead(readButton.dataset.readNotification);
            } else if (item) {
                const notification = userNotifications.find(entry => entry._id === item.dataset.notificationId);
                if (!notification) return;
                if (!notification.readAt) await markNotificationRead(notification._id);
                openNotificationRequest(notification.requestId);
                setDropdownOpen(false);
            } else return;
            await loadUserNotifications();
        } catch (error) {
            console.error('Notification action failed:', error);
            showNotification('Could not update the notification', 'error');
        }
    });
    list.addEventListener('keydown', event => {
        if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-notification-id]')) {
            event.preventDefault();
            event.target.click();
        }
    });
    markAllButton?.addEventListener('click', async () => {
        try {
            const unreadCount = Number(markAllButton.dataset.unreadCount || 0);
            if (unreadCount === 0) {
                showNotification('All notifications are already read', 'success');
                return;
            }
            const result = await notificationRequest('/notifications/read-all', 'PATCH');
            await loadUserNotifications();
            showNotification(`${result.updated || unreadCount} notification${(result.updated || unreadCount) === 1 ? '' : 's'} marked as read`, 'success');
        } catch (error) {
            showNotification('Could not mark notifications as read', 'error');
        }
    });
}

async function notificationRequest(url, method = 'GET') {
    const response = await fetch(url, { method, cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Notification request failed');
    return result;
}

async function loadUserNotifications() {
    const list = document.getElementById('userNotificationList');
    if (!list) return;
    try {
        const result = await notificationRequest('/notifications');
        userNotifications = result.notifications || [];
        renderStoredUserNotifications(userNotifications, result.unreadCount || 0);
    } catch (error) {
        console.error('Failed to load notifications:', error);
        if (!userNotifications.length) list.innerHTML = '<article class="notification-item"><div><h3>Notifications unavailable</h3><p>Please try again shortly.</p></div></article>';
    }
}

function renderStoredUserNotifications(notifications, unreadCount) {
    const list = document.getElementById('userNotificationList');
    if (!list) return;
    setText('userNotificationCount', `${unreadCount} unread`);
    const bellBadge = document.querySelector('.dashboard-notification-badge');
    if (bellBadge) {
        bellBadge.dataset.notificationManaged = 'true';
        bellBadge.textContent = String(unreadCount);
        bellBadge.hidden = unreadCount === 0;
    }
    const markAll = document.getElementById('markAllNotificationsRead');
    if (markAll) {
        markAll.dataset.unreadCount = String(unreadCount);
        markAll.setAttribute('aria-label', unreadCount ? `Mark all ${unreadCount} notifications as read` : 'All notifications are already read');
    }
    const visibleNotifications = activeNotificationFilter
        ? notifications.filter(notification => notification.type === activeNotificationFilter)
        : notifications;
    if (!visibleNotifications.length) {
        list.innerHTML = `<article class="notification-item"><div><h3>No notifications${activeNotificationFilter ? ' in this category' : ' yet'}</h3><p>Updates about your maintenance requests will appear here.</p></div></article>`;
        return;
    }
    list.innerHTML = visibleNotifications.map(notification => `
        <article class="notification-item stored-notification ${notification.readAt ? '' : 'unread'}" tabindex="0" role="button" data-notification-id="${notification._id}">
            <div class="stored-notification-content">
                <h3>${escapeHtml(notification.title)}</h3>
                <p>${escapeHtml(notification.message)}</p>
                <span>${escapeHtml(notification.requestId)} · ${formatNotificationTime(notification.createdAt)} · ${notification.readAt ? 'Read' : 'Unread'}</span>
            </div>
            <div class="stored-notification-actions">
                ${notification.readAt ? '' : `<button type="button" class="notification-action" data-read-notification="${notification._id}">Mark read</button>`}
                <button type="button" class="notification-action danger" data-delete-notification="${notification._id}">Delete</button>
            </div>
        </article>
    `).join('');
}

async function markNotificationRead(id) {
    return notificationRequest(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
}

function openNotificationRequest(requestId) {
    showUserSection('myRequests');
    const row = Array.from(document.querySelectorAll('#userRequestsBody tr')).find(item => item.textContent.includes(requestId));
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function formatNotificationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function renderUserNotifications(requests) {
    const list = document.getElementById('userNotificationList');
    if (!list) return;

    const notifications = requests.slice(0, 5);
    setText('userNotificationCount', `${notifications.length} update${notifications.length === 1 ? '' : 's'}`);

    if (!notifications.length) {
        list.innerHTML = '<article class="notification-item"><div><h3>No notifications yet</h3><p>Updates about your maintenance requests will appear here.</p></div></article>';
        return;
    }

    list.innerHTML = notifications.map(request => `
        <article class="notification-item">
            <div>
                <h3>${escapeHtml(request.equipment)} — ${formatStatus(request.status)}</h3>
                <p>${escapeHtml(getNotificationMessage(request))}</p>
            </div>
            <span>${formatDate(request.requestedDate || request.dueDate)}</span>
        </article>
    `).join('');
}

function getNotificationMessage(request) {
    const messages = {
        pending: 'Your request was received and is waiting for review.',
        approved: 'Your request was approved and is ready for assignment.',
        assigned: `A technician has been assigned${request.assignedTo ? `: ${request.assignedTo}` : ''}.`,
        inspection: 'The technician is inspecting the reported problem.',
        'in-progress': 'Repair work is currently in progress.',
        testing: 'The repair is complete and the equipment is being tested.',
        completed: 'Maintenance marked this request as completed.'
    };
    return messages[request.status] || 'Your maintenance request was updated.';
}

async function getUserRequests() {
    try {
        const email = encodeURIComponent(getUserDashboardEmail());
        const response = await fetch(`/requests?requesterEmail=${email}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('Requests API unavailable');
        const data = await response.json();
        return excludeDuplicateRequestRecords(data.requests || []);
    } catch (error) {
        console.error('Failed to fetch user requests:', error);
        return fallbackUserRequests;
    }
}

function getUserDashboardEmail() {
    return 'user@minekeeper.com';
}

function getUserDashboardName() {
    return 'User Account';
}

function excludeDuplicateRequestRecords(requests) {
    const seenRequestIds = new Set();
    return requests.filter(request => {
        const requestId = String(request.requestId || request.id || request._id || '');
        if (!requestId || seenRequestIds.has(requestId)) return false;
        seenRequestIds.add(requestId);
        return true;
    });
}

function renderUserRequests(requests) {
    const tbody = document.getElementById('userRequestsBody');
    if (!tbody) return;

    if (!requests.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No requests yet.</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(request => `
        <tr>
            <td>${escapeHtml(request.requestId || request.id)}</td>
            <td>${escapeHtml(request.equipment)}</td>
            <td><span class="badge ${escapeHtml(request.priority)}">${capitalize(request.priority)}</span></td>
            <td><span class="status-pill ${escapeHtml(request.status)}">${formatStatus(request.status)}</span></td>
            <td>${formatDate(request.requestedDate || request.dueDate)}</td>
        </tr>
    `).join('');
}

function populateStatusSelect(requests, selectedRequestId) {
    const select = document.getElementById('statusRequestSelect');
    if (!select) return;

    if (!requests.length) {
        select.innerHTML = '<option value="">No requests yet</option>';
        select.onchange = null;
        return;
    }

    select.innerHTML = requests.map(request => (
        `<option value="${escapeHtml(request.requestId || request.id)}">${escapeHtml(request.requestId || request.id)} - ${escapeHtml(request.equipment)}</option>`
    )).join('');

    if (selectedRequestId && requests.some(request => (request.requestId || request.id) === selectedRequestId)) {
        select.value = selectedRequestId;
    }

    select.onchange = () => {
        const selectedRequest = requests.find(request => (request.requestId || request.id) === select.value);
        renderSelectedRequestStatus(selectedRequest);
    };
}

function renderSelectedRequestStatus(request) {
    const title = document.getElementById('statusTitle');
    const description = document.getElementById('statusDescription');

    if (!request) {
        if (title) title.textContent = 'No requests yet';
        if (description) description.textContent = 'Send your first maintenance request to start tracking status here.';
        document.querySelectorAll('[data-status-step]').forEach(step => step.classList.remove('active'));
        return;
    }

    if (title) title.textContent = `${request.requestId || request.id} - ${request.equipment}`;
    if (description) description.textContent = request.description;

    const statusProgress = { pending: 0, approved: 1, assigned: 1, inspection: 2, 'in-progress': 2, testing: 2, completed: 3 };
    const activeIndex = statusProgress[request.status] ?? 0;

    document.querySelectorAll('[data-status-step]').forEach(step => {
        const stepIndex = stepOrder.indexOf(step.dataset.statusStep);
        step.classList.toggle('active', stepIndex <= activeIndex);
    });
}

function setupProfileForm() {
    const form = document.getElementById('userProfileForm');
    if (!form) return;

    const savedProfile = getSavedProfile();
    document.getElementById('profileName').value = savedProfile.name;
    document.getElementById('profileEmail').value = savedProfile.email;
    setDepartmentValue(savedProfile.department);
    document.getElementById('profilePhone').value = savedProfile.phone;

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const profile = {
            name: document.getElementById('profileName').value.trim(),
            email: document.getElementById('profileEmail').value.trim(),
            department: document.getElementById('profileDepartment').value,
            phone: document.getElementById('profilePhone').value.trim()
        };

        localStorage.setItem('userProfile', JSON.stringify(profile));
        localStorage.setItem('userName', profile.name);
        localStorage.setItem('userEmail', profile.email);
        showNotification('Profile updated', 'success');
    });
}

function getSavedProfile() {
    const defaultProfile = {
        name: localStorage.getItem('userName') || 'User Account',
        email: localStorage.getItem('userEmail') || 'user@minekeeper.com',
        department: localStorage.getItem('userDepartment') || 'Operations',
        phone: localStorage.getItem('userPhone') || ''
    };

    try {
        return { ...defaultProfile, ...(JSON.parse(localStorage.getItem('userProfile')) || {}) };
    } catch (error) {
        return defaultProfile;
    }
}

function setDepartmentValue(department) {
    const select = document.getElementById('profileDepartment');
    if (!select) return;

    const hasDepartment = Array.from(select.options).some(option => option.value === department || option.textContent === department);
    if (!hasDepartment && department) {
        const option = document.createElement('option');
        option.value = department;
        option.textContent = department;
        select.appendChild(option);
    }
    select.value = department || 'Operations';
}

function setDefaultRequestDate() {
    const dateInput = document.getElementById('operationDate');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().slice(0, 10);
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function formatStatus(status) {
    return status.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
}

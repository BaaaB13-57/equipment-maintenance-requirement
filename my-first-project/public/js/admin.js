document.addEventListener('DOMContentLoaded', async () => {
    setupAdminNavigation();
    await loadAdminData();
    setActiveReviewRequest();
    renderAdminDashboard();
    setupAdminActions();
});

let adminRequests = [
    { id: 'REQ-1042', user: 'User Account', equipment: 'Crusher Unit #03', priority: 'high', status: 'pending' },
    { id: 'REQ-1038', user: 'Operations Team', equipment: 'Drill Machine #01', priority: 'medium', status: 'approved' },
    { id: 'REQ-1035', user: 'Production Lead', equipment: 'Excavator #05', priority: 'low', status: 'in-progress' },
    { id: 'REQ-1029', user: 'Safety Officer', equipment: 'Conveyor System #01', priority: 'high', status: 'completed' }
];

let adminEquipment = [
    { name: 'Drill Machine #01', location: 'Zone A', status: 'Available', lastService: '2026-07-06' },
    { name: 'Excavator #05', location: 'Pit 2', status: 'Maintenance', lastService: '2026-07-05' },
    { name: 'Crusher Unit #03', location: 'Plant 1', status: 'Down', lastService: '2026-07-08' },
    { name: 'Conveyor System #01', location: 'Line B', status: 'Available', lastService: '2026-07-01' }
];

let adminUsers = [
    { name: 'Admin User', email: 'admin@minekeeper.com', role: 'Admin', status: 'Active' },
    { name: 'User Account', email: 'user@minekeeper.com', role: 'User', status: 'Active' },
    { name: 'Technician Account', email: 'technician@minekeeper.com', role: 'Technician', status: 'Active' },
    { name: 'Production Lead', email: 'production@minekeeper.com', role: 'User', status: 'Inactive' }
];

let technicians = ['Technician Account'];
let activeReviewId = '';
let editingUserId = '';
let editingEquipmentId = '';

async function loadAdminData() {
    try {
        const [requestResponse, equipmentResponse, userResponse] = await Promise.all([
            fetch('/requests'),
            fetch('/equipment'),
            fetch('/users')
        ]);

        if (requestResponse.ok) {
            const data = await requestResponse.json();
            adminRequests = data.requests || adminRequests;
        }

        if (equipmentResponse.ok) {
            const data = await equipmentResponse.json();
            adminEquipment = data.equipment || adminEquipment;
        }

        if (userResponse.ok) {
            const data = await userResponse.json();
            adminUsers = data.users || adminUsers;
            const technicianUsers = adminUsers
                .filter(user => user.role === 'technician' && (user.status || 'Active') === 'Active')
                .map(user => user.name);
            technicians = technicianUsers.length ? technicianUsers : technicians;
        }
    } catch (error) {
        console.error('Failed to load admin dashboard data:', error);
    }
}

function setupAdminNavigation() {
    document.querySelectorAll('[data-admin-section]').forEach(button => {
        button.addEventListener('click', () => showAdminSection(button.dataset.adminSection));
    });

    document.querySelectorAll('[data-admin-section-link]').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            showAdminSection(link.dataset.adminSectionLink);
        });
    });
}

function showAdminSection(sectionId) {
    document.querySelectorAll('.admin-dashboard-section').forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });

    document.querySelectorAll('[data-admin-section]').forEach(button => {
        button.classList.toggle('active', button.dataset.adminSection === sectionId);
    });

    document.querySelectorAll('[data-admin-section-link]').forEach(link => {
        link.classList.toggle('active', link.dataset.adminSectionLink === sectionId);
    });
}

function renderAdminDashboard() {
    renderAdminSummary();
    renderAdminRequests();
    renderAdminReview();
    renderAssignments();
    renderEquipment();
    renderUsers();
}

function renderAdminSummary() {
    const pending = adminRequests.filter(request => ['pending', 'approved'].includes(request.status)).length;
    const openJobs = getOpenJobs();
    const activeUsers = adminUsers.filter(user => (user.status || 'Active') === 'Active').length;
    setText('adminPendingCount', pending);
    setText('adminAssignedCount', openJobs.length);
    setText('adminEquipmentCount', adminEquipment.length);
    setText('adminUserCount', activeUsers);
    setText('adminReviewBadge', `${pending} need review`);
    setText('openJobsCount', `${openJobs.length} open`);
}

function renderAdminRequests() {
    const tbody = document.getElementById('adminRequestsBody');
    if (!tbody) return;

    tbody.innerHTML = adminRequests.map(request => `
        <tr>
            <td>${request.requestId || request.id}</td>
            <td>${request.requesterName || request.user || 'User Account'}</td>
            <td>${request.equipment}</td>
            <td><span class="badge ${request.priority}">${capitalize(request.priority)}</span></td>
            <td><span class="status-pill ${request.status}">${formatStatus(request.status)}</span></td>
            <td>
                <button type="button" class="admin-action-button" data-review-request="${request.requestId || request.id}">Review</button>
                ${request.status === 'pending' ? `<button type="button" class="admin-action-button" data-approve-request="${request.requestId || request.id}">Approve</button>` : ''}
                ${request.status === 'pending' ? `<button type="button" class="admin-action-button danger" data-open-reject-request="${request.requestId || request.id}">Reject</button>` : ''}
                ${['pending', 'approved'].includes(request.status) ? `<button type="button" class="admin-action-button" data-open-assign-request="${request.requestId || request.id}">Assign Technician</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function renderAdminReview() {
    const select = document.getElementById('adminReviewSelect');
    const panel = document.getElementById('adminReviewPanel');
    const request = getActiveReviewRequest();
    if (!panel) return;

    if (!adminRequests.length) {
        if (select) select.innerHTML = '<option>No requests available</option>';
        panel.innerHTML = '<div class="technician-problem-box"><h3>No requests</h3><p>Maintenance requests submitted by users will appear here for admin review.</p></div>';
        return;
    }

    if (select) {
        select.innerHTML = adminRequests.map(item => {
            const id = item.requestId || item.id;
            return `<option value="${id}" ${id === activeReviewId ? 'selected' : ''}>${id} - ${item.equipment}</option>`;
        }).join('');
        select.onchange = () => {
            activeReviewId = select.value;
            renderAdminReview();
        };
    }

    if (!request) return;

    const requestId = request.requestId || request.id;
    panel.innerHTML = `
        <div class="technician-detail-grid">
            <article><span>Request</span><strong>${requestId}</strong></article>
            <article><span>User</span><strong>${request.requesterName || request.user || 'User Account'}</strong></article>
            <article><span>Equipment</span><strong>${request.equipment}</strong></article>
            <article><span>Type</span><strong>${request.type || 'Maintenance'}</strong></article>
            <article><span>Priority</span><strong>${capitalize(request.priority || 'low')}</strong></article>
            <article><span>Status</span><strong>${formatStatus(request.status || 'pending')}</strong></article>
            <article><span>Assigned To</span><strong>${request.assignedTo || 'Unassigned'}</strong></article>
            <article><span>Due Date</span><strong>${request.dueDate || request.requestedDate || 'Not set'}</strong></article>
        </div>
        <div class="technician-problem-box">
            <h3>Problem Description</h3>
            <p>${request.description || 'No problem description provided.'}</p>
            ${request.photoName ? `<p><strong>Uploaded Photo:</strong> ${request.photoName}</p>` : ''}
        </div>
        ${request.rejectionReason ? `<div class="technician-problem-box admin-rejection-result"><h3>Recorded Rejection Reason</h3><p>${escapeHtml(request.rejectionReason)}</p></div>` : ''}
        <form class="maintenance-update-form" data-review-assignment-form="${requestId}">
            <label>Technician
                <select>
                    ${technicians.map(name => `<option ${request.assignedTo === name ? 'selected' : ''}>${name}</option>`).join('')}
                </select>
            </label>
            <label>Rejection reason
                <textarea rows="2" data-rejection-reason="${requestId}" placeholder="Required when rejecting a request">${escapeHtml(request.rejectionReason || '')}</textarea>
            </label>
            <div class="equipment-form-actions">
                <button type="button" class="btn btn-primary" data-approve-request="${requestId}">Approve Request</button>
                <button type="button" class="btn btn-danger" data-reject-request="${requestId}">Reject Request</button>
                <button type="submit" class="btn btn-success">Assign Technician</button>
            </div>
        </form>
    `;
}

function renderAssignments() {
    const list = document.getElementById('assignmentList');
    if (!list) return;

    const openJobs = getOpenJobs();
    if (!openJobs.length) {
        list.innerHTML = `
            <article class="maintenance-work-card">
                <div class="maintenance-work-info">
                    <span class="request-code">No open jobs</span>
                    <h3>All maintenance work is completed</h3>
                    <p>New user requests will appear here after they are submitted.</p>
                </div>
            </article>
        `;
        return;
    }

    list.innerHTML = openJobs.map(request => {
        const requestId = request.requestId || request.id;
        const assignedTo = request.assignedTo || 'Unassigned';
        return `
        <article class="maintenance-work-card">
            <div class="maintenance-work-info">
                <span class="request-code">${requestId}</span>
                <h3>${request.equipment}</h3>
                <p>${request.description || `${request.requesterName || request.user || 'User Account'} submitted a ${request.priority} priority maintenance request.`}</p>
                <div class="work-meta">
                    <span>${request.requesterName || request.user || 'User Account'}</span>
                    <span>Assigned: ${assignedTo}</span>
                    <span class="badge ${request.priority || 'low'}">${capitalize(request.priority || 'low')}</span>
                    <span class="status-pill ${request.status}">${formatStatus(request.status)}</span>
                </div>
                <div class="technician-card-actions">
                    <button type="button" class="admin-action-button" data-review-request="${requestId}">Review</button>
                    ${request.status === 'pending' ? `<button type="button" class="admin-action-button" data-approve-request="${requestId}">Approve</button>` : ''}
                </div>
            </div>
            <form class="maintenance-update-form" data-assignment-form="${requestId}">
                <label>Technician
                    <select>
                        ${technicians.map(name => `<option ${assignedTo === name ? 'selected' : ''}>${name}</option>`).join('')}
                    </select>
                </label>
                <label>Schedule
                    <select>
                        <option>Today</option>
                        <option>Tomorrow</option>
                        <option>This week</option>
                    </select>
                </label>
                <button type="submit" class="btn btn-primary">Assign</button>
            </form>
        </article>
    `;
    }).join('');
}

function renderEquipment() {
    const tbody = document.getElementById('adminEquipmentBody');
    if (!tbody) return;

    tbody.innerHTML = adminEquipment.map((equipment, index) => `
        <tr>
            <td>${equipment.name}</td>
            <td>${equipment.location}</td>
            <td><span class="status-pill ${equipment.status.toLowerCase()}">${equipment.status}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button type="button" class="admin-action-button" data-equipment-toggle-index="${index}">Status</button>
                    <button type="button" class="admin-action-button" data-equipment-edit-index="${index}">Edit</button>
                    <button type="button" class="admin-action-button danger" data-equipment-delete-index="${index}">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderUsers() {
    const tbody = document.getElementById('adminUsersBody');
    if (!tbody) return;

    tbody.innerHTML = adminUsers.map((user, index) => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role}</td>
            <td><span class="status-pill ${user.status.toLowerCase()}">${user.status}</span></td>
            <td>
                <div class="admin-row-actions">
                    <button type="button" class="admin-action-button" data-user-edit-index="${index}">Edit</button>
                    <button type="button" class="admin-action-button danger" data-user-delete-index="${index}">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function setupAdminActions() {
    document.addEventListener('click', async (event) => {
        const reviewId = event.target.dataset.reviewRequest;
        const approveId = event.target.dataset.approveRequest;
        const rejectId = event.target.dataset.rejectRequest;
        const openRejectId = event.target.dataset.openRejectRequest;
        const openAssignId = event.target.dataset.openAssignRequest;
        const messageId = event.target.dataset.sendRequestMessage;
        const equipmentToggleIndex = event.target.dataset.equipmentToggleIndex;
        const equipmentEditIndex = event.target.dataset.equipmentEditIndex;
        const equipmentDeleteIndex = event.target.dataset.equipmentDeleteIndex;
        const userToggleIndex = event.target.dataset.userToggleIndex;
        const userEditIndex = event.target.dataset.userEditIndex;
        const userDeleteIndex = event.target.dataset.userDeleteIndex;

        if (reviewId) {
            activeReviewId = reviewId;
            renderAdminReview();
            showAdminSection('adminReview');
        }

        if (openRejectId) {
            activeReviewId = openRejectId;
            renderAdminReview();
            showAdminSection('adminReview');
            document.querySelector(`[data-rejection-reason="${openRejectId}"]`)?.focus();
        }

        if (openAssignId) {
            activeReviewId = openAssignId;
            renderAdminReview();
            showAdminSection('adminReview');
            document.querySelector(`[data-review-assignment-form="${openAssignId}"] select`)?.focus();
        }

        if (approveId) {
            const request = findAdminRequest(approveId);
            const saved = await updateRequestApi(approveId, { status: 'approved' });
            if (!saved) return;
            if (request) request.status = 'approved';
            renderAdminDashboard();
            showNotification(`${approveId} approved`, 'success');
        }

        if (rejectId) {
            const reason = document.querySelector(`[data-rejection-reason="${rejectId}"]`)?.value.trim();
            if (!reason) {
                showNotification('Enter a rejection reason first', 'warning');
                return;
            }
            const confirmed = await showConfirmPopup(`Reject ${rejectId}? The requester will be notified with your reason.`, 'Reject');
            if (!confirmed) return;
            const request = findAdminRequest(rejectId);
            const saved = await updateRequestApi(rejectId, { status: 'rejected', rejectionReason: reason });
            if (!saved) return;
            if (request) Object.assign(request, saved.data || { status: 'rejected', rejectionReason: reason });
            renderAdminDashboard();
            showNotification(`${rejectId} rejected`, 'warning');
        }

        if (messageId) {
            const input = document.querySelector(`[data-admin-message="${messageId}"]`);
            const message = input?.value.trim();
            if (!message) {
                showNotification('Enter a message first', 'warning');
                return;
            }
            const saved = await updateRequestApi(messageId, { note: message, notifyUser: true });
            if (!saved) return;
            input.value = '';
            showNotification('Message sent to requester', 'success');
        }

        if (equipmentToggleIndex !== undefined) {
            const equipment = adminEquipment[Number(equipmentToggleIndex)];
            const nextStatus = ['Available', 'operational'].includes(equipment.status) ? 'maintenance' : 'operational';
            const saved = await updateEquipmentApi(equipment.id || equipment.assetId, { status: nextStatus });
            if (!saved) return;
            equipment.status = nextStatus;
            renderAdminDashboard();
            showNotification(`${equipment.name} updated`, 'success');
        }

        if (equipmentEditIndex !== undefined) beginEditEquipment(Number(equipmentEditIndex));

        if (equipmentDeleteIndex !== undefined) {
            const equipment = adminEquipment[Number(equipmentDeleteIndex)];
            const confirmed = await showConfirmPopup(`Delete ${equipment.name}? This cannot be undone.`);
            if (!confirmed) return;
            const deleted = await deleteEquipmentApi(equipment.assetId || equipment.id);
            if (!deleted) return;
            adminEquipment.splice(Number(equipmentDeleteIndex), 1);
            renderAdminDashboard();
            showNotification('Equipment deleted successfully', 'success');
        }

        if (userToggleIndex !== undefined) {
            const user = adminUsers[Number(userToggleIndex)];
            const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
            const saved = await updateUserApi(user.email || user.username, { status: nextStatus });
            if (!saved) return;
            user.status = nextStatus;
            renderAdminDashboard();
            showNotification(`${user.name} status updated`, 'success');
        }

        if (userEditIndex !== undefined) beginEditUser(Number(userEditIndex));

        if (userDeleteIndex !== undefined) {
            const user = adminUsers[Number(userDeleteIndex)];
            const confirmed = await showConfirmPopup(`Delete ${user.name}? This cannot be undone.`);
            if (!confirmed) return;
            const deleted = await deleteUserApi(user.email || user.username);
            if (!deleted) return;
            adminUsers.splice(Number(userDeleteIndex), 1);
            renderAdminDashboard();
            showNotification('User deleted successfully', 'success');
        }
    });

    document.addEventListener('submit', async (event) => {
        const requestId = event.target.dataset.assignmentForm || event.target.dataset.reviewAssignmentForm;
        if (!requestId) return;

        event.preventDefault();
        const request = findAdminRequest(requestId);
        const technician = event.target.querySelector('select')?.value || 'Technician Account';
        const saved = await updateRequestApi(requestId, { status: 'assigned', assignedTo: technician });
        if (!saved) return;
        if (request) {
            request.status = 'assigned';
            request.assignedTo = technician;
        }
        renderAdminDashboard();
        showNotification('Assign successful', 'success');
    });

    document.getElementById('addEquipmentBtn')?.addEventListener('click', () => {
        resetEquipmentFormMode();
        toggleAddEquipmentForm(true);
    });

    document.getElementById('cancelAddEquipmentBtn')?.addEventListener('click', () => {
        resetEquipmentFormMode();
        toggleAddEquipmentForm(false);
    });

    document.getElementById('addEquipmentForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveNewEquipment();
    });

    document.getElementById('addUserBtn')?.addEventListener('click', () => {
        resetUserFormMode();
        toggleAddUserForm(true);
    });

    document.getElementById('cancelAddUserBtn')?.addEventListener('click', () => {
        resetUserFormMode();
        toggleAddUserForm(false);
    });

    document.getElementById('addUserForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await saveNewUser();
    });

    document.getElementById('downloadReportBtn')?.addEventListener('click', () => {
        downloadAdminReport();
    });
}

async function updateRequestApi(id, payload) {
    try {
        const response = await fetch(`/requests/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Request update failed');
        return data;
    } catch (error) {
        console.error('Request update failed:', error);
        showNotification(error.message || 'Request update failed', 'error');
        return null;
    }
}

async function updateEquipmentApi(id, payload) {
    try {
        const response = await fetch(`/equipment/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Equipment update failed');
        return data;
    } catch (error) {
        console.error('Equipment update failed:', error);
        showNotification(error.message || 'Equipment update failed', 'error');
        return null;
    }
}

async function createEquipmentApi(payload) {
    try {
        const response = await fetch('/equipment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Equipment save failed');
        return data.data;
    } catch (error) {
        console.error('Equipment create failed:', error);
        showNotification(error.message || 'Equipment save failed', 'error');
        return null;
    }
}

async function deleteEquipmentApi(id) {
    try {
        const response = await fetch(`/equipment/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Equipment delete failed');
        return data;
    } catch (error) {
        console.error('Equipment delete failed:', error);
        showNotification(error.message || 'Equipment delete failed', 'error');
        return null;
    }
}

async function updateUserApi(id, payload) {
    try {
        const response = await fetch(`/users/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'User update failed');
        return data;
    } catch (error) {
        console.error('User update failed:', error);
        showNotification(error.message || 'User update failed', 'error');
        return null;
    }
}

async function createUserApi(payload) {
    try {
        const response = await fetch('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'User save failed');
        return data.user;
    } catch (error) {
        console.error('User create failed:', error);
        showNotification(error.message || 'User save failed', 'error');
        return null;
    }
}

async function deleteUserApi(id) {
    try {
        const response = await fetch(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'User delete failed');
        return data;
    } catch (error) {
        console.error('User delete failed:', error);
        showNotification(error.message || 'User delete failed', 'error');
        return null;
    }
}

function formatStatus(status) {
    return status.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function setActiveReviewRequest() {
    activeReviewId = adminRequests.find(request => request.status !== 'completed')?.requestId ||
        adminRequests.find(request => request.status !== 'completed')?.id ||
        adminRequests[0]?.requestId ||
        adminRequests[0]?.id ||
        '';
}

function getActiveReviewRequest() {
    return findAdminRequest(activeReviewId);
}

function findAdminRequest(id) {
    return adminRequests.find(item => (item.requestId || item.id) === id);
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function getOpenJobs() {
    return adminRequests.filter(request => request.status !== 'completed');
}

function downloadAdminReport() {
    const reportDate = new Date().toLocaleString();
    const pending = adminRequests.filter(request => request.status === 'pending').length;
    const approved = adminRequests.filter(request => request.status === 'approved').length;
    const openJobs = getOpenJobs().length;
    const completed = adminRequests.filter(request => request.status === 'completed').length;
    const highPriority = adminRequests.filter(request => request.priority === 'high' && request.status !== 'completed').length;
    const activeUsers = adminUsers.filter(user => (user.status || 'Active') === 'Active').length;

    const rows = [
        ['Equipment Maintenance Report'],
        ['Generated', reportDate],
        [],
        ['Summary'],
        ['Total Requests', adminRequests.length],
        ['Pending Requests', pending],
        ['Approved Requests', approved],
        ['Open Jobs', openJobs],
        ['Completed Jobs', completed],
        ['High Priority Open Issues', highPriority],
        ['Equipment Count', adminEquipment.length],
        ['Active Users', activeUsers],
        [],
        ['Maintenance Requests'],
        ['Request ID', 'User', 'Equipment', 'Priority', 'Status', 'Assigned To', 'Due Date'],
        ...adminRequests.map(request => [
            request.requestId || request.id || '',
            request.requesterName || request.user || '',
            request.equipment || '',
            request.priority || '',
            request.status || '',
            request.assignedTo || 'Unassigned',
            request.dueDate || request.requestedDate || ''
        ]),
        [],
        ['Equipment'],
        ['Asset ID', 'Name', 'Type', 'Location', 'Status', 'Assigned To'],
        ...adminEquipment.map(equipment => [
            equipment.assetId || equipment.id || '',
            equipment.name || '',
            equipment.type || '',
            equipment.location || '',
            equipment.status || '',
            equipment.assignedTo || 'Unassigned'
        ]),
        [],
        ['Users'],
        ['Name', 'Email', 'Username', 'Role', 'Department', 'Status'],
        ...adminUsers.map(user => [
            user.name || '',
            user.email || '',
            user.username || '',
            user.role || '',
            user.department || '',
            user.status || ''
        ])
    ];

    const csv = rows.map(row => row.map(escapeCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = URL.createObjectURL(blob);
    link.download = `maintenance-report-${dateStamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
    showNotification('Report downloaded successfully', 'success');
}

function escapeCsvValue(value) {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function toggleAddEquipmentForm(show) {
    const form = document.getElementById('addEquipmentForm');
    if (!form) return;
    form.classList.toggle('hidden', !show);
    if (show) document.getElementById('equipmentAssetId')?.focus();
}

function beginEditEquipment(index) {
    const equipment = adminEquipment[index];
    if (!equipment) return;
    editingEquipmentId = equipment.assetId || equipment.id;
    document.getElementById('equipmentAssetId').value = equipment.assetId || equipment.id || '';
    document.getElementById('equipmentName').value = equipment.name || '';
    document.getElementById('equipmentType').value = equipment.type || '';
    document.getElementById('equipmentLocation').value = equipment.location || '';
    document.getElementById('equipmentStatus').value = equipment.status || 'operational';
    document.getElementById('equipmentAssignedTo').value = equipment.assignedTo || 'Unassigned';
    document.getElementById('equipmentNotes').value = equipment.notes || '';
    const submitButton = document.querySelector('#addEquipmentForm button[type="submit"]');
    if (submitButton) submitButton.textContent = 'Update Equipment';
    toggleAddEquipmentForm(true);
}

function resetEquipmentFormMode() {
    editingEquipmentId = '';
    const form = document.getElementById('addEquipmentForm');
    form?.reset();
    const submitButton = form?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = 'Save Equipment';
}

async function saveNewEquipment() {
    const payload = {
        assetId: document.getElementById('equipmentAssetId').value.trim(),
        name: document.getElementById('equipmentName').value.trim(),
        type: document.getElementById('equipmentType').value.trim(),
        location: document.getElementById('equipmentLocation').value.trim(),
        status: document.getElementById('equipmentStatus').value,
        assignedTo: document.getElementById('equipmentAssignedTo').value,
        notes: document.getElementById('equipmentNotes').value.trim()
    };

    if (!payload.assetId || !payload.name || !payload.type || !payload.location) {
        showNotification('Please fill all required equipment fields', 'error');
        return;
    }

    const wasEditing = Boolean(editingEquipmentId);
    const savedEquipment = editingEquipmentId
        ? (await updateEquipmentApi(editingEquipmentId, payload))?.data
        : await createEquipmentApi(payload);
    if (!savedEquipment) return;

    await loadAdminData();
    resetEquipmentFormMode();
    toggleAddEquipmentForm(false);
    renderAdminDashboard();
    showNotification(wasEditing ? 'Equipment updated successfully' : 'Equipment added successfully', 'success');
}

function toggleAddUserForm(show) {
    const form = document.getElementById('addUserForm');
    if (!form) return;
    form.classList.toggle('hidden', !show);
    if (show) document.getElementById('newUserName')?.focus();
}

function beginEditUser(index) {
    const user = adminUsers[index];
    if (!user) return;
    editingUserId = user.email || user.username;
    document.getElementById('newUserName').value = user.name || '';
    document.getElementById('newUserEmail').value = user.email || '';
    document.getElementById('newUsername').value = user.username || '';
    document.getElementById('newUserPassword').value = '';
    document.getElementById('newUserPassword').required = false;
    document.getElementById('newUserPassword').placeholder = 'Leave blank to keep current password';
    document.getElementById('newUserRole').value = user.role || 'user';
    document.getElementById('newUserDepartment').value = user.department || 'Operations';
    document.getElementById('newUserPhone').value = user.phone || '';
    const submitButton = document.querySelector('#addUserForm button[type="submit"]');
    if (submitButton) submitButton.textContent = 'Update User';
    toggleAddUserForm(true);
}

function resetUserFormMode() {
    editingUserId = '';
    const form = document.getElementById('addUserForm');
    form?.reset();
    const password = document.getElementById('newUserPassword');
    if (password) {
        password.required = true;
        password.placeholder = 'Create password';
    }
    const submitButton = form?.querySelector('button[type="submit"]');
    if (submitButton) submitButton.textContent = 'Save User';
}

async function saveNewUser() {
    const form = document.getElementById('addUserForm');
    const submitButton = form?.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent || 'Save User';
    const payload = {
        name: document.getElementById('newUserName').value.trim(),
        email: document.getElementById('newUserEmail').value.trim().toLowerCase(),
        username: document.getElementById('newUsername').value.trim().toLowerCase(),
        password: document.getElementById('newUserPassword').value,
        role: document.getElementById('newUserRole').value,
        department: document.getElementById('newUserDepartment').value.trim() || 'Operations',
        phone: document.getElementById('newUserPhone').value.trim()
    };

    if (!payload.name || !payload.email || !payload.username || (!editingUserId && !payload.password)) {
        showNotification('Please fill all required user fields', 'error');
        return;
    }

    if (payload.username.includes('@')) {
        showNotification('Use a simple username, not an email address', 'error');
        return;
    }

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
    }

    if (!payload.password) delete payload.password;
    const savedUser = editingUserId
        ? (await updateUserApi(editingUserId, payload))?.user
        : await createUserApi(payload);
    if (!savedUser) {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
        return;
    }

    await loadAdminData();
    const wasEditing = Boolean(editingUserId);
    resetUserFormMode();
    toggleAddUserForm(false);
    renderAdminDashboard();
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Save User';
    }
    showNotification(wasEditing ? 'User updated successfully' : 'User added successfully', 'success');
}

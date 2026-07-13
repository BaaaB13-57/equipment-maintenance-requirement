document.addEventListener('DOMContentLoaded', async () => {
    setupUserDashboardMenus();
    await loadEquipmentOptions();
    setupEquipmentPhotoUpload();
    setupOperationsRequestForm();
    await setupUserRequests();
    setupProfileForm();
});

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

    const section = document.getElementById(sectionId);
    if (section && window.innerWidth <= 780) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
            requesterName: localStorage.getItem('userName') || 'User Account',
            requesterEmail: localStorage.getItem('userEmail') || 'user@minekeeper.com',
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
            await setupUserRequests();
            showNotification('Request sent to Maintenance', 'success');

            setTimeout(() => {
                showUserSection('myRequests');
                submitButton.disabled = false;
                submitButton.textContent = originalText;
                form.reset();
                resetEquipmentPhotoPreview();
            }, 1000);
        } catch (error) {
            console.error('Operations request failed:', error);
            showNotification('Network error. Please try again.', 'error');
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
        if (!equipment.length) return;

        select.innerHTML = '<option value="">Select equipment</option>' + equipment.map(item => (
            `<option value="${escapeHtml(item.assetId || item.id || item.name)}">${escapeHtml(item.name)}</option>`
        )).join('');
    } catch (error) {
        console.error('Failed to load equipment options:', error);
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
    const requests = await getUserRequests();
    renderUserRequests(requests);
    populateStatusSelect(requests);
    renderSelectedRequestStatus(requests[0]);
}

async function getUserRequests() {
    try {
        const email = encodeURIComponent(localStorage.getItem('userEmail') || 'user@minekeeper.com');
        const response = await fetch(`/requests?requesterEmail=${email}`);
        if (!response.ok) throw new Error('Requests API unavailable');
        const data = await response.json();
        return data.requests || [];
    } catch (error) {
        console.error('Failed to fetch user requests:', error);
        return fallbackUserRequests;
    }
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

function populateStatusSelect(requests) {
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

    const stepOrder = ['pending', 'approved', 'in-progress', 'completed'];
    const activeIndex = Math.max(stepOrder.indexOf(request.status), 0);

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

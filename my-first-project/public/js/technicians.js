document.addEventListener('DOMContentLoaded', async () => {
    setupTechnicianNavigation();
    setupTechnicianQueueRefresh();
    await loadTechnicianJobs();
    renderTechnicianDashboard();
    setupRepairForms();
});

let technicianJobs = [
    {
        id: 'REQ-1042',
        equipment: 'Crusher Unit #03',
        location: 'Plant 1 - Crusher Bay',
        priority: 'high',
        status: 'assigned',
        problem: 'Main crusher belt is slipping and producing abnormal vibration during startup.',
        reportedBy: 'User Account',
        assignedDate: '2026-07-08',
        notes: ['Assigned by Admin for urgent inspection.'],
        parts: '',
        repairSummary: ''
    },
    {
        id: 'REQ-1035',
        equipment: 'Excavator #05',
        location: 'Pit 2',
        priority: 'medium',
        status: 'in-progress',
        problem: 'Hydraulic arm response is slow and fluid is visible near the lower cylinder.',
        reportedBy: 'Production Lead',
        assignedDate: '2026-07-07',
        notes: ['Hydraulic leak confirmed during inspection.'],
        parts: 'Hydraulic seal kit',
        repairSummary: 'Cylinder seal replacement started.'
    },
    {
        id: 'REQ-1029',
        equipment: 'Drill Machine #01',
        location: 'Zone A',
        priority: 'low',
        status: 'completed',
        problem: 'Oil leak near engine casing after shift startup.',
        reportedBy: 'Operations Team',
        assignedDate: '2026-07-06',
        notes: ['Gasket replaced.', 'Test run completed successfully.'],
        parts: 'Engine gasket',
        repairSummary: 'Oil leak repaired and equipment returned to service.',
        completedDate: '2026-07-08'
    }
];

let activeJobId = technicianJobs.find(job => job.status !== 'completed')?.id || technicianJobs[0].id;

async function loadTechnicianJobs() {
    try {
        const response = await fetch('/requests');
        if (!response.ok) throw new Error('Assigned requests API unavailable');
        const data = await response.json();
        const requests = (data.requests || []).filter(request => {
            const assignedTo = request.assignedTo || '';
            return assignedTo && assignedTo !== 'Unassigned';
        });

        technicianJobs = requests.map(mapRequestToJob);
        if (technicianJobs.length) {
            activeJobId = technicianJobs.find(job => job.status !== 'completed')?.id || technicianJobs[0].id;
        } else {
            activeJobId = '';
        }
    } catch (error) {
        console.error('Failed to load technician jobs:', error);
    }
}

function setupTechnicianQueueRefresh() {
    document.getElementById('refreshTechnicianQueueBtn')?.addEventListener('click', async () => {
        await loadTechnicianJobs();
        renderTechnicianDashboard();
        showTechnicianSection('assignedRequests');
        showNotification('Technician queue refreshed', 'success');
    });
}

function mapRequestToJob(request) {
    return {
        id: request.requestId || request.id,
        equipment: request.equipment,
        location: extractLocation(request.description),
        priority: request.priority || 'low',
        status: request.status || 'approved',
        problem: request.description || 'No problem details provided.',
        reportedBy: request.requesterName || 'User Account',
        assignedTo: request.assignedTo || 'Unassigned',
        assignedDate: request.createdAt || request.dueDate || '',
        notes: (request.notes || []).map(note => note.text || note),
        parts: request.partsUsed || '',
        repairSummary: request.repairSummary || '',
        completedDate: request.completedDate || '',
        photoName: request.photoName || ''
    };
}

function extractLocation(description = '') {
    const match = description.match(/Location:\s*([^.]*)/i);
    return match ? match[1] : 'Not specified';
}

function setupTechnicianNavigation() {
    document.querySelectorAll('[data-technician-section]').forEach(button => {
        button.addEventListener('click', () => showTechnicianSection(button.dataset.technicianSection));
    });

    document.querySelectorAll('[data-technician-section-link]').forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            showTechnicianSection(link.dataset.technicianSectionLink);
        });
    });
}

function showTechnicianSection(sectionId) {
    document.querySelectorAll('.technician-dashboard-section').forEach(section => {
        section.classList.toggle('active', section.id === sectionId);
    });

    document.querySelectorAll('[data-technician-section]').forEach(button => {
        button.classList.toggle('active', button.dataset.technicianSection === sectionId);
    });

    document.querySelectorAll('[data-technician-section-link]').forEach(link => {
        link.classList.toggle('active', link.dataset.technicianSectionLink === sectionId);
    });
}

function renderTechnicianDashboard() {
    renderSummaryCounts();
    renderAssignedJobs();
    renderRequestSelector();
    renderProblemDetails();
    renderRepairForm();
    renderRepairNotes();
    renderCompletedWork();
}

function renderSummaryCounts() {
    const queueJobs = technicianJobs.filter(job => job.status !== 'completed');
    setText('assignedCount', queueJobs.length);
    setText('progressCount', technicianJobs.filter(job => ['inspection', 'in-progress', 'testing'].includes(job.status)).length);
    setText('completedCount', technicianJobs.filter(job => job.status === 'completed').length);
    setText('technicianQueueBadge', `${queueJobs.length} in queue`);
}

function renderAssignedJobs() {
    const list = document.getElementById('technicianRequestList');
    if (!list) return;

    const openJobs = technicianJobs.filter(job => job.status !== 'completed');
    if (!openJobs.length) {
        list.innerHTML = `
            <article class="maintenance-work-card">
                <div class="maintenance-work-info">
                    <span class="request-code">No active jobs</span>
                    <h3>Technician queue is clear</h3>
                    <p>Assigned maintenance requests will appear here after the admin assigns them to you.</p>
                </div>
            </article>
        `;
        return;
    }

    list.innerHTML = openJobs.map(job => `
        <article class="maintenance-work-card">
            <div class="maintenance-work-info">
                <span class="request-code">${job.id}</span>
                <h3>${job.equipment}</h3>
                <p>${job.problem}</p>
                <div class="work-meta">
                    <span>${job.location}</span>
                    <span>Assigned: ${job.assignedTo}</span>
                    <span class="badge ${job.priority}">${capitalize(job.priority)}</span>
                    <span class="status-pill ${job.status}">${formatStatus(job.status)}</span>
                </div>
            </div>
            <div class="technician-card-actions">
                <button type="button" class="btn btn-primary" data-open-job="${job.id}">Check Details</button>
                <button type="button" class="btn btn-cancel" data-start-job="${job.id}">Start Repair</button>
                <button type="button" class="btn btn-success" data-complete-job="${job.id}">Complete</button>
            </div>
        </article>
    `).join('');

    document.querySelectorAll('[data-open-job]').forEach(button => {
        button.addEventListener('click', () => {
            setActiveJob(button.dataset.openJob);
            showTechnicianSection('problemDetails');
        });
    });

    document.querySelectorAll('[data-start-job]').forEach(button => {
        button.addEventListener('click', async () => {
            setActiveJob(button.dataset.startJob);
            const job = getActiveJob();
            if (job && ['approved', 'assigned'].includes(job.status)) {
                await saveJobUpdate(job, {
                    status: 'inspection',
                    note: 'Technician started inspection from queue.'
                });
            }
            showTechnicianSection('repairWork');
        });
    });

    document.querySelectorAll('[data-complete-job]').forEach(button => {
        button.addEventListener('click', async () => {
            setActiveJob(button.dataset.completeJob);
            await completeActiveJob();
        });
    });
}

function renderRequestSelector() {
    const select = document.getElementById('technicianRequestSelect');
    if (!select) return;

    select.innerHTML = technicianJobs.map(job => (
        `<option value="${job.id}" ${job.id === activeJobId ? 'selected' : ''}>${job.id} - ${job.equipment}</option>`
    )).join('');

    if (!technicianJobs.length) {
        select.innerHTML = '<option value="">No assigned requests</option>';
        select.onchange = null;
        return;
    }

    select.onchange = () => {
        setActiveJob(select.value);
    };
}

function renderProblemDetails() {
    const panel = document.getElementById('technicianDetailPanel');
    const job = getActiveJob();
    if (!panel) return;
    if (!job) {
        panel.innerHTML = `
            <div class="technician-problem-box">
                <h3>No assigned request selected</h3>
                <p>Assigned maintenance requests will appear here after the admin assigns work to a technician.</p>
            </div>
        `;
        return;
    }

    panel.innerHTML = `
        <div class="technician-detail-grid">
            <article><span>Request</span><strong>${job.id}</strong></article>
            <article><span>Equipment</span><strong>${job.equipment}</strong></article>
            <article><span>Location</span><strong>${job.location}</strong></article>
            <article><span>Reported By</span><strong>${job.reportedBy}</strong></article>
            <article><span>Assigned To</span><strong>${job.assignedTo}</strong></article>
            <article><span>Priority</span><strong>${capitalize(job.priority)}</strong></article>
            <article><span>Status</span><strong>${formatStatus(job.status)}</strong></article>
        </div>
        <div class="technician-problem-box">
            <h3>Problem Description</h3>
            <p>${job.problem}</p>
            ${job.photoName ? `<p><strong>Uploaded Photo:</strong> ${job.photoName}</p>` : ''}
        </div>
    `;
}

function renderRepairForm() {
    const job = getActiveJob();
    if (!job) {
        setText('activeRepairCode', 'No job selected');
        return;
    }

    setText('activeRepairCode', `${job.id} - ${job.equipment}`);
    document.getElementById('repairStatus').value = job.status;
    document.getElementById('partsUsed').value = job.parts || '';
    document.getElementById('repairAction').value = job.repairSummary || '';
}

function setupRepairForms() {
    const repairForm = document.getElementById('repairWorkForm');
    const notesForm = document.getElementById('repairNotesForm');
    const completeButton = document.getElementById('markCompleteBtn');

    repairForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const job = getActiveJob();
        if (!job) return;

        const nextStatus = document.getElementById('repairStatus').value;
        await saveJobUpdate(job, {
            status: nextStatus,
            partsUsed: document.getElementById('partsUsed').value.trim(),
            repairSummary: document.getElementById('repairAction').value.trim(),
            note: `Status updated to ${formatStatus(nextStatus)}.`
        });

        renderTechnicianDashboard();
        showNotification('Repair status updated', 'success');
    });

    completeButton?.addEventListener('click', async () => {
        await completeActiveJob();
    });

    notesForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const noteInput = document.getElementById('repairNoteText');
        const note = noteInput.value.trim();
        const job = getActiveJob();

        if (!note || !job) {
            showNotification('Please add a repair note', 'warning');
            return;
        }

        await saveJobUpdate(job, { note });
        noteInput.value = '';
        renderRepairNotes();
        showNotification('Repair note added', 'success');
    });
}

function renderRepairNotes() {
    const list = document.getElementById('repairNotesList');
    const job = getActiveJob();
    if (!list || !job) return;

    list.innerHTML = job.notes.map((note, index) => `
        <article class="notification-item">
            <div><h3>${job.id} note ${job.notes.length - index}</h3><p>${note}</p></div>
            <span>${index === 0 ? 'Latest' : 'Saved'}</span>
        </article>
    `).join('');
}

function renderCompletedWork() {
    const tbody = document.getElementById('completedWorkBody');
    const completed = technicianJobs.filter(job => job.status === 'completed');
    if (!tbody) return;

    tbody.innerHTML = completed.map(job => `
        <tr>
            <td>${job.id}</td>
            <td>${job.equipment}</td>
            <td>${job.repairSummary || 'Repair completed.'}</td>
            <td>${formatDate(job.completedDate || getToday())}</td>
        </tr>
    `).join('');

    setText('completedWorkBadge', `${completed.length} closed`);
}

function getActiveJob() {
    return technicianJobs.find(job => job.id === activeJobId);
}

function setActiveJob(jobId) {
    activeJobId = jobId;
    renderTechnicianDashboard();
}

function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
}

function formatStatus(status) {
    return status.replace(/-/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function getToday() {
    return new Date().toISOString().slice(0, 10);
}

async function updateJobApi(id, payload) {
    try {
        const response = await fetch(`/requests/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Request update failed');
        return await response.json();
    } catch (error) {
        console.error('Technician request update failed:', error);
        showNotification('Could not save this update to the database', 'error');
        return null;
    }
}

async function saveJobUpdate(job, payload) {
    const nextStatus = payload.status || job.status;
    const note = payload.note || '';

    job.status = nextStatus;
    if (payload.partsUsed !== undefined) job.parts = payload.partsUsed;
    if (payload.repairSummary !== undefined) job.repairSummary = payload.repairSummary;
    if (note) job.notes.unshift(note);
    if (nextStatus === 'completed') job.completedDate = getToday();

    await updateJobApi(job.id, payload);
    renderTechnicianDashboard();
}

async function completeActiveJob() {
    const job = getActiveJob();
    if (!job) return;

    await saveJobUpdate(job, {
        status: 'completed',
        partsUsed: document.getElementById('partsUsed')?.value.trim() || job.parts,
        repairSummary: document.getElementById('repairAction')?.value.trim() || job.repairSummary || 'Repair completed and equipment tested.',
        note: 'Work marked as completed.'
    });

    showTechnicianSection('completedWork');
    showNotification(`${job.id} marked completed`, 'success');
}

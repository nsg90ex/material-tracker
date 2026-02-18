/* Material Tracker - Main Application Logic */

// Configuration - Will be set from environment variables
const CONFIG = {
    // These will be populated from Netlify environment variables
    AIRTABLE_BASE_ID: '',
    AIRTABLE_API_KEY: '',
    AIRTABLE_TABLE_NAME: 'Requests'
};

// State
let currentUser = null;
let selectedRequestId = null;
let isStoreManager = false;

// DOM Elements
const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const userEmail = document.getElementById('user-email');
const userRole = document.getElementById('user-role');
const requestsList = document.getElementById('requests-list');
const manageList = document.getElementById('manage-list');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    // Set today's date in the form
    document.getElementById('request-date').value = new Date().toISOString().split('T')[0];

    // Initialize Netlify Identity
    netlifyIdentity.on('init', (user) => {
        if (user) {
            handleLogin(user);
        } else {
            showLoginScreen();
        }
    });

    netlifyIdentity.on('login', (user) => {
        handleLogin(user);
    });

    netlifyIdentity.on('logout', () => {
        handleLogout();
    });

    // Initialize Netlify Identity
    netlifyIdentity.init();
});

// Handle Login
function handleLogin(user) {
    currentUser = user;
    userEmail.textContent = user.email;

    // Check if store manager (you can customize this logic)
    // For now, store managers are emails containing "store" or "manager"
    isStoreManager = user.email.toLowerCase().includes('store') || 
                     user.email.toLowerCase().includes('manager');

    if (isStoreManager) {
        userRole.textContent = 'Store Manager';
        document.querySelectorAll('.store-only').forEach(el => el.classList.remove('hidden'));
    } else {
        userRole.textContent = 'Requester';
    }

    showAppScreen();
    loadRequests();
}

// Handle Logout
function handleLogout() {
    currentUser = null;
    selectedRequestId = null;
    isStoreManager = false;
    showLoginScreen();
}

function logout() {
    netlifyIdentity.logout();
}

// Screen Management
function showLoginScreen() {
    loginSection.classList.remove('hidden');
    appSection.classList.add('hidden');
}

function showAppScreen() {
    loginSection.classList.add('hidden');
    appSection.classList.remove('hidden');
}

// Tab Navigation
function showTab(tabName) {
    // Update nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });

    if (tabName === 'requests') {
        document.getElementById('requests-tab').classList.remove('hidden');
        loadRequests();
    } else if (tabName === 'new-request') {
        document.getElementById('new-request-tab').classList.remove('hidden');
    } else if (tabName === 'manage') {
        document.getElementById('manage-tab').classList.remove('hidden');
        loadRequests('manage');
    }
}

// Load Requests from Airtable via Netlify Function
async function loadRequests(mode = 'view') {
    const listContainer = mode === 'manage' ? manageList : requestsList;
    const statusFilter = document.getElementById('status-filter')?.value || '';

    listContainer.innerHTML = '<div class="loading">Loading requests...</div>';

    try {
        const response = await fetch('/.netlify/functions/get-requests', {
            method: 'POST',
            body: JSON.stringify({ 
                status: statusFilter,
                userEmail: currentUser?.email 
            })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch requests');
        }

        const requests = await response.json();

        if (requests.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <h3>No requests found</h3>
                    <p>${statusFilter ? 'No requests with status: ' + statusFilter : 'Create your first request to get started'}</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = requests.map(request => renderRequestCard(request, mode)).join('');
    } catch (error) {
        console.error('Error loading requests:', error);
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <h3>Error loading requests</h3>
                <p>${error.message}</p>
                <button onclick="loadRequests('${mode}')" class="btn-primary" style="margin-top: 16px;">Try Again</button>
            </div>
        `;
    }
}

// Render Request Card
function renderRequestCard(request, mode) {
    const imageHtml = request.imageUrl ? 
        `<img src="${request.imageUrl}" alt="Part image" class="request-image" onclick="window.open('${request.imageUrl}', '_blank')">` : 
        '';

    const statusClass = {
        'Requested': 'status-requested',
        'Ordered': 'status-ordered',
        'In stock': 'status-in-stock'
    }[request.status] || 'status-requested';

    const updateButton = (mode === 'manage' && isStoreManager) ? 
        `<button onclick="openStatusModal('${request.id}', '${request.partName}', '${request.status}')" class="update-btn">Update Status</button>` :
        '';

    return `
        <div class="request-card">
            <div class="request-header">
                <div class="request-title">${escapeHtml(request.partName)}</div>
                <div class="request-meta">
                    <span class="status-badge ${statusClass}">${request.status}</span>
                    <span class="request-date">📅 ${formatDate(request.requestDate)}</span>
                </div>
            </div>
            <div class="request-body">
                <div class="request-details">
                    ${request.size ? `<p><span class="label">Size:</span> <span class="value">${escapeHtml(request.size)}</span></p>` : ''}
                    ${request.description ? `<p><span class="label">Description:</span> <span class="value">${escapeHtml(request.description)}</span></p>` : ''}
                </div>
                ${imageHtml}
            </div>
            <div class="request-footer">
                <span class="requested-by">Requested by: ${escapeHtml(request.requestedBy)}</span>
                ${updateButton}
            </div>
        </div>
    `;
}

// Submit New Request
async function submitRequest(event) {
    event.preventDefault();

    const partName = document.getElementById('part-name').value;
    const size = document.getElementById('part-size').value;
    const description = document.getElementById('part-description').value;
    const requestDate = document.getElementById('request-date').value;
    const imageFile = document.getElementById('part-image').files[0];

    if (!partName) {
        showNotification('Part name is required', 'error');
        return;
    }

    showNotification('Submitting request...', 'info');

    try {
        // Handle image upload first if exists
        let imageUrl = '';
        if (imageFile) {
            const imageBase64 = await fileToBase64(imageFile);
            const uploadResponse = await fetch('/.netlify/functions/upload-image', {
                method: 'POST',
                body: JSON.stringify({ 
                    image: imageBase64,
                    filename: imageFile.name
                })
            });

            if (uploadResponse.ok) {
                const uploadResult = await uploadResponse.json();
                imageUrl = uploadResult.url;
            }
        }

        // Create request record
        const requestData = {
            partName,
            size,
            description,
            requestDate,
            status: 'Requested',
            requestedBy: currentUser?.email || 'Unknown',
            imageUrl
        };

        const response = await fetch('/.netlify/functions/create-request', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error('Failed to create request');
        }

        showNotification('Request created successfully!');

        // Reset form
        document.getElementById('request-form').reset();
        document.getElementById('image-preview').innerHTML = '';
        document.getElementById('request-date').value = new Date().toISOString().split('T')[0];

        // Switch to requests tab
        showTab('requests');
    } catch (error) {
        console.error('Error submitting request:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Image Preview
function previewImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('image-preview');

    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        };
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = '';
    }
}

// Convert file to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Status Modal Functions
function openStatusModal(requestId, partName, currentStatus) {
    selectedRequestId = requestId;
    document.getElementById('modal-request-name').textContent = partName;
    document.getElementById('new-status').value = currentStatus;
    document.getElementById('status-modal').classList.remove('hidden');
}

function closeModal() {
    selectedRequestId = null;
    document.getElementById('status-modal').classList.add('hidden');
}

async function updateStatus() {
    if (!selectedRequestId) return;

    const newStatus = document.getElementById('new-status').value;

    try {
        const response = await fetch('/.netlify/functions/update-status', {
            method: 'POST',
            body: JSON.stringify({ 
                id: selectedRequestId,
                status: newStatus
            })
        });

        if (!response.ok) {
            throw new Error('Failed to update status');
        }

        showNotification(`Status updated to "${newStatus}"`);
        closeModal();
        loadRequests('manage');
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Error: ' + error.message, 'error');
    }
}

// Notification System
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notification-text');

    text.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Utility Functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Close modal on outside click
document.addEventListener('click', (e) => {
    const modal = document.getElementById('status-modal');
    if (e.target === modal) {
        closeModal();
    }
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered:', registration);
            })
            .catch(error => {
                console.log('SW registration failed:', error);
            });
    });
}

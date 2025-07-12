document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.replace('login.html');
        return;
    }

    // Verify admin role
    if (!user.role || user.role.name !== 'admin') {
        console.log('User is not an admin:', user);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.replace('login.html');
        return;
    }

    // Set user name in header
    document.getElementById('userName').textContent = user.name;
    document.getElementById('welcomeName').textContent = user.name;

    // Load initial content (e.g., dashboard)
    await loadContent('dashboard');

    // Setup event listeners
    setupEventListeners();
});

// Utility function to update active class in sidebar
function updateSidebarActive(targetId) {
    document.querySelectorAll('.sidebar-menu li').forEach(item => {
        item.classList.remove('active');
    });
    const targetLink = document.querySelector(`.sidebar-menu a[href="#${targetId}"]`);
    if (targetLink) {
        targetLink.parentElement.classList.add('active');
    }
}

// Function to show/hide content sections
function showContentSection(sectionId) {
    // Hide all sections first
    document.querySelectorAll('.admin-content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show the selected section
    const activeSection = document.getElementById(sectionId + '-content');
    if (activeSection) {
        activeSection.classList.add('active');
    }
}

// Global toast message functions
function showToast(message, type) {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());

    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    // Add toast to document
    document.body.appendChild(toast);

    // Show toast
    setTimeout(() => toast.classList.add('show'), 100);

    // Hide and remove toast
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showSuccess(message) {
    showToast(message, 'success');
}

function showError(message) {
    showToast(message, 'error');
}

async function loadDashboardData() {
    try {
        const token = localStorage.getItem('token');
        const [statsResponse, pendingUsersResponse] = await Promise.all([
            fetch(getApiUrl(config.ENDPOINTS.DASHBOARD.STATS), {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(getApiUrl(config.ENDPOINTS.AUTH.PENDING_USERS), {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!statsResponse.ok || !pendingUsersResponse.ok) {
            const statsError = statsResponse.statusText;
            const pendingUsersError = pendingUsersResponse.statusText;
            throw new Error(`Failed to fetch dashboard data. Stats: ${statsError}, Pending Users: ${pendingUsersError}`);
        }

        const [statsData, pendingUsers] = await Promise.all([
            statsResponse.json(),
            pendingUsersResponse.json()
        ]);

        updateDashboardStats(statsData);
        displayPendingUsers(pendingUsers);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        const dashboardContent = document.getElementById('dashboard-content');
        if (dashboardContent) {
            dashboardContent.innerHTML = `<div class="error-message show" style="text-align: center; padding: 20px;">Failed to load dashboard data. Please ensure the server is running and you have proper permissions. <br>Error: ${error.message}</div>`;
        }
        showError('Failed to load dashboard data');
    }
}

function updateDashboardStats(data) {
    document.getElementById('totalUsers').textContent = data.totalUsers || 0;
    document.getElementById('totalEvents').textContent = data.totalEvents || 0;
    document.getElementById('totalRegistrations').textContent = data.totalRegistrations || 0;
    document.getElementById('pendingApprovals').textContent = data.pendingApprovals || 0;
}

async function handleUserApproval(userId, status) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.USERS.APPROVE(userId)), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to update user status (unknown backend error)');
        }

        await loadDashboardData();
        showSuccess(data.message || `User ${status} successfully`);
    } catch (error) {
        console.error('Error updating user status:', error);
        showError(error.message || 'Failed to update user status (unexpected error)');
    }
}

function displayPendingUsers(users) {
    const pendingUsersList = document.getElementById('pendingUsersList');
    
    if (!users || users.length === 0) {
        pendingUsersList.innerHTML = '<p class="no-pending">No pending approvals</p>';
        return;
    }

    const usersHTML = users.map(user => `
        <div class="approval-item">
            <div class="user-info">
                <h3>${user.name}</h3>
                <p>Role: ${user.role ? user.role.name : 'N/A'}</p>
                <p>Email: ${user.email}</p>
                ${user.coordinationArea ? `<p>Coordination Area: ${user.coordinationArea}</p>` : ''}
                ${user.experience ? `<p>Experience: ${user.experience}</p>` : ''}
                ${user.availability ? `<p>Availability: ${user.availability}</p>` : ''}
                ${user.skills ? `<p>Skills: ${user.skills}</p>` : ''}
            </div>
            <div class="approval-actions">
                <button onclick="handleUserApproval('${user._id}', 'approved')" class="btn-approve">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button onclick="handleUserApproval('${user._id}', 'rejected')" class="btn-reject">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        </div>
    `).join('');

    pendingUsersList.innerHTML = usersHTML;
}

// User Management Functions
async function loadUsersContent() {
    const usersTableBody = document.getElementById('usersTableBody');
    usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading users...</td></tr>';
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.USERS.LIST), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        const users = await response.json();
        renderUsersTable(users);
    } catch (error) {
        console.error('Error loading users:', error);
        usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center error-message">Failed to load users: ${error.message}</td></tr>`;
        showError('Failed to load users.');
    }
}

function renderUsersTable(users) {
    const usersTableBody = document.getElementById('usersTableBody');
    if (!users || users.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="5" class="text-center no-data">No users found.</td></tr>';
        return;
    }
    usersTableBody.innerHTML = users.map(user => `
        <tr>
            <td>${user.name}</td>
            <td>${user.email}</td>
            <td>${user.role ? user.role.name : 'N/A'}</td>
            <td>${user.status}</td>
            <td class="actions">
                <button class="btn-sm btn-info" onclick="editUser('${user._id}')"><i class="fas fa-edit"></i></button>
                <button class="btn-sm btn-danger" onclick="deleteUser('${user._id}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

async function updateUserStatus(userId, status) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.USERS.STATUS(userId)), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update user status');
        }
        showSuccess('User status updated successfully.');
        loadUsersContent(); // Refresh user list
    } catch (error) {
        console.error('Error updating user status:', error);
        showError(error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) {
        return;
    }
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.USERS.DELETE(userId)), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete user');
        }
        showSuccess('User deleted successfully.');
        loadUsersContent(); // Refresh user list
    } catch (error) {
        console.error('Error deleting user:', error);
        showError(error.message);
    }
}

async function editUser(userId) {
    const userRow = document.querySelector(`button[onclick="editUser('${userId}')"]`).closest('tr');
    const name = userRow.cells[0].textContent;
    const email = userRow.cells[1].textContent;
    const currentRole = userRow.cells[2].textContent;

    // Show the modal
    const modal = document.getElementById('editUserModal');
    modal.classList.add('show');
    document.body.classList.add('modal-open');

    // Populate the form fields
    modal.querySelector('#editUserId').value = userId;
    modal.querySelector('#editUserName').value = name;
    modal.querySelector('#editUserEmail').value = email;
    
    // Fetch and populate roles
    const roleSelect = modal.querySelector('#editUserRole');
    roleSelect.innerHTML = '<option>Loading roles...</option>';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.LIST), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch roles');
        
        const roles = await response.json();
        roleSelect.innerHTML = ''; // Clear loading message
        
        roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.name;
            option.textContent = role.name;
            if (role.name === currentRole) {
                option.selected = true;
            }
            roleSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching roles:', error);
        roleSelect.innerHTML = `<option value="${currentRole}" selected>Failed to load roles</option>`;
        showError('Could not load roles for the dropdown.');
    }
}

async function updateUser(userId, userData) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.USERS.UPDATE(userId)), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update user');
        }

        showSuccess('User updated successfully.');
        closeUserModal();
        loadUsersContent(); // Refresh user list
    } catch (error) {
        console.error('Error updating user:', error);
        showError(error.message);
    }
}

function closeUserModal() {
    const modal = document.getElementById('editUserModal');
    modal.classList.remove('show');
    document.body.classList.remove('modal-open');
}

// Role and Permission Management Functions
async function fetchPermissionsAndMatrix() {
    const rolesMatrixContainer = document.getElementById('rolesMatrixContainer');
    rolesMatrixContainer.innerHTML = '<p class="text-center">Loading roles and permissions...</p>';
    try {
        const token = localStorage.getItem('token');
        const [rolesResponse, permissionsResponse] = await Promise.all([
            fetch(getApiUrl(config.ENDPOINTS.ROLES.LIST), { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(getApiUrl(config.ENDPOINTS.PERMISSIONS.LIST), { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!rolesResponse.ok || !permissionsResponse.ok) {
            const errorText = await (rolesResponse.ok ? permissionsResponse : rolesResponse).text();
            throw new Error(`Failed to fetch roles or permissions: ${errorText}`);
        }

        const roles = await rolesResponse.json();
        const permissions = await permissionsResponse.json();

        renderPermissionsMatrix(roles, permissions);
    } catch (error) {
        console.error('Error fetching roles and permissions:', error);
        rolesMatrixContainer.innerHTML = `<div class="error-message show" style="text-align: center; padding: 20px;">Failed to load roles and permissions. <br>Error: ${error.message}</div>`;
        showError('Failed to load roles and permissions.');
    }
}

async function updateRole(roleId, roleData) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.UPDATE(roleId)), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(roleData)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update role');
        }
        showSuccess('Role updated successfully.');
        // No UI refresh here; let the caller handle it
        return true;
    } catch (error) {
        console.error('Error updating role:', error);
        showError(error.message);
        throw error;
    }
}

function renderPermissionsMatrix(roles, permissions) {
    const rolesMatrixContainer = document.getElementById('rolesMatrixContainer');
    if (!roles || roles.length === 0 || !permissions || permissions.length === 0) {
        rolesMatrixContainer.innerHTML = '<p class="no-data">No roles or permissions found.</p>';
        return;
    }

    // Only show the new simplified permissions in this order
    const permissionOrder = [
        { name: 'manage_events', label: 'Manage Events' },
        { name: 'manage_users', label: 'Manage Users' },
        { name: 'assign_volunteers', label: 'Assign Volunteers' },
        { name: 'register_event', label: 'Register Event' },
        { name: 'view_reports', label: 'View Reports' },
        { name: 'view_content', label: 'View Content' }
    ];
    let tableHTML = `
        <table class="permissions-matrix-table">
            <thead>
                <tr>
                    <th>Role</th>
                    ${permissionOrder.map(p => `<th>${p.label}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    roles.forEach(role => {
        tableHTML += `<tr><td>${role.name}</td>`;
        permissionOrder.forEach(pObj => {
            const hasPermission = role.permissions.some(p => p.name === pObj.name);
            tableHTML += `
                <td>
                    <input type="checkbox"
                           data-role-id="${role._id}"
                           data-permission-name="${pObj.name}"
                           ${hasPermission ? 'checked' : ''}
                           onchange="handlePermissionChange(this)">
                </td>
            `;
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `
            </tbody>
        </table>
    `;
    rolesMatrixContainer.innerHTML = tableHTML;
}

function handlePermissionChange(checkbox) {
    const roleId = checkbox.dataset.roleId;
    const permissionName = checkbox.dataset.permissionName;
    const isChecked = checkbox.checked;

    // Fetch the current role data to get its existing permissions
    fetch(getApiUrl(config.ENDPOINTS.ROLES.UPDATE(roleId)), {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(role => {
        let updatedPermissions = role.permissions.map(p => p.name); // Get only permission names

        if (isChecked) {
            if (!updatedPermissions.includes(permissionName)) {
                updatedPermissions.push(permissionName);
            }
        } else {
            updatedPermissions = updatedPermissions.filter(p => p !== permissionName);
        }
        // Find the full permission objects for the update
        fetch(getApiUrl(config.ENDPOINTS.PERMISSIONS.LIST), { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
            .then(res => res.json())
            .then(allAvailablePermissions => {
                const fullPermissionsForUpdate = allAvailablePermissions.filter(p => updatedPermissions.includes(p.name));
                const permissionIdsForUpdate = fullPermissionsForUpdate.map(p => p._id);
                updateRole(roleId, { permissions: permissionIdsForUpdate })
                    .then(() => {
                        fetchPermissionsAndMatrix(); // Refresh the table after update
                    })
                    .catch(error => {
                        console.error('Error updating role:', error);
                        showError('Failed to update permission: Could not update role.');
                        checkbox.checked = !isChecked; // Revert checkbox state on error
                    });
            })
            .catch(error => {
                console.error('Error fetching all permissions:', error);
                showError('Failed to update permission: Could not retrieve all permissions.');
                checkbox.checked = !isChecked; // Revert checkbox state on error
            });
    })
    .catch(error => {
        console.error('Error fetching role for permission update:', error);
        showError('Failed to update permission: Could not retrieve role data.');
        checkbox.checked = !isChecked; // Revert checkbox state on error
    });
}

// Event Management Functions
async function loadEventsContent() {
    const eventsListContainer = document.getElementById('eventsListContainer');
    eventsListContainer.innerHTML = '<p class="text-center">Loading events...</p>';
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.LIST), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }
        const events = await response.json();
        renderEventsList(events);
    } catch (error) {
        console.error('Error loading events:', error);
        eventsListContainer.innerHTML = `<div class="error-message show" style="text-align: center; padding: 20px;">Failed to load events: ${error.message}</div>`;
        showError('Failed to load events.');
    }
}

function renderEventsList(events) {
    const eventsListContainer = document.getElementById('eventsListContainer');
    if (!events || events.length === 0) {
        eventsListContainer.innerHTML = '<p class="no-data">No events found.</p>';
        return;
    }

    eventsListContainer.innerHTML = events.map(event => `
        <div class="event-card">
            ${event.imageUrl ? `<img src="${event.imageUrl}" alt="${event.title}" class="event-card-image">` : `<img src="https://via.placeholder.com/150" alt="Placeholder" class="event-card-image">`}
            <div class="event-card-content">
                <div class="event-header">
                    <h3>${event.title}</h3>
                    <div class="event-badge">${new Date(event.date) > new Date() ? 'Upcoming' : 'Ongoing'}</div>
                </div>
                <div class="event-details">
                    <p><i class="fas fa-calendar"></i> ${new Date(event.date).toLocaleDateString()}</p>
                    <p><i class="fas fa-clock"></i> ${event.time || 'N/A'}</p>
                    <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                </div>
                <div class="event-description">
                    <p>${event.description}</p>
                </div>
                ${event.qrCode ? `<div class="event-qr"><img src="${event.qrCode}" alt="QR Code for registration" style="width:120px;height:120px;margin-top:10px;"/></div>` : ''}
                <div class="event-footer">
                    <button onclick="editEvent('${event._id}')" class="btn btn-info btn-sm">Edit</button>
                    <button onclick="deleteEvent('${event._id}')" class="btn btn-danger btn-sm">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function editEvent(eventId) {
    // Fetch event data and open modal
    fetchEventData(eventId);
}

async function fetchEventData(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.UPDATE(eventId)), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch event data');
        }
        
        const event = await response.json();
        openEditModal(event);
    } catch (error) {
        console.error('Error fetching event data:', error);
        showError('Failed to load event data for editing');
    }
}

function openEditModal(event) {
    document.body.classList.add('modal-open');
    // Populate form fields with existing event data
    document.getElementById('editTitle').value = event.title || '';
    document.getElementById('editDescription').value = event.description || '';
    // Format date for input field (YYYY-MM-DD)
    const eventDate = new Date(event.date);
    const formattedDate = eventDate.toISOString().split('T')[0];
    document.getElementById('editDate').value = formattedDate;
    document.getElementById('editTime').value = event.time || '';
    document.getElementById('editLocation').value = event.location || '';
    document.getElementById('editCapacity').value = event.capacity || '';
    document.getElementById('editOrganizer').value = event.organizer || '';
    document.getElementById('editPrice').value = event.price || 0;
    document.getElementById('editImageUrl').value = event.imageUrl || '';
    // Populate coordinator dropdown
    const coordinatorSelect = document.getElementById('editCoordinator');
    if (coordinatorSelect) {
        coordinatorSelect.innerHTML = '<option value="">Unassigned</option>';
        // Fetch coordinators
        fetch(getApiUrl(config.ENDPOINTS.USERS.LIST), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(res => res.json())
        .then(users => {
            const coordinators = users.filter(u => u.role && (u.role.name === 'coordinator'));
            if (coordinators.length === 0) {
                coordinatorSelect.innerHTML = '<option value="">No coordinators available</option>';
                coordinatorSelect.disabled = true;
            } else {
                coordinators.forEach(user => {
                    const option = document.createElement('option');
                    option.value = user._id || user.id;
                    option.textContent = user.name + ' (' + user.email + ')';
                    if ((event.coordinator && (user._id === event.coordinator || user.id === event.coordinator)) || (event.coordinator && event.coordinator._id && user._id === event.coordinator._id)) {
                        option.selected = true;
                    }
                    coordinatorSelect.appendChild(option);
                });
                coordinatorSelect.disabled = false;
            }
        })
        .catch(() => {
            coordinatorSelect.innerHTML = '<option value="">Failed to load coordinators</option>';
            coordinatorSelect.disabled = true;
        });
    }
    // Store event ID for form submission
    document.getElementById('editEventForm').dataset.eventId = event._id;
    // Show modal
    document.getElementById('editEventModal').classList.add('show');
}

function closeEditModal() {
    document.body.classList.remove('modal-open');
    document.getElementById('editEventModal').classList.remove('show');
    document.getElementById('editEventForm').reset();
    delete document.getElementById('editEventForm').dataset.eventId;
}

async function updateEvent(eventId, eventData) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.UPDATE(eventId)), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update event');
        }
        
        showSuccess('Event updated successfully.');
        closeEditModal();
        loadEventsContent(); // Refresh event list
    } catch (error) {
        console.error('Error updating event:', error);
        showError(error.message);
    }
}

async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) {
        return;
    }
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.DELETE(eventId)), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to delete event');
        }
        showSuccess('Event deleted successfully.');
        loadEventsContent(); // Refresh event list
    } catch (error) {
        console.error('Error deleting event:', error);
        showError(error.message);
    }
}


// Centralized function to load content for each section
async function loadContent(section) {
    try {
        // Update sidebar active state
        updateSidebarActive(section);

        // Show the selected content section
        showContentSection(section);

        // Load section-specific content
        switch (section) {
            case 'dashboard':
                await loadDashboardData();
                break;
            case 'users':
                await loadUsersContent();
                break;
            case 'roles':
                await fetchPermissionsAndMatrix();
                break;
            case 'events':
                await loadEventsContent();
                break;
            case 'reports':
                // TODO: Implement reports loading
                break;
            case 'settings':
                await loadPublicRolesSettings();
                break;
            default:
                console.warn(`Unknown section: ${section}`);
        }
    } catch (error) {
        console.error(`Error loading ${section} content:`, error);
        showError(`Failed to load ${section} content`);
    }
}

function setupEventListeners() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    document.querySelectorAll('.sidebar-menu a').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').replace('#', '');
            loadContent(targetId); // Use loadContent to handle everything
        });
    });

    // Edit Event Modal Event Listeners
    const editEventForm = document.getElementById('editEventForm');
    const closeEditModalBtn = document.getElementById('closeEditModal');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    if (editEventForm) {
        editEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const eventId = editEventForm.dataset.eventId;
            if (!eventId) {
                showError('Event ID not found');
                return;
            }
            const formData = new FormData(editEventForm);
            const eventData = Object.fromEntries(formData.entries());
            // Format date for backend
            if (eventData.date) {
                eventData.date = new Date(eventData.date).toISOString();
            }
            // Convert numeric fields
            if (eventData.capacity) {
                eventData.capacity = parseInt(eventData.capacity);
            }
            if (eventData.price) {
                eventData.price = parseFloat(eventData.price);
            }
            // Add coordinator field
            if (eventData.coordinator === '') {
                eventData.coordinator = null;
            }
            await updateEvent(eventId, eventData);
        });
    }

    if (closeEditModalBtn) {
        closeEditModalBtn.addEventListener('click', closeEditModal);
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditModal);
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('editEventModal');
        if (e.target === modal) {
            closeEditModal();
        }
    });

    // Edit User Modal Event Listeners
    const editUserForm = document.getElementById('editUserForm');
    if (editUserForm) {
        editUserForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const userId = document.getElementById('editUserId').value;
            const userData = {
                name: document.getElementById('editUserName').value,
                email: document.getElementById('editUserEmail').value,
                role: document.getElementById('editUserRole').value,
            };
            updateUser(userId, userData);
        });
    }

    const closeUserModalBtn = document.getElementById('closeUserModal');
    if (closeUserModalBtn) {
        closeUserModalBtn.addEventListener('click', closeUserModal);
    }

    const cancelUserEditBtn = document.getElementById('cancelUserEditBtn');
    if (cancelUserEditBtn) {
        cancelUserEditBtn.addEventListener('click', closeUserModal);
    }
}

// Public Registration Roles Settings Logic
async function loadPublicRolesSettings() {
    const token = localStorage.getItem('token');
    const form = document.getElementById('publicRolesForm');
    const saveMsg = document.getElementById('publicRolesSaveMsg');
    if (!form) return;
    // Fetch current allowed roles
    try {
        const response = await fetch(getApiUrl('/api/dashboard/allowed-public-roles'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch allowed roles');
        const allowedRoles = await response.json();
        // Set checkboxes
        form.querySelectorAll('input[name="publicRole"]').forEach(cb => {
            cb.checked = allowedRoles.includes(cb.value);
        });
    } catch (err) {
        saveMsg.textContent = 'Failed to load roles';
        saveMsg.style.color = 'red';
    }
    // Save handler
    form.onsubmit = async function(e) {
        e.preventDefault();
        const selected = Array.from(form.querySelectorAll('input[name="publicRole"]:checked')).map(cb => cb.value);
        try {
            const response = await fetch(getApiUrl('/api/dashboard/allowed-public-roles'), {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ roles: selected })
            });
            if (!response.ok) throw new Error('Failed to save roles');
            saveMsg.textContent = 'Saved!';
            saveMsg.style.color = 'green';
        } catch (err) {
            saveMsg.textContent = 'Failed to save';
            saveMsg.style.color = 'red';
        }
        setTimeout(() => { saveMsg.textContent = ''; }, 2000);
    };
}
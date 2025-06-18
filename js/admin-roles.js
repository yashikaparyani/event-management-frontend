// client/js/admin-roles.js

const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

// DOM Elements
const rolesList = document.getElementById('rolesList');
const addRoleBtn = document.getElementById('addRoleBtn');
const roleModal = document.getElementById('roleModal');
const roleForm = document.getElementById('roleForm');
const modalTitle = document.getElementById('modalTitle');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelBtn');
const logoutBtn = document.getElementById('logoutBtn');

let currentRoleId = null;
let allPermissions = [];

// Fetch all roles
async function fetchRolesAndMatrix() {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.LIST), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch roles');
        const roles = await response.json();
        displayRoles(roles);
        // Only render matrix if permissions are loaded
        if (allPermissions.length > 0) {
            renderPermissionsMatrix(roles, allPermissions);
        }
    } catch (error) {
        showError('Error fetching roles: ' + error.message);
    }
}

// Fetch all permissions
async function fetchPermissionsAndMatrix() {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.PERMISSIONS.LIST), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch permissions');
        allPermissions = await response.json();
        displayPermissions();
        // Now fetch roles and render matrix
        await fetchRolesAndMatrix();
    } catch (error) {
        showError('Error fetching permissions: ' + error.message);
    }
}

// Display roles in the list
function displayRoles(roles) {
    rolesList.innerHTML = roles.map(role => `
        <div class="role-card">
            <div class="role-header">
                <h3>${role.name}</h3>
                <span class="role-badge ${role.isDefault ? 'default' : ''}">
                    ${role.isDefault ? 'Default' : ''}
                </span>
            </div>
            <p class="role-description">${role.description}</p>
            <div class="role-permissions">
                <h4>Permissions:</h4>
                <ul>
                    ${role.permissions.map(p => `<li>${p.name}</li>`).join('')}
                </ul>
            </div>
            <div class="role-actions">
                <button onclick="editRole('${role._id}')" class="btn-secondary">
                    <i class="fas fa-edit"></i> Edit
                </button>
                ${!role.isDefault ? `
                    <button onclick="deleteRole('${role._id}')" class="btn-danger">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Display permissions in the modal
function displayPermissions() {
    const permissionsGrid = document.getElementById('permissionsGrid');
    const categories = [...new Set(allPermissions.map(p => p.category))];
    
    permissionsGrid.innerHTML = categories.map(category => `
        <div class="permission-category">
            <h4>${category.charAt(0).toUpperCase() + category.slice(1)}</h4>
            <div class="permission-list">
                ${allPermissions
                    .filter(p => p.category === category)
                    .map(p => `
                        <label class="permission-item">
                            <input type="checkbox" name="permissions" value="${p._id}">
                            ${p.name}
                            <span class="permission-description">${p.description}</span>
                        </label>
                    `).join('')}
            </div>
        </div>
    `).join('');
}

// Add new role
async function addRole(roleData) {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.LIST), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(roleData)
        });
        if (!response.ok) throw new Error('Failed to add role');
        await fetchRolesAndMatrix();
        closeModal();
    } catch (error) {
        showError('Error adding role: ' + error.message);
    }
}

// Edit role
async function editRole(roleId) {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.UPDATE(roleId)), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to fetch role');
        const role = await response.json();
        
        currentRoleId = roleId;
        modalTitle.textContent = 'Edit Role';
        document.getElementById('roleName').value = role.name;
        document.getElementById('roleDescription').value = role.description;
        document.getElementById('isDefault').checked = role.isDefault;
        
        // Check the permissions that the role has
        const checkboxes = document.querySelectorAll('input[name="permissions"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = role.permissions.some(p => p._id === checkbox.value);
        });
        
        openModal();
    } catch (error) {
        showError('Error fetching role: ' + error.message);
    }
}

// Update role
async function updateRole(roleId, roleData) {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.UPDATE(roleId)), {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(roleData)
        });
        if (!response.ok) throw new Error('Failed to update role');
        await fetchRolesAndMatrix();
        closeModal();
    } catch (error) {
        showError('Error updating role: ' + error.message);
    }
}

// Delete role
async function deleteRole(roleId) {
    if (!confirm('Are you sure you want to delete this role?')) return;
    
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.DELETE(roleId)), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) throw new Error('Failed to delete role');
        await fetchRolesAndMatrix();
    } catch (error) {
        showError('Error deleting role: ' + error.message);
    }
}

// Modal functions
function openModal() {
    roleModal.classList.add('show');
}

function closeModal() {
    roleModal.classList.remove('show');
    roleForm.reset();
    currentRoleId = null;
    modalTitle.textContent = 'Add New Role';
}

// Event Listeners
addRoleBtn.addEventListener('click', () => {
    currentRoleId = null;
    modalTitle.textContent = 'Add New Role';
    roleForm.reset();
    openModal();
});

closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

roleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const roleData = {
        name: document.getElementById('roleName').value,
        description: document.getElementById('roleDescription').value,
        isDefault: document.getElementById('isDefault').checked,
        permissions: Array.from(document.querySelectorAll('input[name="permissions"]:checked'))
            .map(checkbox => checkbox.value)
    };
    
    if (currentRoleId) {
        await updateRole(currentRoleId, roleData);
    } else {
        await addRole(roleData);
    }
});

logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    window.location.href = 'login.html';
});

// Utility functions
function showError(message) {
    alert(message); // Replace with a better UI notification
}

// --- Permissions Matrix Logic ---
function renderPermissionsMatrix(roles, permissions) {
    const container = document.getElementById('rolesMatrixContainer');
    if (!container) return;

    // Build table header
    let table = `<table class="permissions-matrix-table">
        <thead>
            <tr>
                <th>Role</th>`;
    permissions.forEach(perm => {
        table += `<th title="${perm.description}">${perm.name}</th>`;
    });
    table += `<th>Save</th></tr></thead><tbody>`;

    // Build table rows
    roles.forEach(role => {
        table += `<tr data-role-id="${role._id}">
            <td><strong>${role.name}</strong></td>`;
        permissions.forEach(perm => {
            const hasPerm = role.permissions.some(p => p._id === perm._id);
            table += `<td><input type="checkbox" class="perm-checkbox" data-role="${role._id}" data-perm="${perm._id}" ${hasPerm ? 'checked' : ''} ${role.isDefault ? 'disabled' : ''}></td>`;
        });
        table += `<td><button class="save-perms-btn" data-role="${role._id}" ${role.isDefault ? 'disabled' : ''}>Save</button></td></tr>`;
    });
    table += '</tbody></table>';
    container.innerHTML = table;

    // Add event listeners for save buttons
    document.querySelectorAll('.save-perms-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const roleId = this.getAttribute('data-role');
            const row = this.closest('tr');
            const checkboxes = row.querySelectorAll('.perm-checkbox');
            const selectedPerms = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.getAttribute('data-perm'));
            await updateRole(roleId, { permissions: selectedPerms });
        });
    });
}

// --- Style for matrix table (add to head dynamically for demo) ---
(function addMatrixStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
    .permissions-matrix-table { border-collapse: collapse; width: 100%; margin-top: 2rem; background: #222; color: #fff; }
    .permissions-matrix-table th, .permissions-matrix-table td { border: 1px solid #444; padding: 8px; text-align: center; }
    .permissions-matrix-table th { background: #333; }
    .permissions-matrix-table tr:nth-child(even) { background: #232323; }
    .save-perms-btn { padding: 4px 12px; background: #007bff; color: #fff; border: none; border-radius: 3px; cursor: pointer; }
    .save-perms-btn:disabled { background: #555; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
})();

// Initialize
fetchRolesAndMatrix();
fetchPermissionsAndMatrix(); 
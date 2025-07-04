// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    if (user.role.name !== 'admin') {
        window.location.href = 'home.html';
        return;
    }

    // Initialize dashboard
    loadContent('dashboard');
});

// Function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return {};
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Handle API response
async function handleApiResponse(response) {
    if (!response.ok) {
        const error = await response.json();
        if (error.code === 'TOKEN_EXPIRED' || response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
            return;
        }
        throw new Error(error.message || 'API request failed');
    }
    return response.json();
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const [statsResponse, pendingResponse] = await Promise.all([
            fetch('https://event-management-backend-z0ty.onrender.com/api/dashboard/stats', {
                headers: getAuthHeaders()
            }),
            fetch('https://event-management-backend-z0ty.onrender.com/api/pending-users', {
                headers: getAuthHeaders()
            })
        ]);

        const stats = await handleApiResponse(statsResponse);
        const pendingUsers = await handleApiResponse(pendingResponse);

        // Update dashboard stats
        document.getElementById('totalUsers').textContent = stats.totalUsers;
        document.getElementById('pendingApprovals').textContent = stats.pendingApprovals;
        document.getElementById('totalEvents').textContent = stats.totalEvents;
        document.getElementById('totalRegistrations').textContent = stats.totalRegistrations;

        // Update pending users list
        const pendingList = document.getElementById('pendingUsersList');
        if (pendingUsers.length === 0) {
            pendingList.innerHTML = '<p>No pending approvals</p>';
        } else {
            pendingList.innerHTML = pendingUsers.map(user => `
                <div class="pending-user">
                    <div class="user-info">
                        <h4>${user.name}</h4>
                        <p>${user.email}</p>
                        <p>Role: ${user.role.name}</p>
                    </div>
                    <div class="user-actions">
                        <button onclick="approveUser('${user._id}')" class="btn-approve">
                            <i class="fas fa-check"></i> Approve
                        </button>
                        <button onclick="rejectUser('${user._id}')" class="btn-reject">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Error loading dashboard data: ' + error.message);
    }
}

function renderPermissionsMatrix(roles, permissions) {
    console.log("DEBUG: roles", roles);
    console.log("DEBUG: permissions", permissions);
    // ...rest of your code
} 
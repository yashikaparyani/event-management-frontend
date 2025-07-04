// client/js/admin-create.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('login.html');
        return;
    }

    const roleSelect = document.getElementById('role');
    const conditionalFieldsDiv = document.getElementById('conditionalFields');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    // Function to fetch roles and populate the dropdown
    async function fetchRoles() {
        try {
            const response = await fetch(getApiUrl(config.ENDPOINTS.ROLES.LIST), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error('Failed to fetch roles');
            }
            const roles = await response.json();
            roleSelect.innerHTML = '<option value="">Select a role</option>';
            roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role.name;
                option.textContent = role.name.charAt(0).toUpperCase() + role.name.slice(1);
                roleSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error fetching roles:', error);
            errorMsg.textContent = error.message || 'Failed to load roles.';
            errorMsg.classList.add('show');
        }
    }

    // Function to render conditional fields based on selected role
    function renderConditionalFields(selectedRole) {
        conditionalFieldsDiv.innerHTML = ''; // Clear previous fields
        switch (selectedRole) {
            case 'participant':
                conditionalFieldsDiv.innerHTML = `
                    <div class="form-group">
                        <label for="eventInterest">Event Interest</label>
                        <input type="text" id="eventInterest" name="eventInterest" placeholder="e.g., Tech Conferences, Music Festivals">
                    </div>
                `;
                break;
            case 'coordinator':
                conditionalFieldsDiv.innerHTML = `
                    <div class="form-group">
                        <label for="coordinationArea">Coordination Area</label>
                        <input type="text" id="coordinationArea" name="coordinationArea" placeholder="e.g., Venue Management, Volunteer Lead">
                    </div>
                `;
                break;
            case 'volunteer':
                conditionalFieldsDiv.innerHTML = `
                    <div class="form-group">
                        <label for="availability">Availability</label>
                        <input type="text" id="availability" name="availability" placeholder="e.g., Weekends, Evenings">
                    </div>
                    <div class="form-group">
                        <label for="skills">Skills</label>
                        <input type="text" id="skills" name="skills" placeholder="e.g., First Aid, Photography">
                    </div>
                `;
                break;
            // No conditional fields for admin or audience
            default:
                break;
        }
    }

    // Event listener for role selection change
    roleSelect.addEventListener('change', (e) => {
        renderConditionalFields(e.target.value);
    });

    // Handle form submission
    document.getElementById('createUserForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';
        errorMsg.classList.remove('show');
        successMsg.textContent = '';
        successMsg.classList.remove('show');

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const role = roleSelect.value;

        if (password !== confirmPassword) {
            errorMsg.textContent = 'Passwords do not match.';
            errorMsg.classList.add('show');
            return;
        }

        if (password.length < 8) {
            errorMsg.textContent = 'Password must be at least 8 characters long.';
            errorMsg.classList.add('show');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            errorMsg.textContent = 'Please enter a valid email address.';
            errorMsg.classList.add('show');
            return;
        }

        const formData = {
            name,
            email,
            password,
            role
        };

        // Add conditional fields data
        if (role === 'participant') {
            formData.eventInterest = document.getElementById('eventInterest').value;
        } else if (role === 'coordinator') {
            formData.coordinationArea = document.getElementById('coordinationArea').value;
        } else if (role === 'volunteer') {
            formData.availability = document.getElementById('availability').value;
            formData.skills = document.getElementById('skills').value;
        }

        try {
            const response = await fetch(getApiUrl(config.ENDPOINTS.USERS.LIST), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.status === 401) {
                // Token expired or invalid
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.replace('login.html');
                return;
            }

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create user');
            }

            successMsg.textContent = 'User created successfully!';
            successMsg.classList.add('show');
            document.getElementById('createUserForm').reset(); // Clear form
            renderConditionalFields(''); // Clear conditional fields

            // Optional: refresh user list in admin dashboard if still on that page
            if (window.location.pathname.includes('admin-dashboard.html')) {
                // This part would ideally trigger a refresh of the users table in admin-dashboard.js
                // For now, it clears the form. A full refresh of the admin-dashboard page would show new users.
            }

        } catch (error) {
            console.error('Error creating user:', error);
            errorMsg.textContent = error.message || 'Failed to create user. Please try again.';
            errorMsg.classList.add('show');
        }
    });

    // Initial fetch of roles
    fetchRoles();
}); 
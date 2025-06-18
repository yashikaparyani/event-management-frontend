document.addEventListener('DOMContentLoaded', () => {
    const roleSelect = document.getElementById('role');
    const participantFields = document.getElementById('participantFields');
    const coordinatorFields = document.getElementById('coordinatorFields');
    const volunteerFields = document.getElementById('volunteerFields');
    const registerForm = document.getElementById('registerForm');
    const errorMsg = document.getElementById('errorMsg');

    // Handle role selection
    roleSelect.addEventListener('change', () => {
        // Hide all role-specific fields
        participantFields.classList.remove('show');
        coordinatorFields.classList.remove('show');
        volunteerFields.classList.remove('show');

        // Show fields based on selected role
        switch (roleSelect.value) {
            case 'participant':
                participantFields.classList.add('show');
                break;
            case 'coordinator':
                coordinatorFields.classList.add('show');
                break;
            case 'volunteer':
                volunteerFields.classList.add('show');
                break;
        }
    });

    // Helper function to show messages
    function showMessage(message, isError = true) {
        errorMsg.textContent = message;
        errorMsg.className = isError ? 'error-message show' : 'success-message show';
        errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Helper function to redirect to appropriate dashboard
    function redirectToDashboard(roleName) {
        console.log('Redirecting to dashboard for role:', roleName);
        let redirectUrl = '';
        
        switch(roleName) {
            case 'admin':
                redirectUrl = 'admin-dashboard.html';
                break;
            case 'coordinator':
                redirectUrl = 'coordinator-dashboard.html';
                break;
            case 'participant':
                redirectUrl = 'participant-dashboard.html';
                break;
            case 'volunteer':
                redirectUrl = 'volunteer-dashboard.html';
                break;
            case 'audience':
                redirectUrl = 'audience-dashboard.html';
                break;
            default:
                redirectUrl = 'home.html';
        }
        
        console.log('Performing redirect to:', redirectUrl);
        window.location.replace(redirectUrl);
    }

    // Handle form submission
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';
        errorMsg.className = 'error-message';

        const submitButton = registerForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        submitButton.disabled = true;

        try {
            // Get form data
            const formData = {
                name: document.getElementById('name').value.trim(),
                email: document.getElementById('email').value.trim(),
                password: document.getElementById('password').value,
                role: roleSelect.value
            };

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) {
                showMessage('Please enter a valid email address');
                return;
            }

            // Validate password
            if (formData.password.length < 6) {
                showMessage('Password must be at least 6 characters long');
                return;
            }

            // Add role-specific data
            switch (formData.role) {
                case 'participant':
                    formData.eventInterest = document.getElementById('eventInterest').value.trim();
                    break;
                case 'coordinator':
                    formData.coordinationArea = document.getElementById('coordinationArea').value.trim();
                    formData.experience = document.getElementById('experience').value.trim();
                    break;
                case 'volunteer':
                    formData.availability = document.getElementById('availability').value.trim();
                    formData.skills = document.getElementById('skills').value.trim();
                    break;
            }

            console.log('Sending registration data:', formData);

            const response = await fetch(getApiUrl(config.ENDPOINTS.AUTH.REGISTER), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            console.log('Registration response status:', response.status);
            const result = await response.json();
            console.log('Registration response:', result);

            if (!response.ok) {
                // Handle specific error cases
                switch (response.status) {
                    case 409:
                        throw new Error('An account with this email already exists. Please login or use a different email.');
                    case 400:
                        throw new Error(result.message || 'Invalid registration data. Please check your inputs.');
                    case 500:
                        throw new Error('Server error. Please try again later.');
                    default:
                        throw new Error(result.message || 'Registration failed');
                }
            }

            // Handle successful registration - redirect all users to login page
            showMessage('Registration successful! Please login to continue.', false);
            
            // Clear any potential login state and redirect to login
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            setTimeout(() => {
                window.location.replace('login.html');
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);
            showMessage(error.message || 'Registration failed. Please try again.');
        } finally {
            submitButton.innerHTML = originalButtonText;
            submitButton.disabled = false;
            // Also ensure any messages are hidden in finally block after processing
            errorMsg.classList.remove('show');
            errorMsg.textContent = '';
        }
    });
}); 
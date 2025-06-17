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
        participantFields.style.display = 'none';
        coordinatorFields.style.display = 'none';
        volunteerFields.style.display = 'none';

        // Show fields based on selected role
        switch (roleSelect.value) {
            case 'participant':
                participantFields.style.display = 'block';
                break;
            case 'coordinator':
                coordinatorFields.style.display = 'block';
                break;
            case 'volunteer':
                volunteerFields.style.display = 'block';
                break;
        }
    });

    // Helper function to show messages
    function showMessage(message, isError = true) {
        errorMsg.textContent = message;
        errorMsg.className = isError ? 'error-message show' : 'success-message show';
        errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

            // Show success message based on status
            if (result.status === 'approved') {
                showMessage('Registration successful! Redirecting to login...', false);
                // For approved users, they can go straight to login
                setTimeout(() => {
                    window.location.replace('login.html');
                }, 2000);
            } else {
                showMessage('Registration successful! Your account is pending approval. You will be notified once approved.', false);
                // For pending users, clear any potential partial login state before redirecting to login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                setTimeout(() => {
                    window.location.replace('login.html');
                }, 3000);
            }

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
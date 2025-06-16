// client/js/login.js

// Check if already logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    // Always clear error message on page load
    const errorMsg = document.getElementById('errorMsg');
    if (errorMsg) {
        errorMsg.textContent = '';
        errorMsg.classList.remove('show');
    }

    if (token && user) {
        console.log('Already logged in as:', user.role.name);
        redirectToDashboard(user.role.name);
    }
});

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

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('Login form submitted');
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('errorMsg');
    const submitBtn = e.target.querySelector('button[type="submit"]');

    // Clear previous error message and hide it
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');

    // Validate email format (simple client-side check)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        errorMsg.textContent = 'Please enter a valid email address';
        errorMsg.classList.add('show');
        return;
    }

    // Validate password length (simple client-side check)
    if (password.length < 6) {
        errorMsg.textContent = 'Password must be at least 6 characters long';
        errorMsg.classList.add('show');
        return;
    }

    // Disable button and show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    try {
        console.log('Sending login request to backend...');
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        console.log('Received response status:', response.status);
        const data = await response.json();
        console.log('Response data:', data);

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // Store token and user data in local storage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));

        console.log('Login successful. Initiating redirection...');
        redirectToDashboard(data.user.role.name);

    } catch (error) {
        console.error('Login error:', error);
        errorMsg.textContent = error.message || 'Login failed. Please try again.';
        errorMsg.classList.add('show');
    } finally {
        // Re-enable button and restore original text, and clear error message (if any)
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        // errorMsg.classList.remove('show'); // This line is problematic if client-side validation fails
    }
});

// Helper function to show error messages
function showError(message) {
  const errorMsg = document.getElementById('errorMsg');
  errorMsg.textContent = message;
  errorMsg.classList.add('show');
  
  // Scroll to error message
  errorMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Clear error message when user starts typing in input fields
document.getElementById('email').addEventListener('input', () => {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');
});

document.getElementById('password').addEventListener('input', () => {
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.textContent = '';
    errorMsg.classList.remove('show');
});

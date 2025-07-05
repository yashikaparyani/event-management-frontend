document.addEventListener('DOMContentLoaded', async function() {
    // Fetch allowed public registration roles
    try {
        const response = await fetch(getApiUrl('/api/dashboard/allowed-public-roles'));
        if (response.ok) {
            const allowedRoles = await response.json();
            const roleToggle = document.getElementById('roleToggle');
            const participantLabel = document.getElementById('participantLabel');
            const audienceLabel = document.getElementById('audienceLabel');
            const roleDropdownGroup = document.getElementById('roleDropdownGroup');
            const roleDropdown = document.getElementById('roleDropdown');
            const conditionalFieldsDiv = document.getElementById('conditionalFields');

            // Check if only participant and audience are enabled
            const onlyParticipantAudience = allowedRoles.length === 2 && allowedRoles.includes('participant') && allowedRoles.includes('audience');
            const hasOtherRoles = allowedRoles.includes('coordinator') || allowedRoles.includes('volunteer');

            if (onlyParticipantAudience && !hasOtherRoles) {
                // Show toggle, hide dropdown
                if (roleToggle && roleToggle.parentElement) roleToggle.parentElement.style.display = '';
                if (participantLabel) participantLabel.style.display = '';
                if (audienceLabel) audienceLabel.style.display = '';
                if (roleDropdownGroup) roleDropdownGroup.style.display = 'none';
                // Remove conditional fields if present
                if (conditionalFieldsDiv) conditionalFieldsDiv.innerHTML = '';
            } else {
                // Show dropdown, hide toggle
                if (roleToggle && roleToggle.parentElement) roleToggle.parentElement.style.display = 'none';
                if (participantLabel) participantLabel.style.display = 'none';
                if (audienceLabel) audienceLabel.style.display = 'none';
                if (roleDropdownGroup) roleDropdownGroup.style.display = '';
                if (roleDropdown) {
                    roleDropdown.innerHTML = '<option value="">Select a role</option>';
                    allowedRoles.forEach(role => {
                        const label = role.charAt(0).toUpperCase() + role.slice(1);
                        const option = document.createElement('option');
                        option.value = role;
                        option.textContent = label;
                        roleDropdown.appendChild(option);
                    });
                    // Render conditional fields on change
                    roleDropdown.addEventListener('change', function(e) {
                        renderConditionalFields(e.target.value);
                    });
                }
            }
        }
    } catch (err) {
        // Ignore errors, fallback to default
    }

    function renderConditionalFields(selectedRole) {
        const conditionalFieldsDiv = document.getElementById('conditionalFields');
        if (!conditionalFieldsDiv) return;
        conditionalFieldsDiv.innerHTML = '';
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
            default:
                break;
        }
    }

    // Role toggle
    const roleToggle = document.getElementById('roleToggle');
    const participantLabel = document.getElementById('participantLabel');
    const audienceLabel = document.getElementById('audienceLabel');
    let selectedRole = 'participant';

    function updateRoleLabels() {
        if (roleToggle && participantLabel && audienceLabel) {
            if (roleToggle.checked) {
                participantLabel.classList.remove('active');
                audienceLabel.classList.add('active');
                selectedRole = 'audience';
            } else {
                participantLabel.classList.add('active');
                audienceLabel.classList.remove('active');
                selectedRole = 'participant';
            }
        }
    }
    if (roleToggle) {
        roleToggle.addEventListener('change', updateRoleLabels);
        updateRoleLabels();
    }

    // Form elements
    const registerForm = document.getElementById('registerForm');
    const sendOtpBtn = document.getElementById('sendOtpBtn');
    const otpBlock = document.getElementById('otpBlock');
    const verifyOtpBtn = document.getElementById('verifyOtpBtn');
    const resendOtpBtn = document.getElementById('resendOtpBtn');
    const registerBtn = document.getElementById('registerBtn');
    const errorMsg = document.getElementById('errorMsg');
    const phoneInput = document.getElementById('phone');
    const otpInputs = otpBlock.querySelectorAll('.otp-inputs input');
    let timer;
    let currentPhone = '';
    let sessionId = '';
    let otpVerified = false;
    const API_KEY = 'ccc3be85-40f7-11f0-a562-0200cd936042';

    function showError(message) {
        errorMsg.textContent = message;
        errorMsg.classList.add('show');
        setTimeout(() => errorMsg.classList.remove('show'), 5000);
    }

    function setLoading(isLoading, button) {
        button.disabled = isLoading;
        button.textContent = isLoading ? 'Please wait...' : button.dataset.originalText;
    }

    // Store original button text
    sendOtpBtn.dataset.originalText = sendOtpBtn.textContent;
    verifyOtpBtn.dataset.originalText = verifyOtpBtn.textContent;
    registerBtn.dataset.originalText = registerBtn.textContent;

    // OTP block hidden by default
    otpBlock.classList.add('hidden');
    registerBtn.disabled = true;

    // Send OTP
    sendOtpBtn.addEventListener('click', async function() {
        const phone = phoneInput.value.trim();
        if (!/^[0-9]{10}$/.test(phone)) {
            showError('Please enter a valid 10-digit phone number');
            return;
        }
        currentPhone = phone;
        setLoading(true, sendOtpBtn);
        errorMsg.textContent = '';
        try {
            // 2factor.in API: Send OTP
            const response = await fetch(`https://2factor.in/API/V1/${API_KEY}/SMS/+91${phone}/AUTOGEN`, {
                method: 'GET'
            });
            const data = await response.json();
            if (data.Status === 'Success') {
                sessionId = data.Details;
                otpBlock.classList.remove('hidden');
                sendOtpBtn.disabled = true;
                phoneInput.disabled = true;
                startTimer();
                otpInputs.forEach(input => input.value = '');
                otpInputs[0].focus();
                otpVerified = false;
                registerBtn.disabled = true;
            } else {
                showError(data.Details || 'Failed to send OTP');
            }
        } catch (error) {
            showError('Failed to send OTP. Please try again.');
        } finally {
            setLoading(false, sendOtpBtn);
        }
    });

    // OTP input navigation
    otpInputs.forEach((input, idx) => {
        input.addEventListener('input', function() {
            if (this.value.length === 1 && idx < otpInputs.length - 1) {
                otpInputs[idx + 1].focus();
            }
        });
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && idx > 0) {
                otpInputs[idx - 1].focus();
            }
        });
        input.addEventListener('keypress', function(e) {
            if (!/[0-9]/.test(e.key)) e.preventDefault();
        });
    });

    // Verify OTP
    verifyOtpBtn.addEventListener('click', async function() {
        const otp = Array.from(otpInputs).map(input => input.value).join('');
        if (otp.length !== 6) {
            showError('Please enter the complete 6-digit OTP');
            return;
        }
        setLoading(true, verifyOtpBtn);
        errorMsg.textContent = '';
        try {
            // 2factor.in API: Verify OTP
            const response = await fetch(`https://2factor.in/API/V1/${API_KEY}/SMS/VERIFY/${sessionId}/${otp}`, {
                method: 'GET'
            });
            const data = await response.json();
            if (data.Status === 'Success' && data.Details === 'OTP Matched') {
                otpVerified = true;
                registerBtn.disabled = false;
                showError('OTP verified! You can now register.');
                verifyOtpBtn.classList.add('hidden');
                document.getElementById('phoneVerifiedLabel').classList.remove('hidden');
            } else {
                otpVerified = false;
                registerBtn.disabled = true;
                showError(data.Details || 'Invalid OTP');
                otpInputs.forEach(input => input.value = '');
                otpInputs[0].focus();
                verifyOtpBtn.classList.remove('hidden');
                document.getElementById('phoneVerifiedLabel').classList.add('hidden');
            }
        } catch (error) {
            showError('Failed to verify OTP. Please try again.');
            verifyOtpBtn.classList.remove('hidden');
            document.getElementById('phoneVerifiedLabel').classList.add('hidden');
        } finally {
            setLoading(false, verifyOtpBtn);
        }
    });

    // Resend OTP
    resendOtpBtn.addEventListener('click', async function() {
        if (!currentPhone) return;
        setLoading(true, resendOtpBtn);
        errorMsg.textContent = '';
        try {
            const response = await fetch(`https://2factor.in/API/V1/${API_KEY}/SMS/+91${currentPhone}/AUTOGEN`, {
                method: 'GET'
            });
            const data = await response.json();
            if (data.Status === 'Success') {
                sessionId = data.Details;
                startTimer();
                otpInputs.forEach(input => input.value = '');
                otpInputs[0].focus();
            } else {
                showError(data.Details || 'Failed to resend OTP');
            }
        } catch (error) {
            showError('Failed to resend OTP. Please try again.');
        } finally {
            setLoading(false, resendOtpBtn);
        }
    });

    // Timer for OTP
    function startTimer() {
        let timeLeft = 300; // 5 minutes
        const countdownDisplay = document.getElementById('countdown');
        resendOtpBtn.disabled = true;
        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            countdownDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (timeLeft <= 0) {
                clearInterval(timer);
                resendOtpBtn.disabled = false;
                countdownDisplay.textContent = '00:00';
            }
            timeLeft--;
        }, 1000);
    }

    // Registration submit
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        if (!otpVerified) {
            showError('Please verify OTP before registering.');
            return;
        }
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const phone = phoneInput.value.trim();
        let selectedRole = 'audience'; // Default role for public registration
        const roleDropdown = document.getElementById('roleDropdown');
        const roleToggle = document.getElementById('roleToggle');
        if (roleDropdown && roleDropdown.style.display !== 'none') {
            selectedRole = roleDropdown.value;
        } else if (roleToggle && roleToggle.style.display !== 'none') {
            selectedRole = roleToggle.checked ? 'audience' : 'participant';
        }
        if (!name || !email || !password || !phone) {
            showError('Please fill all fields.');
            return;
        }
        setLoading(true, registerBtn);
        errorMsg.textContent = '';
        try {
            // Use the correct backend URL for registration
            const response = await fetch(getApiUrl(config.ENDPOINTS.AUTH.REGISTER), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    phone,
                    role: selectedRole
                })
            });
            const data = await response.json();
            if (response.ok) {
                // Check for eventId in URL
                const urlParams = new URLSearchParams(window.location.search);
                const eventId = urlParams.get('eventId');
                if (eventId) {
                    // Register user for the event
                    try {
                        const eventResponse = await fetch(`/api/events/${eventId}/register`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email })
                        });
                        const eventData = await eventResponse.json();
                        if (eventResponse.ok) {
                            alert('Registration successful and you have been registered for the event!');
                        } else {
                            alert('Registration successful, but failed to register for the event: ' + (eventData.message || 'Unknown error'));
                        }
                    } catch (eventError) {
                        alert('Registration successful, but failed to register for the event.');
                    }
                }
                window.location.replace('login.html');
            } else {
                showError((data && data.message) ? data.message : 'Registration failed');
                console.error('Registration error:', data);
            }
        } catch (error) {
            showError('Registration failed. Please try again.');
            console.error('Registration error:', error);
        } finally {
            setLoading(false, registerBtn);
        }
    });
}); 
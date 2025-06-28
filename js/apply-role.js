document.addEventListener('DOMContentLoaded', () => {
    const roleSelect = document.getElementById('role');
    const eventDropdownGroup = document.getElementById('eventDropdownGroup');
    const eventIdSelect = document.getElementById('eventId');
    const conditionalFieldsDiv = document.getElementById('conditionalFields');
    const errorMsg = document.getElementById('errorMsg');
    const successMsg = document.getElementById('successMsg');

    let availableEvents = [];

    // Fetch events with open applications for the selected role
    async function fetchEventsForRole(role) {
        eventIdSelect.innerHTML = '';
        eventDropdownGroup.style.display = 'none';
        if (!role) return;
        try {
            const response = await fetch(getApiUrl(`/events/applications-open?role=${role}`));
            if (!response.ok) throw new Error('Failed to fetch events');
            availableEvents = await response.json();
            if (availableEvents.length === 0) {
                errorMsg.textContent = `No events are currently accepting ${role} applications.`;
                errorMsg.classList.add('show');
                eventDropdownGroup.style.display = 'none';
                return;
            }
            errorMsg.textContent = '';
            errorMsg.classList.remove('show');
            if (availableEvents.length === 1) {
                eventDropdownGroup.style.display = 'none';
                eventIdSelect.innerHTML = `<option value="${availableEvents[0]._id}">${availableEvents[0].title}</option>`;
            } else {
                eventDropdownGroup.style.display = 'block';
                eventIdSelect.innerHTML = availableEvents.map(ev => `<option value="${ev._id}">${ev.title}</option>`).join('');
            }
        } catch (error) {
            errorMsg.textContent = error.message || 'Failed to load events.';
            errorMsg.classList.add('show');
        }
    }

    // Render conditional fields for volunteer
    function renderConditionalFields(selectedRole) {
        conditionalFieldsDiv.innerHTML = '';
        if (selectedRole === 'volunteer') {
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
        }
    }

    // Role selection change
    roleSelect.addEventListener('change', (e) => {
        const selectedRole = e.target.value;
        fetchEventsForRole(selectedRole);
        renderConditionalFields(selectedRole);
    });

    // Form submission
    document.getElementById('applyRoleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsg.textContent = '';
        errorMsg.classList.remove('show');
        successMsg.textContent = '';
        successMsg.classList.remove('show');

        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const role = roleSelect.value;
        let eventId = eventIdSelect.value;
        if (availableEvents.length === 1) {
            eventId = availableEvents[0]._id;
        }

        if (!role || !eventId) {
            errorMsg.textContent = 'Please select a role and event.';
            errorMsg.classList.add('show');
            return;
        }

        const formData = {
            name,
            email,
            phone,
            role,
            eventId
        };
        if (role === 'volunteer') {
            formData.availability = document.getElementById('availability').value;
            formData.skills = document.getElementById('skills').value;
        }

        try {
            const response = await fetch(getApiUrl('/auth/register'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to submit application');
            }
            successMsg.textContent = 'Application submitted successfully! Await admin approval.';
            successMsg.classList.add('show');
            document.getElementById('applyRoleForm').reset();
            conditionalFieldsDiv.innerHTML = '';
        } catch (error) {
            errorMsg.textContent = error.message || 'Failed to submit application.';
            errorMsg.classList.add('show');
        }
    });
}); 
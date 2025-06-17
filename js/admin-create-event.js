document.addEventListener('DOMContentLoaded', () => {
    const createEventForm = document.getElementById('createEventForm');
    const messageElem = document.getElementById('message');
    const errorMsgElem = document.getElementById('errorMsg');

    if (createEventForm) {
        createEventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            messageElem.style.display = 'none';
            errorMsgElem.style.display = 'none';
            messageElem.textContent = '';
            errorMsgElem.textContent = '';

            const formData = new FormData(createEventForm);
            const eventData = Object.fromEntries(formData.entries());

            // Format date and time for backend
            if (eventData.date) {
                eventData.date = new Date(eventData.date).toISOString();
            }
            // Combine date and time for a single datetime field if needed, or send separately
            // For now, sending separately. Backend will need to handle.

            const token = localStorage.getItem('token');

            if (!token) {
                errorMsgElem.textContent = 'You must be logged in to create an event.';
                errorMsgElem.style.display = 'block';
                return;
            }

            try {
                const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.CREATE), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(eventData)
                });

                const result = await response.json();

                if (response.ok) {
                    messageElem.textContent = result.message || 'Event created successfully!';
                    messageElem.style.display = 'block';
                    createEventForm.reset(); // Clear the form
                    // Optionally redirect or show success state
                    setTimeout(() => {
                        window.location.href = 'admin-dashboard.html#events';
                    }, 2000);
                } else {
                    errorMsgElem.textContent = result.message || 'Failed to create event.';
                    errorMsgElem.style.display = 'block';
                }
            } catch (error) {
                console.error('Error creating event:', error);
                errorMsgElem.textContent = 'An unexpected error occurred. Please try again.';
                errorMsgElem.style.display = 'block';
            }
        });
    }
}); 
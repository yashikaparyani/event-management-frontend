document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.replace('../login.html');
        return;
    }

    // Get event ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');

    if (!eventId) {
        alert('No event specified');
        window.location.replace('../participant-dashboard.html');
        return;
    }

    // Fetch event details
    fetchEventDetails(eventId);

    // Setup form submission
    const poetryForm = document.getElementById('poetrySubmissionForm');
    if (poetryForm) {
        poetryForm.addEventListener('submit', handlePoetrySubmission);
    }
});

async function fetchEventDetails(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(`/api/poetry/${eventId}`), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch event details');
        }

        const event = await response.json();
        displayEventDetails(event);
    } catch (error) {
        console.error('Error fetching event details:', error);
        alert('Error loading event details');
    }
}

function displayEventDetails(event) {
    const eventInfo = document.getElementById('eventInfo');
    if (eventInfo) {
        eventInfo.innerHTML = `
            <div class="event-info-item">
                <strong>Title:</strong> ${event.title}
            </div>
            <div class="event-info-item">
                <strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}
            </div>
            <div class="event-info-item">
                <strong>Time:</strong> ${event.time || 'TBA'}
            </div>
            <div class="event-info-item">
                <strong>Location:</strong> ${event.location}
            </div>
            <div class="event-info-item">
                <strong>Description:</strong> ${event.description || 'No description provided'}
            </div>
        `;
    }
}

async function handlePoetrySubmission(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');

    try {
        const formData = new FormData();
        formData.append('title', document.getElementById('title').value);
        formData.append('content', document.getElementById('content').value);

        const pdfFile = document.getElementById('pdfSubmission').files[0];
        if (pdfFile) {
            formData.append('pdfSubmission', pdfFile);
        }

        const audioFile = document.getElementById('audioSubmission').files[0];
        if (audioFile) {
            formData.append('audioSubmission', audioFile);
        }

        const response = await fetch(getApiUrl(`/api/poetry/${eventId}/submit`), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to submit poetry');
        }

        alert('Poetry submitted successfully!');
        e.target.reset();
    } catch (error) {
        console.error('Error submitting poetry:', error);
        alert('Error submitting poetry. Please try again.');
    }
}
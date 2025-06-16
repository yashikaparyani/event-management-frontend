document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Check if user is an audience member
    if (user.role !== 'audience') {
        window.location.href = 'login.html';
        return;
    }

    // Update user information in the UI
    document.getElementById('userName').textContent = user.name;
    document.getElementById('welcomeName').textContent = user.name;

    // Handle logout
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    // Load upcoming events
    loadUpcomingEvents();
    // Load user's registrations
    loadUserRegistrations();
});

async function loadUpcomingEvents() {
    try {
        const response = await fetch('http://localhost:5000/api/events/upcoming', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load events');
        }

        const events = await response.json();
        const eventsContainer = document.getElementById('upcomingEvents');

        if (events.length === 0) {
            eventsContainer.innerHTML = '<p>No upcoming events found.</p>';
            return;
        }

        eventsContainer.innerHTML = events.slice(0, 3).map(event => `
            <div class="event-item">
                <div class="event-icon">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <div class="event-details">
                    <h4>${event.title}</h4>
                    <p>
                        <i class="fas fa-calendar"></i> ${new Date(event.date).toLocaleDateString()}
                        <i class="fas fa-map-marker-alt ml-2"></i> ${event.location}
                    </p>
                </div>
                <button onclick="registerForEvent('${event._id}')" class="btn btn-primary">
                    <i class="fas fa-ticket-alt"></i> Register
                </button>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('upcomingEvents').innerHTML = 
            '<p class="error">Failed to load events. Please try again later.</p>';
    }
}

async function loadUserRegistrations() {
    try {
        const response = await fetch('http://localhost:5000/api/events/registered', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load registrations');
        }

        const registrations = await response.json();
        const registrationsContainer = document.getElementById('myRegistrations');

        if (registrations.length === 0) {
            registrationsContainer.innerHTML = '<p>You haven\'t registered for any events yet.</p>';
            return;
        }

        registrationsContainer.innerHTML = registrations.slice(0, 3).map(reg => `
            <div class="event-item">
                <div class="event-icon">
                    <i class="fas fa-ticket-alt"></i>
                </div>
                <div class="event-details">
                    <h4>${reg.event.title}</h4>
                    <p>
                        <i class="fas fa-calendar"></i> ${new Date(reg.event.date).toLocaleDateString()}
                        <i class="fas fa-map-marker-alt ml-2"></i> ${reg.event.location}
                    </p>
                </div>
                <span class="event-status status-${reg.status.toLowerCase()}">${reg.status}</span>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading registrations:', error);
        document.getElementById('myRegistrations').innerHTML = 
            '<p class="error">Failed to load registrations. Please try again later.</p>';
    }
}

async function registerForEvent(eventId) {
    try {
        const response = await fetch(`http://localhost:5000/api/events/${eventId}/register`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to register for event');
        }

        // Reload both sections to show updated data
        loadUpcomingEvents();
        loadUserRegistrations();

        // Show success message
        alert('Successfully registered for the event!');

    } catch (error) {
        console.error('Error registering for event:', error);
        alert(error.message || 'Failed to register for event. Please try again.');
    }
}
// participant-dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // Load all events when the All Events section is shown
    const allEventsSection = document.getElementById('all-events-section');
    const allEventsNav = document.querySelector('a[href="#all-events"]');
    const myRegistrationsNav = document.querySelector('a[href="#my-registrations"]');

    if (allEventsNav) {
        allEventsNav.addEventListener('click', () => {
            loadAllEvents();
        });
    }
    if (myRegistrationsNav) {
        myRegistrationsNav.addEventListener('click', () => {
            loadRegisteredEvents();
        });
    }

    // Optionally, load events on first page load if All Events is default
    // loadAllEvents();
});

async function loadAllEvents() {
    const eventsContainer = document.querySelector('#all-events-section .events-list-container');
    eventsContainer.innerHTML = '<p>Loading events...</p>';
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.LIST), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to load events');
        }
        const events = await response.json();
        if (!events.length) {
            eventsContainer.innerHTML = '<p class="no-data">No events available yet.</p>';
            return;
        }
        eventsContainer.innerHTML = events.map(event => `
            <div class="event-card">
                <img src="${event.imageUrl || 'https://via.placeholder.com/400x200?text=No+Image'}" alt="Event Image" class="event-card-image">
                <div class="event-card-content">
                    <div class="event-header">
                        <h3>${event.title}</h3>
                        <span class="event-badge">${event.organizer || ''}</span>
                    </div>
                    <div class="event-details">
                        <p><i class="fas fa-calendar"></i> ${new Date(event.date).toLocaleDateString()} ${event.time ? ('| ' + event.time) : ''}</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                    </div>
                    <div class="event-description">
                        ${(event.description || '').split(' ').slice(0, 20).join(' ')}${(event.description && event.description.split(' ').length > 20) ? '...' : ''}
                    </div>
                    <div class="event-actions">
                        <button class="btn btn-primary" onclick="registerForEvent('${event._id}')">Register</button>
                    </div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        eventsContainer.innerHTML = '<p class="error">Failed to load events. Please try again later.</p>';
    }
}

async function registerForEvent(eventId) {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.REGISTER(eventId)), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ email: user.email }) // Send email as required by backend
        });
        const result = await response.json();
        if (response.ok) {
            alert('Registered successfully!');
            // Get event details to check event type
            const eventResponse = await fetch(getApiUrl(`/api/events/${eventId}`), {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const eventDetails = await eventResponse.json();
            
            // Redirect based on event type
            if (eventDetails.type === 'Poetry') {
                window.location.href = `poetry/index.html?eventId=${eventId}`;
            } else {
                loadRegisteredEvents();
            }
        } else {
            alert(result.message || 'Failed to register for event.');
        }
    } catch (error) {
        alert('Error registering for event.');
    }
}

async function loadRegisteredEvents() {
    const eventsContainer = document.querySelector('#my-registrations-section .events-list-container');
    eventsContainer.innerHTML = '<p>Loading your registered events...</p>';
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.REGISTERED), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) throw new Error('Failed to load registered events');
        
        const events = await response.json();
        if (!events.length) {
            eventsContainer.innerHTML = '<p class="no-data">You haven\'t registered for any events yet.</p>';
            return;
        }

        eventsContainer.innerHTML = events.map(event => `
            <div class="event-card">
                <img src="${event.imageUrl || 'https://via.placeholder.com/400x200?text=No+Image'}" alt="Event Image" class="event-card-image">
                <div class="event-card-content">
                    <div class="event-header">
                        <h3>${event.title}</h3>
                        <span class="event-badge">${event.type}</span>
                    </div>
                    <div class="event-details">
                        <p><i class="fas fa-calendar"></i> ${new Date(event.date).toLocaleDateString()} ${event.time ? ('| ' + event.time) : ''}</p>
                        <p><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                    </div>
                    <div class="event-description">
                        ${(event.description || '').split(' ').slice(0, 20).join(' ')}${(event.description && event.description.split(' ').length > 20) ? '...' : ''}
                    </div>
                    <div class="event-actions">
                        <button class="btn btn-primary" onclick="startEvent('${event._id}', '${event.type}')">
                            <i class="fas fa-play-circle"></i> Start Event
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        } catch (error) {
        console.error('Error loading registered events:', error);
        eventsContainer.innerHTML = '<p class="error">Failed to load your registered events. Please try again later.</p>';
        }
}
//change done
// ✅ FIXED FUNCTION
async function startEvent(eventId, eventType) {
    // Clear any old event data from localStorage
    if (eventType === 'Poetry') {
        localStorage.removeItem('poetryEventData');
        localStorage.removeItem('poetrySubmission');
    }

    try {
        switch(eventType) {
            case 'Quiz':
                window.location.href = `quiz/index.html?eventId=${eventId}`;
                break;
            case 'Debate': {
                // First check if debate exists for this event
                const debateResponse = await fetch(getApiUrl(`/api/debates/event/${eventId}`), {
                    headers: getAuthHeaders()
                });
                if (!debateResponse.ok) {
                    throw new Error('No debate found for this event');
                }
                const debateData = await debateResponse.json();
                window.location.href = `debate/participant-debate.html?debateId=${debateData._id}`;
                break;
            }
            case 'Poetry':
                window.location.href = `poetry/index.html?eventId=${eventId}`;
                break;
            default:
                alert('Event type not supported');
        }
    } catch (error) {
        console.error('Error starting event:', error);
        alert(`Failed to start ${eventType} event: ${error.message}`);
    }
}
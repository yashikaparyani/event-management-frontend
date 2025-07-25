// participant-dashboard.js

// Global socket connection
let socket;

// Initialize socket connection
function initSocket() {
    if (!socket) {
        socket = io(config.SOCKET_URL, {
            auth: {
                token: localStorage.getItem('token')
            }
        });

        // Handle socket connection
        socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            const eventId = new URLSearchParams(window.location.search).get('eventId');
            if (eventId) {
                joinDebateRoom(eventId);
            }
        });

        // Handle debate started event
        socket.on('debate-started', (data) => {
            console.log('Debate started:', data);
            // Redirect to waiting screen when debate starts
            if (data.eventId) {
                window.location.href = `waiting-screen.html?eventId=${data.eventId}`;
            }
        });

        // Handle turn notification
        socket.on('your-turn', (data) => {
            console.log('Your turn to speak!', data);
            // Show notification to user
            showNotification(`It's your turn to speak! ${data.timeLeft} seconds remaining.`);
        });

        // Handle error events
        socket.on('error', (error) => {
            console.error('Socket error:', error);
            showNotification('Connection error: ' + (error.message || 'Unknown error'), 'error');
        });
    }
}

// Join debate room
function joinDebateRoom(eventId) {
    if (!socket || !socket.connected) {
        console.error('Socket not connected');
        return;
    }
    
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !user._id) {
        console.error('User not authenticated');
        return;
    }

    socket.emit('join-debate', {
        eventId: eventId,
        userId: user._id
    });
}

// Show notification to user
function showNotification(message, type = 'info') {
    // You can implement a better notification system here
    alert(`${type.toUpperCase()}: ${message}`);
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialize socket connection
    initSocket();
    
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

    // Load events on page load
    loadRegisteredEvents();
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
                try {
                    // Try to get the debate by event ID
                    const debateResponse = await fetch(getApiUrl(`/api/debates/event/${eventId}`), {
                        headers: getAuthHeaders()
                    });
                    
                    if (debateResponse.ok) {
                        const debateData = await debateResponse.json();
                        // Check if debate is active
                        if (debateData.status === 'active' || debateData.status === 'waiting') {
                            window.location.href = `debate/participant-debate.html?debateId=${debateData._id}`;
                        } else {
                            throw new Error('The debate has not started yet. Please wait for the coordinator to begin.');
                        }
                    } else {
                        // If no debate found, show appropriate message
                        if (debateResponse.status === 404) {
                            throw new Error('No debate session has been created for this event yet. Please wait for the coordinator to start the debate.');
                        } else {
                            const error = await debateResponse.json();
                            throw new Error(error.message || 'Failed to join debate session');
                        }
                    }
                } catch (error) {
                    console.error('Debate error:', error);
                    throw new Error(error.message || 'Error joining debate: Please try again later');
                }
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
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
    
    // Set up tab switching
    setupTabs();
    
    // Load events on page load
    loadAllEvents();
});

// Set up tab switching
function setupTabs() {
    const allEventsNav = document.querySelector('a[href="#all-events"]');
    const myRegistrationsNav = document.querySelector('a[href="#my-registrations"]');
    const allEventsSection = document.getElementById('all-events-section');
    const myRegistrationsSection = document.getElementById('my-registrations-section');

    if (allEventsNav && allEventsSection) {
        allEventsNav.addEventListener('click', (e) => {
            e.preventDefault();
            allEventsSection.style.display = 'block';
            myRegistrationsSection.style.display = 'none';
            allEventsNav.classList.add('active');
            myRegistrationsNav.classList.remove('active');
            loadAllEvents();
        });
    }

    if (myRegistrationsNav && myRegistrationsSection) {
        myRegistrationsNav.addEventListener('click', (e) => {
            e.preventDefault();
            allEventsSection.style.display = 'none';
            myRegistrationsSection.style.display = 'block';
            allEventsNav.classList.remove('active');
            myRegistrationsNav.classList.add('active');
            loadRegisteredEvents();
        });
    }
}

async function loadAllEvents() {
    const eventsContainer = document.querySelector('#all-events-section .events-list-container');
    eventsContainer.innerHTML = '<p>Loading events...</p>';
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.LIST), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to load events');
        }
        
        const events = await response.json();
        
        // Get registered events to check registration status
        let registeredEvents = [];
        try {
            const registeredResponse = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.REGISTERED), {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (registeredResponse.ok) {
                registeredEvents = await registeredResponse.json();
                registeredEvents = registeredEvents.map(e => e._id || e);
            }
        } catch (e) {
            console.error('Error loading registered events:', e);
        }
        
        if (!events || !events.length) {
            eventsContainer.innerHTML = '<p class="no-data">No events available at the moment. Please check back later.</p>';
            return;
        }
        
        // Filter out past events
        const currentDate = new Date();
        const upcomingEvents = events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= currentDate;
        });
        
        if (!upcomingEvents.length) {
            eventsContainer.innerHTML = '<p class="no-data">No upcoming events. Please check back later.</p>';
            return;
        }
        
        // Render events
        eventsContainer.innerHTML = upcomingEvents.map(event => {
            const isRegistered = registeredEvents.includes(event._id);
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="event-card">
                    <img src="${event.imageUrl || 'https://via.placeholder.com/400x200?text=No+Image'}" 
                         alt="${event.title}" 
                         class="event-card-image">
                    <div class="event-card-content">
                        <div class="event-header">
                            <h3>${event.title}</h3>
                            <span class="event-type ${event.type ? event.type.toLowerCase() : 'general'}">
                                ${event.type || 'Event'}
                            </span>
                        </div>
                        <div class="event-details">
                            <p><i class="fas fa-calendar"></i> ${formattedDate}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${event.location || 'Online'}</p>
                            ${event.coordinator ? `<p><i class="fas fa-user-tie"></i> ${event.coordinator.name || 'Coordinator'}</p>` : ''}
                        </div>
                        <div class="event-description">
                            ${event.description || 'No description available.'}
                        </div>
                        <div class="event-actions">
                            ${isRegistered 
                                ? `<button class="btn btn-success" disabled>
                                    <i class="fas fa-check"></i> Registered
                                   </button>
                                   <button class="btn btn-primary" 
                                           onclick="startEvent('${event._id}', '${event.type || 'General'}')">
                                    View Event
                                   </button>`
                                : `<button class="btn btn-primary" 
                                         onclick="registerForEvent('${event._id}')">
                                    Register Now
                                  </button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        eventsContainer.innerHTML = '<p class="error">Failed to load events. Please try again later.</p>';
    }
}

async function registerForEvent(eventId) {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!user || !user.email) {
        alert('Please log in to register for events.');
        return;
    }
    
    try {
        // Show loading state
        const registerBtn = document.querySelector(`button[onclick*="${eventId}"]`);
        const originalText = registerBtn ? registerBtn.innerHTML : 'Registering...';
        if (registerBtn) {
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
        }
        
        // First, get event details to determine the type
        const eventResponse = await fetch(getApiUrl(`/api/events/${eventId}`), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!eventResponse.ok) {
            const error = await eventResponse.json();
            throw new Error(error.message || 'Failed to fetch event details');
        }
        
        const eventDetails = await eventResponse.json();
        
        // Register for the event
        const registerResponse = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.REGISTER(eventId)), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ 
                email: user.email,
                name: user.name || 'Participant',
                userId: user._id || user.id
            })
        });
        
        const result = await registerResponse.json();
        
        if (registerResponse.ok) {
            // Show success message
            alert('Successfully registered for the event!');
            
            // Redirect based on event type
            switch(eventDetails.type) {
                case 'Debate':
                    // For debate, we need to select a team first
                    selectDebateTeam(eventId);
                    break;
                case 'Poetry':
                    window.location.href = `poetry/index.html?eventId=${eventId}`;
                    break;
                case 'Quiz':
                    window.location.href = `quiz/index.html?eventId=${eventId}`;
                    break;
                case 'CodecRaze':
                    window.location.href = `codec-raze/index.html?eventId=${eventId}`;
                    break;
                default:
                    // For other event types, reload the registered events list
                    loadRegisteredEvents();
                    break;
            }
        } else {
            throw new Error(result.message || 'Failed to register for event');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert(`Error: ${error.message || 'Failed to register for event. Please try again.'}`);
    } finally {
        // Reset button state
        const registerBtn = document.querySelector(`button[onclick*="${eventId}"]`);
        if (registerBtn) {
            registerBtn.disabled = false;
            registerBtn.innerHTML = 'Register Now';
        }
    }
}

// Show team selection modal for debate events
function selectDebateTeam(eventId) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.style.position = 'fixed';
    modal.style.zIndex = '1000';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    
    modal.innerHTML = `
        <div class="modal-content" style="background: white; margin: 15% auto; padding: 20px; width: 80%; max-width: 500px; border-radius: 8px;">
            <h2>Join Debate Team</h2>
            <p>Please select which team you want to join:</p>
            <div style="display: flex; justify-content: space-around; margin: 20px 0;">
                <button id="joinForTeam" class="btn btn-primary" style="padding: 10px 20px;">
                    <i class="fas fa-thumbs-up"></i> For
                </button>
                <button id="joinAgainstTeam" class="btn btn-danger" style="padding: 10px 20px;">
                    <i class="fas fa-thumbs-down"></i> Against
                </button>
            </div>
            <button id="closeModal" class="btn btn-secondary" style="width: 100%;">
                Cancel
            </button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('joinForTeam').addEventListener('click', () => joinDebateTeam(eventId, 'for', modal));
    document.getElementById('joinAgainstTeam').addEventListener('click', () => joinDebateTeam(eventId, 'against', modal));
    document.getElementById('closeModal').addEventListener('click', () => modal.remove());
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Join a debate team
async function joinDebateTeam(eventId, team, modal) {
    try {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user'));
        
        const response = await fetch(getApiUrl(`/api/debates/${eventId}/join`), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                participantId: user._id || user.id,
                name: user.name || 'Participant',
                email: user.email,
                team: team
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to join team');
        }
        
        const result = await response.json();
        
        // Close the modal
        if (modal) modal.remove();
        
        // Show success message
        alert(`Successfully joined the ${team} team!`);
        
        // Update the UI
        loadRegisteredEvents();
        
    } catch (error) {
        console.error('Error joining team:', error);
        alert(`Error: ${error.message || 'Failed to join team. Please try again.'}`);
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
/**
 * Start an event or join an existing session
 * @param {string} eventId - The ID of the event to start/join
 * @param {string} eventType - The type of event (Debate, Poetry, etc.)
 */
async function startEvent(eventId, eventType) {
    // Get the JWT token and user data
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    // Check if user is logged in
    if (!token || !user) {
        alert('Please log in to start an event.');
        window.location.href = 'login.html';
        return;
    }
    
    // Show loading state
    const startBtn = document.querySelector(`button[onclick*="${eventId}"]`);
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
    }

    try {
        // First, get event details to verify the event type and status
        const eventResponse = await fetch(getApiUrl(`/api/events/${eventId}`), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!eventResponse.ok) {
            const error = await eventResponse.json();
            throw new Error(error.message || 'Failed to fetch event details');
        }
        
        const eventDetails = await eventResponse.json();
        
        // Clear any old event data from localStorage if needed
        if (eventType === 'Poetry') {
            localStorage.removeItem('poetryEventData');
            localStorage.removeItem('poetrySubmission');
        }
        
        // Handle different event types
        switch (eventType) {
            case 'Debate':
                await handleDebateEvent(eventId, token, user);
                break;
                
            case 'Quiz':
                window.location.href = `quiz/index.html?eventId=${eventId}`;
                break;
                
            case 'Poetry':
                window.location.href = `poetry/index.html?eventId=${eventId}`;
                break;
                
            case 'CodecRaze':
                window.location.href = `codec-raze/index.html?eventId=${eventId}`;
                break;
                
            default:
                throw new Error('This event type is not supported yet.');
        }
        
    } catch (error) {
        console.error('Error starting event:', error);
        alert(`Error: ${error.message || 'Failed to start event. Please try again.'}`);
    } finally {
        // Reset button state
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = 'Start Event';
        }
    }
}

/**
 * Handle debate event flow
 */
async function handleDebateEvent(eventId, token, user) {
    try {
        // Check if there's an existing debate session for this event
        const sessionResponse = await fetch(getApiUrl(`/api/debates/event/${eventId}`), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (sessionResponse.ok) {
            const debateData = await sessionResponse.json();
            
            // Check if debate is active
            if (debateData.status === 'active' || debateData.status === 'in_progress') {
                // Check if user is registered as a participant
                const isRegistered = await checkDebateRegistration(eventId, user, token);
                
                if (isRegistered) {
                    // If registered, join the debate
                    window.location.href = `debate/participant-debate.html?eventId=${eventId}`;
                } else {
                    // If not registered, show audience view
                    window.location.href = `debate/audience-debate.html?eventId=${eventId}`;
                }
            } else if (debateData.status === 'scheduled' || debateData.status === 'waiting') {
                // If debate is scheduled but not started, show waiting screen
                window.location.href = `debate/waiting.html?eventId=${eventId}`;
            } else if (debateData.status === 'ended') {
                throw new Error('This debate has already ended.');
            } else {
                throw new Error('The debate has not started yet. Please wait for the coordinator to begin.');
            }
        } else if (sessionResponse.status === 404) {
            // If no debate session exists yet, show waiting screen
            window.location.href = `debate/waiting.html?eventId=${eventId}`;
        } else {
            const error = await sessionResponse.json();
            throw new Error(error.message || 'Failed to join debate session');
        }
    } catch (error) {
        console.error('Error handling debate event:', error);
        throw error; // Re-throw to be handled by the caller
    }
}

/**
 * Check if user is registered for a debate
 */
async function checkDebateRegistration(eventId, user, token) {
    try {
        const response = await fetch(getApiUrl(`/api/debates/${eventId}/participants`), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const participants = await response.json();
            const userId = user._id || user.id;
            
            // Check if user is in either team
            return participants.some(p => 
                (p.participantId === userId || p._id === userId || p.user === userId) && 
                (p.team === 'for' || p.team === 'against')
            );
        }
        return false;
    } catch (error) {
        console.error('Error checking debate registration:', error);
        return false;
    }
}
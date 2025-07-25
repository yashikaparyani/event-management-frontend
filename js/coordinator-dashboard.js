// Fetch and display events managed by the current coordinator

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    if (!token || !user) return;
    if (!user.role || user.role.name !== 'coordinator') return;

    // Fetch events where coordinator == current user
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.LIST), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch events');
        const events = await response.json();
        // Filter events managed by this coordinator
        const managedEvents = events.filter(event =>
            event.coordinator === user.id ||
            event.coordinator === user._id ||
            (event.assignedCoordinators && (
                event.assignedCoordinators.map(String).includes(String(user.id)) ||
                event.assignedCoordinators.map(String).includes(String(user._id))
            ))
        );

        // Update Events Managed card
        const eventsManagedCard = document.querySelector('.dashboard-grid .card:nth-child(1) p');
        if (eventsManagedCard) {
            eventsManagedCard.textContent = managedEvents.length;
        }

        // Update My Events section
        const eventsListContainer = document.querySelector('.events-list-container');
        if (eventsListContainer) {
            if (managedEvents.length === 0) {
                eventsListContainer.innerHTML = '<p class="no-data">No events assigned yet.</p>';
            } else {
                eventsListContainer.innerHTML = managedEvents.map(event => `
                    <div class="event-item">
                        <h3>${event.title}</h3>
                        <p>${event.description || ''}</p>
                        <p><strong>Date:</strong> ${event.date ? new Date(event.date).toLocaleDateString() : 'N/A'}</p>
                        <p><strong>Location:</strong> ${event.location || 'N/A'}</p>
                        <div class="event-actions">
                            ${event.type === 'Quiz' ? `
                                <button class="btn btn-primary" onclick="createOrEditQuiz('${event._id}', '${event.title}')">
                                    <i class="fas fa-edit"></i> Create/Edit Quiz
                                </button>
                            ` : ''}

                            ${event.type === 'Debate' ? `
                                <button class="btn btn-success" onclick="startDebate('${event._id}', '${event.title}')">
                                    <i class="fas fa-play-circle"></i> Start Debate
                                </button>
                            ` : ''}

                            ${event.type === 'Poetry' ? `
                                <button class="btn btn-primary" onclick="managePoetry('${event._id}', '${event.title}')">
                                    <i class="fas fa-feather-alt"></i> Manage Poetry Event
                                </button>
                            ` : ''}

                            ${event.type === 'CodecRaze' ? `
                                <button class="btn btn-primary" onclick="manageCodecRaze('${event._id}', '${event.title}')">
                                    <i class="fas fa-code"></i> Manage Codec Raze
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        const eventsListContainer = document.querySelector('.events-list-container');
        if (eventsListContainer) {
            eventsListContainer.innerHTML = `<p class="error-message">${error.message || 'Failed to load events.'}</p>`;
        }
        const eventsManagedCard = document.querySelector('.dashboard-grid .card:nth-child(1) p');
        if (eventsManagedCard) {
            eventsManagedCard.textContent = '0';
        }
    }
});

// Function to create or edit quiz for an event
async function createOrEditQuiz(eventId, eventTitle) {
    // Store event info for quiz creation
    localStorage.setItem('currentEventId', eventId);
    localStorage.setItem('currentEventTitle', eventTitle);
    
    // Redirect to quiz creation page
    window.location.href = 'coordinator-quiz-creation.html';
} 


function startDebate(eventId, eventTitle) {
    localStorage.setItem('currentDebateId', eventId);
    localStorage.setItem('currentEventTitle', eventTitle);
    // Redirect to the debate management page
    window.location.href = 'debate/index.html?debateId=' + eventId;
}

function managePoetry(eventId, eventTitle) {
    // Clear any existing poetry management data
    localStorage.removeItem('poetryEventData');
    localStorage.removeItem('poetryTopics');
    
    // Set current event information
    localStorage.setItem('currentPoetryId', eventId);
    localStorage.setItem('currentEventTitle', eventTitle);
    
    // Redirect to the poetry management page
    window.location.href = 'poetry/manage.html?eventId=' + eventId;
}

// Add the manageCodecRaze function
function manageCodecRaze(eventId, eventTitle) {
    localStorage.setItem('currentCodecRazeEventId', eventId);
    localStorage.setItem('currentEventTitle', eventTitle);
    window.location.href = 'codecraze/problems.html?eventId=' + eventId;
}
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));

    if (!token || !user) {
        window.location.href = 'login.html';
        return;
    }

    // Check if user is an audience member
    if (user.role.name !== 'audience') {
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

    // Load all events for audience
    loadAllEvents();
});

let allEventsCache = [];

// Add event listeners for sidebar navigation
function setupSidebarFilters() {
    document.getElementById('allEventsNav').addEventListener('click', function(e) {
        e.preventDefault();
        setActiveNav('allEventsNav');
        renderEvents(allEventsCache);
    });
    document.getElementById('upcomingEventsNav').addEventListener('click', function(e) {
        e.preventDefault();
        setActiveNav('upcomingEventsNav');
        const now = new Date();
        const upcoming = allEventsCache.filter(ev => new Date(ev.date) > now);
        renderEvents(upcoming);
    });
    document.getElementById('currentEventsNav').addEventListener('click', function(e) {
        e.preventDefault();
        setActiveNav('currentEventsNav');
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const current = allEventsCache.filter(ev => {
            const evDate = new Date(ev.date);
            return evDate >= today && evDate < tomorrow;
        });
        renderEvents(current);
    });
}

function setActiveNav(id) {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function renderEvents(events) {
    const eventsContainer = document.getElementById('upcomingEvents');
    if (!events.length) {
        eventsContainer.innerHTML = '<p>No events found.</p>';
        return;
    }
    eventsContainer.innerHTML = events.map((event, idx) => {
        // Limit description to 20 words
        let desc = event.description || '';
        const words = desc.split(' ');
        let preview = desc;
        if (words.length > 20) {
            preview = words.slice(0, 20).join(' ') + '...';
        }
        return `
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
                        ${preview}
                    </div>
                    ${event.qrCode ? `<div class='event-qr'><img src='${event.qrCode}' alt='QR Code for registration' style='width:120px;height:120px;margin-top:10px;'/></div>` : ''}
                    <button class="btn btn-secondary view-details-btn" data-event-idx="${idx}">View Details</button>
                </div>
            </div>
        `;
    }).join('');
    // Add event listeners for view details buttons
    document.querySelectorAll('.view-details-btn').forEach((btn, idx) => {
        btn.addEventListener('click', function() {
            const event = events[idx];
            document.getElementById('modalEventImage').src = event.imageUrl || 'https://via.placeholder.com/400x200?text=No+Image';
            document.getElementById('modalEventTitle').textContent = event.title;
            document.getElementById('modalEventDate').textContent = new Date(event.date).toLocaleDateString();
            document.getElementById('modalEventTime').textContent = event.time || '';
            document.getElementById('modalEventLocation').textContent = event.location;
            document.getElementById('modalEventOrganizer').textContent = event.organizer || '';
            document.getElementById('modalEventDescription').textContent = event.description || '';
            document.getElementById('eventDetailsModal').classList.add('show');
        });
    });
}

// Update loadAllEvents to cache all events and render all by default
async function loadAllEvents() {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.LIST), {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        if (!response.ok) {
            throw new Error('Failed to load events');
        }
        allEventsCache = await response.json();
        renderEvents(allEventsCache);
        setupSidebarFilters();
        document.getElementById('allEventsNav').classList.add('active');
        // Modal close logic
        document.getElementById('closeModalBtn').onclick = function() {
            document.getElementById('eventDetailsModal').classList.remove('show');
        };
        window.onclick = function(event) {
            const modal = document.getElementById('eventDetailsModal');
            if (event.target === modal) {
                modal.classList.remove('show');
            }
        };
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('upcomingEvents').innerHTML = '<p class="error">Failed to load events. Please try again later.</p>';
    }
}

async function registerForEvent(eventId) {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.EVENTS.REGISTER(eventId)), {
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
        loadAllEvents();

        // Show success message
        alert('Successfully registered for the event!');

    } catch (error) {
        console.error('Error registering for event:', error);
        alert(error.message || 'Failed to register for event. Please try again.');
    }
}
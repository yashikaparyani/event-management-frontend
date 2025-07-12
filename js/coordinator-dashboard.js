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
        const managedEvents = events.filter(event => event.coordinator === user.id || event.coordinator === user._id);

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
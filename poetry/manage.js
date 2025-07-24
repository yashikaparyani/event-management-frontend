document.addEventListener('DOMContentLoaded', () => {
    // Authentication check
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    const eventId = new URLSearchParams(window.location.search).get('eventId');

    if (!token || !user || !eventId) {
        window.location.replace('../login.html');
        return;
    }

    // Check if user is a coordinator
    if (user.role.name !== 'coordinator') {
        window.location.replace('../login.html');
        return;
    }

    // Fetch event details and initialize the page
    fetchEventDetails(eventId);
    loadTopics(eventId);
    loadSubmissions(eventId);

    // Set up topic form submission
    const topicForm = document.getElementById('topicForm');
    if (topicForm) {
        topicForm.addEventListener('submit', (e) => handleTopicSubmission(e, eventId));
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

        if (!response.ok) throw new Error('Failed to fetch event details');

        const event = await response.json();
        displayEventDetails(event);
    } catch (error) {
        console.error('Error fetching event details:', error);
        alert('Error loading event details');
    }
}

function displayEventDetails(event) {
    // Update event title
    const eventTitle = document.getElementById('eventTitle');
    if (eventTitle) {
        eventTitle.textContent = event.title;
    }

    // Update event info
    const eventInfo = document.getElementById('eventInfo');
    if (eventInfo) {
        eventInfo.innerHTML = `
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

async function loadTopics(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.POETRY.TOPICS(eventId)), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch topics');

        const topics = await response.json();
        displayTopics(topics);
    } catch (error) {
        console.error('Error loading topics:', error);
        const topicsList = document.getElementById('topicsList');
        if (topicsList) {
            topicsList.innerHTML = '<p class="error-message">Failed to load topics</p>';
        }
    }
}

function displayTopics(topics) {
    const topicsList = document.getElementById('topicsList');
    if (topicsList) {
        if (topics.length === 0) {
            topicsList.innerHTML = '<p class="no-data">No topics added yet</p>';
            return;
        }

        topicsList.innerHTML = topics.map(topic => `
            <div class="topic-item">
                <h4>${topic.title}</h4>
                <p>${topic.description || ''}</p>
                <button class="btn btn-danger btn-sm" onclick="deleteTopic('${topic._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `).join('');
    }
}

async function handleTopicSubmission(e, eventId) {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const topicInput = document.getElementById('topic');
    const descriptionInput = document.getElementById('description');

    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.POETRY.TOPICS(eventId)), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title: topicInput.value,
                description: descriptionInput.value
            })
        });

        if (!response.ok) throw new Error('Failed to add topic');

        // Clear form and reload topics
        topicInput.value = '';
        descriptionInput.value = '';
        loadTopics(eventId);
    } catch (error) {
        console.error('Error adding topic:', error);
        alert('Failed to add topic');
    }
}

async function deleteTopic(topicId) {
    if (!confirm('Are you sure you want to delete this topic?')) return;

    const token = localStorage.getItem('token');
    const eventId = new URLSearchParams(window.location.search).get('eventId');

    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.POETRY.DELETE_TOPIC(eventId, topicId)), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to delete topic');

        loadTopics(eventId);
    } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Failed to delete topic');
    }
}

async function loadSubmissions(eventId) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(getApiUrl(config.ENDPOINTS.POETRY.SUBMISSIONS(eventId)), {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to fetch submissions');

        const submissions = await response.json();
        displaySubmissions(submissions);
    } catch (error) {
        console.error('Error loading submissions:', error);
        const submissionsList = document.getElementById('submissionsList');
        if (submissionsList) {
            submissionsList.innerHTML = '<p class="error-message">Failed to load submissions</p>';
        }
    }
}

function displaySubmissions(submissions) {
    const submissionsList = document.getElementById('submissionsList');
    if (!submissionsList) return;

    // Ensure submissions is an array
    const submissionsArray = Array.isArray(submissions) ? submissions : [];
    
    if (submissionsArray.length === 0) {
        submissionsList.innerHTML = '<p class="no-data">No submissions yet</p>';
        return;
    }

        submissionsList.innerHTML = submissionsArray.map(submission => `
            <div class="submission-item">
                <h4>${submission.title || 'Untitled'}</h4>
                <p><strong>Submitted by:</strong> ${submission.participant?.name || 'Anonymous'}</p>
                <p><strong>Submission Date:</strong> ${new Date(submission.createdAt || Date.now()).toLocaleString()}</p>
                <div class="submission-content">
                    ${submission.content ? `<p>${submission.content}</p>` : ''}
                    ${submission.pdfUrl ? `<a href="${submission.pdfUrl}" target="_blank" class="btn btn-sm"><i class="fas fa-file-pdf"></i> View PDF</a>` : ''}
                    ${submission.audioUrl ? `<audio controls src="${submission.audioUrl}"></audio>` : ''}
                </div>
            </div>
        `).join('');
    }

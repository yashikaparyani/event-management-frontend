// REMOVE ALL MOCK DATA AND ADMIN/JUDGE LOGIC
// Use backend APIs and Socket.IO for all actions
// Use config.js for API endpoints and socket URL

// --- Debate Frontend Integration ---

let debateId = null;
let user = null;
let userRole = null;
let debate = null;
let session = null;
let socket = null;

// DOM elements
const roleSelect = document.getElementById('role');
const detailsContent = document.getElementById('details-content');
const topicsList = document.getElementById('topics-list');
const rulesList = document.getElementById('rules-list');
const participantsList = document.getElementById('participants-list');
const registrationForm = document.getElementById('registration-form');

// Utility: get debateId from URL or localStorage
function getDebateId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debateId') || localStorage.getItem('currentDebateId');
}

// Utility: get user and role from localStorage
function getUserAndRole() {
    const u = JSON.parse(localStorage.getItem('user'));
    return {
        user: u,
        role: u && u.role ? (u.role.name || u.role) : null
    };
}

// Update showCreateDebateForm to use #create-debate-form and add timer field
async function showCreateDebateForm() {
    const formDiv = document.getElementById('create-debate-form');
    if (!formDiv) return;
    formDiv.innerHTML = `
        <form id="createDebateForm">
            <label>Topics (comma separated):<br>
                <input id="debateTopics" required autocomplete="off">
            </label><br>
            <label>Rules (comma separated):<br>
                <input id="debateRules" required autocomplete="off">
            </label><br>
            <label>Timer per participant (seconds):<br>
                <input id="debateTimer" type="number" min="30" max="600" value="120" required autocomplete="off">
            </label><br>
            <button type="submit">Create Debate</button>
        </form>
        <div id="createDebateError" style="color:red"></div>
    `;
    document.getElementById('createDebateForm').onsubmit = async function(e) {
        e.preventDefault();
        const topics = document.getElementById('debateTopics').value.split(',').map(t => t.trim()).filter(Boolean);
        const rules = document.getElementById('debateRules').value.split(',').map(r => r.trim()).filter(Boolean);
        const timer = parseInt(document.getElementById('debateTimer').value, 10);
        try {
            const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.CREATE), {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    eventId: debateId,
                    topics,
                    rules,
                    timerPerParticipant: timer
                })
            });
            if (!res.ok) throw new Error('Failed to create debate');
            const data = await res.json();
            // Use the debateId returned from the backend
            debateId = data.debate._id;
            // After creation, fetch debate, initialize socket, and show hosting window
            const debateRes = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.GET(debateId)), {
                headers: getAuthHeaders()
            });
            if (!debateRes.ok) throw new Error('Failed to fetch debate after creation');
            debate = await debateRes.json();
            await fetchSession();
            initializeSocket();
            // In showCreateDebateForm, after successful creation and fetching debate, show a success message
            formDiv.innerHTML = '<div style="color:green; font-weight:bold;">Debate created successfully!</div>';
            renderCoordinatorSessionControls();
        } catch (err) {
            document.getElementById('createDebateError').textContent = err.message;
        }
    };
}

// Update fetchDebate error handler to show create form for coordinator
async function fetchDebate() {
    try {
        const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.GET(debateId)), {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch debate');
        debate = await res.json();
        renderEventDetails();
        renderTopics();
        renderRules();
        renderParticipants();
        // Only initialize socket after debate exists
        initializeSocket();
        renderCoordinatorSessionControls(); // Add this line
    } catch (e) {
        if (userRole === 'coordinator') {
            showCreateDebateForm();
        } else {
            detailsContent.innerHTML = '<span style="color:red">Failed to load debate details.</span>';
        }
    }
}

// Fetch session state from backend
async function fetchSession() {
    try {
        const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.SESSION(debateId)), {
            headers: getAuthHeaders()
        });
        if (!res.ok) return;
        session = await res.json();
        renderSessionState();
    } catch (e) {}
}

// Render event details
function renderEventDetails() {
    if (!debate) return;
    let html = '';
    html += `<div><strong>Name:</strong> ${debate.event.title}</div>`;
    html += `<div><strong>Date:</strong> ${new Date(debate.event.date).toLocaleDateString()}</div>`;
    html += `<div><strong>Time:</strong> ${debate.event.time || ''}</div>`;
    html += `<div><strong>Location:</strong> ${debate.event.location}</div>`;
    html += `<div><strong>Description:</strong> ${debate.event.description}</div>`;
    detailsContent.innerHTML = html;
}

// Render topics
function renderTopics() {
    topicsList.innerHTML = '';
    if (!debate || !debate.topics) return;
    debate.topics.forEach(topic => {
        let li = document.createElement('li');
        li.textContent = topic;
        topicsList.appendChild(li);
    });
}

// Render rules
function renderRules() {
    rulesList.innerHTML = '';
    if (!debate || !debate.rules) return;
    debate.rules.forEach(rule => {
        let li = document.createElement('li');
        li.textContent = rule;
        rulesList.appendChild(li);
    });
}

// Render teams/participants
function renderParticipants() {
    participantsList.innerHTML = '';
    if (!debate || !debate.teams) return;
    debate.teams.forEach(team => {
        let li = document.createElement('li');
        let members = team.members && team.members.length ? team.members.map(m => m.name || m).join(', ') : '';
        li.innerHTML = `<strong>${team.name}</strong>: ${members}`;
        participantsList.appendChild(li);
    });
}

// Render session state (current speaker, scores, status)
function renderSessionState() {
    const sessionBlock = document.getElementById('session-state');
    if (!sessionBlock) return;
    let html = '';
    if (!session) {
        html = '<em>No active session.</em>';
    } else {
        html += `<div><strong>Status:</strong> ${session.status}</div>`;
        if (session.currentSpeaker) {
            html += `<div><strong>Current Speaker:</strong> ${session.currentSpeaker.name}</div>`;
        }
        if (session.scores && session.scores.length) {
            html += '<div><strong>Scores:</strong><ul>';
            session.scores.forEach(s => {
                html += `<li>${s.team.name || s.team}: ${s.points}</li>`;
            });
            html += '</ul></div>';
        }
    }
    sessionBlock.innerHTML = html;
    }

// Register team (participant)
window.registerParticipant = async function(event) {
    event.preventDefault();
    const teamName = document.getElementById('team-name').value.trim();
    const memberNames = document.getElementById('member-names').value.split(',').map(n => n.trim()).filter(Boolean);
    if (!teamName || !memberNames.length) return;
    try {
        const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.REGISTER_TEAM(debateId)), {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ name: teamName, memberIds: [user.id, ...memberNames] })
        });
        if (!res.ok) throw new Error('Failed to register team');
        registrationForm.innerHTML = '<strong>Registered successfully!</strong>';
        fetchDebate();
    } catch (e) {
        registrationForm.innerHTML = '<span style="color:red">Failed to register team.</span>';
    }
};

// Register as audience
window.registerAudience = async function(event) {
    event.preventDefault();
    try {
        const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.REGISTER_AUDIENCE(debateId)), {
            method: 'POST',
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to register as audience');
        registrationForm.innerHTML = '<strong>Registered as audience!</strong>';
        fetchDebate();
    } catch (e) {
        registrationForm.innerHTML = '<span style="color:red">Failed to register as audience.</span>';
    }
};

// Remove or comment out renderRegistrationForm and its calls
// function renderRegistrationForm() { ... }
// Remove all calls to renderRegistrationForm();

// --- Real-time (Socket.IO) ---
function initializeSocket() {
    socket = io(config.SOCKET_URL);
    socket.on('connect', () => {
        socket.emit('join-debate', { debateId, userId: user.id });
    });
    socket.on('debate-joined', data => {
        session = data.session;
        renderSessionState();
    });
    socket.on('debate-started', data => {
        session = data.session;
        renderSessionState();
    });
    socket.on('debate-ended', data => {
        session = data.session;
        renderSessionState();
    });
    socket.on('speaker-changed', data => {
        if (session) session.currentSpeaker = data.currentSpeaker;
        renderSessionState();
    });
    socket.on('score-updated', data => {
        if (session) session.scores = data.scores;
        renderSessionState();
    });
    socket.on('error', data => {
        alert(data.message);
    });
}

// --- Coordinator Controls (for demo, add to page if coordinator) ---
function renderCoordinatorControls() {
    if (userRole !== 'coordinator') return;
    const controls = document.createElement('div');
    controls.id = 'coordinator-controls';
    controls.innerHTML = `
        <button id="startDebateBtn">Start Debate</button>
        <button id="endDebateBtn">End Debate</button>
        <input id="nextSpeakerId" placeholder="Next Speaker User ID">
        <button id="nextSpeakerBtn">Next Speaker</button>
        <input id="scoreTeamId" placeholder="Team ID">
        <input id="scorePoints" type="number" placeholder="Points">
        <button id="assignScoreBtn">Assign Score</button>
    `;
    document.body.appendChild(controls);
    document.getElementById('startDebateBtn').onclick = () => {
        socket.emit('start-debate', { debateId, userId: user.id });
    };
    document.getElementById('endDebateBtn').onclick = () => {
        socket.emit('end-debate', { debateId, userId: user.id });
    };
    document.getElementById('nextSpeakerBtn').onclick = () => {
        const nextSpeakerId = document.getElementById('nextSpeakerId').value.trim();
        if (nextSpeakerId) {
            socket.emit('next-speaker', { debateId, userId: user.id, nextSpeakerId });
        }
    };
    document.getElementById('assignScoreBtn').onclick = () => {
        const teamId = document.getElementById('scoreTeamId').value.trim();
        const points = parseInt(document.getElementById('scorePoints').value, 10);
        if (teamId && !isNaN(points)) {
            socket.emit('assign-score', { debateId, userId: user.id, teamId, points });
    }
};
}

// Add coordinator session controls (Start/End Debate)
function renderCoordinatorSessionControls() {
    if (userRole !== 'coordinator' || !debate) return;
    const controlsDiv = document.getElementById('coordinator-session-controls');
    if (!controlsDiv) return;
    let html = '';
    html += `<button id="startDebateSessionBtn">Start Debate</button> `;
    html += `<button id="endDebateSessionBtn">End Debate</button>`;
    controlsDiv.innerHTML = html;
    document.getElementById('startDebateSessionBtn').onclick = async () => {
        try {
            const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.START_SESSION(debateId)), {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to start debate session');
            // Redirect to hosting window page
            window.location.href = `hosting.html?debateId=${debateId}`;
        } catch (e) {
            alert('Failed to start debate session');
        }
    };
    document.getElementById('endDebateSessionBtn').onclick = async () => {
        try {
            const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.END_SESSION(debateId)), {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to end debate session');
            alert('Debate session ended');
        } catch (e) {
            alert('Failed to end debate session');
        }
    };
}

// --- Main Init ---
// --- Coordinator Debate Flow Refactor ---

document.addEventListener('DOMContentLoaded', () => {
    debateId = getDebateId();
    if (!debateId) {
        alert('No debateId found.');
        return;
    }
    const { user: u, role } = getUserAndRole();
    user = u;
    userRole = role;
    // Only show create form, do NOT fetch debate or session on page load
    if (userRole === 'coordinator') {
        showCreateDebateForm();
    }
}); 
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
            // After creation, fetch debate, initialize socket, and show hosting window
            const debateRes = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.GET(debateId)), {
                headers: getAuthHeaders()
            });
            if (!debateRes.ok) throw new Error('Failed to fetch debate after creation');
            debate = await debateRes.json();
            await fetchSession();
            initializeSocket();
            maybeShowHostingWindow();
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
        maybeShowHostingWindow();
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

// Render registration form
function renderRegistrationForm() {
    if (userRole === 'participant') {
        registrationForm.innerHTML = `
            <form onsubmit="registerParticipant(event)">
                <input id="team-name" placeholder="Team Name" required><br>
                <input id="member-names" placeholder="Member Names (comma separated)" required><br>
                <input type="submit" value="Register">
            </form>
        `;
    } else if (userRole === 'audience') {
        registrationForm.innerHTML = `
            <form onsubmit="registerAudience(event)">
                <input id="audience-name" placeholder="Your Name" required><br>
                <input type="submit" value="Register as Audience">
            </form>
        `;
    } else {
        registrationForm.innerHTML = '<em>Registration forms are only visible to participants and audience.</em>';
    }
}

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

// --- Enhanced Coordinator Hosting Window ---

let hostingState = {
    timer: 0,
    timerInterval: null,
    currentSpeaker: null,
    scores: {}, // { participantId: { clarity, facts, arguments, presentation, understanding, total, side } }
};

function maybeShowHostingWindow() {
    if (userRole === 'coordinator' && debate) {
        document.getElementById('coordinator-hosting-window').style.display = '';
        showHostingWindow();
    }
}

function showHostingWindow() {
    const hostDiv = document.getElementById('coordinator-hosting-window');
    hostDiv.style.display = '';
    // Mock: assign half to 'for', half to 'against'
    const allMembers = (debate.teams || []).flatMap(team => (team.members || []).map(m => ({...m, team: team.name, _id: m._id || m.id || m.name})));
    const mid = Math.ceil(allMembers.length / 2);
    const forMotion = allMembers.slice(0, mid).map(m => ({...m, side: 'for'}));
    const againstMotion = allMembers.slice(mid).map(m => ({...m, side: 'against'}));
    let html = '<h2>Debate Hosting Window</h2>';
    html += '<div style="display:flex;gap:2rem;">';
    html += '<div><h3>For the Motion</h3><ul id="for-list">' + forMotion.map(m => `<li>${m.name} (${m.team}) <button onclick="selectSpeaker('${m._id}','for')">Select</button> <span id="tick-for-${m._id}"></span></li>`).join('') + '</ul></div>';
    html += '<div><h3>Against the Motion</h3><ul id="against-list">' + againstMotion.map(m => `<li>${m.name} (${m.team}) <button onclick="selectSpeaker('${m._id}','against')">Select</button> <span id="tick-against-${m._id}"></span></li>`).join('') + '</ul></div>';
    html += '</div>';
    html += '<div id="timer-block" style="margin-top:1rem;"></div>';
    html += '<button onclick="showLeaderboard()">Leaderboard</button> ';
    html += '<button onclick="redirectToDashboard()">Redirect to Dashboard</button>';
    hostDiv.innerHTML = html;
}

window.selectSpeaker = function(participantId, side) {
    hostingState.currentSpeaker = participantId;
    startTimer();
    showScoringModal(participantId, side);
};

function startTimer() {
    const timerBlock = document.getElementById('timer-block');
    hostingState.timer = debate.timerPerParticipant || 120; // default 2 min
    timerBlock.innerHTML = `<h4>Timer: <span id='timer-count'>${hostingState.timer}</span> seconds</h4><button onclick='stopChance()'>Stop Chance</button>`;
    if (hostingState.timerInterval) clearInterval(hostingState.timerInterval);
    hostingState.timerInterval = setInterval(() => {
        hostingState.timer--;
        document.getElementById('timer-count').textContent = hostingState.timer;
        if (hostingState.timer <= 0) stopChance();
    }, 1000);
}

window.stopChance = function() {
    if (hostingState.timerInterval) clearInterval(hostingState.timerInterval);
    if (hostingState.currentSpeaker) {
        document.getElementById(`tick-for-${hostingState.currentSpeaker}`)?.replaceWith('✔️');
        document.getElementById(`tick-against-${hostingState.currentSpeaker}`)?.replaceWith('✔️');
    }
    hostingState.currentSpeaker = null;
    document.getElementById('timer-block').innerHTML = '';
    document.getElementById('scoring-modal')?.remove();
};

function showScoringModal(participantId, side) {
    let modal = document.createElement('div');
    modal.id = 'scoring-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%,-50%)';
    modal.style.background = '#fff';
    modal.style.padding = '2rem';
    modal.style.border = '2px solid #2d6cdf';
    modal.style.zIndex = 1000;
    modal.innerHTML = `
        <h3>Score Participant</h3>
        <form id='scoreForm'>
            <label>Clarity of Thoughts (0-2): <input type='number' min='0' max='2' id='clarity' required></label><br>
            <label>Facts & Figures (0-2): <input type='number' min='0' max='2' id='facts' required></label><br>
            <label>Use of Arguments (0-2): <input type='number' min='0' max='2' id='arguments' required></label><br>
            <label>Presentation (0-2): <input type='number' min='0' max='2' id='presentation' required></label><br>
            <label>Understanding of Topic (0-2): <input type='number' min='0' max='2' id='understanding' required></label><br>
            <button type='submit'>Save Score</button>
        </form>
        <button onclick='document.getElementById("scoring-modal").remove()'>Close</button>
    `;
    document.body.appendChild(modal);
    document.getElementById('scoreForm').onsubmit = function(e) {
        e.preventDefault();
        const clarity = parseInt(document.getElementById('clarity').value, 10);
        const facts = parseInt(document.getElementById('facts').value, 10);
        const argumentsScore = parseInt(document.getElementById('arguments').value, 10);
        const presentation = parseInt(document.getElementById('presentation').value, 10);
        const understanding = parseInt(document.getElementById('understanding').value, 10);
        const total = clarity + facts + argumentsScore + presentation + understanding;
        hostingState.scores[participantId] = { clarity, facts, arguments: argumentsScore, presentation, understanding, total, side };
        document.getElementById('scoring-modal').remove();
    };
}

window.showLeaderboard = function() {
    let modal = document.createElement('div');
    modal.id = 'leaderboard-modal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%,-50%)';
    modal.style.background = '#fff';
    modal.style.padding = '2rem';
    modal.style.border = '2px solid #2d6cdf';
    modal.style.zIndex = 1000;
    const forScores = Object.entries(hostingState.scores).filter(([_, s]) => s.side === 'for').sort((a, b) => b[1].total - a[1].total);
    const againstScores = Object.entries(hostingState.scores).filter(([_, s]) => s.side === 'against').sort((a, b) => b[1].total - a[1].total);
    let html = '<h3>Leaderboard</h3><div style="display:flex;gap:2rem;">';
    html += '<div><h4>For the Motion</h4><ol>' + forScores.map(([id, s]) => `<li>${id}: ${s.total}</li>`).join('') + '</ol></div>';
    html += '<div><h4>Against the Motion</h4><ol>' + againstScores.map(([id, s]) => `<li>${id}: ${s.total}</li>`).join('') + '</ol></div>';
    html += '</div>';
    html += '<button onclick="document.getElementById(\'leaderboard-modal\').remove()">Close</button>';
    modal.innerHTML = html;
    document.body.appendChild(modal);
};

window.redirectToDashboard = function() {
    window.location.href = '../coordinator-dashboard.html';
};

// --- Main Init ---
// --- Coordinator Debate Flow Refactor ---

document.addEventListener('DOMContentLoaded', async () => {
    debateId = getDebateId();
    if (!debateId) {
        alert('No debateId found.');
        return;
    }
    const { user: u, role } = getUserAndRole();
    user = u;
    userRole = role;
    // On page load, do NOT call fetchDebate or initializeSocket yet
    // Instead, try to fetch the debate to check if it exists
    let debateExists = false;
    try {
        const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.GET(debateId)), {
            headers: getAuthHeaders()
        });
        if (res.ok) {
            debate = await res.json();
            debateExists = true;
        }
    } catch (e) {
        debateExists = false;
    }
    if (!debateExists && userRole === 'coordinator') {
        showCreateDebateForm();
        return;
    }
    if (debateExists) {
        // Now safe to fetch session, initialize socket, and show hosting window
        await fetchSession();
        initializeSocket();
        maybeShowHostingWindow();
    }
}); 
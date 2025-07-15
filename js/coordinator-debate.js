// Debate page logic for all roles
const socket = io();
const eventId = localStorage.getItem('currentEventId');
const eventTitle = localStorage.getItem('currentEventTitle');
const role = localStorage.getItem('currentEventRole');
const userId = localStorage.getItem('userId'); // Assumes userId is stored on login

document.getElementById('debate-title').textContent = eventTitle + ' - Debate';

// Join debate room
socket.emit('join-debate', { eventId, userId, role });

// Handle debate joined
socket.on('debate-joined', (data) => {
    renderDebateState(data);
});

// Handle state updates
socket.on('debate-state-update', (data) => {
    updateDebateState(data);
});

// Handle new messages
socket.on('debate-message', (msg) => {
    addChatMessage(msg);
});

// Handle votes
socket.on('debate-vote', (vote) => {
    addVote(vote);
});

function renderDebateState(data) {
    document.getElementById('debate-status').textContent = 'Status: ' + data.status;
    updateSpeaker(data.currentSpeaker, data.timer);
    renderControls(data);
    renderChat(data.messages);
    renderVoting(data.votes);
}

function updateDebateState(data) {
    if (data.status) document.getElementById('debate-status').textContent = 'Status: ' + data.status;
    if ('currentSpeaker' in data) updateSpeaker(data.currentSpeaker, data.timer);
    // Optionally update participants/audience lists
}

function updateSpeaker(speakerId, timer) {
    document.getElementById('current-speaker').textContent = speakerId ? 'Current Speaker: ' + speakerId : 'No speaker';
    document.getElementById('speaker-timer').textContent = timer ? 'Time left: ' + timer + 's' : '';
}

function renderControls(data) {
    const controls = document.getElementById('debate-controls');
    controls.innerHTML = '';
    if (role === 'coordinator') {
        // Coordinator controls: assign speaker, end turn, end debate
        controls.innerHTML += '<button onclick="assignSpeaker()">Assign Speaker</button>';
        controls.innerHTML += '<button onclick="endTurn()">End Turn</button>';
        controls.innerHTML += '<button onclick="endDebate()">End Debate</button>';
    } else if (role === 'participant') {
        // Participant controls: request to speak, send message
        controls.innerHTML += '<button onclick="sendMessage()">Send Message</button>';
    } else if (role === 'audience') {
        // Audience controls: vote, send message (if allowed)
        controls.innerHTML += '<button onclick="sendVote()">Vote</button>';
    }
}

function renderChat(messages) {
    const chat = document.getElementById('debate-chat');
    chat.innerHTML = '<h3>Chat</h3>' + (messages || []).map(m => `<div><b>${m.role}:</b> ${m.content}</div>`).join('');
}

function addChatMessage(msg) {
    const chat = document.getElementById('debate-chat');
    chat.innerHTML += `<div><b>${msg.role}:</b> ${msg.content}</div>`;
}

function renderVoting(votes) {
    const voting = document.getElementById('debate-voting');
    voting.innerHTML = '<h3>Voting</h3>' + (votes || []).map(v => `<div>${v.voteType}</div>`).join('');
}

function addVote(vote) {
    const voting = document.getElementById('debate-voting');
    voting.innerHTML += `<div>${vote.voteType}</div>`;
}

// Coordinator actions
function assignSpeaker() {
    const speakerId = prompt('Enter participant userId to assign as speaker:');
    const timer = prompt('Enter time (seconds) for this speaker:');
    socket.emit('assign-speaker', { eventId, userId, speakerId, timer });
}
function endTurn() {
    socket.emit('end-turn', { eventId, userId });
}
function endDebate() {
    socket.emit('end-debate', { eventId, userId });
}
// Participant/audience actions
function sendMessage() {
    const content = prompt('Enter your message:');
    socket.emit('send-debate-message', { eventId, userId, role, content });
}
function sendVote() {
    const voteType = prompt('Enter your vote (e.g., upvote, like):');
    socket.emit('send-vote', { eventId, userId, voteType });
} 
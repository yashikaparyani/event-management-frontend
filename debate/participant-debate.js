// participant-debate.js - Enhanced with real-time Socket.IO integration

let debateId = null;
let debate = null;
let user = null;
let userSide = null;
let socket = null;
let notes = '';
let participants = { for: [], against: [] };
let currentSpeaker = null;
let timeLeft = 0;
let timerInterval = null;

function getDebateId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debateId');
}

async function fetchDebate() {
    try {
        const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.GET(debateId)), {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch debate');
        debate = await res.json();
        showSideSelectionModal();
    } catch (e) {
        document.getElementById('modal-content').innerHTML = '<span style="color:red">Failed to load debate details.</span>';
        document.getElementById('modal').style.display = '';
    }
}

function showSideSelectionModal() {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modal-content');
    if (!modal || !modalContent) return;
    modal.style.display = '';
    let html = `<h2>Join Debate</h2>`;
    html += `<div style="margin: 1rem 0;"><strong>Topic:</strong> ${debate.topics && debate.topics.length ? debate.topics[0] : 'N/A'}</div>`;
    html += `<div style="margin: 1rem 0;"><strong>Rules:</strong><ul>` + (debate.rules || []).map(r => `<li>${r}</li>`).join('') + `</ul></div>`;
    html += `<div style='margin:1.5rem 0; font-weight: bold;'>Choose your side:</div>`;
    html += `<div style="text-align: center;">`;
    html += `<button class='side-btn for' onclick="selectSide('for')">For the Motion</button>`;
    html += `<button class='side-btn against' onclick="selectSide('against')">Against the Motion</button>`;
    html += `</div>`;
    modalContent.innerHTML = html;
}

window.selectSide = async function(side) {
    userSide = side;
    try {
        // Register participant with their chosen side
        const response = await fetch(getApiUrl(`/api/debates/${debateId}/register`), {
            method: 'POST',
            headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ side: side })
        });
        if (!response.ok) throw new Error('Failed to register for debate');
        
        // Hide modal and show waiting screen immediately
        document.getElementById('modal').style.display = 'none';
        showWaitingScreen();
        initializeSocket();
    } catch (error) {
        alert('Failed to join debate: ' + error.message);
    }
};

function showWaitingScreen() {
    const waiting = document.getElementById('waiting-screen');
    if (!waiting) return;
    waiting.style.display = '';
    
    // Enhanced competitive waiting screen
    document.getElementById('welcome-message').innerHTML = `
        <h2 style="color: #2d6cdf; text-align: center; margin-bottom: 1rem;">🏆 Debate Arena 🏆</h2>
        <p style="text-align: center; font-size: 1.1rem; color: #666;">Get ready to showcase your debating skills!</p>
    `;
    
    document.getElementById('debate-topic').innerHTML = `
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
            <strong style="color: #2d6cdf;">📋 Topic:</strong> ${debate.topics && debate.topics.length ? debate.topics[0] : 'N/A'}
        </div>
    `;
    
    document.getElementById('debate-rules').innerHTML = `
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
            <strong style="color: #2d6cdf;">📜 Rules:</strong>
            <ul style="margin: 0.5rem 0;">` + (debate.rules || []).map(r => `<li>${r}</li>`).join('') + `</ul>
        </div>
    `;
    
    document.getElementById('side-display').innerHTML = `
        <div style="text-align: center; margin: 1rem 0;">
            <strong>Your Side:</strong> 
            <span class='side-btn ${userSide}' style="font-size: 1.1rem; padding: 0.5rem 1rem;">
                ${userSide === 'for' ? '✅ For the Motion' : '❌ Against the Motion'}
            </span>
        </div>
    `;
    
    document.getElementById('current-speaker').innerHTML = `
        <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
            <strong>🎤 Current Speaker:</strong> Waiting for debate to start...
        </div>
    `;
    
    document.getElementById('timer').innerHTML = `
        <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
            <strong>⏱️ Time Left:</strong> --
        </div>
    `;
    
    document.getElementById('turn-anim').innerHTML = '';
    
    // Notes section
    const notesBox = document.getElementById('notes');
    if (notesBox) {
        notesBox.value = notes;
        notesBox.placeholder = "Take notes here to prepare your arguments...";
        notesBox.style.border = "2px solid #e0e0e0";
        notesBox.style.borderRadius = "8px";
        notesBox.style.padding = "1rem";
        notesBox.oninput = function() { notes = notesBox.value; };
    }
    
    // Initialize participant lists
    updateParticipantLists();
}

function updateParticipantLists() {
    const leaderboardDiv = document.getElementById('leaderboard');
    if (!leaderboardDiv) return;
    
    let html = `
        <div style="margin-top: 2rem;">
            <h3 style="color: #2d6cdf; text-align: center; margin-bottom: 1rem;">👥 Participants</h3>
            <div style="display: flex; gap: 2rem; justify-content: space-around;">
                <div style="flex: 1;">
                    <h4 style="color: #27ae60; text-align: center;">✅ For the Motion</h4>
                    <ul style="list-style: none; padding: 0;">
    `;
    
    participants.for.forEach(p => {
        const isCurrentUser = p._id === user.id || p._id === user._id;
        const isSpeaking = currentSpeaker && (currentSpeaker._id === p._id || currentSpeaker === p._id);
        html += `
            <li style="
                background: ${isCurrentUser ? '#e8f5e8' : '#f8f9fa'}; 
                padding: 0.5rem; 
                margin: 0.5rem 0; 
                border-radius: 5px;
                border-left: 4px solid ${isSpeaking ? '#ff6b6b' : '#27ae60'};
                ${isSpeaking ? 'animation: pulse 1s infinite;' : ''}
            ">
                ${p.name} ${isCurrentUser ? '(You)' : ''} ${isSpeaking ? '🎤' : ''}
            </li>
        `;
    });
    
    html += `
                    </ul>
                </div>
                <div style="flex: 1;">
                    <h4 style="color: #e74c3c; text-align: center;">❌ Against the Motion</h4>
                    <ul style="list-style: none; padding: 0;">
    `;
    
    participants.against.forEach(p => {
        const isCurrentUser = p._id === user.id || p._id === user._id;
        const isSpeaking = currentSpeaker && (currentSpeaker._id === p._id || currentSpeaker === p._id);
        html += `
            <li style="
                background: ${isCurrentUser ? '#ffeaea' : '#f8f9fa'}; 
                padding: 0.5rem; 
                margin: 0.5rem 0; 
                border-radius: 5px;
                border-left: 4px solid ${isSpeaking ? '#ff6b6b' : '#e74c3c'};
                ${isSpeaking ? 'animation: pulse 1s infinite;' : ''}
            ">
                ${p.name} ${isCurrentUser ? '(You)' : ''} ${isSpeaking ? '🎤' : ''}
            </li>
        `;
    });
    
    html += `
                    </ul>
                </div>
            </div>
        </div>
        <style>
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
        </style>
    `;
    
    leaderboardDiv.innerHTML = html;
}

function initializeSocket() {
    socket = io(config.SOCKET_URL);
    
    // Join debate room
    socket.emit('join-debate', { debateId, userId: user.id || user._id });
    
    // Listen for participant updates
    socket.on('participants-updated', (data) => {
        participants = data.participants;
        updateParticipantLists();
    });
    
    // Listen for speaker changes
    socket.on('speaker-changed', (data) => {
        currentSpeaker = data.currentSpeaker;
        updateCurrentSpeaker(data.currentSpeaker);
        updateParticipantLists();
    });
    
    // Listen for timer updates
    socket.on('timer-updated', (data) => {
        updateTimer(data.timeLeft);
    });
    
    // Listen for turn notifications
    socket.on('your-turn', () => {
        showTurnNotification();
    });
    
    // Listen for leaderboard redirect
    socket.on('show-leaderboard', (data) => {
        window.location.href = `leaderboard.html?debateId=${debateId}`;
    });
    
    socket.on('error', (data) => {
        console.error('Socket error:', data.message);
    });
}

function updateCurrentSpeaker(speaker) {
    const currentSpeakerDiv = document.getElementById('current-speaker');
    if (!currentSpeakerDiv) return;
    
    const isMyTurn = speaker && (speaker._id === user.id || speaker._id === user._id || speaker === user.id || speaker === user._id);
    
    if (isMyTurn) {
        currentSpeakerDiv.innerHTML = `
            <div style="background: #ffebee; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center; border: 2px solid #f44336;">
                <strong style="color: #f44336; font-size: 1.2rem;">🎤 It's your turn!</strong>
            </div>
        `;
    } else if (speaker) {
        const speakerName = typeof speaker === 'string' ? speaker : speaker.name;
        currentSpeakerDiv.innerHTML = `
            <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
                <strong>🎤 Current Speaker:</strong> ${speakerName}
            </div>
        `;
    } else {
        currentSpeakerDiv.innerHTML = `
            <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center;">
                <strong>🎤 Current Speaker:</strong> Waiting for debate to start...
            </div>
        `;
    }
}

function updateTimer(seconds) {
    timeLeft = seconds;
    const timerDiv = document.getElementById('timer');
    if (!timerDiv) return;
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeString = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    const isLowTime = seconds <= 30;
    timerDiv.innerHTML = `
        <div style="background: ${isLowTime ? '#ffebee' : '#fff3e0'}; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: center; ${isLowTime ? 'border: 2px solid #f44336;' : ''}">
            <strong style="color: ${isLowTime ? '#f44336' : '#ff9800'}; font-size: 1.3rem;">⏱️ Time Left: ${timeString}</strong>
        </div>
    `;
}

function showTurnNotification() {
    const turnAnimDiv = document.getElementById('turn-anim');
    if (!turnAnimDiv) return;
    
    turnAnimDiv.innerHTML = `
        <div class='turn-anim' style='color:#f44336; font-size: 1.5rem; text-align: center; font-weight: bold; background: #ffebee; padding: 1rem; border-radius: 8px; border: 2px solid #f44336;'>
            🚨 It's your turn! 🚨
        </div>
    `;
    
    // Clear the notification after 5 seconds
    setTimeout(() => {
        turnAnimDiv.innerHTML = '';
    }, 5000);
}

window.addEventListener('DOMContentLoaded', async () => {
    debateId = getDebateId();
    if (!debateId) {
        alert('No debateId found.');
        return;
    }
    
    user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        alert('Please login first.');
        window.location.href = '../login.html';
        return;
    }
    
    await fetchDebate();
});
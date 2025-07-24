// audience-debate.js - Real-time debate viewing for audience

let debateId = null;
let debate = null;
let user = null;
let socket = null;
let currentSpeaker = null;
let timeLeft = 0;
let participants = { for: [], against: [] };
let currentReaction = null; // 'like' or 'dislike'

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
        displayDebateInfo();
        initializeSocket();
    } catch (e) {
        document.getElementById('debate-status').innerHTML = '❌ Failed to load debate';
    }
}

function displayDebateInfo() {
    document.getElementById('debate-info').innerHTML = `
        <div style="background: white; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h3 style="color: #2d6cdf; margin-bottom: 1rem;">📋 Debate Topic</h3>
            <p style="font-size: 1.1rem; margin-bottom: 1rem;">${debate.topics && debate.topics.length ? debate.topics[0] : 'N/A'}</p>
            <h4 style="color: #2d6cdf;">📜 Rules</h4>
            <ul>${(debate.rules || []).map(r => `<li>${r}</li>`).join('')}</ul>
        </div>
    `;
}

function initializeSocket() {
    socket = io(config.SOCKET_URL);
    
    socket.emit('join-debate', { debateId, userId: user.id || user._id });
    
    socket.on('participants-updated', (data) => {
        participants = data.participants;
        updateParticipantLists();
    });
    
    socket.on('speaker-changed', (data) => {
        currentSpeaker = data.currentSpeaker;
        updateCurrentSpeaker(data.currentSpeaker);
        resetReactionButtons();
    });
    
    socket.on('timer-updated', (data) => {
        updateTimer(data.timeLeft);
    });
    
    socket.on('show-leaderboard', () => {
        window.location.href = `leaderboard.html?debateId=${debateId}`;
    });
    
    socket.on('debate-started', () => {
        document.getElementById('debate-status').innerHTML = '🔴 Debate is now LIVE!';
    });
    
    socket.on('debate-ended', () => {
        document.getElementById('debate-status').innerHTML = '✅ Debate has ended';
        disableReactionButtons();
    });
}

function updateCurrentSpeaker(speaker) {
    const nameDiv = document.getElementById('current-speaker-name');
    const sideDiv = document.getElementById('speaker-side');
    
    if (speaker) {
        const speakerName = typeof speaker === 'string' ? speaker : speaker.name;
        nameDiv.innerHTML = speakerName;
        sideDiv.innerHTML = `Speaking for: ${getSpeakerSide(speaker)}`;
        enableReactionButtons();
    } else {
        nameDiv.innerHTML = 'Waiting for next speaker...';
        sideDiv.innerHTML = '';
        disableReactionButtons();
    }
}

function getSpeakerSide(speaker) {
    const speakerId = typeof speaker === 'string' ? speaker : speaker._id;
    if (participants.for.some(p => p._id === speakerId)) return '✅ For the Motion';
    if (participants.against.some(p => p._id === speakerId)) return '❌ Against the Motion';
    return 'Unknown';
}

function updateTimer(seconds) {
    timeLeft = seconds;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const timeString = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    document.getElementById('timer-display').innerHTML = timeString;
    document.getElementById('timer-status').innerHTML = seconds > 0 ? 'Speaker time remaining' : 'Time\'s up!';
    
    if (seconds <= 0) {
        disableReactionButtons();
    }
}

function updateParticipantLists() {
    updateParticipantList('for-participants', participants.for);
    updateParticipantList('against-participants', participants.against);
}

function updateParticipantList(containerId, participantList) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = participantList.map(p => {
        const isSpeaking = currentSpeaker && (currentSpeaker._id === p._id || currentSpeaker === p._id);
        const hasSpoken = p.hasSpoken || false;
        
        return `
            <div class="participant-item ${isSpeaking ? 'speaking' : ''} ${hasSpoken ? 'completed' : ''}">
                <span>${p.name}</span>
                <span class="status-indicator">
                    ${isSpeaking ? '🎤' : hasSpoken ? '✅' : '⏳'}
                </span>
            </div>
        `;
    }).join('');
}

window.reactToSpeaker = function(reaction) {
    if (!currentSpeaker || timeLeft <= 0) return;
    
    currentReaction = reaction;
    updateReactionButtons();
    
    // Send reaction to server
    socket.emit('audience-reaction', {
        debateId,
        speakerId: typeof currentSpeaker === 'string' ? currentSpeaker : currentSpeaker._id,
        reaction: reaction,
        userId: user.id || user._id
    });
    
    document.getElementById('reaction-status').innerHTML = `You ${reaction}d this speaker`;
};

function updateReactionButtons() {
    const likeBtn = document.getElementById('like-btn');
    const dislikeBtn = document.getElementById('dislike-btn');
    
    likeBtn.classList.toggle('selected', currentReaction === 'like');
    dislikeBtn.classList.toggle('selected', currentReaction === 'dislike');
}

function resetReactionButtons() {
    currentReaction = null;
    updateReactionButtons();
    document.getElementById('reaction-status').innerHTML = 'Select your reaction to the current speaker';
}

function enableReactionButtons() {
    document.getElementById('like-btn').disabled = false;
    document.getElementById('dislike-btn').disabled = false;
}

function disableReactionButtons() {
    document.getElementById('like-btn').disabled = true;
    document.getElementById('dislike-btn').disabled = true;
    document.getElementById('reaction-status').innerHTML = 'Reactions disabled';
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

// hosting.js - Enhanced coordinator hosting with real-time Socket.IO integration

let debateId = null;
let debate = null;
let socket = null;
let user = null;
let hostingState = {
    timer: 0,
    timerInterval: null,
    currentSpeaker: null,
    scores: {}, // { participantId: { clarity, facts, arguments, presentation, knowledge, total, side, likes } }
    participants: { for: [], against: [] },
    speakerQueue: []
};

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
        renderDebateDetails();
        initializeSocket();
        showHostingWindow();
    } catch (e) {
        const detailsDiv = document.getElementById('debate-details');
        if (detailsDiv) {
            detailsDiv.innerHTML = '<span style="color:red">Failed to load debate details.</span>';
        }
    }
}

function renderDebateDetails() {
    if (!debate) return;
    const detailsDiv = document.getElementById('debate-details');
    if (!detailsDiv) return;
    let html = `
        <div style="background: #f8f9fa; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem;">
            <h2 style="color: #2d6cdf; margin-bottom: 1rem;">🎯 Debate Details</h2>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div><strong>📋 Event:</strong> ${debate.event.title}</div>
                <div><strong>📅 Date:</strong> ${new Date(debate.event.date).toLocaleDateString()}</div>
                <div><strong>🕐 Time:</strong> ${debate.event.time || 'N/A'}</div>
                <div><strong>📍 Location:</strong> ${debate.event.location}</div>
                <div><strong>⏱️ Timer per participant:</strong> ${debate.timerPerParticipant || 120} seconds</div>
                <div><strong>🎤 Topic:</strong> ${debate.topics && debate.topics.length ? debate.topics[0] : 'N/A'}</div>
            </div>
        </div>
    `;
    detailsDiv.innerHTML = html;
}

function initializeSocket() {
    socket = io(config.SOCKET_URL);
    
    // Join debate room as coordinator
    socket.emit('join-debate', { debateId, userId: user.id || user._id });
    
    // Listen for participant updates
    socket.on('participants-updated', (data) => {
        hostingState.participants = data.participants;
        updateParticipantLists();
    });
    
    // Listen for audience reactions
    socket.on('audience-reaction', (data) => {
        updateParticipantLikes(data.speakerId, data.reaction);
    });
}

function showHostingWindow() {
    const hostDiv = document.getElementById('hosting-window');
    if (!hostDiv) return;
    hostDiv.style.display = '';
    
    let html = `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 2rem; border-radius: 12px; text-align: center; margin-bottom: 2rem;">
            <h2>🏆 Debate Hosting Control Panel</h2>
            <p>Manage the live debate session</p>
        </div>
        
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            <button onclick="endEvent()" style="background: #f44336; color: white; padding: 1rem 2rem; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer;">🛑 End Event</button>
            <button onclick="showLeaderboard()" style="background: #4caf50; color: white; padding: 1rem 2rem; border: none; border-radius: 8px; font-size: 1.1rem; cursor: pointer;">🏆 Show Leaderboard</button>
        </div>
        
        <div style="display: flex; gap: 2rem; margin-bottom: 2rem;">
            <div style="flex: 1; background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 5px solid #4caf50;">
                <h3 style="color: #4caf50; text-align: center; margin-bottom: 1rem;">✅ For the Motion</h3>
                <div id="for-list"></div>
            </div>
            <div style="flex: 1; background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-left: 5px solid #f44336;">
                <h3 style="color: #f44336; text-align: center; margin-bottom: 1rem;">❌ Against the Motion</h3>
                <div id="against-list"></div>
            </div>
        </div>
        
        <div id="timer-block" style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);"></div>
        
        <div id="scoreboard-section" style="display: none;"></div>
    `;
    
    hostDiv.innerHTML = html;
    updateParticipantLists();
}

function updateParticipantLists() {
    updateParticipantList('for-list', hostingState.participants.for || [], 'for');
    updateParticipantList('against-list', hostingState.participants.against || [], 'against');
}

function updateParticipantList(containerId, participants, side) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = participants.map(p => {
        const hasSpoken = hostingState.scores[p._id] ? true : false;
        const likes = hostingState.scores[p._id] ? hostingState.scores[p._id].likes || 0 : 0;
        const isCurrent = hostingState.currentSpeaker === p._id;
        
        return `
            <div style="
                background: ${isCurrent ? '#e3f2fd' : hasSpoken ? '#e8f5e9' : '#f8f9fa'};
                padding: 1rem;
                margin: 0.5rem 0;
                border-radius: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border: ${isCurrent ? '2px solid #2196f3' : 'none'};
            ">
                <div>
                    <strong>${p.name}</strong>
                    ${likes > 0 ? `<span style="margin-left: 0.5rem; color: #4caf50;">👍 ${likes}</span>` : ''}
                </div>
                <div>
                    ${hasSpoken ? '<span style="color: #4caf50; font-size: 1.2rem;">✅</span>' : ''}
                    ${isCurrent ? '<span style="color: #2196f3; font-size: 1.2rem;">🎤</span>' : ''}
                    <button onclick="selectSpeaker('${p._id}', '${side}', '${p.name}')" 
                            style="margin-left: 0.5rem; padding: 0.5rem 1rem; background: #2d6cdf; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        ${isCurrent ? 'Current' : 'Select'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

window.selectSpeaker = function(participantId, side, participantName) {
    hostingState.currentSpeaker = participantId;
    
    // Notify participant via socket
    socket.emit('speaker-changed', {
        debateId,
        currentSpeaker: { _id: participantId, name: participantName },
        userId: user.id || user._id
    });
    
    // Notify the specific participant that it's their turn
    socket.emit('your-turn', {
        debateId,
        participantId,
        userId: user.id || user._id
    });
    
    startTimer(participantName);
    updateParticipantLists();
};

function startTimer(speakerName) {
    const timerBlock = document.getElementById('timer-block');
    if (!timerBlock) return;
    
    hostingState.timer = debate.timerPerParticipant || 120;
    
    timerBlock.innerHTML = `
        <h3>⏱️ Current Speaker: <span style="color: #2d6cdf;">${speakerName}</span></h3>
        <div style="font-size: 2rem; font-weight: bold; color: #ff9800; margin: 1rem 0;">
            <span id='timer-count'>${hostingState.timer}</span> seconds
        </div>
        <div style="margin: 1rem 0;">
            <button onclick='skipChance()' style="background: #ff9800; color: white; padding: 0.8rem 1.5rem; border: none; border-radius: 8px; margin-right: 1rem; cursor: pointer; font-size: 1rem;">⏭️ Skip Chance</button>
            <button onclick='showScoringModal("${hostingState.currentSpeaker}", "${speakerName}")' style="background: #4caf50; color: white; padding: 0.8rem 1.5rem; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem;">📊 Open Scoreboard</button>
        </div>
    `;
    
    if (hostingState.timerInterval) clearInterval(hostingState.timerInterval);
    
    hostingState.timerInterval = setInterval(() => {
        hostingState.timer--;
        const timerCount = document.getElementById('timer-count');
        if (timerCount) timerCount.textContent = hostingState.timer;
        
        // Broadcast timer update to all participants and audience
        socket.emit('timer-updated', {
            debateId,
            timeLeft: hostingState.timer,
            userId: user.id || user._id
        });
        
        if (hostingState.timer <= 0) {
            clearInterval(hostingState.timerInterval);
            timerBlock.innerHTML += '<div style="color: #f44336; font-weight: bold; margin-top: 1rem;">⏰ Time\'s up!</div>';
        }
    }, 1000);
}

window.skipChance = function() {
    if (hostingState.timerInterval) {
        clearInterval(hostingState.timerInterval);
    }
    
    const timerBlockElement = document.getElementById('timer-block');
    if (timerBlockElement) {
        timerBlockElement.innerHTML = `
            <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; border: 2px solid #ff9800;">
                <h4 style="color: #e65100;">⏭️ Speaker's chance has been skipped</h4>
                <p>Select the next speaker to continue</p>
            </div>
        `;
    }
    
    // Mark current speaker as completed without score
    if (hostingState.currentSpeaker) {
        if (!hostingState.scores[hostingState.currentSpeaker]) {
            hostingState.scores[hostingState.currentSpeaker] = {
                clarity: 0, facts: 0, arguments: 0, presentation: 0, knowledge: 0,
                total: 0, side: getCurrentSpeakerSide(), likes: 0, skipped: true
            };
        }
    }
    
    hostingState.currentSpeaker = null;
    updateParticipantLists();
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

// Main init
window.addEventListener('DOMContentLoaded', async () => {
    debateId = getDebateId();
    if (!debateId) {
        alert('No debateId found.');
        return;
    }
    await fetchDebate();
}); 
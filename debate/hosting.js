// hosting.js

let debateId = null;
let debate = null;
let session = null;
let hostingState = {
    timer: 0,
    timerInterval: null,
    currentSpeaker: null,
    scores: {}, // { participantId: { clarity, facts, arguments, presentation, understanding, total, side } }
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
        showHostingWindow();
    } catch (e) {
        document.getElementById('debate-details').innerHTML = '<span style="color:red">Failed to load debate details.</span>';
    }
}

function renderDebateDetails() {
    if (!debate) return;
    let html = '';
    html += `<div><strong>Name:</strong> ${debate.event.title}</div>`;
    html += `<div><strong>Date:</strong> ${new Date(debate.event.date).toLocaleDateString()}</div>`;
    html += `<div><strong>Time:</strong> ${debate.event.time || ''}</div>`;
    html += `<div><strong>Location:</strong> ${debate.event.location}</div>`;
    html += `<div><strong>Description:</strong> ${debate.event.description}</div>`;
    html += `<div><strong>Timer per participant:</strong> ${debate.timerPerParticipant || 120} seconds</div>`;
    document.getElementById('debate-details').innerHTML = html;
}

function showHostingWindow() {
    const hostDiv = document.getElementById('hosting-window');
    hostDiv.style.display = '';
    // Mock: assign half to 'for', half to 'against'
    const allMembers = (debate.teams || []).flatMap(team => (team.members || []).map(m => ({...m, team: team.name, _id: m._id || m.id || m.name})));
    const mid = Math.ceil(allMembers.length / 2);
    const forMotion = allMembers.slice(0, mid).map(m => ({...m, side: 'for'}));
    const againstMotion = allMembers.slice(mid).map(m => ({...m, side: 'against'}));
    let html = '<h2>Debate Hosting</h2>';
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

// Main init
window.addEventListener('DOMContentLoaded', async () => {
    debateId = getDebateId();
    if (!debateId) {
        alert('No debateId found.');
        return;
    }
    await fetchDebate();
}); 
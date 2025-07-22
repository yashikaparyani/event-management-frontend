// participant-debate.js

let debateId = null;
let debate = null;
let user = null;
let userSide = null;
let currentSpeaker = null;
let timer = null;
let notes = '';

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
    html += `<div><strong>Topic:</strong> ${debate.topics && debate.topics.length ? debate.topics[0] : 'N/A'}</div>`;
    html += `<div><strong>Rules:</strong><ul>` + (debate.rules || []).map(r => `<li>${r}</li>`).join('') + `</ul></div>`;
    html += `<div style='margin:1rem 0;'>Choose your side:</div>`;
    html += `<button class='side-btn for' onclick="selectSide('for')">For the Motion</button>`;
    html += `<button class='side-btn against' onclick="selectSide('against')">Against the Motion</button>`;
    modalContent.innerHTML = html;
}

window.selectSide = function(side) {
    userSide = side;
    // Here you would register the participant with the backend and their side
    // For now, just proceed to waiting screen
    document.getElementById('modal').style.display = 'none';
    showWaitingScreen();
};

function showWaitingScreen() {
    const waiting = document.getElementById('waiting-screen');
    if (!waiting) return;
    waiting.style.display = '';
    document.getElementById('welcome-message').innerHTML = `<h2>Welcome to the Debate!</h2>`;
    document.getElementById('debate-topic').innerHTML = `<strong>Topic:</strong> ${debate.topics && debate.topics.length ? debate.topics[0] : 'N/A'}`;
    document.getElementById('debate-rules').innerHTML = `<strong>Rules:</strong><ul>` + (debate.rules || []).map(r => `<li>${r}</li>`).join('') + `</ul>`;
    document.getElementById('side-display').innerHTML = `<strong>Your Side:</strong> <span class='side-btn ${userSide}'>${userSide === 'for' ? 'For the Motion' : 'Against the Motion'}</span>`;
    document.getElementById('current-speaker').innerHTML = `<strong>Current Speaker:</strong> Waiting for debate to start...`;
    document.getElementById('timer').innerHTML = `<strong>Time Left:</strong> --`;
    document.getElementById('turn-anim').innerHTML = '';
    // Restore notes if any
    const notesBox = document.getElementById('notes');
    if (notesBox) {
        notesBox.value = notes;
        notesBox.oninput = function() { notes = notesBox.value; };
    }
    // Mock leaderboard
    document.getElementById('leaderboard').innerHTML = `<h3>Leaderboard</h3><div>Coming soon...</div>`;
}

// Mock real-time updates (replace with Socket.IO integration)
function mockRealtime() {
    setTimeout(() => {
        document.getElementById('current-speaker').innerHTML = `<strong>Current Speaker:</strong> Alice (For the Motion)`;
        document.getElementById('timer').innerHTML = `<strong>Time Left:</strong> 90s`;
        document.getElementById('turn-anim').innerHTML = `<div class='turn-anim'>Now speaking: Alice</div>`;
    }, 2000);
    setTimeout(() => {
        document.getElementById('current-speaker').innerHTML = `<strong>Current Speaker:</strong> <span style='color:#e74c3c;'>It's your turn!</span>`;
        document.getElementById('timer').innerHTML = `<strong>Time Left:</strong> 120s`;
        document.getElementById('turn-anim').innerHTML = `<div class='turn-anim' style='color:#e74c3c;'>It's your turn! Start speaking!</div>`;
    }, 6000);
    setTimeout(() => {
        document.getElementById('current-speaker').innerHTML = `<strong>Current Speaker:</strong> Bob (Against the Motion)`;
        document.getElementById('timer').innerHTML = `<strong>Time Left:</strong> 90s`;
        document.getElementById('turn-anim').innerHTML = `<div class='turn-anim'>Now speaking: Bob</div>`;
    }, 12000);
}

window.addEventListener('DOMContentLoaded', async () => {
    debateId = getDebateId();
    if (!debateId) {
        alert('No debateId found.');
        return;
    }
    // For now, mock user
    user = JSON.parse(localStorage.getItem('user')) || { name: 'Participant' };
    await fetchDebate();
    // Start mock real-time updates
    setTimeout(mockRealtime, 1000);
}); 
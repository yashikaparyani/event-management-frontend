// Debate Hosting Page Logic - FULL IMPLEMENTATION
// Handles: participant lists, speaker selection, timer, scoreboard, skip, likes, leaderboard, real-time updates

document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const debateInfo = document.getElementById('debateInfo');
    const forList = document.getElementById('forList');
    const againstList = document.getElementById('againstList');
    const currentSpeakerBlock = document.getElementById('currentSpeakerBlock');
    const currentSpeaker = document.getElementById('currentSpeaker');
    const timerBlock = document.getElementById('timerBlock');
    const timerValue = document.getElementById('timerValue');
    const skipChanceBtn = document.getElementById('skipChanceBtn');
    const scoreboardBlock = document.getElementById('scoreboardBlock');
    const scoreForm = document.getElementById('scoreForm');
    const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
    const notificationBlock = document.getElementById('notificationBlock');

    // --- State ---
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId') || localStorage.getItem('currentDebateEventId');
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    let eventDetails = null;
    let participants = [];
    let forSide = [];
    let againstSide = [];
    let speakerIndex = 0;
    let speakerList = [];
    let timer = null;
    let timerDuration = 0;
    let timerRemaining = 0;
    let currentSpeakerObj = null;
    let scores = {}; // { userId: {clarity, facts, arguments, presentation, knowledge, total, spoken, likes} }
    let likes = {}; // { userId: number }
    let debateStarted = false;
    let socket = null;
    let leaderboardShown = false;

    // --- Utility Functions ---
    function showNotification(msg, type = 'info') {
        notificationBlock.textContent = msg;
        notificationBlock.className = `alert alert-${type} mt-3`;
        notificationBlock.classList.remove('d-none');
        setTimeout(() => notificationBlock.classList.add('d-none'), 3000);
    }

    function renderParticipantLists() {
    forList.innerHTML = '';
    againstList.innerHTML = '';
    const safeStr = v => (typeof v === 'string' && v.trim() ? v : '-');
    const safeLikes = v => (typeof v === 'number' && v >= 0 ? v : 0);
    const safeSpoken = v => !!v;
    (Array.isArray(forSide) ? forSide : []).forEach(p => {
        const li = document.createElement('li');
        li.className = 'participant-item';
        li.innerHTML = `<span>${safeStr(p.name)} ${safeSpoken(scores[p._id]?.spoken) ? '<i class="fas fa-check text-success"></i>' : ''}</span> <span class="badge bg-secondary">${safeLikes(scores[p._id]?.likes)} <i class="fas fa-heart text-danger"></i></span>`;
        li.onclick = () => selectSpeaker(p._id);
        forList.appendChild(li);
    });
    (Array.isArray(againstSide) ? againstSide : []).forEach(p => {
        const li = document.createElement('li');
        li.className = 'participant-item';
        li.innerHTML = `<span>${safeStr(p.name)} ${safeSpoken(scores[p._id]?.spoken) ? '<i class="fas fa-check text-success"></i>' : ''}</span> <span class="badge bg-secondary">${safeLikes(scores[p._id]?.likes)} <i class="fas fa-heart text-danger"></i></span>`;
        li.onclick = () => selectSpeaker(p._id);
        againstList.appendChild(li);
    });
}

function renderCurrentSpeaker() {
    const safeStr = v => (typeof v === 'string' && v.trim() ? v : '-');
    if (!currentSpeakerObj) {
        currentSpeaker.textContent = '-';
        timerValue.textContent = '';
        return;
    }
    currentSpeaker.innerHTML = `<b>${safeStr(currentSpeakerObj.name)}</b> (${safeStr(currentSpeakerObj.side)})`;
    timerValue.textContent = timerRemaining + 's';
}

    function resetScoreForm() {
        scoreForm.reset();
    }

    function enableScoreForm(enable) {
        [...scoreForm.elements].forEach(el => el.disabled = !enable);
    }

    function updateScoreForSpeaker(values) {
        if (!currentSpeakerObj) return;
        scores[currentSpeakerObj._id] = {
            ...scores[currentSpeakerObj._id],
            ...values,
            total: Object.values(values).reduce((a, b) => a + Number(b), 0),
            spoken: true,
            likes: scores[currentSpeakerObj._id]?.likes || 0
        };
    }

    function selectSpeaker(userId) {
        if (timer && timerRemaining > 0) {
            showNotification('Wait for current speaker to finish or skip.', 'warning');
            return;
        }
        const p = participants.find(x => x._id === userId);
        if (!p) return;
        currentSpeakerObj = p;
        timerRemaining = timerDuration;
        renderCurrentSpeaker();
        enableScoreForm(true);
        resetScoreForm();
        // Notify all via socket
        socket.emit('debate-next-speaker', { eventId, userId: p._id });
        startTimer();
    }

    function startTimer() {
        clearInterval(timer);
        timer = setInterval(() => {
            timerRemaining--;
            timerValue.textContent = timerRemaining + 's';
            if (timerRemaining <= 0) {
                clearInterval(timer);
                enableScoreForm(true);
                showNotification('Time up! Please submit score.');
            }
        }, 1000);
    }

    function endSpeakerTurn() {
        clearInterval(timer);
        timerRemaining = 0;
        enableScoreForm(true);
        showNotification('Speaker turn ended. Submit score.');
    }

    function showLeaderboard() {
        leaderboardShown = true;
        socket.emit('debate-show-leaderboard', { eventId });
        window.location.href = `leaderboard.html?eventId=${eventId}`;
    }

    // --- Event Handlers ---
    skipChanceBtn.onclick = () => {
        if (!currentSpeakerObj) return;
        endSpeakerTurn();
        socket.emit('debate-skip-chance', { eventId, userId: currentSpeakerObj._id });
    };

    scoreForm.onsubmit = (e) => {
        e.preventDefault();
        if (!currentSpeakerObj) return;
        const formData = new FormData(scoreForm);
        const values = {
            clarity: Number(formData.get('clarity') || 0),
            facts: Number(formData.get('facts') || 0),
            arguments: Number(formData.get('arguments') || 0),
            presentation: Number(formData.get('presentation') || 0),
            knowledge: Number(formData.get('knowledge') || 0)
        };
        if (Object.values(values).some(v => v < 0 || v > 2)) {
            showNotification('Scores must be between 0 and 2.', 'danger');
            return;
        }
        updateScoreForSpeaker(values);
        enableScoreForm(false);
        showNotification('Score submitted. Select next speaker.');
        socket.emit('debate-score', { eventId, userId: currentSpeakerObj._id, ...values });
        currentSpeakerObj = null;
        renderCurrentSpeaker();
        renderParticipantLists();
    };

    showLeaderboardBtn.onclick = showLeaderboard;

    // --- Socket.IO Setup ---
    function setupSocket() {
        socket = io();
        socket.emit('join-debate', { eventId, userId: user._id });

        socket.on('debate-state', data => {
            // Sync state: participants, scores, likes, currentSpeaker
            participants = data.participants;
            forSide = participants.filter(p => p.side === 'for');
            againstSide = participants.filter(p => p.side === 'against');
            scores = data.scores || {};
            likes = data.likes || {};
            currentSpeakerObj = participants.find(x => x._id === data.currentSpeakerId) || null;
            timerDuration = data.timerPerParticipant || timerDuration;
            timerRemaining = data.timerRemaining || timerDuration;
            renderParticipantLists();
            renderCurrentSpeaker();
        });

        socket.on('debate-next-speaker', data => {
            currentSpeakerObj = participants.find(x => x._id === data.userId) || null;
            timerRemaining = timerDuration;
            renderCurrentSpeaker();
            enableScoreForm(true);
            resetScoreForm();
            showNotification(`It's ${currentSpeakerObj?.name}'s turn!`);
            startTimer();
        });

        socket.on('debate-score', data => {
            scores[data.userId] = {
                ...scores[data.userId],
                ...data.scores,
                total: Object.values(data.scores).reduce((a, b) => a + Number(b), 0),
                spoken: true,
                likes: scores[data.userId]?.likes || 0
            };
            renderParticipantLists();
        });

        socket.on('debate-like', data => {
            if (!scores[data.userId]) scores[data.userId] = {};
            scores[data.userId].likes = data.likes;
            renderParticipantLists();
        });

        socket.on('debate-skip-chance', data => {
            if (currentSpeakerObj && currentSpeakerObj._id === data.userId) {
                endSpeakerTurn();
            }
        });

        socket.on('debate-show-leaderboard', () => {
            if (!leaderboardShown) {
                window.location.href = `leaderboard.html?eventId=${eventId}`;
            }
        });
    }

    // --- Initial Data Fetch ---
    async function fetchDebateData() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/events/${eventId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch debate event');
            eventDetails = await res.json();
            debateInfo.innerHTML = `<b>Topic:</b> ${eventDetails.topic || '-'}<br><b>Rules:</b> ${eventDetails.rules || '-'}<br><b>Timer:</b> ${eventDetails.timerPerParticipant || '-'}s`;
            timerDuration = eventDetails.timerPerParticipant || 120;
        } catch (err) {
            debateInfo.innerHTML = '<span class="text-danger">Failed to load debate info.</span>';
        }
    }

    async function fetchParticipants() {
        // This assumes an endpoint /api/events/:id/participants with side info
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/events/${eventId}/participants`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch participants');
            participants = await res.json();
            forSide = participants.filter(p => p.side === 'for');
            againstSide = participants.filter(p => p.side === 'against');
            participants.forEach(p => {
                scores[p._id] = scores[p._id] || { clarity: 0, facts: 0, arguments: 0, presentation: 0, knowledge: 0, total: 0, spoken: false, likes: 0 };
            });
            renderParticipantLists();
        } catch (err) {
            forList.innerHTML = againstList.innerHTML = '<span class="text-danger">Failed to load participants.</span>';
        }
    }

    // --- Init ---
    (async function init() {
        await fetchDebateData();
        await fetchParticipants();
        setupSocket();
        enableScoreForm(false);
        renderCurrentSpeaker();
    })();
});

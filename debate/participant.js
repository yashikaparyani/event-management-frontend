// Debate Participant Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const debateInfo = document.getElementById('debateInfo');
    const sideModal = new bootstrap.Modal(document.getElementById('sideModal'));
    const sideModalTopic = document.getElementById('sideModalTopic');
    const sideModalRules = document.getElementById('sideModalRules');
    const chooseForBtn = document.getElementById('chooseForBtn');
    const chooseAgainstBtn = document.getElementById('chooseAgainstBtn');
    const yourSide = document.getElementById('yourSide');
    const forList = document.getElementById('forList');
    const againstList = document.getElementById('againstList');
    const currentSpeaker = document.getElementById('currentSpeaker');
    const timerValue = document.getElementById('timerValue');
    const notificationBlock = document.getElementById('notificationBlock');
    const notes = document.getElementById('notes');
    const speakModal = new bootstrap.Modal(document.getElementById('speakModal'));
    const scoreForm = document.getElementById('scoreForm');
    const speakTimer = document.getElementById('speakTimer');

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId') || localStorage.getItem('currentDebateEventId');
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    let eventDetails = null;
    let participants = [];
    let forSideArr = [];
    let againstSideArr = [];
    let mySide = null;
    let timerDuration = 0;
    let timer = null;
    let timerRemaining = 0;
    let isMyTurn = false;

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
    (Array.isArray(forSideArr) ? forSideArr : []).forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${safeStr(p.name)}</span>`;
        forList.appendChild(li);
    });
    (Array.isArray(againstSideArr) ? againstSideArr : []).forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${safeStr(p.name)}</span>`;
        againstList.appendChild(li);
    });
}

function renderCurrentSpeaker(speaker) {
    const safeStr = v => (typeof v === 'string' && v.trim() ? v : '-');
    currentSpeaker.textContent = speaker ? `${safeStr(speaker.name)} (${safeStr(speaker.side)})` : '-';
}

    function startTurnTimer() {
        clearInterval(timer);
        timerRemaining = timerDuration;
        speakTimer.textContent = `Time left: ${timerRemaining}s`;
        timer = setInterval(() => {
            timerRemaining--;
            speakTimer.textContent = `Time left: ${timerRemaining}s`;
            if (timerRemaining <= 0) {
                clearInterval(timer);
                showNotification('Time up! Submit your scores.');
            }
        }, 1000);
    }

    async function fetchDebateInfo() {
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
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/events/${eventId}/participants`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch participants');
            participants = await res.json();
            forSideArr = participants.filter(p => p.side === 'for');
            againstSideArr = participants.filter(p => p.side === 'against');
            renderParticipantLists();
        } catch (err) {
            forList.innerHTML = againstList.innerHTML = '<span class="text-danger">Failed to load participants.</span>';
        }
    }

    function handleSideSelection(side) {
        mySide = side;
        yourSide.textContent = side.charAt(0).toUpperCase() + side.slice(1);
        // Notify backend of side selection
        socket.emit('debate-select-side', { eventId, userId: user._id, side });
        sideModal.hide();
    }

    // --- Socket.IO Setup ---
    // Use backend URL for production
    const socket = io('https://event-management-backend-z0ty.onrender.com', { transports: ['websocket'] });
    socket.emit('join-debate', { eventId, userId: user._id });

    socket.on('debate-state', data => {
        participants = data.participants;
        forSideArr = participants.filter(p => p.side === 'for');
        againstSideArr = participants.filter(p => p.side === 'against');
        renderParticipantLists();
        renderCurrentSpeaker(participants.find(x => x._id === data.currentSpeakerId));
        timerDuration = data.timerPerParticipant || timerDuration;
        if (mySide) yourSide.textContent = mySide.charAt(0).toUpperCase() + mySide.slice(1);
    });

    socket.on('debate-next-speaker', data => {
        const speaker = participants.find(x => x._id === data.userId);
        renderCurrentSpeaker(speaker);
        if (speaker && speaker._id === user._id) {
            isMyTurn = true;
            speakModal.show();
            startTurnTimer();
            showNotification("It's your turn!", 'success');
        } else {
            isMyTurn = false;
            speakModal.hide();
        }
    });

    socket.on('debate-show-leaderboard', () => {
        window.location.href = `leaderboard.html?eventId=${eventId}`;
    });

    // --- Modal Side Selection (on first join) ---
    (async function init() {
        await fetchDebateInfo();
        await fetchParticipants();
        // If user already has a side, skip modal (could check backend)
        if (!mySide) {
            sideModalTopic.innerHTML = `<b>Topic:</b> ${eventDetails.topic || '-'}<br>`;
            sideModalRules.innerHTML = `<b>Rules:</b> ${eventDetails.rules || '-'}`;
            sideModal.show();
        }
    })();

    chooseForBtn.onclick = () => handleSideSelection('for');
    chooseAgainstBtn.onclick = () => handleSideSelection('against');

    // --- Speaking & Score Submission ---
    scoreForm.onsubmit = (e) => {
        e.preventDefault();
        if (!isMyTurn) return;
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
        socket.emit('debate-score', { eventId, userId: user._id, ...values });
        isMyTurn = false;
        speakModal.hide();
        showNotification('Score submitted.');
    };
});

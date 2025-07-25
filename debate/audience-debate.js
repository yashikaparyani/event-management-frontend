// Debate Audience Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const debateInfo = document.getElementById('debateInfo');
    const forList = document.getElementById('forList');
    const againstList = document.getElementById('againstList');
    const currentSpeaker = document.getElementById('currentSpeaker');
    const timerValue = document.getElementById('timerValue');
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    const likesCount = document.getElementById('likesCount');
    const notificationBlock = document.getElementById('notificationBlock');

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    let participants = [];
    let forSideArr = [];
    let againstSideArr = [];
    let currentSpeakerId = null;
    let canReact = false;
    let likes = 0;

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

    async function fetchDebateInfo() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/events/${eventId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch debate event');
            const eventDetails = await res.json();
            debateInfo.innerHTML = `<b>Topic:</b> ${eventDetails.topic || '-'}<br><b>Rules:</b> ${eventDetails.rules || '-'}<br><b>Timer:</b> ${eventDetails.timerPerParticipant || '-'}s`;
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

    // --- Socket.IO Setup ---
    const socket = io();
    socket.emit('join-debate-audience', { eventId, userId: user._id });

    socket.on('debate-state', data => {
        participants = data.participants;
        forSideArr = participants.filter(p => p.side === 'for');
        againstSideArr = participants.filter(p => p.side === 'against');
        renderParticipantLists();
        renderCurrentSpeaker(participants.find(x => x._id === data.currentSpeakerId));
        timerValue.textContent = data.timerValue ? `${data.timerValue}s` : '';
        canReact = data.canReact;
        likes = data.likes || 0;
        likesCount.textContent = `Likes: ${likes}`;
    });

    socket.on('debate-next-speaker', data => {
        const speaker = participants.find(x => x._id === data.userId);
        renderCurrentSpeaker(speaker);
        timerValue.textContent = data.timerValue ? `${data.timerValue}s` : '';
        canReact = data.canReact;
        likes = data.likes || 0;
        likesCount.textContent = `Likes: ${likes}`;
    });

    socket.on('debate-likes-update', data => {
        likes = data.likes;
        likesCount.textContent = `Likes: ${likes}`;
    });

    socket.on('debate-show-leaderboard', () => {
        window.location.href = `leaderboard.html?eventId=${eventId}`;
    });

    // --- Like/Dislike Buttons ---
    likeBtn.onclick = () => {
        if (!canReact) {
            showNotification('Reactions are disabled right now.');
            return;
        }
        socket.emit('debate-like', { eventId, userId: user._id });
    };
    dislikeBtn.onclick = () => {
        if (!canReact) {
            showNotification('Reactions are disabled right now.');
            return;
        }
        socket.emit('debate-dislike', { eventId, userId: user._id });
    };

    // --- Init ---
    (async function init() {
        await fetchDebateInfo();
        await fetchParticipants();
    })();
});

// Debate Leaderboard Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const debateInfo = document.getElementById('debateInfo');
    const forLeaderboard = document.getElementById('forLeaderboard');
    const againstLeaderboard = document.getElementById('againstLeaderboard');
    const backBtn = document.getElementById('backBtn');
    const notificationBlock = document.getElementById('notificationBlock');

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId') || localStorage.getItem('currentDebateEventId');
    const user = JSON.parse(localStorage.getItem('user'));
    let eventDetails = null;
    let leaderboardData = null;

    function showNotification(msg, type = 'info') {
        notificationBlock.textContent = msg;
        notificationBlock.className = `alert alert-${type} mt-3`;
        notificationBlock.classList.remove('d-none');
        setTimeout(() => notificationBlock.classList.add('d-none'), 3000);
    }

    function renderLeaderboard() {
    if (!leaderboardData) return;
    forLeaderboard.innerHTML = '';
    againstLeaderboard.innerHTML = '';
    const safe = v => (v === undefined || v === null ? 0 : v);
    const safeStr = v => (typeof v === 'string' && v.trim() ? v : '-');
    (Array.isArray(leaderboardData.for) ? leaderboardData.for : []).forEach((p, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<b>#${i+1}. ${safeStr(p.name)}</b> - <span class="badge bg-primary">${safe(p.total)} pts</span> <span class="badge bg-danger ms-2"><i class="fas fa-heart"></i> ${safe(p.likes)}</span><br><small>Clarity: ${safe(p.clarity)}, Facts: ${safe(p.facts)}, Arguments: ${safe(p.arguments)}, Presentation: ${safe(p.presentation)}, Knowledge: ${safe(p.knowledge)}</small>`;
        forLeaderboard.appendChild(li);
    });
    (Array.isArray(leaderboardData.against) ? leaderboardData.against : []).forEach((p, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<b>#${i+1}. ${safeStr(p.name)}</b> - <span class="badge bg-primary">${safe(p.total)} pts</span> <span class="badge bg-danger ms-2"><i class="fas fa-heart"></i> ${safe(p.likes)}</span><br><small>Clarity: ${safe(p.clarity)}, Facts: ${safe(p.facts)}, Arguments: ${safe(p.arguments)}, Presentation: ${safe(p.presentation)}, Knowledge: ${safe(p.knowledge)}</small>`;
        againstLeaderboard.appendChild(li);
    });
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
        } catch (err) {
            debateInfo.innerHTML = '<span class="text-danger">Failed to load debate info.</span>';
        }
    }

    async function fetchLeaderboard() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/events/${eventId}/debate-leaderboard`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch leaderboard');
            leaderboardData = await res.json();
            renderLeaderboard();
        } catch (err) {
            showNotification('Failed to load leaderboard.', 'danger');
        }
    }

    function goBack() {
        if (!user) window.location.href = '/';
        else if (user.role === 'coordinator') window.location.href = '/coordinator-dashboard.html';
        else if (user.role === 'participant') window.location.href = '/participant-dashboard.html';
        else if (user.role === 'audience') window.location.href = '/audience-dashboard.html';
        else window.location.href = '/';
    }

    backBtn.onclick = goBack;

    // Real-time updates (refresh leaderboard on event)
    // Use backend URL for production
    const socket = io('https://event-management-backend-z0ty.onrender.com', { transports: ['websocket'] });
    socket.emit('join-debate-leaderboard', { eventId, userId: user?._id });
    socket.on('debate-leaderboard-update', fetchLeaderboard);

    (async function init() {
        await fetchDebateInfo();
        await fetchLeaderboard();
    })();
});

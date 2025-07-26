function getAuth() {
    return {
        token: localStorage.getItem('token'),
        user: JSON.parse(localStorage.getItem('user'))
    };
}
function getEventId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('eventId') || localStorage.getItem('currentSpeedCodeEventId');
}

let problems = [];

async function fetchProblems() {
    const { token } = getAuth();
    const eventId = getEventId();
    const res = await fetch(`/api/speedcode/problems/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    problems = await res.json();
    const select = document.getElementById('problem-filter');
    select.innerHTML = `<option value="">All Problems</option>`;
    problems.forEach(p => {
        select.innerHTML += `<option value="${p._id}">${p.title}</option>`;
    });
}

async function fetchSubmissions() {
    const { token } = getAuth();
    const eventId = getEventId();
    const problemId = document.getElementById('problem-filter').value;
    let url = `/api/speedcode/submissions?eventId=${eventId}`;
    if (problemId) url += `&problemId=${problemId}`;
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const submissions = await res.json();
    renderSubmissions(submissions);
    renderLeaderboard(submissions);
}

function renderSubmissions(submissions) {
    const tbody = document.querySelector('#submissions-table tbody');
    tbody.innerHTML = '';
    submissions.forEach(sub => {
        tbody.innerHTML += `<tr>
            <td>${sub.participantId?.name || 'N/A'}</td>
            <td>${sub.problemId?.title || 'N/A'}</td>
            <td>${sub.result}</td>
            <td>${sub.score}</td>
            <td>${new Date(sub.submittedAt).toLocaleString()}</td>
        </tr>`;
    });
}

function renderLeaderboard(submissions) {
    // Simple leaderboard: sum of best scores per participant
    const leaderboard = {};
    submissions.forEach(sub => {
        const user = sub.participantId?.name || 'N/A';
        if (!leaderboard[user] || sub.score > leaderboard[user]) {
            leaderboard[user] = sub.score;
        }
    });
    const sorted = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]);
    document.getElementById('leaderboard').innerHTML =
        sorted.length
            ? `<ol>${sorted.map(([user, score]) => `<li>${user}: ${score}</li>`).join('')}</ol>`
            : 'No submissions yet.';
}

document.getElementById('refresh-btn').onclick = fetchSubmissions;
document.getElementById('problem-filter').onchange = fetchSubmissions;

window.onload = async function () {
    await fetchProblems();
    fetchSubmissions();
};
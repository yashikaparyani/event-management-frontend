// Utility to get token and user
function getAuth() {
    return {
        token: localStorage.getItem('token'),
        user: JSON.parse(localStorage.getItem('user'))
    };
}

// Get eventId from query parameter or storage
function getEventId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('eventId') || localStorage.getItem('currentSpeedCodeEventId');
}

// Fetch and display all problems for this event
async function fetchProblems() {
    const { token } = getAuth();
    const eventId = getEventId();
    const list = document.getElementById('problems-list');
    list.innerHTML = '<li>Loading...</li>';
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/problems/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch problems');
        const problems = await res.json();
        if (problems.length === 0) {
            list.innerHTML = '<li>No problems yet.</li>';
            return;
        }
        list.innerHTML = '';
        problems.forEach(problem => {
            const li = document.createElement('li');
            li.innerHTML = `<b>${problem.title}</b> (${problem.difficulty})
                <button onclick="editProblem('${problem._id}')">Edit</button>
                <button onclick="deleteProblem('${problem._id}')" style="color:red;">Delete</button>
                <button onclick="viewTestCases('${problem._id}')">View Test Cases</button>`;
            list.appendChild(li);
        });
    } catch (err) {
        list.innerHTML = `<li style="color:red;">${err.message}</li>`;
    } finally {
        hideSpinner();
    }
}

// Edit problem (populate form)
window.editProblem = async function (problemId) {
    const { token } = getAuth();
    const eventId = getEventId();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/problems/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const problems = await res.json();
        const problem = problems.find(p => p._id === problemId);
        if (!problem) return showToast('Problem not found!');
        document.getElementById('problem-id').value = problem._id;
        document.getElementById('title').value = problem.title;
        document.getElementById('description').value = problem.description;
        document.getElementById('sample-input').value = problem.sampleInput || '';
        document.getElementById('sample-output').value = problem.sampleOutput || '';
        document.getElementById('time-limit').value = problem.timeLimit || 1;
        document.getElementById('difficulty').value = problem.difficulty || 'Easy';
        document.getElementById('test-cases').value = JSON.stringify(problem.testCases, null, 2);
        document.getElementById('form-title').textContent = 'Edit Problem';
        document.getElementById('submit-btn').textContent = 'Update Problem';
        document.getElementById('cancel-btn').style.display = '';
    } catch (err) {
        showToast('Error loading problem');
    } finally {
        hideSpinner();
    }
};

// Cancel editing
document.getElementById('cancel-btn').onclick = function () {
    document.getElementById('problem-form').reset();
    document.getElementById('problem-id').value = '';
    document.getElementById('form-title').textContent = 'Add New Problem';
    document.getElementById('submit-btn').textContent = 'Add Problem';
    this.style.display = 'none';
};

// Delete problem
window.deleteProblem = async function (problemId) {
    if (!confirm('Delete this problem?')) return;
    const { token } = getAuth();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/problems/${problemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete problem');
        showToast('Problem deleted!');
        fetchProblems();
    } catch (err) {
        showToast(err.message);
    } finally {
        hideSpinner();
    }
};

// Handle form submission to add or update a problem
document.getElementById('problem-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const { token } = getAuth();
    const eventId = getEventId();
    const problemId = document.getElementById('problem-id').value;

    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const sampleInput = document.getElementById('sample-input').value;
    const sampleOutput = document.getElementById('sample-output').value;
    const timeLimit = Number(document.getElementById('time-limit').value) || 1;
    const difficulty = document.getElementById('difficulty').value;
    let testCases;
    try {
        testCases = JSON.parse(document.getElementById('test-cases').value);
        if (!Array.isArray(testCases)) throw new Error();
    } catch {
        showToast('Test cases must be a valid JSON array!');
        return;
    }

    const payload = {
        eventId,
        title,
        description,
        sampleInput,
        sampleOutput,
        timeLimit,
        difficulty,
        testCases
    };

    showSpinner();
    if (problemId) {
        // Edit existing
        try {
            const res = await fetch(`/api/speedcode/problems/${problemId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to update problem');
            showToast('Problem updated!');
            this.reset();
            document.getElementById('problem-id').value = '';
            document.getElementById('form-title').textContent = 'Add New Problem';
            document.getElementById('submit-btn').textContent = 'Add Problem';
            document.getElementById('cancel-btn').style.display = 'none';
            fetchProblems();
        } catch (err) {
            showToast(err.message);
        } finally {
            hideSpinner();
        }
    } else {
        // Create new
        try {
            const res = await fetch('/api/speedcode/problems', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error('Failed to add problem');
            showToast('Problem added!');
            this.reset();
            fetchProblems();
        } catch (err) {
            showToast(err.message);
        } finally {
            hideSpinner();
        }
    }
});

// Toggle between manage and submissions
document.getElementById('manage-problems-btn').onclick = function() {
    document.getElementById('problem-form-section').style.display = '';
    document.getElementById('problems-list-section').style.display = '';
    document.getElementById('submissions-section').style.display = 'none';
};
document.getElementById('view-submissions-btn').onclick = function() {
    document.getElementById('problem-form-section').style.display = 'none';
    document.getElementById('problems-list-section').style.display = 'none';
    document.getElementById('submissions-section').style.display = '';
    fetchProblemsForSubmissions();
    fetchSubmissions();
};

// Submissions logic
let submissionProblems = [];

async function fetchProblemsForSubmissions() {
    const { token } = getAuth();
    const eventId = getEventId();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/problems/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        submissionProblems = await res.json();
        const select = document.getElementById('problem-filter');
        select.innerHTML = `<option value="">All Problems</option>`;
        submissionProblems.forEach(p => {
            select.innerHTML += `<option value="${p._id}">${p.title}</option>`;
        });
    } catch (err) {
        showToast('Failed to load problems for submissions');
    } finally {
        hideSpinner();
    }
}

async function fetchSubmissions() {
    const { token } = getAuth();
    const eventId = getEventId();
    const problemId = document.getElementById('problem-filter').value;
    let url = `/api/speedcode/submissions?eventId=${eventId}`;
    if (problemId) url += `&problemId=${problemId}`;
    showSpinner();
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const submissions = await res.json();
        renderSubmissions(submissions);
        renderLeaderboard(submissions);
    } catch (err) {
        showToast('Failed to fetch submissions');
    } finally {
        hideSpinner();
    }
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
            <td>
              <button onclick="overrideSubmissionPrompt('${sub._id}')">Override</button>
            </td>
        </tr>`;
    });
}

// Manual override prompt
window.overrideSubmissionPrompt = function(submissionId) {
    const result = prompt('Enter new result (Accepted/Rejected/Pending):');
    if (!result) return;
    const score = prompt('Enter new score (number):');
    if (score === null) return;
    overrideSubmission(submissionId, result, Number(score));
};

async function overrideSubmission(submissionId, result, score) {
    const { token } = getAuth();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/submissions/${submissionId}/override`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ result, score })
        });
        if (res.ok) {
            showToast('Submission updated!');
            fetchSubmissions();
        } else {
            showToast('Failed to update submission');
        }
    } finally {
        hideSpinner();
    }
}

// Rejudge button logic
document.getElementById('rejudge-btn').onclick = async function() {
    const problemId = document.getElementById('problem-filter').value;
    if (!problemId) return showToast('Select a problem to rejudge');
    if (!confirm('Rejudge all submissions for this problem?')) return;
    const { token } = getAuth();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/problems/${problemId}/rejudge`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            showToast('Rejudge started!');
            fetchSubmissions();
        } else {
            showToast('Failed to rejudge');
        }
    } finally {
        hideSpinner();
    }
};

function renderLeaderboard(submissions) {
    // Simple leaderboard: sum of best scores per participant
    const leaderboard = {};
    submissions.forEach(sub => {
        const user = sub.participantId?.name || 'N/A';
        if (!leaderboard[user]) leaderboard[user] = {};
        const pid = sub.problemId?._id || '';
        if (!leaderboard[user][pid] || sub.score > leaderboard[user][pid]) {
            leaderboard[user][pid] = sub.score;
        }
    });
    // Compute total scores
    const scores = [];
    for (const user in leaderboard) {
        let total = 0;
        for (const pid in leaderboard[user]) total += leaderboard[user][pid];
        scores.push({ user, total });
    }
    scores.sort((a, b) => b.total - a.total);
    let html = '<ol>';
    scores.forEach(s => {
        html += `<li><b>${s.user}</b>: ${s.total} pts</li>`;
    });
    html += '</ol>';
    document.getElementById('leaderboard').innerHTML = html;
}

// Event listeners for filter and refresh
document.getElementById('refresh-btn').onclick = fetchSubmissions;
document.getElementById('problem-filter').onchange = fetchSubmissions;

// --- Event Controls Logic ---
async function loadEventControls() {
    const { token } = getAuth();
    const eventId = getEventId();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/event-controls/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
            document.getElementById('event-controls-status').innerHTML = `<span style="color:red;">${data.error || 'Failed to load event controls.'}</span>`;
            return;
        }
        document.getElementById('event-controls-status').innerHTML = `
          <b>Event Active:</b> <span style="color:${data.isActive ? 'green' : 'red'}">${data.isActive ? 'Yes' : 'No'}</span> &nbsp;|&nbsp;
          <b>Submissions Locked:</b> <span style="color:${data.submissionsLocked ? 'red' : 'green'}">${data.submissionsLocked ? 'Yes' : 'No'}</span> &nbsp;|&nbsp;
          <b>Leaderboard Visible:</b> <span style="color:${data.leaderboardVisible ? 'green' : 'gray'}">${data.leaderboardVisible ? 'Yes' : 'No'}</span>
        `;
        // Store for toggling
        document.getElementById('event-controls-section').dataset.active = data.isActive;
        document.getElementById('event-controls-section').dataset.locked = data.submissionsLocked;
        document.getElementById('event-controls-section').dataset.leaderboard = data.leaderboardVisible;
    } catch (err) {
        document.getElementById('event-controls-status').innerHTML = `<span style="color:red;">Failed to load event controls.</span>`;
    } finally {
        hideSpinner();
    }
}

// Toggle handlers
document.getElementById('toggle-active-btn').onclick = async function() {
    await updateEventControl('isActive');
};
document.getElementById('toggle-lock-btn').onclick = async function() {
    await updateEventControl('submissionsLocked');
};
document.getElementById('toggle-leaderboard-btn').onclick = async function() {
    await updateEventControl('leaderboardVisible');
};

async function updateEventControl(field) {
    const { token } = getAuth();
    const eventId = getEventId();
    // Get current value
    const section = document.getElementById('event-controls-section');
    let payload = {};
    if (field === 'isActive') payload.isActive = !(section.dataset.active === 'true');
    if (field === 'submissionsLocked') payload.submissionsLocked = !(section.dataset.locked === 'true');
    if (field === 'leaderboardVisible') payload.leaderboardVisible = !(section.dataset.leaderboard === 'true');
    showSpinner();
    try {
        await fetch(`/api/speedcode/event-controls/${eventId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        await loadEventControls();
    } finally {
        hideSpinner();
    }
}

// --- Export Submissions Logic ---
document.getElementById('export-csv-btn').onclick = function() {
    exportSubmissions('csv');
};
document.getElementById('export-json-btn').onclick = function() {
    exportSubmissions('json');
};

async function exportSubmissions(format) {
    const { token } = getAuth();
    const eventId = getEventId();
    const url = `/api/speedcode/export-submissions?eventId=${eventId}&format=${format}`;
    showSpinner();
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (format === 'csv') {
            const blob = await res.blob();
            const urlObj = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlObj;
            a.download = 'submissions.csv';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(urlObj);
        } else {
            const data = await res.json();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const urlObj = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlObj;
            a.download = 'submissions.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(urlObj);
        }
        showToast('Export complete!');
    } catch (err) {
        showToast('Export failed');
    } finally {
        hideSpinner();
    }
}

// --- Analytics Logic ---
async function loadAnalytics() {
    const { token } = getAuth();
    const eventId = getEventId();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/analytics?eventId=${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            document.getElementById('analytics-content').innerHTML = '<span style="color:red;">Failed to load analytics.</span>';
            return;
        }
        const data = await res.json();
        let html = `<b>Participants:</b> ${data.participantCount}<br/><br/>`;
        html += `<b>Most Solved Problem:</b> ${data.mostSolved || 'N/A'}<br/>`;
        html += `<b>Least Solved Problem:</b> ${data.leastSolved || 'N/A'}<br/><br/>`;
        html += `<table border="1" style="width:100%;margin-top:1em;"><thead>
            <tr><th>Problem</th><th>Attempts</th><th>Solved</th><th>Fastest Correct</th></tr>
            </thead><tbody>`;
        data.problemStats.forEach(stat => {
            html += `<tr>
                <td>${stat.title}</td>
                <td>${stat.attempts}</td>
                <td>${stat.solved}</td>
                <td>${stat.fastest ? (stat.fastest.participantId + '<br/>' + new Date(stat.fastest.submittedAt).toLocaleString()) : '-'}</td>
            </tr>`;
        });
        html += `</tbody></table>`;
        document.getElementById('analytics-content').innerHTML = html;
    } catch (err) {
        document.getElementById('analytics-content').innerHTML = '<span style="color:red;">Failed to load analytics.</span>';
    } finally {
        hideSpinner();
    }
}

document.getElementById('refresh-analytics-btn').onclick = loadAnalytics;

// Load analytics on page load
window.addEventListener('DOMContentLoaded', loadAnalytics);

window.addEventListener('DOMContentLoaded', () => {
    loadEventControls();
    fetchProblems();
});

// --- Test Case Modal Logic ---
window.viewTestCases = async function(problemId) {
    const { token } = getAuth();
    showSpinner();
    try {
        const res = await fetch(`/api/speedcode/problems/${problemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return showToast('Failed to fetch problem');
        const problem = await res.json();
        const list = document.getElementById('test-cases-list');
        list.innerHTML = '';
        if (!problem.testCases || !problem.testCases.length) {
            list.innerHTML = '<em>No test cases found.</em>';
        } else {
            problem.testCases.forEach((tc, idx) => {
                list.innerHTML += `
                    <div style="border-bottom:1px solid #eee; margin-bottom:0.5em; padding-bottom:0.5em;">
                      <b>Test Case ${idx + 1}</b> ${tc.isHidden ? '(Hidden)' : ''}
                      <pre><b>Input:</b> ${tc.input}</pre>
                      <pre><b>Output:</b> ${tc.output}</pre>
                    </div>
                `;
            });
        }
        document.getElementById('test-cases-modal').style.display = '';
        document.getElementById('modal-overlay').style.display = '';
    } catch (err) {
        showToast('Failed to load test cases');
    } finally {
        hideSpinner();
    }
};

window.closeTestCasesModal = function() {
    document.getElementById('test-cases-modal').style.display = 'none';
    document.getElementById('modal-overlay').style.display = 'none';
};

// --- Spinner and Toast Utilities ---
function showSpinner() {
    document.getElementById('global-spinner').style.display = '';
}
function hideSpinner() {
    document.getElementById('global-spinner').style.display = 'none';
}
function showToast(msg, duration=2500) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.style.display = '';
    setTimeout(() => { toast.style.display = 'none'; }, duration);
}
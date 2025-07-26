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

let problems = [];
let currentProblem = null;

// Fetch and display all problems for this event
async function fetchProblems() {
    const { token } = getAuth();
    const eventId = getEventId();
    const listDiv = document.getElementById('problems-list');
    listDiv.innerHTML = 'Loading...';

    try {
        const res = await fetch(`/api/speedcode/problems/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch problems');
        problems = await res.json();
        if (problems.length === 0) {
            listDiv.innerHTML = 'No problems available yet.';
            return;
        }
        listDiv.innerHTML = '';
        problems.forEach((problem, idx) => {
            const div = document.createElement('div');
            div.className = 'problem-summary';
            div.innerHTML = `<b>Problem ${idx + 1}: ${problem.title}</b> (${problem.difficulty})<br>
                <button onclick="showSubmissionForm('${problem._id}')">Solve</button>
                <details>
                  <summary>View Description</summary>
                  <pre>${problem.description}</pre>
                  <b>Sample Input:</b>
                  <pre>${problem.sampleInput || ''}</pre>
                  <b>Sample Output:</b>
                  <pre>${problem.sampleOutput || ''}</pre>
                </details>
                <hr>`;
            listDiv.appendChild(div);
        });
    } catch (err) {
        listDiv.innerHTML = `<span style="color:red;">${err.message}</span>`;
    }
}

// Show the code submission form for a problem
window.showSubmissionForm = function (problemId) {
    currentProblem = problems.find(p => p._id === problemId);
    if (!currentProblem) return alert('Problem not found!');
    document.getElementById('problems-section').style.display = 'none';
    document.getElementById('submission-section').style.display = '';
    document.getElementById('problem-title').textContent = currentProblem.title;
    document.getElementById('problem-description').textContent = currentProblem.description +
        '\n\nSample Input:\n' + (currentProblem.sampleInput || '') +
        '\nSample Output:\n' + (currentProblem.sampleOutput || '');
    document.getElementById('code').value = '';
    document.getElementById('submission-result').innerHTML = '';
};

// Back to problems list
document.getElementById('back-btn').onclick = function () {
    document.getElementById('submission-section').style.display = 'none';
    document.getElementById('problems-section').style.display = '';
    currentProblem = null;
};

// Handle code submission
document.getElementById('submission-form').onsubmit = async function (e) {
    e.preventDefault();
    if (!currentProblem) return alert('No problem selected!');
    const { token } = getAuth();
    const code = document.getElementById('code').value;
    const language = document.getElementById('language').value;

    const payload = {
        problemId: currentProblem._id,
        code,
        language
    };

    const resultDiv = document.getElementById('submission-result');
    resultDiv.innerHTML = 'Submitting...';

    try {
        const res = await fetch(`/api/speedcode/submit/${currentProblem._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Submission failed');
        // Show basic result/feedback
        resultDiv.innerHTML = `<b>Submission Status:</b> ${data.result || 'Pending'}<br>
            <b>Score:</b> ${data.score || 0}<br>
            <b>Feedback:</b> ${data.feedback || 'N/A'}`;
        // Optionally, show test case results
        if (data.testCaseResults && Array.isArray(data.testCaseResults)) {
            resultDiv.innerHTML += '<br><b>Test Case Results:</b><ul>' +
                data.testCaseResults.map(tc =>
                    `<li>${tc.passed ? '✅' : '❌'} Input: <code>${tc.input}</code> | Expected: <code>${tc.expectedOutput}</code> | Got: <code>${tc.actualOutput}</code></li>`
                ).join('') + '</ul>';
        }
    } catch (err) {
        resultDiv.innerHTML = `<span style="color:red;">${err.message}</span>`;
    }
};

// Fetch problems on page load
window.onload = fetchProblems;
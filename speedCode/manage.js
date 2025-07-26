// Utility to get token and user
function getAuth() {
    return {
        token: localStorage.getItem('token'),
        user: JSON.parse(localStorage.getItem('user'))
    };
}

// Get eventId from query parameter or storage (adapt as needed)
function getEventId() {
    // Example: speedcode/manage.html?eventId=123
    const params = new URLSearchParams(window.location.search);
    return params.get('eventId') || localStorage.getItem('currentSpeedCodeEventId');
}

// Fetch and display all problems for this event
async function fetchProblems() {
    const { token } = getAuth();
    const eventId = getEventId();
    const list = document.getElementById('problems-list');
    list.innerHTML = '<li>Loading...</li>';

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
                <button onclick="editProblem('${problem._id}')">Edit</button>`;
            list.appendChild(li);
        });
    } catch (err) {
        list.innerHTML = `<li style="color:red;">${err.message}</li>`;
    }
}

// Handle form submission to add a new problem
document.getElementById('problem-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const { token, user } = getAuth();
    const eventId = getEventId();

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
        alert('Test cases must be a valid JSON array!');
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
        alert('Problem added!');
        this.reset();
        fetchProblems();
    } catch (err) {
        alert(err.message);
    }
});

// Fetch problems on page load
window.onload = fetchProblems;
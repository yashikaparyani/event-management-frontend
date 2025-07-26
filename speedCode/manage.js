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
                <button onclick="deleteProblem('${problem._id}')" style="color:red;">Delete</button>`;
            list.appendChild(li);
        });
    } catch (err) {
        list.innerHTML = `<li style="color:red;">${err.message}</li>`;
    }
}

// Edit problem (populate form)
window.editProblem = async function (problemId) {
    const { token } = getAuth();
    const eventId = getEventId();
    const res = await fetch(`/api/speedcode/problems/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const problems = await res.json();
    const problem = problems.find(p => p._id === problemId);
    if (!problem) return alert('Problem not found!');
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
    try {
        const res = await fetch(`/api/speedcode/problems/${problemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to delete problem');
        alert('Problem deleted!');
        fetchProblems();
    } catch (err) {
        alert(err.message);
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
            alert('Problem updated!');
            this.reset();
            document.getElementById('problem-id').value = '';
            document.getElementById('form-title').textContent = 'Add New Problem';
            document.getElementById('submit-btn').textContent = 'Add Problem';
            document.getElementById('cancel-btn').style.display = 'none';
            fetchProblems();
        } catch (err) {
            alert(err.message);
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
            alert('Problem added!');
            this.reset();
            fetchProblems();
        } catch (err) {
            alert(err.message);
        }
    }
});

// Fetch problems on page load
window.onload = fetchProblems;
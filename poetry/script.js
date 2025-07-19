document.addEventListener('DOMContentLoaded', function() {
    // --- CONFIG ---
    // Get eventId and token (customize as needed)
    const eventId = localStorage.getItem('currentEventId') || 'REPLACE_WITH_EVENT_ID';
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = user.role || 'participant'; // Default to participant if no role

    // DOM elements
    const submissionSection = document.getElementById('poetry-submission-section');
    const participantsSection = document.getElementById('participants-section');
    const form = document.getElementById('poetry-submission-form');
    const successMsg = document.getElementById('submission-success');

    // --- Fetch and render poems ---
    async function fetchAndRenderPoems() {
        try {
            const res = await fetch(`/api/poetry/${eventId}/submissions`);
            if (!res.ok) throw new Error('Failed to fetch poems');
            const { submissions } = await res.json();
            renderPoems(submissions);
        } catch (err) {
            participantsSection.innerHTML = '<p class="error-message">Could not load poems.</p>';
        }
    }

    function renderPoems(poems) {
        if (!poems.length) {
            participantsSection.innerHTML = '<p>No poems submitted yet.</p>';
            return;
        }
        let html = '<ul id="participants-list">';
        poems.forEach(poem => {
            html += `<li data-poem-id="${poem._id}">
                <span class="poem-title">${poem.title}</span> <span class="poet-name">by ${poem.poetName}</span>
                <div class="poem-content">${poem.text ? poem.text : '[No poem submitted]'}</div>`;
            // Show delete button for admin/coordinator
            if (userRole === 'admin' || userRole === 'coordinator') {
                html += `<button class='delete-poem-btn' data-id='${poem._id}' style='margin-left:1rem;color:#fff;background:#e57373;border:none;border-radius:4px;padding:0.2rem 0.7rem;cursor:pointer;'>Delete</button>`;
            }
            html += `</li>`;
        });
        html += '</ul>';
        participantsSection.innerHTML = html;
        // Add delete button listeners
        if (userRole === 'admin' || userRole === 'coordinator') {
            document.querySelectorAll('.delete-poem-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const poemId = btn.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this poem?')) {
                        try {
                            const res = await fetch(`/api/poetry/${poemId}`, {
                                method: 'DELETE',
                                headers: { 'Authorization': `Bearer ${token}` }
                            });
                            let result;
                            try {
                                const contentType = res.headers.get('content-type');
                                if (contentType && contentType.includes('application/json')) {
                                    result = await res.json();
                                } else {
                                    result = null;
                                }
                            } catch (e) {
                                result = null;
                            }
                            if (res.ok) {
                                await fetchAndRenderPoems();
                            } else {
                                alert('Delete failed: ' + (result && result.message ? result.message : 'Unknown error'));
                            }
                        } catch (err) {
                            alert('Delete failed: ' + err.message);
                        }
                    }
                });
            });
        }
    }

    // --- Handle poem submission ---
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const poetName = document.getElementById('poet-name').value.trim();
            const poemTitle = document.getElementById('poem-title').value.trim();
            const poemText = document.getElementById('poem-text').value.trim();
            // File upload not implemented; just send text for now
            const payload = { eventId, poetName, title: poemTitle, text: poemText };
            try {
                const res = await fetch('/api/poetry/submit', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });
                let result;
                try {
                    const contentType = res.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        result = await res.json();
                    } else {
                        result = null;
                    }
                } catch (e) {
                    result = null;
                }
                if (res.ok) {
                    successMsg.style.display = '';
                    form.reset();
                    await fetchAndRenderPoems();
                    setTimeout(() => { successMsg.style.display = 'none'; }, 2500);
                } else {
                    alert('Submission failed: ' + (result && result.message ? result.message : 'Unknown error'));
                }
            } catch (err) {
                alert('Submission failed: ' + err.message);
            }
        });
    }

    // Initial fetch of poems
    fetchAndRenderPoems();
});
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

    const userName = user.name || '';
    const roleName = user.role && user.role.name ? user.role.name : userRole;

    // Hide submit form for non-participants
    if (roleName !== 'participant') {
        if (submissionSection) submissionSection.style.display = 'none';
    } else {
        if (submissionSection) submissionSection.style.display = '';
    }

    // --- Fetch and render poems ---
    async function fetchAndRenderPoems() {
        try {
            const res = await fetch(getApiUrl('/api/poetry/' + eventId + '/submissions'), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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
                <span class="poem-title">${poem.title}</span> <span class="poet-name">by ${poem.user && poem.user.name ? poem.user.name : poem.poetName || ''}</span>
                <span class="poem-date"> | ${new Date(poem.createdAt).toLocaleString()}</span>
                <span class="like-count" style="margin-left:1em;">&#x1F44D; ${poem.likeCount}</span>
                <button class='view-poem-btn' data-id='${poem._id}' style='margin-left:1em;'>View</button>`;
            // Like button for audience only
            if (roleName === 'audience') {
                html += `<button class='like-poem-btn' data-id='${poem._id}' style='margin-left:0.5em;' ${poem.likedByCurrentUser ? 'disabled' : ''}>&#x1F44D; Like</button>`;
            }
            // Delete button for coordinator/volunteer
            if (roleName === 'coordinator' || roleName === 'volunteer') {
                html += `<button class='delete-poem-btn' data-id='${poem._id}' style='margin-left:1em;color:#fff;background:#e57373;border:none;border-radius:4px;padding:0.2rem 0.7rem;cursor:pointer;'>Delete</button>`;
            }
            html += `</li>`;
        });
        html += '</ul>';
        participantsSection.innerHTML = html;

        // Add view button listeners
        document.querySelectorAll('.view-poem-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const poemId = btn.getAttribute('data-id');
                const poem = poems.find(p => p._id === poemId);
                showPoemModal(poem);
            });
        });
        // Add like button listeners (audience)
        if (roleName === 'audience') {
            document.querySelectorAll('.like-poem-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const poemId = btn.getAttribute('data-id');
                    try {
                        const res = await fetch(getApiUrl('/api/poetry/' + poemId + '/like'), {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        await fetchAndRenderPoems();
                    } catch (err) {
                        alert('Like failed: ' + err.message);
                    }
                });
            });
        }
        // Add delete button listeners (coordinator/volunteer)
        if (roleName === 'coordinator' || roleName === 'volunteer') {
            document.querySelectorAll('.delete-poem-btn').forEach(btn => {
                btn.addEventListener('click', async function() {
                    const poemId = btn.getAttribute('data-id');
                    if (confirm('Are you sure you want to delete this poem?')) {
                        try {
                            const res = await fetch(getApiUrl('/api/poetry/' + poemId), {
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

    // --- Modal logic ---
    function showPoemModal(poem) {
        const modal = document.getElementById('poem-modal');
        document.getElementById('modal-poem-title').textContent = poem.title;
        document.getElementById('modal-poet-name').textContent = poem.user && poem.user.name ? poem.user.name : poem.poetName || '';
        document.getElementById('modal-poem-date').textContent = new Date(poem.createdAt).toLocaleString();
        document.getElementById('modal-poem-text').textContent = poem.text || '[No poem submitted]';
        // File block
        const fileBlock = document.getElementById('modal-poem-file-block');
        if (poem.fileUrl) {
            fileBlock.innerHTML = `<a href="${getApiUrl(poem.fileUrl)}" target="_blank">View/Download File</a>`;
        } else {
            fileBlock.innerHTML = '';
        }
        // Like block
        const likeBlock = document.getElementById('modal-like-block');
        likeBlock.innerHTML = `<span>&#x1F44D; ${poem.likeCount} Likes</span>`;
        modal.style.display = 'block';
        document.getElementById('close-poem-modal').onclick = function() {
            modal.style.display = 'none';
        };
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    // --- Handle poem submission ---
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            const poemTitle = document.getElementById('poem-title').value.trim();
            const poemText = document.getElementById('poem-text').value.trim();
            const poemFileInput = document.getElementById('poem-file');
            const formData = new FormData();
            formData.append('eventId', eventId);
            formData.append('title', poemTitle);
            formData.append('text', poemText);
            // Use account name for participant
            formData.append('poetName', userName);
            if (poemFileInput && poemFileInput.files.length > 0) {
                formData.append('poemFile', poemFileInput.files[0]);
            }
            try {
                const res = await fetch(getApiUrl('/api/poetry/submit'), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                    body: formData
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
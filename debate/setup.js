// Debate Setup Page Logic

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    const setupForm = document.getElementById('debateSetupForm');
    const setupSuccessBlock = document.getElementById('setupSuccessBlock');
    const setupErrorBlock = document.getElementById('setupErrorBlock');
    const startDebateBtn = document.getElementById('startDebateBtn');
    const setupFormBlock = document.getElementById('setupFormBlock');

    // Prefill if already set (edit mode)
    const token = localStorage.getItem('token');
    fetch(`/api/events/${eventId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
        .then(async res => {
            if (!res.ok) throw new Error('Failed to fetch event');
            const contentType = res.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) throw new Error('Invalid response');
            return res.json();
        })
        .then(event => {
            if (event.type === 'Debate') {
                if (event.topic) document.getElementById('debateTopic').value = event.topic;
                if (event.rules) document.getElementById('debateRules').value = event.rules;
                if (event.timerPerParticipant) document.getElementById('debateTimer').value = event.timerPerParticipant;
            }
        })
        .catch(err => {
            setupErrorBlock.textContent = err.message || 'Failed to load event.';
            setupErrorBlock.classList.remove('d-none');
        });

    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setupErrorBlock.classList.add('d-none');
        setupErrorBlock.textContent = '';

        const topic = document.getElementById('debateTopic').value.trim();
        const rules = document.getElementById('debateRules').value.trim();
        const timer = parseInt(document.getElementById('debateTimer').value, 10);

        if (!topic || !rules || !timer || timer < 30 || timer > 600) {
            setupErrorBlock.textContent = 'Please fill all fields correctly.';
            setupErrorBlock.classList.remove('d-none');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/events/${eventId}/debate-setup`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic, rules, timerPerParticipant: timer })
            });
            if (!response.ok) throw new Error('Failed to save debate setup');
            setupFormBlock.classList.add('d-none');
            setupSuccessBlock.classList.remove('d-none');
        } catch (err) {
            setupErrorBlock.textContent = err.message || 'Failed to save debate setup.';
            setupErrorBlock.classList.remove('d-none');
        }
    });

    startDebateBtn.addEventListener('click', () => {
        window.location.href = `hosting.html?eventId=${eventId}`;
    });
});

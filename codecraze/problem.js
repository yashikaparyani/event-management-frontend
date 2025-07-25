document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('../login.html');
        return;
    }

    // Get problem ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const problemId = urlParams.get('id');
    if (!problemId) {
        document.body.innerHTML = '<p>Problem ID not specified.</p>';
        return;
    }

    const problemTitle = document.getElementById('problemTitle');
    const problemDescription = document.getElementById('problemDescription');
    const sampleIO = document.getElementById('sampleIO');
    const feedback = document.getElementById('feedback');
    const submitBtn = document.getElementById('submitBtn');

    // Fetch problem details
    try {
        const response = await fetch(getApiUrl(`/api/codecraze/problems/${problemId}`), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch problem');
        const problem = await response.json();
        problemTitle.textContent = problem.title;
        problemDescription.innerHTML = `<pre>${problem.description}</pre>`;
        // Show sample input/output
        const samples = problem.testCases.filter(tc => tc.isSample);
        if (samples.length) {
            sampleIO.innerHTML = '<h3>Sample Input/Output</h3>' + samples.map(tc => `
                <div class="sample-case">
                    <strong>Input:</strong><pre>${tc.input}</pre>
                    <strong>Output:</strong><pre>${tc.output}</pre>
                </div>
            `).join('');
        } else {
            sampleIO.innerHTML = '';
        }
    } catch (error) {
        problemTitle.textContent = 'Error';
        problemDescription.innerHTML = `<p class="error-message">${error.message}</p>`;
        return;
    }

    // Handle code submission (real Judge0 integration)
    submitBtn.addEventListener('click', async () => {
        feedback.innerHTML = '<p>Submitting...</p>';
        const code = document.getElementById('code').value;
        const language = document.getElementById('language').value;
        try {
            const response = await fetch(getApiUrl(`/api/codecraze/submit/${problemId}`), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code, language })
            });
            if (!response.ok) throw new Error('Submission failed');
            const data = await response.json();
            if (!data.results || !data.results.length) {
                feedback.innerHTML = '<p>No test case results.</p>';
                return;
            }
            feedback.innerHTML = '<h3>Results</h3>' + data.results.map((r, i) => `
                <div class="test-result ${r.passed ? 'passed' : 'failed'}">
                    <strong>Test Case ${i + 1}:</strong> ${r.passed ? 'Passed' : 'Failed'}<br>
                    <strong>Input:</strong> <pre>${r.input}</pre>
                    <strong>Expected Output:</strong> <pre>${r.expected}</pre>
                    <strong>Your Output:</strong> <pre>${r.stdout || ''}</pre>
                    ${r.stderr ? `<strong>Error:</strong> <pre>${r.stderr}</pre>` : ''}
                    ${r.error ? `<strong>API Error:</strong> <pre>${r.error}</pre>` : ''}
                </div>
            `).join('');
        } catch (error) {
            feedback.innerHTML = `<p class="error-message">${error.message}</p>`;
        }
    });
}); 
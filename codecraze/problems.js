document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('../login.html');
        return;
    }

    const problemsList = document.getElementById('problemsList');
    problemsList.innerHTML = '<p>Loading problems...</p>';

    try {
        const response = await fetch(getApiUrl('/api/codecraze/problems'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch problems');
        const problems = await response.json();
        if (!problems.length) {
            problemsList.innerHTML = '<p>No problems available yet.</p>';
            return;
        }
        problemsList.innerHTML = `
            <table class="problems-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Difficulty</th>
                        <th>Points</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${problems.map(problem => `
                        <tr>
                            <td><a href="problem.html?id=${problem._id}">${problem.title}</a></td>
                            <td>${problem.difficulty}</td>
                            <td>${problem.points}</td>
                            <td id="status-${problem._id}">Not Started</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        problemsList.innerHTML = `<p class="error-message">${error.message}</p>`;
    }
}); 
// leaderboard.js - Debate leaderboard display

let debateId = null;
let debate = null;
let user = null;
let scores = {};

function getDebateId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('debateId');
}

async function fetchDebateAndScores() {
    try {
        const res = await fetch(getApiUrl(config.ENDPOINTS.DEBATES.GET(debateId)), {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error('Failed to fetch debate');
        debate = await res.json();
        
        // For now, we'll use mock scores since the backend integration isn't complete
        // In a real implementation, this would fetch from the debate session
        displayDebateSummary();
        displayLeaderboard();
    } catch (e) {
        console.error('Error fetching debate:', e);
        document.getElementById('debate-summary').innerHTML = '<p style="color: red;">Failed to load debate information</p>';
    }
}

function displayDebateSummary() {
    const summaryDiv = document.getElementById('debate-summary');
    if (!summaryDiv || !debate) return;
    
    summaryDiv.innerHTML = `
        <h3 style="color: #2d6cdf; margin-bottom: 1rem;">📋 Debate Summary</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
            <div>
                <p><strong>Topic:</strong> ${debate.topics && debate.topics.length ? debate.topics[0] : 'N/A'}</p>
                <p><strong>Event:</strong> ${debate.event.title}</p>
                <p><strong>Date:</strong> ${new Date(debate.event.date).toLocaleDateString()}</p>
            </div>
            <div>
                <p><strong>Location:</strong> ${debate.event.location}</p>
                <p><strong>Timer per participant:</strong> ${debate.timerPerParticipant || 120} seconds</p>
                <p><strong>Status:</strong> <span style="color: #4caf50; font-weight: bold;">Completed</span></p>
            </div>
        </div>
    `;
}

function displayLeaderboard() {
    // Mock data for demonstration - in real implementation, this would come from the backend
    const mockScores = {
        for: [
            { name: 'Alice Johnson', total: 9, likes: 15, clarity: 2, facts: 2, arguments: 2, presentation: 2, knowledge: 1 },
            { name: 'Bob Smith', total: 7, likes: 12, clarity: 1, facts: 2, arguments: 2, presentation: 1, knowledge: 1 },
            { name: 'Carol Davis', total: 6, likes: 8, clarity: 1, facts: 1, arguments: 2, presentation: 1, knowledge: 1 }
        ],
        against: [
            { name: 'David Wilson', total: 8, likes: 18, clarity: 2, facts: 1, arguments: 2, presentation: 2, knowledge: 1 },
            { name: 'Eva Brown', total: 7, likes: 10, clarity: 1, facts: 2, arguments: 1, presentation: 2, knowledge: 1 },
            { name: 'Frank Miller', total: 5, likes: 6, clarity: 1, facts: 1, arguments: 1, presentation: 1, knowledge: 1 }
        ]
    };
    
    displayTeamLeaderboard('for-leaderboard', mockScores.for);
    displayTeamLeaderboard('against-leaderboard', mockScores.against);
}

function displayTeamLeaderboard(containerId, participants) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Sort by total score, then by likes
    participants.sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return b.likes - a.likes;
    });
    
    container.innerHTML = participants.map((participant, index) => {
        const rank = index + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'other';
        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}`;
        
        return `
            <div class="participant-rank ${rankClass}">
                <div class="rank-number">${rankEmoji}</div>
                <div class="participant-info">
                    <div class="participant-name">${participant.name}</div>
                    <div class="participant-details">
                        Clarity: ${participant.clarity}/2 | Facts: ${participant.facts}/2 | 
                        Arguments: ${participant.arguments}/2 | Presentation: ${participant.presentation}/2 | 
                        Knowledge: ${participant.knowledge}/2
                    </div>
                </div>
                <div class="score-info">
                    <div class="total-score">${participant.total}/10</div>
                    <div class="likes-count">👍 ${participant.likes} likes</div>
                </div>
            </div>
        `;
    }).join('');
}

window.backToDashboard = function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '../login.html';
        return;
    }
    
    switch(user.role.name) {
        case 'coordinator':
            window.location.href = '../coordinator-dashboard.html';
            break;
        case 'participant':
            window.location.href = '../participant-dashboard.html';
            break;
        case 'audience':
            window.location.href = '../audience-dashboard.html';
            break;
        default:
            window.location.href = '../home.html';
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    debateId = getDebateId();
    if (!debateId) {
        alert('No debateId found.');
        return;
    }
    
    user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        alert('Please login first.');
        window.location.href = '../login.html';
        return;
    }
    
    await fetchDebateAndScores();
});

// coordinator-debate.js

// Global variables
let socket;
let debateId;
let debateData = {
    status: 'not_started',
    currentSpeaker: null,
    timer: 0,
    timerInterval: null,
    participants: {
        for: [],
        against: []
    },
    scores: {},
    audienceEnabled: false
};

// DOM Elements
const startDebateBtn = document.getElementById('startDebateBtn');
const endDebateBtn = document.getElementById('endDebateBtn');
const nextSpeakerBtn = document.getElementById('nextSpeakerBtn');
const nextSpeakerSelect = document.getElementById('nextSpeakerSelect');
const teamSelect = document.getElementById('teamSelect');
const submitScoreBtn = document.getElementById('submitScoreBtn');
const toggleAudienceBtn = document.getElementById('toggleAudienceBtn');
const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
const timerDisplay = document.getElementById('timer');
const debateStatus = document.getElementById('debateStatus');
const forTeamList = document.getElementById('forTeam');
const againstTeamList = document.getElementById('againstTeam');

// Initialize the page
async function init() {
    // Get debate ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    debateId = urlParams.get('debateId');
    
    if (!debateId) {
        alert('No debate ID provided');
        window.location.href = 'coordinator-dashboard.html';
        return;
    }
    
    // Initialize socket connection
    initSocket();
    
    // Load debate data
    await loadDebateData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Update UI based on debate status
    updateUI();
}

// Initialize socket connection
function initSocket() {
    const token = localStorage.getItem('token');
    socket = io(config.SOCKET_URL, {
        auth: { token }
    });
    
    // Socket event listeners
    socket.on('connect', () => {
        console.log('Connected to WebSocket');
        if (debateId) {
            socket.emit('join-debate', { debateId, role: 'coordinator' });
        }
    });
    
    socket.on('debate-updated', (data) => {
        console.log('Debate updated:', data);
        debateData = { ...debateData, ...data };
        updateUI();
    });
    
    socket.on('participant-joined', (data) => {
        console.log('Participant joined:', data);
        // Update participants list
        if (data.team === 'for') {
            if (!debateData.participants.for.some(p => p.id === data.id)) {
                debateData.participants.for.push(data);
            }
        } else {
            if (!debateData.participants.against.some(p => p.id === data.id)) {
                debateData.participants.against.push(data);
            }
        }
        updateParticipantsList();
    });
    
    // Handle errors
    socket.on('error', (error) => {
        console.error('Socket error:', error);
        alert(`Error: ${error.message || 'An error occurred'}`);
    });
}

// Load debate data from the server
async function loadDebateData() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_BASE_URL}/api/debates/event/${debateId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load debate data');
        }
        
        const data = await response.json();
        debateData = { ...debateData, ...data };
        
        // Update UI with debate data
        document.getElementById('eventTitle').textContent = data.title || 'Debate';
        updateUI();
        
    } catch (error) {
        console.error('Error loading debate data:', error);
        alert('Failed to load debate data. Please try again.');
    }
}

// Set up event listeners
function setupEventListeners() {
    // Start debate
    startDebateBtn.addEventListener('click', startDebate);
    
    // End debate
    endDebateBtn.addEventListener('click', endDebate);
    
    // Next speaker
    nextSpeakerBtn.addEventListener('click', setNextSpeaker);
    
    // Submit score
    submitScoreBtn.addEventListener('click', submitScore);
    
    // Toggle audience reactions
    toggleAudienceBtn.addEventListener('click', toggleAudienceReactions);
    
    // Show leaderboard
    showLeaderboardBtn.addEventListener('click', showLeaderboard);
    
    // Update score inputs when team selection changes
    teamSelect.addEventListener('change', updateScoreInputs);
}

// Start the debate
async function startDebate() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_BASE_URL}/api/debates/${debateId}/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                motion: debateData.motion || 'This house believes...',
                rules: debateData.rules || 'Standard debate rules apply',
                timerPerParticipant: 300 // 5 minutes per speaker
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to start debate');
        }
        
        const data = await response.json();
        debateData = { ...debateData, ...data, status: 'in_progress' };
        updateUI();
        
    } catch (error) {
        console.error('Error starting debate:', error);
        alert('Failed to start debate. Please try again.');
    }
}

// End the debate
async function endDebate() {
    if (!confirm('Are you sure you want to end the debate? This cannot be undone.')) {
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_BASE_URL}/api/debates/${debateId}/end`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to end debate');
        }
        
        debateData.status = 'ended';
        updateUI();
        
    } catch (error) {
        console.error('Error ending debate:', error);
        alert('Failed to end debate. Please try again.');
    }
}

// Set the next speaker
async function setNextSpeaker() {
    const participantId = nextSpeakerSelect.value;
    if (!participantId) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_BASE_URL}/api/debates/${debateId}/next-speaker`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ participantId })
        });
        
        if (!response.ok) {
            throw new Error('Failed to set next speaker');
        }
        
        const data = await response.json();
        debateData.currentSpeaker = data.currentSpeaker;
        debateData.timer = data.timeRemaining || 300; // 5 minutes
        
        // Start the timer
        startTimer();
        updateUI();
        
    } catch (error) {
        console.error('Error setting next speaker:', error);
        alert('Failed to set next speaker. Please try again.');
    }
}

// Submit score for the current speaker
async function submitScore() {
    const team = teamSelect.value;
    const scores = {
        clarity: parseInt(document.getElementById('clarityScore').value) || 0,
        facts: parseInt(document.getElementById('factsScore').value) || 0,
        arguments: parseInt(document.getElementById('argumentsScore').value) || 0,
        presentation: parseInt(document.getElementById('presentationScore').value) || 0,
        knowledge: parseInt(document.getElementById('knowledgeScore').value) || 0
    };
    
    // Validate scores (each between 0 and 2)
    for (const [criteria, score] of Object.entries(scores)) {
        if (score < 0 || score > 2) {
            alert(`Please enter a valid score (0-2) for ${criteria}`);
            return;
        }
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_BASE_URL}/api/debates/${debateId}/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                participantId: debateData.currentSpeaker,
                scores,
                team
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit score');
        }
        
        const data = await response.json();
        debateData.scores = data.scores;
        updateUI();
        
        // Reset score inputs
        document.querySelectorAll('.score-input').forEach(input => {
            input.value = '';
        });
        
        alert('Score submitted successfully!');
        
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score. Please try again.');
    }
}

// Toggle audience reactions
async function toggleAudienceReactions() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${config.API_BASE_URL}/api/debates/${debateId}/toggle-audience`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                enabled: !debateData.audienceEnabled
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to toggle audience reactions');
        }
        
        const data = await response.json();
        debateData.audienceEnabled = data.enabled;
        updateUI();
        
    } catch (error) {
        console.error('Error toggling audience reactions:', error);
        alert('Failed to toggle audience reactions. Please try again.');
    }
}

// Show leaderboard
function showLeaderboard() {
    window.open(`/leaderboard.html?debateId=${debateId}`, '_blank');
}

// Update score inputs based on selected team
function updateScoreInputs() {
    const team = teamSelect.value;
    const inputs = document.querySelectorAll('.score-input');
    
    if (team) {
        inputs.forEach(input => input.disabled = false);
        submitScoreBtn.disabled = false;
    } else {
        inputs.forEach(input => {
            input.disabled = true;
            input.value = '';
        });
        submitScoreBtn.disabled = true;
    }
}

// Update the UI based on the current state
function updateUI() {
    // Update status display
    debateStatus.textContent = formatStatus(debateData.status);
    
    // Update button states
    startDebateBtn.disabled = debateData.status !== 'not_started';
    endDebateBtn.disabled = debateData.status !== 'in_progress';
    nextSpeakerBtn.disabled = debateData.status !== 'in_progress';
    nextSpeakerSelect.disabled = debateData.status !== 'in_progress';
    teamSelect.disabled = debateData.status !== 'in_progress';
    toggleAudienceBtn.disabled = debateData.status !== 'in_progress';
    showLeaderboardBtn.disabled = debateData.status === 'not_started';
    
    // Update audience button text
    toggleAudienceBtn.innerHTML = `<i class="fas fa-users"></i> ${debateData.audienceEnabled ? 'Disable' : 'Enable'} Audience Reactions`;
    
    // Update participants list
    updateParticipantsList();
    
    // Update timer display
    updateTimerDisplay();
}

// Update participants list
function updateParticipantsList() {
    // Clear existing lists
    forTeamList.innerHTML = '<h4>For Team</h4>';
    againstTeamList.innerHTML = '<h4>Against Team</h4>';
    
    // Clear and update next speaker dropdown
    nextSpeakerSelect.innerHTML = '<option value="">Select next speaker</option>';
    
    // Add participants to their respective teams
    debateData.participants.for.forEach(participant => {
        const item = createParticipantItem(participant, 'for');
        forTeamList.appendChild(item);
        addToSpeakerDropdown(participant, 'For');
    });
    
    debateData.participants.against.forEach(participant => {
        const item = createParticipantItem(participant, 'against');
        againstTeamList.appendChild(item);
        addToSpeakerDropdown(participant, 'Against');
    });
    
    // Update team select for scoring
    updateTeamSelect();
}

// Create a participant list item
function createParticipantItem(participant, team) {
    const item = document.createElement('div');
    item.className = 'participant-item';
    
    // Highlight current speaker
    const isCurrentSpeaker = debateData.currentSpeaker === participant.id;
    if (isCurrentSpeaker) {
        item.classList.add('current-speaker');
        item.style.fontWeight = 'bold';
    }
    
    // Participant name and score
    const score = debateData.scores[participant.id] || { total: 0 };
    item.innerHTML = `
        <span>${participant.name} (${participant.email})</span>
        <span>Score: ${score.total || 0}</span>
    `;
    
    return item;
}

// Add participant to the speaker dropdown
function addToSpeakerDropdown(participant, teamPrefix) {
    const option = document.createElement('option');
    option.value = participant.id;
    option.textContent = `${teamPrefix}: ${participant.name}`;
    nextSpeakerSelect.appendChild(option);
}

// Update team select dropdown
function updateTeamSelect() {
    teamSelect.innerHTML = '<option value="">Select team</option>';
    
    if (debateData.participants.for.length > 0) {
        const option = document.createElement('option');
        option.value = 'for';
        option.textContent = 'For Team';
        teamSelect.appendChild(option);
    }
    
    if (debateData.participants.against.length > 0) {
        const option = document.createElement('option');
        option.value = 'against';
        option.textContent = 'Against Team';
        teamSelect.appendChild(option);
    }
}

// Start the timer
function startTimer() {
    // Clear any existing timer
    if (debateData.timerInterval) {
        clearInterval(debateData.timerInterval);
    }
    
    // Update the timer every second
    debateData.timerInterval = setInterval(() => {
        if (debateData.timer > 0) {
            debateData.timer--;
            updateTimerDisplay();
        } else {
            clearInterval(debateData.timerInterval);
            debateData.timerInterval = null;
        }
    }, 1000);
    
    updateTimerDisplay();
}

// Update the timer display
function updateTimerDisplay() {
    const minutes = Math.floor(debateData.timer / 60);
    const seconds = debateData.timer % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // Change color when time is running low
    if (debateData.timer <= 30) {
        timerDisplay.style.color = '#f44336'; // Red
    } else {
        timerDisplay.style.color = ''; // Default
    }
}

// Format status for display
function formatStatus(status) {
    switch (status) {
        case 'not_started': return 'Not Started';
        case 'in_progress': return 'In Progress';
        case 'ended': return 'Ended';
        default: return status;
    }
}

// Initialize the page when DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Quiz management logic for coordinator

let currentQuiz = null;
let currentQuestionIndex = 0;
let quizState = 'waiting'; // waiting, active, finished
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user'));
    
    if (!token || !user) {
        window.location.replace('login.html');
        return;
    }
    
    if (user.role.name !== 'coordinator') {
        window.location.replace('login.html');
        return;
    }
    
    // Initialize socket connection
    initializeSocket();
    
    // Load quiz details
    loadQuizDetails();
});

function initializeSocket() {
    // Load Socket.IO client library dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.onload = () => {
        socket = io(config.SOCKET_URL);
        
        socket.on('connect', () => {
            console.log('Connected to server');
        });
        
        socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });
        
        socket.on('error', (data) => {
            showError(data.message);
        });
    };
    document.head.appendChild(script);
}

async function loadQuizDetails() {
    const token = localStorage.getItem('token');
    const quizId = localStorage.getItem('createdQuizId');
    
    if (!quizId) {
        showError('Quiz ID not found. Please create a quiz first.');
        return;
    }
    
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.QUIZZES.GET(quizId)), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch quiz details');
        }
        
        currentQuiz = await response.json();
        displayQuizDetails();
        displayQuestionsPreview();
        updateQuizProgress();
        
    } catch (error) {
        console.error('Error loading quiz:', error);
        showError('Failed to load quiz details.');
    }
}

function displayQuizDetails() {
    if (!currentQuiz) return;
    
    document.getElementById('quizTitle').textContent = currentQuiz.title;
    document.getElementById('quizDescription').textContent = currentQuiz.description || 'No description';
    document.getElementById('quizId').textContent = currentQuiz.quizId;
    document.getElementById('eventTitle').textContent = currentQuiz.event ? currentQuiz.event.title : 'Unknown Event';
    document.getElementById('totalQuestions').textContent = currentQuiz.questions.length;
}

function displayQuestionsPreview() {
    if (!currentQuiz || !currentQuiz.questions) return;
    
    const questionsList = document.getElementById('questionsList');
    questionsList.innerHTML = '';
    
    currentQuiz.questions.forEach((question, index) => {
        const questionDiv = document.createElement('div');
        questionDiv.className = 'question-preview';
        
        const options = question.options.map((option, optIndex) => {
            const isCorrect = optIndex === question.correctOption;
            return `<div class="option ${isCorrect ? 'correct-option' : ''}">
                ${String.fromCharCode(65 + optIndex)}. ${option} ${isCorrect ? '✓' : ''}
            </div>`;
        }).join('');
        
        questionDiv.innerHTML = `
            <div class="question-number">Question ${index + 1}</div>
            <p><strong>${question.text}</strong></p>
            ${options}
            <div class="timer-info">Timer: ${question.timer} seconds</div>
        `;
        
        questionsList.appendChild(questionDiv);
    });
}

function updateQuizProgress() {
    document.getElementById('currentQuestion').textContent = currentQuestionIndex + 1;
    document.getElementById('totalQuestions').textContent = currentQuiz.questions.length;
}

function updateQuizState(newState) {
    quizState = newState;
    const statusIndicator = document.getElementById('statusIndicator');
    const startBtn = document.getElementById('startQuizBtn');
    const nextBtn = document.getElementById('nextQuestionBtn');
    const leaderboardBtn = document.getElementById('showLeaderboardBtn');
    
    switch (newState) {
        case 'waiting':
            statusIndicator.className = 'status-indicator status-waiting';
            statusIndicator.innerHTML = '<i class="fas fa-clock"></i> Quiz Status: Waiting to Start';
            startBtn.disabled = false;
            nextBtn.disabled = true;
            leaderboardBtn.disabled = true;
            break;
        case 'active':
            statusIndicator.className = 'status-indicator status-active';
            statusIndicator.innerHTML = '<i class="fas fa-play"></i> Quiz Status: Active';
            startBtn.disabled = true;
            nextBtn.disabled = false;
            leaderboardBtn.disabled = true;
            break;
        case 'finished':
            statusIndicator.className = 'status-indicator status-finished';
            statusIndicator.innerHTML = '<i class="fas fa-check"></i> Quiz Status: Finished';
            startBtn.disabled = true;
            nextBtn.disabled = true;
            leaderboardBtn.disabled = false;
            break;
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

function showSuccess(message) {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    document.getElementById('errorMessage').style.display = 'none';
}

async function startQuiz() {
    if (!currentQuiz || !socket) {
        showError('No quiz loaded or socket not connected.');
        return;
    }
    
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        // Emit socket event to start quiz
        socket.emit('start-quiz', {
            quizId: currentQuiz._id,
            userId: user.id
        });
        
        // Update local state
        updateQuizState('active');
        currentQuestionIndex = 0;
        updateQuizProgress();
        showSuccess('Quiz started! Participants can now begin.');
        
    } catch (error) {
        console.error('Error starting quiz:', error);
        showError('Failed to start quiz.');
    }
}

async function nextQuestion() {
    if (!currentQuiz || !socket) {
        showError('No quiz loaded or socket not connected.');
        return;
    }
    
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        
        // Emit socket event to advance question
        socket.emit('next-question', {
            quizId: currentQuiz._id,
            userId: user.id
        });
        
        currentQuestionIndex++;
        
        if (currentQuestionIndex >= currentQuiz.questions.length) {
            // Quiz finished
            updateQuizState('finished');
            showSuccess('Quiz completed! You can now show the leaderboard.');
        } else {
            updateQuizProgress();
            showSuccess(`Moved to question ${currentQuestionIndex + 1}`);
        }
        
    } catch (error) {
        console.error('Error advancing question:', error);
        showError('Failed to advance question.');
    }
}

async function showLeaderboard() {
    if (!currentQuiz || !socket) {
        showError('No quiz loaded or socket not connected.');
        return;
    }
    
    try {
        // Emit socket event to show leaderboard
        socket.emit('show-leaderboard', {
            quizId: currentQuiz._id
        });
        
        showSuccess('Leaderboard request sent to all participants.');
        
    } catch (error) {
        console.error('Error showing leaderboard:', error);
        showError('Failed to load leaderboard.');
    }
}

// Initialize quiz state
updateQuizState('waiting'); 
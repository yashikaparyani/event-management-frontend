// Participant real-time quiz logic

let socket = null;
let quizId = null;
let eventId = null;
let userId = null;
let currentQuestionIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let selectedOption = null;
let quizStarted = false;

// On page load
window.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    eventId = localStorage.getItem('currentEventId');
    userId = user ? (user.id || user._id) : null;
    
    if (!user || !eventId) {
        window.location.replace('participant-dashboard.html');
        return;
    }
    
    // Fetch quiz for this event
    fetchQuizForEvent();
});

async function fetchQuizForEvent() {
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.QUIZZES.BY_EVENT(eventId)), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (!response.ok) throw new Error('No quiz found for this event.');
        const quizzes = await response.json();
        if (!quizzes.length) throw new Error('No quiz found for this event.');
        quizId = quizzes[0]._id;
        initializeSocket();
    } catch (error) {
        showError(error.message || 'No quiz found for this event.');
    }
}

function initializeSocket() {
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.onload = () => {
        socket = io(config.SOCKET_URL);
        
        socket.on('connect', () => {
            // Join quiz session
            socket.emit('join-quiz', { quizId, userId, eventId });
        });
        
        socket.on('quiz-joined', (data) => {
            // Waiting room
            showWaitingRoom();
        });
        
        socket.on('quiz-started', (data) => {
            quizStarted = true;
            showQuizBlock();
        });
        
        socket.on('current-question', (data) => {
            showQuizBlock();
            displayQuestion(data);
        });
        
        socket.on('quiz-finished', () => {
            showLeaderboardBlock();
        });
        
        socket.on('leaderboard', (data) => {
            showLeaderboardBlock();
            displayLeaderboard(data.leaderboard);
        });
        
        socket.on('answer-submitted', (data) => {
            showAnswerFeedback(data.isCorrect);
        });
        
        socket.on('error', (data) => {
            showError(data.message);
        });
    };
    document.head.appendChild(script);
}

function showWaitingRoom() {
    document.getElementById('waitingRoom').style.display = '';
    document.getElementById('quizBlock').style.display = 'none';
    document.getElementById('leaderboardBlock').style.display = 'none';
}

function showQuizBlock() {
    document.getElementById('waitingRoom').style.display = 'none';
    document.getElementById('quizBlock').style.display = '';
    document.getElementById('leaderboardBlock').style.display = 'none';
    document.getElementById('answerFeedback').innerHTML = '';
    document.getElementById('submitAnswerBtn').disabled = true;
    selectedOption = null;
}

function showLeaderboardBlock() {
    document.getElementById('waitingRoom').style.display = 'none';
    document.getElementById('quizBlock').style.display = 'none';
    document.getElementById('leaderboardBlock').style.display = '';
}

function displayQuestion(data) {
    currentQuestionIndex = data.questionIndex;
    document.getElementById('questionText').textContent = data.question;
    const optionsList = document.getElementById('optionsList');
    optionsList.innerHTML = '';
    data.options.forEach((option, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = String.fromCharCode(65 + idx) + '. ' + option;
        btn.onclick = () => selectOption(idx, btn);
        optionsList.appendChild(btn);
    });
    // Timer
    timeLeft = data.timer;
    updateTimerDisplay();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            submitAnswer();
        }
    }, 1000);
    // Enable submit button only after option selected
    document.getElementById('submitAnswerBtn').onclick = submitAnswer;
    document.getElementById('submitAnswerBtn').disabled = true;
}

function selectOption(idx, btn) {
    selectedOption = idx;
    document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('submitAnswerBtn').disabled = false;
}

function updateTimerDisplay() {
    document.getElementById('timer').textContent = timeLeft;
}

function submitAnswer() {
    if (!quizStarted || selectedOption === null) return;
    document.getElementById('submitAnswerBtn').disabled = true;
    if (timerInterval) clearInterval(timerInterval);
    // Emit answer to server
    socket.emit('submit-answer', {
        quizId,
        userId,
        questionIndex: currentQuestionIndex,
        selectedOption,
        timeTaken: timeLeft
    });
}

function showAnswerFeedback(isCorrect) {
    const feedback = document.getElementById('answerFeedback');
    feedback.innerHTML = isCorrect ? '<span class="success-message">Correct!</span>' : '<span class="error-message">Incorrect.</span>';
    setTimeout(() => { feedback.innerHTML = ''; }, 2000);
}

function displayLeaderboard(leaderboard) {
    const tbody = document.getElementById('leaderboardBody');
    tbody.innerHTML = '';
    leaderboard.forEach((entry, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${idx + 1}</td><td>${entry.name}</td><td>${entry.correctAnswers}</td><td>${entry.totalAnswered}</td><td>${entry.accuracy}</td><td>${entry.totalTime}</td>`;
        tbody.appendChild(tr);
    });
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
} 
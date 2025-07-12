// Quiz creation and editing logic

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
    
    // Load event info
    const eventId = localStorage.getItem('currentEventId');
    const eventTitle = localStorage.getItem('currentEventTitle');
    
    if (!eventId || !eventTitle) {
        showError('Event information not found. Please go back to dashboard.');
        return;
    }
    
    document.getElementById('eventTitle').textContent = eventTitle;
    
    // Add first question by default
    addQuestion();
    
    // Handle form submission
    document.getElementById('quizForm').addEventListener('submit', handleQuizSubmission);
});

let questionCounter = 0;

function addQuestion() {
    questionCounter++;
    const questionsContainer = document.getElementById('questionsContainer');
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'question-container';
    questionDiv.id = `question-${questionCounter}`;
    
    questionDiv.innerHTML = `
        <div class="question-header">
            <h3>Question ${questionCounter}</h3>
            <button type="button" class="btn-remove-question" onclick="removeQuestion(${questionCounter})">
                <i class="fas fa-trash"></i> Remove
            </button>
        </div>
        <div class="form-group">
            <label for="question-${questionCounter}-text">Question Text</label>
            <input type="text" id="question-${questionCounter}-text" name="question-${questionCounter}-text" required placeholder="Enter your question">
        </div>
        <div class="option-group">
            <label>Options:</label>
            <input type="text" id="question-${questionCounter}-option-0" name="question-${questionCounter}-option-0" required placeholder="Option A">
            <input type="text" id="question-${questionCounter}-option-1" name="question-${questionCounter}-option-1" required placeholder="Option B">
            <input type="text" id="question-${questionCounter}-option-2" name="question-${questionCounter}-option-2" required placeholder="Option C">
            <input type="text" id="question-${questionCounter}-option-3" name="question-${questionCounter}-option-3" required placeholder="Option D">
        </div>
        <div class="option-group">
            <label>Correct Option:</label>
            <label><input type="radio" name="question-${questionCounter}-correct" value="0" required> Option A</label>
            <label><input type="radio" name="question-${questionCounter}-correct" value="1" required> Option B</label>
            <label><input type="radio" name="question-${questionCounter}-correct" value="2" required> Option C</label>
            <label><input type="radio" name="question-${questionCounter}-correct" value="3" required> Option D</label>
        </div>
        <div class="form-group">
            <label for="question-${questionCounter}-timer">Timer (seconds)</label>
            <input type="number" id="question-${questionCounter}-timer" name="question-${questionCounter}-timer" required min="10" max="300" value="30">
        </div>
    `;
    
    questionsContainer.appendChild(questionDiv);
}

function removeQuestion(questionNumber) {
    const questionElement = document.getElementById(`question-${questionNumber}`);
    if (questionElement) {
        questionElement.remove();
        // Renumber remaining questions
        renumberQuestions();
    }
}

function renumberQuestions() {
    const questions = document.querySelectorAll('.question-container');
    questions.forEach((question, index) => {
        const questionNumber = index + 1;
        question.id = `question-${questionNumber}`;
        question.querySelector('h3').textContent = `Question ${questionNumber}`;
        
        // Update all input IDs and names
        const inputs = question.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            const oldName = input.name;
            if (oldName) {
                const newName = oldName.replace(/question-\d+/, `question-${questionNumber}`);
                input.name = newName;
                input.id = newName;
            }
        });
        
        // Update radio button names
        const radios = question.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.name = `question-${questionNumber}-correct`;
        });
        
        // Update remove button onclick
        const removeBtn = question.querySelector('.btn-remove-question');
        if (removeBtn) {
            removeBtn.onclick = () => removeQuestion(questionNumber);
        }
    });
    questionCounter = questions.length;
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

async function handleQuizSubmission(e) {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    const eventId = localStorage.getItem('currentEventId');
    
    // Collect form data
    const quizData = {
        title: document.getElementById('quizTitle').value,
        description: document.getElementById('quizDescription').value,
        eventId: eventId,
        questions: []
    };
    
    // Collect questions
    const questions = document.querySelectorAll('.question-container');
    if (questions.length === 0) {
        showError('At least one question is required.');
        return;
    }
    
    for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        const questionNumber = i + 1;
        
        const questionText = document.getElementById(`question-${questionNumber}-text`).value;
        const options = [
            document.getElementById(`question-${questionNumber}-option-0`).value,
            document.getElementById(`question-${questionNumber}-option-1`).value,
            document.getElementById(`question-${questionNumber}-option-2`).value,
            document.getElementById(`question-${questionNumber}-option-3`).value
        ];
        const correctOption = document.querySelector(`input[name="question-${questionNumber}-correct"]:checked`);
        const timer = document.getElementById(`question-${questionNumber}-timer`).value;
        
        if (!questionText || options.some(opt => !opt) || !correctOption || !timer) {
            showError(`Please complete all fields for Question ${questionNumber}.`);
            return;
        }
        
        quizData.questions.push({
            text: questionText,
            options: options,
            correctOption: parseInt(correctOption.value),
            timer: parseInt(timer)
        });
    }
    
    try {
        const response = await fetch(getApiUrl(config.ENDPOINTS.QUIZZES.CREATE), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(quizData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess(`Quiz created successfully! Quiz ID: ${result.quiz.quizId}`);
            // Store quiz info for management page
            localStorage.setItem('createdQuizId', result.quiz.id);
            localStorage.setItem('createdQuizTitle', result.quiz.title);
            
            // Redirect to quiz management page after 2 seconds
            setTimeout(() => {
                window.location.href = 'coordinator-quiz-management.html';
            }, 2000);
        } else {
            showError(result.message || 'Failed to create quiz.');
        }
    } catch (error) {
        console.error('Error creating quiz:', error);
        showError('An error occurred while creating the quiz.');
    }
} 
// =============================================
// Event Management System - Participant Interface
// =============================================

'use strict';

// =============================================
// Utility Functions
// =============================================

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} unsafe - The string to escape
 * @returns {string} Escaped HTML string
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Gets authentication data from localStorage
 * @returns {Object} Object containing token and user info
 */
function getAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return { token, user };
}

/**
 * Gets the current event ID from URL parameters or localStorage
 * @returns {string} The event ID
 */
function getEventId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('eventId') || localStorage.getItem('currentEventId');
}

// =============================================
// Application State
// =============================================

const state = {
    problems: [],
    currentProblem: null,
    editor: null,
    currentLanguage: 'python', // Default language
    testCases: [],
    eventControls: {
        isActive: true,
        submissionsLocked: false,
        leaderboardVisible: true
    }
};

// =============================================
// Event Controls Functions
// =============================================

/**
 * Fetches event controls
 */
async function fetchEventControls() {
    const eventId = getEventId();
    if (!eventId) return;

    try {
        const { token } = getAuth();
        const response = await fetch(`/api/speedcode/event-controls/${eventId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch event controls');
        }

        state.eventControls = await response.json();
        updateEventStatusUI();
    } catch (error) {
        console.error('Error fetching event controls:', error);
        showToast('Failed to load event controls', 'error');
    }
}

/**
 * Updates UI based on event status
 */
function updateEventStatusUI() {
    if (!elements.eventTimer) return;

    if (!state.eventControls.isActive) {
        elements.eventTimer.textContent = 'Event is not active';
        elements.eventTimer.className = 'event-status inactive';
        return;
    }

    if (state.eventControls.submissionsLocked) {
        elements.eventTimer.textContent = 'Submissions are locked';
        elements.eventTimer.className = 'event-status locked';
        return;
    }

    // Update timer if event is active
    updateEventTimer();
}

/**
 * Updates event timer
 */
function updateEventTimer() {
    if (!elements.eventTimer || !state.eventControls.endTime) return;

    const now = new Date();
    const endTime = new Date(state.eventControls.endTime);
    const timeLeft = Math.max(0, endTime - now);

    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    elements.eventTimer.textContent = 
        `${hours.toString().padStart(2, '0')}:${
        minutes.toString().padStart(2, '0')}:${
        seconds.toString().padStart(2, '0')}`;

    // Schedule next update
    setTimeout(updateEventTimer, 1000);
}

// =============================================
// DOM Elements
// =============================================

const elements = {
    problemsList: document.getElementById('problems-list'),
    problemView: document.getElementById('problem-view'),
    problemTitle: document.getElementById('problem-title'),
    problemDescription: document.getElementById('problem-description'),
    codeEditor: document.getElementById('code-editor'),
    runCodeBtn: document.getElementById('run-code'),
    submitCodeBtn: document.getElementById('submit-code'),
    backButton: document.getElementById('back-to-problems'),
    searchInput: document.getElementById('search-problems'),
    difficultyFilter: document.getElementById('difficulty-filter')
};

// =============================================
// UI Functions
// =============================================

/**
 * Shows a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of notification (success, error, info)
 * @param {number} duration - How long to show the toast in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container') || 
        document.createElement('div');
        
    if (!toastContainer.id) {
        toastContainer.id = 'toast-container';
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after duration
    setTimeout(() => {
        toast.classList.add('toast-fade-out');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Shows a loading spinner
 * @param {boolean} show - Whether to show or hide the spinner
 */
function showSpinner(show = true) {
    const spinner = document.getElementById('loading-spinner') || 
        document.createElement('div');
        
    if (!spinner.id) {
        spinner.id = 'loading-spinner';
        spinner.className = 'spinner';
        document.body.appendChild(spinner);
    }

    spinner.style.display = show ? 'flex' : 'none';
}

// =============================================
// Code Editor Functions
// =============================================

/**
 * Initializes the code editor
 */
function initCodeEditor() {
    if (!elements.codeEditor) {
        throw new Error('Code editor element not found');
    }

    state.editor = CodeMirror.fromTextArea(elements.codeEditor, {
        mode: 'python',
        theme: 'default',
        lineNumbers: true,
        indentUnit: 4,
        lineWrapping: true,
        autoCloseBrackets: true,
        matchBrackets: true,
        extraKeys: {
            'Ctrl-Enter': runTestCases,
            'Cmd-Enter': runTestCases
        }
    });

    // Set initial code template
    updateCodeTemplate();
}

/**
 * Updates the code template based on selected language
 */
function updateCodeTemplate() {
    if (!state.editor) return;

    const templates = {
        python: 'def solve(input):\n    # Your code here\n    pass',
        javascript: 'function solve(input) {\n    // Your code here\n    return input;\n}',
        java: 'public class Solution {\n    public static Object solve(Object input) {\n        // Your code here\n        return input;\n    }\n}'
    };

    state.editor.setValue(templates[state.currentLanguage] || '');
}

// =============================================
// Problem Management
// =============================================

/**
 * Fetches all problems for the current event
 */
async function fetchProblems() {
    const eventId = getEventId();
    if (!eventId) {
        showToast('No event selected', 'error');
        return;
    }

    showSpinner(true);

    try {
        const { token } = getAuth();
        const response = await fetch(`/api/events/${eventId}/problems`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch problems');
        }

        state.problems = await response.json();
        renderProblemsList();
    } catch (error) {
        console.error('Error fetching problems:', error);
        showToast('Failed to load problems', 'error');
    } finally {
        showSpinner(false);
    }
}

/**
 * Renders the list of problems
 */
function renderProblemsList() {
    if (!elements.problemsList) return;

    if (!state.problems.length) {
        elements.problemsList.innerHTML = `
            <div class="alert alert-info">
                No problems available for this event.
            </div>`;
        return;
    }

    elements.problemsList.innerHTML = state.problems.map(problem => `
        <div class="problem-card" data-problem-id="${problem._id}">
            <h3>${escapeHtml(problem.title)} 
                <span class="difficulty-badge difficulty-${problem.difficulty}">
                    ${problem.difficulty}
                </span>
            </h3>
            <div class="problem-meta">
                <span><i class="far fa-clock"></i> ${problem.timeLimit || 1}s</span>
                <span><i class="fas fa-memory"></i> ${problem.memoryLimit || 256}MB</span>
                <span><i class="fas fa-tag"></i> ${problem.tags ? escapeHtml(problem.tags.join(', ')) : 'No tags'}</span>
            </div>
            <p>${escapeHtml(problem.description.substring(0, 150))}${problem.description.length > 150 ? '...' : ''}</p>
            <div class="problem-actions">
                <button class="btn btn-sm btn-solve" data-problem-id="${problem._id}">
                    <i class="fas fa-code"></i> Solve Problem
                </button>
                ${problem.solved ? 
                    '<span class="solved-badge"><i class="fas fa-check-circle"></i> Solved</span>' : 
                    ''}
            </div>
        </div>
    `).join('');

    // Add event listeners to solve buttons
    document.querySelectorAll('.btn-solve').forEach(button => {
        button.addEventListener('click', () => viewProblem(button.dataset.problemId));
    });
}

// =============================================
// Event Handlers
// =============================================

/**
 * Handles viewing a specific problem
 * @param {string} problemId - The ID of the problem to view
 */
function viewProblem(problemId) {
    state.currentProblem = state.problems.find(p => p._id === problemId);
    if (!state.currentProblem) {
        showToast('Problem not found', 'error');
        return;
    }

    // Update UI
    elements.problemTitle.textContent = state.currentProblem.title;
    elements.problemDescription.innerHTML = state.currentProblem.description;
    
    // Show problem view and hide list
    document.getElementById('problems-section').style.display = 'none';
    elements.problemView.style.display = 'block';
    
    // Load submission history
    loadSubmissionHistory(problemId);
    
    // Update code template if needed
    updateCodeTemplate();
}

/**
 * Loads submission history for a problem
 * @param {string} problemId - The ID of the problem
 */
async function loadSubmissionHistory(problemId) {
    const submissionHistory = document.getElementById('submission-history');
    if (!submissionHistory) return;

    showSpinner(true);

    try {
        const { token } = getAuth();
        const response = await fetch(`/api/problems/${problemId}/submissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load submission history');
        }

        const submissions = await response.json();
        renderSubmissionHistory(submissions);
    } catch (error) {
        console.error('Error loading submission history:', error);
        showToast('Failed to load submission history', 'error');
        submissionHistory.innerHTML = '<p class="error">Failed to load submission history</p>';
    } finally {
        showSpinner(false);
    }
}

/**
 * Renders the submission history
 * @param {Array} submissions - Array of submission objects
 */
function renderSubmissionHistory(submissions) {
    const submissionHistory = document.getElementById('submission-history');
    if (!submissionHistory) return;

    if (!submissions.length) {
        submissionHistory.innerHTML = `
            <div class="no-submissions">
                <p>No submissions yet</p>
            </div>`;
        return;
    }

    submissionHistory.innerHTML = submissions.map(sub => `
        <div class="submission-item">
            <div class="submission-meta">
                <span class="submission-time">${new Date(sub.submittedAt).toLocaleString()}</span>
                <span class="submission-language">${sub.language}</span>
            </div>
            <div class="submission-status ${sub.status}">
                <i class="fas ${sub.status === 'passed' ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span>${sub.status === 'passed' ? 'Passed' : 'Failed'}</span>
            </div>
            <div class="submission-actions">
                <button class="btn btn-sm" onclick="viewSubmissionCode('${sub._id}')">
                    <i class="fas fa-code"></i> View Code
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Shows a modal to view submission code
 * @param {string} submissionId - The ID of the submission to view
 */
window.viewSubmissionCode = async function(submissionId) {
    const { token } = getAuth();
    
    try {
        const response = await fetch(`/api/submissions/${submissionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load submission');
        }

        const submission = await response.json();
        
        // Create and show modal
        const modal = document.createElement('div');
        modal.className = 'code-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Submission Code</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <pre><code>${escapeHtml(submission.code)}</code></pre>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal on click
        modal.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', () => modal.remove());
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    } catch (error) {
        console.error('Error viewing submission:', error);
        showToast('Failed to load submission', 'error');
    }
}

// =============================================
// Event Handlers
// =============================================

/**
 * Handles viewing a specific problem
 * @param {string} problemId - The ID of the problem to view
 */
function viewProblem(problemId) {
    state.currentProblem = state.problems.find(p => p._id === problemId);
    if (!state.currentProblem) {
        showToast('Problem not found', 'error');
        return;
    }

    // Update UI
    elements.problemTitle.textContent = state.currentProblem.title;
    elements.problemDescription.innerHTML = state.currentProblem.description;
    
    // Show problem view and hide list
    document.getElementById('problems-section').style.display = 'none';
    elements.problemView.style.display = 'block';
    
    // Load submission history
    loadSubmissionHistory(problemId);
    
    // Update code template if needed
    updateCodeTemplate();
}

/**
 * Loads submission history for a problem
 * @param {string} problemId - The ID of the problem
 */
async function loadSubmissionHistory(problemId) {
    const submissionHistory = document.getElementById('submission-history');
    if (!submissionHistory) return;

    showSpinner(true);

    try {
        const { token } = getAuth();
        const response = await fetch(`/api/problems/${problemId}/submissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load submission history');
        }

        const submissions = await response.json();
        renderSubmissionHistory(submissions);
    } catch (error) {
        console.error('Error loading submission history:', error);
        showToast('Failed to load submission history', 'error');
        submissionHistory.innerHTML = '<p class="error">Failed to load submission history</p>';
    } finally {
        showSpinner(false);
    }
}

/**
 * Renders the submission history
 * @param {Array} submissions - Array of submission objects
 */
function renderSubmissionHistory(submissions) {
    const submissionHistory = document.getElementById('submission-history');
    if (!submissionHistory) return;

    if (!submissions.length) {
        submissionHistory.innerHTML = `
            <div class="no-submissions">
                <p>No submissions yet</p>
            </div>`;
        return;
    }

    submissionHistory.innerHTML = submissions.map(sub => `
        <div class="submission-item">
            <div class="submission-meta">
                <span class="submission-time">${new Date(sub.submittedAt).toLocaleString()}</span>
                <span class="submission-language">${sub.language}</span>
            </div>
            <div class="submission-status ${sub.status}">
                <i class="fas ${sub.status === 'passed' ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                <span>${sub.status === 'passed' ? 'Passed' : 'Failed'}</span>
            </div>
            <div class="submission-actions">
                <button class="btn btn-sm" onclick="viewSubmissionCode('${sub._id}')">
                    <i class="fas fa-code"></i> View Code
                </button>
            </div>
        </div>
    `).join('');
}

/**
 * Shows a modal to view submission code
 * @param {string} submissionId - The ID of the submission to view
 */
window.viewSubmissionCode = async function(submissionId) {
    const { token } = getAuth();
    
    try {
        const response = await fetch(`/api/submissions/${submissionId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to load submission');
        }

        const submission = await response.json();
        
        // Create and show modal
        const modal = document.createElement('div');
        modal.className = 'code-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Submission Code</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <pre><code>${escapeHtml(submission.code)}</code></pre>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary modal-close">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal on click
        modal.querySelectorAll('.modal-close').forEach(button => {
            button.addEventListener('click', () => modal.remove());
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    } catch (error) {
        console.error('Error viewing submission:', error);
        showToast('Failed to load submission', 'error');
    }
}

/**
 * Handles running test cases
 */
async function runTestCases() {
    if (!state.currentProblem || !state.editor) return;

    showSpinner(true);
    const code = state.editor.getValue();

    try {
        // Implementation for running test cases
        showToast('Running test cases...', 'info');
        
        const { token } = getAuth();
        const response = await fetch(`/api/problems/${state.currentProblem._id}/test`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                language: state.currentLanguage
            })
        });

        if (!response.ok) {
            throw new Error('Failed to run test cases');
        }

        const result = await response.json();
        
        // Update UI with results
        if (elements.submissionResult) {
            elements.submissionResult.innerHTML = `
                <div class="test-results">
                    <h4>Test Results</h4>
                    ${result.passed ? 
                        `<div class="test-passed">All tests passed!</div>` : 
                        `<div class="test-failed">${result.failedCount} of ${result.totalCount} tests failed</div>`
                    }
                    ${result.message ? `<div class="test-message">${escapeHtml(result.message)}</div>` : ''}
                </div>`;
        }
        
        showToast(result.passed ? 'All tests passed!' : 'Some tests failed', 
                result.passed ? 'success' : 'error');
    } catch (error) {
        console.error('Error running test cases:', error);
        showToast('Failed to run test cases', 'error');
    } finally {
        showSpinner(false);
    }
}

/**
 * Handles code submission
 */
async function submitCode() {
    if (!state.currentProblem || !state.editor) return;

    showSpinner(true);
    const code = state.editor.getValue();

    try {
        // Implementation for code submission
        showToast('Submitting solution...', 'info');
        
        const { token } = getAuth();
        const response = await fetch(`/api/problems/${state.currentProblem._id}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code,
                language: state.currentLanguage
            })
        });

        if (!response.ok) {
            throw new Error('Failed to submit solution');
        }

        const result = await response.json();
        
        // Update UI with submission result
        if (elements.submissionStatus) {
            elements.submissionStatus.innerHTML = `
                <div class="submission-result ${result.passed ? 'success' : 'error'}">
                    <h4>${result.passed ? 'Submission Successful!' : 'Submission Failed'}</h4>
                    <p>${result.message || ''}</p>
                    ${result.score !== undefined ? `<p>Score: ${result.score}%</p>` : ''}
                </div>`;
        }
        
        showToast(result.passed ? 'Solution submitted successfully!' : 'Submission failed', 
                result.passed ? 'success' : 'error');
    } catch (error) {
        console.error('Error submitting code:', error);
        showToast('Failed to submit solution', 'error');
    } finally {
        showSpinner(false);
    }
}

/**
 * Goes back to the problems list
 */
function backToProblems() {
    document.getElementById('problems-section').style.display = 'block';
    elements.problemView.style.display = 'none';
}

// =============================================
// Initialization
// =============================================

/**
 * Initializes the application
 */
function init() {
    // Check if required elements exist
    if (!elements.problemsList || !elements.problemView) {
        console.error('Required DOM elements not found');
        return;
    }

    try {
        // Initialize code editor
        initCodeEditor();

        // Set up event listeners
        if (elements.runCodeBtn) elements.runCodeBtn.addEventListener('click', runTestCases);
        if (elements.submitCodeBtn) elements.submitCodeBtn.addEventListener('click', submitCode);
        if (elements.backButton) elements.backButton.addEventListener('click', backToProblems);
        if (elements.searchInput) {
            elements.searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredProblems = state.problems.filter(problem => {
                    const titleMatch = problem.title.toLowerCase().includes(searchTerm);
                    const descriptionMatch = problem.description.toLowerCase().includes(searchTerm);
                    const tagsMatch = problem.tags?.some(tag => 
                        tag.toLowerCase().includes(searchTerm)
                    );
                    return titleMatch || descriptionMatch || tagsMatch;
                });
                renderProblemsList(filteredProblems);
            });
        }

        // Load problems
        fetchProblems();

        // Fetch event controls
        fetchEventControls();

    } catch (error) {
        console.error('Error initializing application:', error);
        showToast('Failed to initialize application. Please refresh the page.', 'error');
    }
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
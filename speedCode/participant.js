// Utility to get token and user
function getAuth() {
    return {
        token: localStorage.getItem('token'),
        user: JSON.parse(localStorage.getItem('user'))
    };
}

// Get eventId from query parameter or storage
function getEventId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('eventId') || localStorage.getItem('currentSpeedCodeEventId');
}

// State
let problems = [];
let currentProblem = null;
let editor = null;
let eventControls = {
    isActive: true,
    submissionsLocked: false,
    leaderboardVisible: true
};

// DOM Elements
const problemsSection = document.getElementById('problems-section');
const problemView = document.getElementById('problem-view');
const problemsList = document.getElementById('problems-list');
const problemTitle = document.getElementById('problem-title');
const problemStatement = document.getElementById('problem-statement');
const problemConstraints = document.getElementById('problem-constraints');
const problemExamples = document.getElementById('problem-examples');
const submissionHistory = document.getElementById('submission-history');
const languageSelector = document.getElementById('language-selector');
const runCodeBtn = document.getElementById('run-code');
const submitCodeBtn = document.getElementById('submit-code');
const runTestCaseBtn = document.getElementById('run-test-case');
const addTestCaseBtn = document.getElementById('add-test-case');
const testCasesList = document.getElementById('test-cases-list');
const submissionResult = document.getElementById('submission-result');
const resultDetails = document.getElementById('result-details');
const submissionStatusBadge = document.getElementById('submission-status-badge');
const eventTimer = document.getElementById('event-timer');
const submissionStatus = document.getElementById('submission-status');
const problemSearch = document.getElementById('problem-search');
const difficultyFilter = document.getElementById('difficulty-filter');

// Initialize CodeMirror editor
function initCodeEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById('editor'), {
        mode: 'javascript',
        theme: 'monokai',
        lineNumbers: true,
        lineWrapping: true,
        indentUnit: 4,
        tabSize: 4,
        autoCloseBrackets: true,
        matchBrackets: true,
        extraKeys: {
            'Ctrl-Enter': submitCode,
            'Cmd-Enter': submitCode,
            'Ctrl-Space': 'autocomplete'
        }
    });

    // Set default code template based on language
    languageSelector.addEventListener('change', updateCodeTemplate);
    
    // Set initial mode
    updateEditorMode('javascript');
}

// Update editor mode based on selected language
function updateEditorMode(language) {
    let mode;
    switch(language) {
        case 'python':
            mode = 'python';
            break;
        case 'java':
        case 'cpp':
            mode = 'text/x-c++src';
            break;
        case 'javascript':
        default:
            mode = 'javascript';
    }
    editor.setOption('mode', mode);
}

// Update code template based on selected language
function updateCodeTemplate() {
    const language = languageSelector.value;
    updateEditorMode(language);
    
    let template = '';
    switch(language) {
        case 'python':
            template = `def solve(input):
    # Your solution here
    return input`;
            break;
        case 'java':
            template = `public class Solution {
    public static void main(String[] args) {
        // Read input
        // Scanner scanner = new Scanner(System.in);
        // String input = scanner.nextLine();
        
        // Call solution
        // String result = solve(input);
        
        // Output result
        // System.out.println(result);
    }
    
    public static String solve(String input) {
        // Your solution here
        return input;
    }
}`;
            break;
        case 'cpp':
            template = `#include <iostream>
#include <string>

using namespace std;

string solve(string input) {
    // Your solution here
    return input;
}

int main() {
    string input;
    // Read input
    // getline(cin, input);
    
    // Call solution
    // string result = solve(input);
    
    // Output result
    // cout << result << endl;
    
    return 0;
}`;
            break;
        case 'javascript':
        default:
            template = `function solve(input) {
    // Your solution here
    return input;
}`;
    }
    
    editor.setValue(template);
}

// Show loading spinner
function showSpinner(show = true) {
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = show ? 'flex' : 'none';
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button class="toast-close">&times;</button>
    `;
    
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => toast.remove();
    
    toastContainer.appendChild(toast);
    
    if (duration > 0) {
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    return toast;
}

// Fetch and display all problems for this event
async function fetchProblems() {
    const { token, user } = getAuth();
    const eventId = getEventId();
    
    if (!eventId) {
        showToast('Event ID not found', 'error');
        return;
    }
    
    showSpinner(true);
    
    try {
        // First, check if user is registered for this event
        const eventRes = await fetch(`/api/events/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!eventRes.ok) {
            const error = await eventRes.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to fetch event details');
        }
        
        const event = await eventRes.json();
        const isRegistered = event.registeredParticipants && 
                            event.registeredParticipants.includes(user.id);
        
        if (!isRegistered) {
            // Show registration prompt
            if (confirm('You need to register for this event first. Would you like to register now?')) {
                // Register the user
                const registerRes = await fetch(`/api/events/${eventId}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ email: user.email })
                });
                
                if (!registerRes.ok) {
                    const error = await registerRes.json().catch(() => ({}));
                    throw new Error(error.message || 'Failed to register for event');
                }
                
                showToast('Successfully registered for the event!', 'success');
            } else {
                // If user chooses not to register, redirect to events page
                window.location.href = '/events.html';
                return;
            }
        }
        
        // Fetch problems if registered
        const res = await fetch(`/api/speedcode/problems/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Failed to fetch problems');
        }
        
        problems = await res.json();
        renderProblemsList();
        
        // Also fetch event controls
        await fetchEventControls();
    } catch (err) {
        showToast(err.message, 'error');
        console.error('Error:', err);
        // Redirect to events page on error
        setTimeout(() => window.location.href = '/events.html', 2000);
    } finally {
        showSpinner(false);
    }
}

// Render problems list
function renderProblemsList() {
    if (problems.length === 0) {
        problemsList.innerHTML = '<p>No problems available yet.</p>';
        return;
    }
    
    const searchTerm = problemSearch.value.toLowerCase();
    const difficulty = difficultyFilter.value;
    
    const filteredProblems = problems.filter(problem => {
        const matchesSearch = problem.title.toLowerCase().includes(searchTerm) || 
                            problem.description.toLowerCase().includes(searchTerm);
        const matchesDifficulty = !difficulty || problem.difficulty === difficulty;
        return matchesSearch && matchesDifficulty;
    });
    
    if (filteredProblems.length === 0) {
        problemsList.innerHTML = '<p>No problems match your search criteria.</p>';
        return;
    }
    
    problemsList.innerHTML = filteredProblems.map((problem, idx) => `
        <div class="problem-card">
            <h3>${problem.title} <span class="difficulty-badge difficulty-${problem.difficulty}">${problem.difficulty}</span></h3>
            <div class="problem-meta">
                <span><i class="far fa-clock"></i> ${problem.timeLimit || 1}s</span>
                <span><i class="fas fa-memory"></i> ${problem.memoryLimit || 256}MB</span>
                <span><i class="fas fa-tag"></i> ${problem.tags ? problem.tags.join(', ') : 'No tags'}</span>
            </div>
            <p>${problem.description.substring(0, 150)}${problem.description.length > 150 ? '...' : ''}</p>
            <div class="problem-actions">
                <button class="btn btn-sm" onclick="viewProblem('${problem._id}')">
                    <i class="fas fa-code"></i> Solve Problem
                </button>
                <span class="solved-badge" style="display: ${problem.solved ? 'inline-block' : 'none'}">
                    <i class="fas fa-check-circle"></i> Solved
                </span>
            </div>
        </div>
    `).join('');
}

// View a single problem
window.viewProblem = function(problemId) {
    currentProblem = problems.find(p => p._id === problemId);
    if (!currentProblem) {
        showToast('Problem not found', 'error');
        return;
    }
    
    // Update UI
    problemTitle.textContent = currentProblem.title;
    problemStatement.innerHTML = marked.parse(currentProblem.description || 'No description provided.');
    
    // Set difficulty badge
    const difficultyBadge = document.getElementById('problem-difficulty');
    difficultyBadge.textContent = currentProblem.difficulty;
    difficultyBadge.className = `difficulty-badge difficulty-${currentProblem.difficulty}`;
    
    // Render examples
    renderExamples();
    
    // Load submission history
    loadSubmissionHistory(problemId);
    
    // Update code template based on selected language
    updateCodeTemplate();
    
    // Show problem view
    problemsSection.style.display = 'none';
    problemView.style.display = 'block';
    
    // Initialize test cases
    initTestCases();
    
    // Reset submission result
    submissionResult.style.display = 'none';
};

// Render problem examples
function renderExamples() {
    if (!currentProblem.examples || currentProblem.examples.length === 0) {
        problemExamples.innerHTML = '<p>No examples provided.</p>';
        return;
    }
    
    problemExamples.innerHTML = currentProblem.examples.map((example, idx) => `
        <div class="example">
            <h4>Example ${idx + 1}</h4>
            <div class="example-io">
                <div class="io-group">
                    <span class="io-label">Input:</span>
                    <pre>${example.input}</pre>
                </div>
                <div class="io-group">
                    <span class="io-label">Output:</span>
                    <pre>${example.output}</pre>
                </div>
                ${example.explanation ? `
                <div class="io-group">
                    <span class="io-label">Explanation:</span>
                    <p>${example.explanation}</p>
                </div>` : ''}
            </div>
        </div>
    `).join('');
}

// Initialize test cases
function initTestCases() {
    testCasesList.innerHTML = '';
    
    // Add sample test cases if any
    if (currentProblem.sampleInput && currentProblem.sampleOutput) {
        addTestCase(currentProblem.sampleInput, currentProblem.sampleOutput, true);
    }
    
    // Add a default empty test case
    addTestCase('', '', false);
}

// Add a test case
function addTestCase(input = '', expected = '', isSample = false) {
    const testCaseId = `test-case-${Date.now()}`;
    const testCase = document.createElement('div');
    testCase.className = 'test-case';
    testCase.id = testCaseId;
    testCase.innerHTML = `
        <div class="test-case-header">
            <span class="test-case-title">${isSample ? 'Sample Test Case' : 'Test Case'}</span>
            <button class="test-case-delete" onclick="document.getElementById('${testCaseId}').remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="test-case-input">
            <label class="test-case-label">Input:</label>
            <div class="test-case-value" contenteditable="true">${input}</div>
        </div>
        <div class="test-case-expected">
            <label class="test-case-label">Expected Output:</label>
            <div class="test-case-value" contenteditable="true">${expected}</div>
        </div>
    `;
    testCasesList.appendChild(testCase);
    return testCase;
}

// Run test cases
async function runTestCases() {
    if (!currentProblem) return;
    
    const testCases = Array.from(testCasesList.children).map(testCaseEl => {
        const inputEl = testCaseEl.querySelector('.test-case-input .test-case-value');
        const expectedEl = testCaseEl.querySelector('.test-case-expected .test-case-value');
        return {
            input: inputEl.textContent.trim(),
            expected: expectedEl.textContent.trim()
        };
    }).filter(tc => tc.input || tc.expected);
    
    if (testCases.length === 0) {
        showToast('Please add at least one test case', 'warning');
        return;
    }
    
    showSpinner(true);
    submissionResult.style.display = 'block';
    submissionStatusBadge.textContent = 'Running';
    submissionStatusBadge.className = 'status-badge status-pending';
    resultDetails.innerHTML = 'Running test cases...';
    
    try {
        const { token } = getAuth();
        const code = editor.getValue();
        const language = languageSelector.value;
        
        // Run each test case
        let allPassed = true;
        const results = [];
        
        for (const [index, testCase] of testCases.entries()) {
            const res = await fetch('/api/speedcode/run', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    problemId: currentProblem._id,
                    code,
                    language,
                    input: testCase.input,
                    expectedOutput: testCase.expected
                })
            });
            
            const data = await res.json();
            const passed = data.passed;
            allPassed = allPassed && passed;
            
            results.push({
                input: testCase.input,
                expected: testCase.expected,
                output: data.output,
                error: data.error,
                passed,
                executionTime: data.executionTime
            });
        }
        
        // Display results
        if (allPassed) {
            submissionStatusBadge.textContent = 'All Test Cases Passed';
            submissionStatusBadge.className = 'status-badge status-success';
            showToast('All test cases passed!', 'success');
        } else {
            submissionStatusBadge.textContent = 'Some Test Cases Failed';
            submissionStatusBadge.className = 'status-badge status-error';
        }
        
        // Render detailed results
        resultDetails.innerHTML = results.map((result, idx) => `
            <div class="test-result ${result.passed ? 'passed' : 'failed'}">
                <h4>Test Case ${idx + 1}: ${result.passed ? '✓ Passed' : '✗ Failed'}</h4>
                <div class="test-details">
                    <div class="test-detail">
                        <span class="detail-label">Input:</span>
                        <pre>${result.input || 'No input'}</pre>
                    </div>
                    <div class="test-detail">
                        <span class="detail-label">Expected Output:</span>
                        <pre>${result.expected || 'No expected output'}</pre>
                    </div>
                    ${result.error ? `
                    <div class="test-detail">
                        <span class="detail-label">Error:</span>
                        <pre class="error">${result.error}</pre>
                    </div>` : ''}
                    <div class="test-detail">
                        <span class="detail-label">Your Output:</span>
                        <pre>${result.output || 'No output'}</pre>
                    </div>
                    <div class="test-detail">
                        <span class="detail-label">Execution Time:</span>
                        <span>${result.executionTime || 'N/A'} ms</span>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (err) {
        console.error('Error running test cases:', err);
        submissionStatusBadge.textContent = 'Error';
        submissionStatusBadge.className = 'status-badge status-error';
        resultDetails.innerHTML = `An error occurred while running test cases: ${err.message}`;
        showToast('Error running test cases', 'error');
    } finally {
        showSpinner(false);
    }
}

// Submit code
async function submitCode() {
    if (!currentProblem || !editor) {
        showToast('No problem selected', 'error');
        return;
    }
    
    if (eventControls.submissionsLocked) {
        showToast('Submissions are locked for this event', 'error');
        return;
    }
    
    const code = editor.getValue().trim();
    if (!code) {
        showToast('Please write some code before submitting', 'warning');
        return;
    }
    
    const { token } = getAuth();
    const language = languageSelector.value;
    
    showSpinner(true);
    submissionResult.style.display = 'block';
    submissionStatusBadge.textContent = 'Submitting...';
    submissionStatusBadge.className = 'status-badge status-pending';
    resultDetails.innerHTML = 'Submitting your solution...';
    
    try {
        const res = await fetch(`/api/speedcode/submit/${currentProblem._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                code,
                language
            })
        });
        
        if (!res.ok) {
            const error = await res.json().catch(() => ({}));
            throw new Error(error.message || 'Submission failed');
        }
        
        const data = await res.json();
        
        // Update UI with submission result
        if (data.passed) {
            submissionStatusBadge.textContent = 'Accepted';
            submissionStatusBadge.className = 'status-badge status-success';
            showToast('Submission accepted!', 'success');
        } else {
            submissionStatusBadge.textContent = 'Wrong Answer';
            submissionStatusBadge.className = 'status-badge status-error';
        }
        
        // Show detailed results
        resultDetails.innerHTML = `
            <div class="submission-summary">
                <div class="summary-item">
                    <span class="summary-label">Status:</span>
                    <span class="summary-value">${data.passed ? 'Accepted' : 'Wrong Answer'}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Score:</span>
                    <span class="summary-value">${data.score || 0} / 100</span>
                </div>
                ${data.executionTime ? `
                <div class="summary-item">
                    <span class="summary-label">Time:</span>
                    <span class="summary-value">${data.executionTime} ms</span>
                </div>` : ''}
                ${data.memoryUsed ? `
                <div class="summary-item">
                    <span class="summary-label">Memory:</span>
                    <span class="summary-value">${data.memoryUsed} KB</span>
                </div>` : ''}
            </div>
        `;
        
        // Show test case results if available
        if (data.testCaseResults && data.testCaseResults.length > 0) {
            resultDetails.innerHTML += `
                <h4>Test Case Results:</h4>
                <div class="test-results">
                    ${data.testCaseResults.map((testCase, idx) => `
                        <div class="test-result ${testCase.passed ? 'passed' : 'failed'}">
                            <h5>Test Case ${idx + 1}: ${testCase.passed ? '✓ Passed' : '✗ Failed'}</h5>
                            <div class="test-details">
                                <div class="test-detail">
                                    <span class="detail-label">Input:</span>
                                    <pre>${testCase.input || 'No input'}</pre>
                                </div>
                                ${testCase.expected ? `
                                <div class="test-detail">
                                    <span class="detail-label">Expected Output:</span>
                                    <pre>${testCase.expected}</pre>
                                </div>` : ''}
                                ${testCase.error ? `
                                <div class="test-detail">
                                    <span class="detail-label">Error:</span>
                                    <pre class="error">${testCase.error}</pre>
                                </div>` : ''}
                                <div class="test-detail">
                                    <span class="detail-label">Your Output:</span>
                                    <pre>${testCase.actualOutput || 'No output'}</pre>
                                </div>
                                ${testCase.executionTime ? `
                                <div class="test-detail">
                                    <span class="detail-label">Execution Time:</span>
                                    <span>${testCase.executionTime} ms</span>
                                </div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Reload submission history
        loadSubmissionHistory(currentProblem._id);
        
    } catch (err) {
        console.error('Error submitting code:', err);
        submissionStatusBadge.textContent = 'Error';
        submissionStatusBadge.className = 'status-badge status-error';
        resultDetails.innerHTML = `An error occurred: ${err.message}`;
        showToast('Submission failed', 'error');
    } finally {
        showSpinner(false);
    }
}

// Load submission history for a problem
async function loadSubmissionHistory(problemId) {
    const { token } = getAuth();
    const historyTab = document.querySelector('.tab-pane#submissions');
    
    try {
        const res = await fetch(`/api/speedcode/submissions?problemId=${problemId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            throw new Error('Failed to load submission history');
        }
        
        const submissions = await res.json();
        
        if (submissions.length === 0) {
            submissionHistory.innerHTML = '<p>No submissions yet.</p>';
            return;
        }
        
        submissionHistory.innerHTML = `
            <div class="submissions-list">
                ${submissions.map(sub => `
                    <div class="submission-item ${sub.passed ? 'passed' : 'failed'}">
                        <div class="submission-header">
                            <span class="submission-time">${new Date(sub.submittedAt).toLocaleString()}</span>
                            <span class="submission-status">${sub.passed ? '✓ Accepted' : '✗ Wrong Answer'}</span>
                            <span class="submission-score">Score: ${sub.score || 0}</span>
                        </div>
                        <div class="submission-details">
                            <div class="detail">
                                <span class="label">Language:</span>
                                <span class="value">${sub.language}</span>
                            </div>
                            ${sub.executionTime ? `
                            <div class="detail">
                                <span class="label">Time:</span>
                                <span class="value">${sub.executionTime} ms</span>
                            </div>` : ''}
                            ${sub.memoryUsed ? `
                            <div class="detail">
                                <span class="label">Memory:</span>
                                <span class="value">${sub.memoryUsed} KB</span>
                            </div>` : ''}
                        </div>
                        <button class="btn btn-sm" onclick="viewSubmissionCode('${sub._id}')">
                            <i class="fas fa-code"></i> View Code
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
        
    } catch (err) {
        console.error('Error loading submission history:', err);
        submissionHistory.innerHTML = `<p class="error">Error loading submission history: ${err.message}</p>`;
    }
}

// View submission code
window.viewSubmissionCode = async function(submissionId) {
    const { token } = getAuth();
    
    try {
        const res = await fetch(`/api/speedcode/submissions/${submissionId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            throw new Error('Failed to load submission');
        }
        
        const submission = await res.json();
        
        // Show code in a modal or alert
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Submission Code</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <pre><code>${submission.code}</code></pre>
                </div>
                <div class="modal-footer">
                    <button class="btn" onclick="this.closest('.modal').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
    } catch (err) {
        console.error('Error viewing submission:', err);
        showToast('Failed to load submission', 'error');
    }
};

// Fetch event controls
async function fetchEventControls() {
    const eventId = getEventId();
    if (!eventId) return;
    
    const { token } = getAuth();
    
    try {
        const res = await fetch(`/api/speedcode/event-controls/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            eventControls = await res.json();
            updateEventStatusUI();
        }
    } catch (err) {
        console.error('Error fetching event controls:', err);
    }
}

// Update UI based on event status
function updateEventStatusUI() {
    // Update submission status
    const statusText = eventControls.submissionsLocked ? 'Submissions Locked' : 'Submissions Open';
    const statusIcon = eventControls.submissionsLocked ? 'fa-lock' : 'fa-lock-open';
    submissionStatus.innerHTML = `<i class="fas ${statusIcon}"></i> ${statusText}`;
    
    // Disable submit button if submissions are locked
    submitCodeBtn.disabled = eventControls.submissionsLocked;
    
    // Update event timer if available
    if (eventControls.endTime) {
        updateEventTimer(new Date(eventControls.endTime));
    }
}

// Update event timer
function updateEventTimer(endTime) {
    const timerElement = document.getElementById('event-timer');
    
    function update() {
        const now = new Date();
        const diff = endTime - now;
        
        if (diff <= 0) {
            timerElement.innerHTML = '<i class="fas fa-hourglass-end"></i> Event Ended';
            return;
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        timerElement.innerHTML = `<i class="fas fa-clock"></i> ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    update();
    const timer = setInterval(update, 1000);
    
    // Store timer ID to clear it later if needed
    window.eventTimer = timer;
}

// Back to problems list
function backToProblems() {
    problemView.style.display = 'none';
    problemsSection.style.display = 'block';
    currentProblem = null;
    
    // Clear any existing timer
    if (window.eventTimer) {
        clearInterval(window.eventTimer);
    }
}

// Initialize the application
function init() {
    // Initialize code editor
    initCodeEditor();
    
    // Set up event listeners
    document.getElementById('back-to-problems').addEventListener('click', backToProblems);
    runCodeBtn.addEventListener('click', runTestCases);
    submitCodeBtn.addEventListener('click', submitCode);
    addTestCaseBtn.addEventListener('click', () => addTestCase('', '', false));
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabId = e.target.getAttribute('data-tab');
            
            // Update active tab
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Show corresponding tab content
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
            
            // Load submission history if needed
            if (tabId === 'submissions' && currentProblem) {
                loadSubmissionHistory(currentProblem._id);
            }
        });
    });
    
    // Search and filter
    problemSearch.addEventListener('input', renderProblemsList);
    difficultyFilter.addEventListener('change', renderProblemsList);
    
    // Check authentication
    const { token, user } = getAuth();
    if (!token || !user) {
        window.location.href = '/login.html';
        return;
    }
    
    // Load problems
    fetchProblems();
}

// Start the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
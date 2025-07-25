// Configuration for API URLs
const config = {
    // API Base URL - will be different for development and production
    API_BASE_URL: 'https://event-management-backend-z0ty.onrender.com',
    
    // Socket.IO URL
    SOCKET_URL: 'https://event-management-backend-z0ty.onrender.com',
    
    // API Endpoints
    ENDPOINTS: {
        AUTH: {
            LOGIN: '/api/auth/login',
            REGISTER: '/api/auth/register',
            PENDING_USERS: '/api/auth/pending-users'
        },
        DASHBOARD: {
            STATS: '/api/dashboard/stats'
        },
        USERS: {
            LIST: '/api/users',
            APPROVE: (userId) => `/api/approve-user/${userId}`,
            STATUS: (userId) => `/api/users/${userId}/status`,
            DELETE: (userId) => `/api/users/${userId}`,
            UPDATE: (userId) => `/api/users/${userId}`
        },
        ROLES: {
            LIST: '/api/roles',
            UPDATE: (roleId) => `/api/roles/${roleId}`,
            DELETE: (roleId) => `/api/roles/${roleId}`
        },
        PERMISSIONS: {
            LIST: '/api/permissions'
        },
        EVENTS: {
            LIST: '/api/events',
            CREATE: '/api/events',
            UPDATE: (eventId) => `/api/events/${eventId}`,
            DELETE: (eventId) => `/api/events/${eventId}`,
            UPCOMING: '/api/events/upcoming',
            REGISTERED: '/api/events/registered',
            REGISTER: (eventId) => `/api/events/${eventId}/register`
        },
        QUIZZES: {
            CREATE: '/api/quizzes',
            GET: (quizId) => `/api/quizzes/${quizId}`,
            UPDATE: (quizId) => `/api/quizzes/${quizId}`,
            BY_EVENT: (eventId) => `/api/quizzes/event/${eventId}`,
            BY_COORDINATOR: '/api/quizzes/coordinator/quizzes'
        },
        POETRY: {
            TOPICS: (eventId) => `/api/poetry/${eventId}/topics`,
            DELETE_TOPIC: (eventId, topicId) => `/api/poetry/${eventId}/topics/${topicId}`,
            SUBMISSIONS: (eventId) => `/api/poetry/${eventId}/submissions`,
            SUBMIT: (eventId) => `/api/poetry/${eventId}/submit`
        }
    }
};

// Helper function to get full API URL
function getApiUrl(endpoint) {
    return config.API_BASE_URL + endpoint;
}

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}
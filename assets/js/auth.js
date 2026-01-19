// =============================================
// AUTHENTICATION SYSTEM FOR SALES OPS
// =============================================

// Check if user is logged in
function isLoggedIn() {
    const session = localStorage.getItem('salesAppSession')
    if (!session) return false

    try {
        const sessionData = JSON.parse(session)
        return sessionData && sessionData.userId && sessionData.role
    } catch (e) {
        return false
    }
}

// Get current session
function getCurrentSession() {
    const session = localStorage.getItem('salesAppSession')
    if (!session) return null

    try {
        return JSON.parse(session)
    } catch (e) {
        return null
    }
}

// Logout function
async function logout() {
    // Logout from Supabase if available
    if (typeof logoutFromSupabase === 'function') {
        try {
            await logoutFromSupabase()
        } catch (err) {
            console.error('Supabase logout error:', err)
        }
    }

    // Clear local session
    localStorage.removeItem('salesAppSession')

    // Redirect to login (works from both user/ and admin/ folders)
    const currentPath = window.location.pathname
    if (currentPath.includes('/user/') || currentPath.includes('/admin/')) {
        window.location.href = '../index.html'
    } else {
        window.location.href = 'index.html'
    }
}

// Check authentication and redirect if needed
function requireAuth(requiredRole = null) {
    if (!isLoggedIn()) {
        window.location.href = '/index.html'
        return false
    }

    const session = getCurrentSession()

    // Check role if specified
    if (requiredRole && session.role !== requiredRole) {
        window.location.href = '/index.html'
        return false
    }

    return true
}

// Redirect to appropriate dashboard based on role
function redirectToDashboard() {
    const session = getCurrentSession()
    if (!session) {
        window.location.href = '/index.html'
        return
    }

    if (session.role === 'admin') {
        window.location.href = '/admin/dashboard.html'
    } else {
        window.location.href = '/user/dashboard.html'
    }
}

// Initialize auth check on page load (for protected pages)
function initAuthCheck(requiredRole = null) {
    if (!requireAuth(requiredRole)) {
        return false
    }

    // Set user info in UI if available
    const session = getCurrentSession()
    if (session) {
        const userNameElements = document.querySelectorAll('.user-name')
        const userEmailElements = document.querySelectorAll('.user-email')

        userNameElements.forEach(el => el.textContent = session.name || session.email)
        userEmailElements.forEach(el => el.textContent = session.email)
    }

    return true
}

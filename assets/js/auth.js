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
async function logout(forced = false) {
    // Only clean up DB token on a voluntary logout (not forced kicks)
    if (!forced && typeof logoutFromSupabase === 'function') {
        try {
            await logoutFromSupabase()
        } catch (err) {
            console.error('Supabase logout error:', err)
        }
    }

    // Stop any running session watcher
    if (window._sessionWatcherInterval) {
        clearInterval(window._sessionWatcherInterval)
        window._sessionWatcherInterval = null
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
        const currentPath = window.location.pathname
        if (currentPath.includes('/user/') || currentPath.includes('/admin/')) {
            window.location.href = '../index.html'
        } else {
            window.location.href = 'index.html'
        }
        return false
    }

    const session = getCurrentSession()

    // Check role if specified
    if (requiredRole && session.role !== requiredRole) {
        const currentPath = window.location.pathname
        if (currentPath.includes('/user/') || currentPath.includes('/admin/')) {
            window.location.href = '../index.html'
        } else {
            window.location.href = 'index.html'
        }
        return false
    }

    return true
}

// Redirect to appropriate dashboard based on role
function redirectToDashboard() {
    const session = getCurrentSession()
    if (!session) {
        window.location.href = 'index.html'
        return
    }

    if (session.role === 'admin') {
        window.location.href = 'admin/dashboard.html'
    } else {
        window.location.href = 'user/dashboard.html'
    }
}

// ── Single-Session Watcher ──────────────────────────────────────────
// Shows a full-screen overlay and redirects when another login is detected
function showSessionKickedOverlay() {
    // Prevent double-showing
    if (document.getElementById('session-kicked-overlay')) return

    const overlay = document.createElement('div')
    overlay.id = 'session-kicked-overlay'
    overlay.innerHTML = `
        <div style="
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(15,23,42,0.92);
            display: flex; align-items: center; justify-content: center;
            font-family: 'Inter', sans-serif;
        ">
            <div style="
                background: #fff; border-radius: 16px; padding: 40px 36px;
                max-width: 420px; width: 90%; text-align: center;
                box-shadow: 0 25px 60px rgba(0,0,0,0.35);
            ">
                <div style="
                    width: 64px; height: 64px; border-radius: 50%;
                    background: #fee2e2; color: #ef4444;
                    font-size: 28px; display: flex; align-items: center;
                    justify-content: center; margin: 0 auto 20px;
                ">⚠️</div>
                <h4 style="margin: 0 0 10px; color: #111827; font-size: 20px; font-weight: 700;">
                    Session Ended
                </h4>
                <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                    You have been logged in on another device or browser.<br>
                    For security, you have been signed out here.
                </p>
                <p style="color: #9ca3af; font-size: 13px; margin: 0 0 20px;">
                    Redirecting to login...
                </p>
                <div style="
                    height: 4px; background: #f3f4f6; border-radius: 4px; overflow: hidden;
                ">
                    <div id="session-kick-progress" style="
                        height: 100%; background: #ef4444; border-radius: 4px;
                        width: 0%; transition: width 3s linear;
                    "></div>
                </div>
            </div>
        </div>`
    document.body.appendChild(overlay)

    // Animate progress bar
    requestAnimationFrame(() => {
        const bar = document.getElementById('session-kick-progress')
        if (bar) bar.style.width = '100%'
    })
}

async function startSessionWatcher() {
    const session = getCurrentSession()
    if (!session || !session.sessionToken) return  // old session without token — skip

    // Stop any existing watcher
    if (window._sessionWatcherInterval) {
        clearInterval(window._sessionWatcherInterval)
    }

    const check = async () => {
        const current = getCurrentSession()
        if (!current) return  // already logged out

        const isValid = await validateSessionToken(current.userId, current.sessionToken)
        if (!isValid) {
            // Stop watcher immediately
            clearInterval(window._sessionWatcherInterval)
            window._sessionWatcherInterval = null

            // Clear local session WITHOUT touching DB (the new session owns DB now)
            localStorage.removeItem('salesAppSession')

            // Show the kicked overlay
            showSessionKickedOverlay()

            // Redirect after 3 seconds
            setTimeout(() => {
                const path = window.location.pathname
                if (path.includes('/user/') || path.includes('/admin/')) {
                    window.location.href = '../index.html'
                } else {
                    window.location.href = 'index.html'
                }
            }, 3000)
        }
    }

    // First check after 5 seconds, then every 30 seconds
    setTimeout(check, 5000)
    window._sessionWatcherInterval = setInterval(check, 30000)
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

    // Start single-session enforcement watcher
    startSessionWatcher()

    return true
}

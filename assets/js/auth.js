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

    // Close BroadcastChannel if open
    if (window._sessionChannel) {
        window._sessionChannel.close()
        window._sessionChannel = null
    }

    // Clear local session
    localStorage.removeItem('salesAppSession')

    // Redirect to login
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

// ── Session Kicked Overlay ──────────────────────────────────────────
function showSessionKickedOverlay() {
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
                    You have been signed in on another tab or device.<br>
                    For security, you have been signed out here.
                </p>
                <p style="color: #9ca3af; font-size: 13px; margin: 0 0 20px;">
                    Redirecting to login...
                </p>
                <div style="height: 4px; background: #f3f4f6; border-radius: 4px; overflow: hidden;">
                    <div id="session-kick-progress" style="
                        height: 100%; background: #ef4444; border-radius: 4px;
                        width: 0%; transition: width 3s linear;
                    "></div>
                </div>
            </div>
        </div>`
    document.body.appendChild(overlay)

    requestAnimationFrame(() => {
        const bar = document.getElementById('session-kick-progress')
        if (bar) bar.style.width = '100%'
    })
}

function _doKick() {
    // Stop all watchers
    if (window._sessionWatcherInterval) {
        clearInterval(window._sessionWatcherInterval)
        window._sessionWatcherInterval = null
    }

    // Tell all other tabs to die immediately before closing our channel
    if (window._sessionChannel) {
        window._sessionChannel.postMessage({ type: 'KICK_ALL' })
        window._sessionChannel.close()
        window._sessionChannel = null
    }

    // Clear local session WITHOUT touching DB (new session owns it)
    localStorage.removeItem('salesAppSession')

    showSessionKickedOverlay()

    setTimeout(() => {
        const path = window.location.pathname
        if (path.includes('/user/') || path.includes('/admin/')) {
            window.location.href = '../index.html'
        } else {
            window.location.href = 'index.html'
        }
    }, 3000)
}

// ── Session Watcher ─────────────────────────────────────────────────
// Handles BOTH same-browser tabs (BroadcastChannel) AND
// cross-browser/device (user_metadata polling)
function startSessionWatcher() {
    const session = getCurrentSession()
    if (!session) return

    // ── 1. Strict One-Tab-Per-Browser Enforcement ──────────────
    // Generate a unique ID for this specific page load in memory.
    // Unlike sessionStorage, this survives "Duplicate Tab" without cloning.
    const pageInstanceId = crypto.randomUUID()
    const pageLoadTime = Date.now()

    if (window._sessionChannel) {
        window._sessionChannel.close()
    }

    const channel = new BroadcastChannel('sales_ops_single_session')
    window._sessionChannel = channel

    // Listen for other tabs announcing their session
    channel.onmessage = (event) => {
        const msg = event.data

        // If another tab was killed by the server poll, kill this one too
        if (msg.type === 'KICK_ALL') {
            _doKick()
            return
        }

        // If another tab claims the session...
        if (msg.type === 'CLAIM_SESSION' && msg.userId === session.userId) {

            // Check if it's a completely different login session token
            if (msg.sessionToken && msg.sessionToken !== session.sessionToken) {
                _doKick()
                return
            }

            // If it's the exact same session but a DIFFERENT browser tab (pageInstanceId differs),
            // we enforce "Last Tab Wins". The older tab kills itself.
            if (msg.pageInstanceId !== pageInstanceId) {
                if (msg.time > pageLoadTime) {
                    _doKick() // We are older, so we die.
                } else if (msg.time === pageLoadTime && msg.pageInstanceId > pageInstanceId) {
                    _doKick() // Tie-breaker.
                }
            }
        }
    }

    // Broadcast that THIS tab is now the active one
    if (session.sessionToken) {
        channel.postMessage({
            type: 'CLAIM_SESSION',
            userId: session.userId,
            sessionToken: session.sessionToken,
            pageInstanceId: pageInstanceId,
            time: pageLoadTime
        })
    }

    // ── 3. Polling — cross-browser/device enforcement ───────────────
    // Only poll if we have a sessionToken (i.e. user logged in fresh
    // after the single-session feature was deployed)
    if (!session.sessionToken) return

    if (window._sessionWatcherInterval) {
        clearInterval(window._sessionWatcherInterval)
    }

    const checkRemote = async () => {
        const current = getCurrentSession()
        if (!current) return  // already logged out

        const isValid = await validateSessionToken(current.userId, current.sessionToken)
        if (!isValid) {
            _doKick()
        }
    }

    // First remote check after 10 seconds, then every 30 seconds
    setTimeout(checkRemote, 10000)
    window._sessionWatcherInterval = setInterval(checkRemote, 30000)
}

// Initialize auth check on page load (for protected pages)
function initAuthCheck(requiredRole = null) {
    if (!requireAuth(requiredRole)) {
        return false
    }

    const session = getCurrentSession()
    if (session) {
        document.querySelectorAll('.user-name').forEach(el => el.textContent = session.name || session.email)
        document.querySelectorAll('.user-email').forEach(el => el.textContent = session.email)
    }

    // Start single-session enforcement
    startSessionWatcher()

    return true
}

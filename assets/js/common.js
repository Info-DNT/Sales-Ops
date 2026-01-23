// =============================================
// COMMON UTILITIES AND SHARED FUNCTIONS
// =============================================

// Format date
function formatDate(date) {
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Format time
function formatTime(date) {
  const d = new Date(date)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Get current date string (YYYY-MM-DD)
function getCurrentDateString() {
  return new Date().toISOString().split('T')[0]
}

// Storage helpers (kept for backwards compatibility, but now using Supabase)
function getUserData(userId) {
  const key = `userData_${userId}`
  const data = localStorage.getItem(key)
  return data ? JSON.parse(data) : {
    attendance: [],
    workReports: [],
    quotations: [],
    leads: [],
    userDetails: {}
  }
}

function saveUserData(userId, data) {
  const key = `userData_${userId}`
  localStorage.setItem(key, JSON.stringify(data))
}

// Generate user sidebar navigation
function generateUserNav(currentPage) {
  const navItems = [
    { page: 'dashboard', icon: 'fa-home', label: 'Home' },
    { page: 'attendance', icon: 'fa-clock', label: 'Attendance' },
    { page: 'user-details', icon: 'fa-user', label: 'User Details' },
    { page: 'work-report', icon: 'fa-chart-bar', label: 'Work Report' },
    {
      page: 'leads',
      icon: 'fa-bullseye',
      label: 'Leads',
      hasDropdown: true,
      dropdownItems: [
        { page: 'calls', icon: 'fa-phone', label: 'Calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings' }
      ]
    },
    { page: 'settings', icon: 'fa-cog', label: 'Settings' }
  ]

  return `
    <!-- Mobile hamburger button -->
    <button class="mobile-menu-toggle" onclick="toggleMobileMenu()" aria-label="Toggle menu">
      <i class="fas fa-bars"></i>
    </button>
    
    <!-- Mobile overlay -->
    <div class="mobile-overlay" onclick="closeMobileMenu()"></div>
    
    <nav class="sidebar">
      <div class="sidebar-header">
        <h4 class="text-white mb-4">Sales Ops</h4>
        <p class="text-white-50 small mb-0 user-name"></p>
      </div>
      <ul class="nav-menu">
        ${navItems.map(item => {
    if (item.hasDropdown) {
      const isActive = currentPage === item.page || item.dropdownItems.some(sub => sub.page === currentPage);
      return `
              <li class="nav-item-dropdown">
                <a href="${item.page}.html" class="nav-link ${currentPage === item.page ? 'active' : ''}">
                  <i class="fas ${item.icon}"></i> ${item.label}
                </a>
                <div class="nav-dropdown">
                  ${item.dropdownItems.map(subItem => `
                    <a href="${subItem.page}.html" class="nav-dropdown-link ${currentPage === subItem.page ? 'active' : ''}">
                      <i class="fas ${subItem.icon}"></i> ${subItem.label}
                    </a>
                  `).join('')}
                </div>
              </li>
            `;
    } else {
      return `
              <li>
                <a href="${item.page}.html" class="nav-link ${currentPage === item.page ? 'active' : ''}">
                  <i class="fas ${item.icon}"></i> ${item.label}
                </a>
              </li>
            `;
    }
  }).join('')}
        <li>
          <a href="#" onclick="logout(); return false;" class="nav-link">
            <i class="fas fa-sign-out-alt"></i> Logout
          </a>
        </li>
      </ul>
    </nav>
  `
}

// Generate admin sidebar navigation
function generateAdminNav(currentPage) {
  const navItems = [
    { page: 'dashboard', icon: 'fa-tachometer-alt', label: 'Dashboard' },
    { page: 'users', icon: 'fa-users', label: 'Users' },
    { page: 'attendance', icon: 'fa-clock', label: 'Attendance' },
    {
      page: 'leads',
      icon: 'fa-bullseye',
      label: 'Leads',
      hasDropdown: true,
      dropdownItems: [
        { page: 'calls', icon: 'fa-phone', label: 'Calls' },
        { page: 'meetings', icon: 'fa-video', label: 'Meetings' }
      ]
    },
    { page: 'quotations', icon: 'fa-file-invoice-dollar', label: 'Quotations' },
    { page: 'reports', icon: 'fa-chart-line', label: 'Reports' },
    { page: 'settings', icon: 'fa-cog', label: 'Settings' }
  ]

  return `
    <!-- Mobile hamburger button -->
    <button class="mobile-menu-toggle" onclick="toggleMobileMenu()" aria-label="Toggle menu">
      <i class="fas fa-bars"></i>
    </button>
    
    <!-- Mobile overlay -->
    <div class="mobile-overlay" onclick="closeMobileMenu()"></div>
    
    <nav class="sidebar">
      <div class="sidebar-header">
        <h4 class="text-white mb-4">Admin Panel</h4>
        <p class="text-white-50 small mb-0 user-name"></p>
      </div>
      <ul class="nav-menu">
        ${navItems.map(item => {
    if (item.hasDropdown) {
      const isActive = currentPage === item.page || item.dropdownItems.some(sub => sub.page === currentPage);
      return `
              <li class="nav-item-dropdown">
                <a href="${item.page}.html" class="nav-link ${currentPage === item.page ? 'active' : ''}">
                  <i class="fas ${item.icon}"></i> ${item.label}
                </a>
                <div class="nav-dropdown">
                  ${item.dropdownItems.map(subItem => `
                    <a href="${subItem.page}.html" class="nav-dropdown-link ${currentPage === subItem.page ? 'active' : ''}">
                      <i class="fas ${subItem.icon}"></i> ${subItem.label}
                    </a>
                  `).join('')}
                </div>
              </li>
            `;
    } else {
      return `
              <li>
                <a href="${item.page}.html" class="nav-link ${currentPage === item.page ? 'active' : ''}">
                  <i class="fas ${item.icon}"></i> ${item.label}
                </a>
              </li>
            `;
    }
  }).join('')}
        <li>
          <a href="#" onclick="logout(); return false;" class="nav-link">
            <i class="fas fa-sign-out-alt"></i> Logout
          </a>
        </li>
      </ul>
    </nav>
  `
}

// Insert navigation
function insertNav(role, currentPage) {
  const appDiv = document.getElementById('app')
  if (!appDiv) return

  const nav = role === 'admin'
    ? generateAdminNav(currentPage)
    : generateUserNav(currentPage)

  appDiv.insertAdjacentHTML('afterbegin', nav)
}

// Show loading state
function showLoading() {
  const loader = document.createElement('div')
  loader.id = 'loading-overlay'
  loader.className = 'loading-overlay'
  loader.innerHTML = '<div class="spinner-border text-primary" role="status"></div>'
  document.body.appendChild(loader)
}

function hideLoading() {
  const loader = document.getElementById('loading-overlay')
  if (loader) loader.remove()
}

// Show toast notification
function showToast(message, type = 'success') {
  // Remove existing toasts
  const existingToasts = document.querySelectorAll('.toast-notification')
  existingToasts.forEach(t => t.remove())

  const toast = document.createElement('div')
  toast.className = `toast-notification toast-${type}`
  toast.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} me-2"></i>
    ${message}
  `
  document.body.appendChild(toast)

  setTimeout(() => toast.classList.add('show'), 100)
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

// Mobile menu toggle functions
function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar')
  const overlay = document.querySelector('.mobile-overlay')

  if (sidebar && overlay) {
    sidebar.classList.toggle('mobile-active')
    overlay.classList.toggle('active')
    document.body.classList.toggle('menu-open')
  }
}

function closeMobileMenu() {
  const sidebar = document.querySelector('.sidebar')
  const overlay = document.querySelector('.mobile-overlay')

  if (sidebar && overlay) {
    sidebar.classList.remove('mobile-active')
    overlay.classList.remove('active')
    document.body.classList.remove('menu-open')
  }
}

// Close mobile menu when clicking on navigation links (delegated event listener)
document.addEventListener('click', function (e) {
  if (e.target.closest('.nav-link')) {
    closeMobileMenu()
  }
})
